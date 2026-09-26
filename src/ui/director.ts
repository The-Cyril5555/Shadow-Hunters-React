// Metteur en scène : rejoue les actions reçues une par une, avec leurs animations,
// puis applique le nouvel état du plateau. On voit donc toujours ce qui se passe
// avant son résultat, même quand les bots enchaînent vite.
import {
  CHARACTERS, cardDef, cardName, type AreaId, type CardId, type CharacterId, type DeckId, type PlayerView,
  type VisibleEvent,
} from '../engine';
import type { SeatInfo } from '../net/protocol';
import { initialFx, useFx, type Arrow, type Bubble, type Flyer, type FlyerContent, type Overlay, type Pulse, type Tone } from './fx';
import { play, type Sfx } from './sound';
import { useStore } from './store';
import { FACTION_LABEL } from './theme';

export interface Frame {
  view: PlayerView;
  events: VisibleEvent[];
  seats: SeatInfo[];
}

const queue: Frame[] = [];
/** Scène en cours de lecture (déjà retirée de la file, pas encore appliquée). */
let current: Frame | null = null;
let running = false;
let generation = 0;
let nextId = 1;

// ─── Rythme ─────────────────────────────────────────────────

function speedFactor(): number {
  const { settings } = useStore.getState();
  if (settings.reducedMotion) return 0;
  const base = settings.speed === 'slow' ? 1.35 : settings.speed === 'fast' ? 0.6 : 1;
  // En retard sur la partie : on accélère, puis on saute les animations.
  const backlog = queue.length;
  if (backlog > 7) return 0;
  if (backlog > 3) return base * 0.35;
  if (backlog > 1) return base * 0.65;
  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Primitives d'effets ────────────────────────────────────

function el(id: string): boolean {
  return typeof document !== 'undefined' && document.getElementById(id) !== null;
}

/** Élément représentant un joueur : son pion sur le plateau s'il est visible, sinon son tapis. */
function playerEl(p: number): string {
  return el(`token-${p}`) ? `token-${p}` : `mat-${p}`;
}

function setOverlay(o: Overlay | null): void {
  useFx.setState({ overlay: o ? { ...o, key: nextId++ } : null });
}

function caption(text: string): void {
  useFx.setState({ caption: { text, key: nextId++ } });
}

function transient<K extends 'arrows' | 'flyers' | 'bubbles'>(key: K, item: FxItem<K>, ms: number): void {
  useFx.setState((s) => ({ [key]: [...(s[key] as FxItem<K>[]), item] }) as Partial<typeof s>);
  setTimeout(() => {
    useFx.setState((s) => ({ [key]: (s[key] as FxItem<K>[]).filter((x) => x.id !== item.id) }) as Partial<typeof s>);
  }, ms);
}
type FxItem<K> = K extends 'arrows' ? Arrow : K extends 'flyers' ? Flyer : Bubble;

function arrow(from: string, to: string, tone: Tone, f: number): void {
  if (from === to) return;
  transient('arrows', { id: nextId++, from, to, tone }, Math.max(400, 1100 * f));
}

function fly(from: string, to: string, content: FlyerContent, f: number): number {
  const ms = Math.max(250, 650 * f);
  transient('flyers', { id: nextId++, from, to, content, ms }, ms + 80);
  return ms;
}

function bubble(p: number | string, text: string, tone: Bubble['tone']): void {
  const target = typeof p === 'number' ? `mat-${p}` : p;
  transient('bubbles', { id: nextId++, target, text, tone }, 1600);
}

function pulse(players: number[], kind: Pulse, ms: number): void {
  useFx.setState((s) => {
    const pulses = { ...s.pulses };
    for (const p of players) pulses[p] = kind;
    return { pulses };
  });
  setTimeout(() => {
    useFx.setState((s) => {
      const pulses = { ...s.pulses };
      for (const p of players) if (pulses[p] === kind) delete pulses[p];
      return { pulses };
    });
  }, ms);
}

function areaFx(area: AreaId, kind: 'dest' | 'action' | 'boom', ms: number): void {
  useFx.setState((s) => ({ areaFx: { ...s.areaFx, [area]: kind } }));
  setTimeout(() => useFx.setState((s) => {
    const next = { ...s.areaFx };
    if (next[area] === kind) delete next[area];
    return { areaFx: next };
  }), ms);
}

function deckFx(deck: DeckId, kind: 'draw' | 'shuffle', ms: number): void {
  useFx.setState((s) => ({ deckFx: { ...s.deckFx, [deck]: kind } }));
  setTimeout(() => useFx.setState((s) => {
    const next = { ...s.deckFx };
    if (next[deck] === kind) delete next[deck];
    return { deckFx: next };
  }), ms);
}

function sfx(name: Sfx, volume = 0.7): void {
  play(name, volume);
}

// ─── Scénario de chaque événement ───────────────────────────

const CAPTION_ONLY = new Set([
  'skip', 'pass', 'nothing', 'area_none', 'no_target', 'no_effect', 'empty', 'agnes', 'game_start', 'hermit_result',
]);

async function playEvent(e: VisibleEvent, frame: Frame, f: number, gen: number): Promise<void> {
  const d = e.data as Record<string, unknown>;
  const me = useStore.getState().seat;
  const view = useStore.getState().view ?? frame.view;
  const name = (p: unknown) => view.players[p as number]?.name ?? '?';
  const wait = async (ms: number) => {
    if (gen === generation) await sleep(ms * f);
  };
  caption(e.text);

  switch (e.type) {
    case 'turn_start': {
      const p = d.player as number;
      pulse([p], 'turn', 1400 * f);
      sfx('turn_start', p === me ? 0.9 : 0.35);
      setOverlay({ kind: 'banner', tone: p === me ? 'me' : 'turn', text: p === me ? 'À vous de jouer !' : `Au tour de ${name(p)}` });
      await wait(p === me ? 1000 : 700);
      setOverlay(null);
      return;
    }
    case 'dice': {
      const purpose = d.purpose as string;
      const label = purpose === 'move' ? `Déplacement · ${name(d.player)}` : purpose === 'attack' ? `Attaque · ${name(d.player)}`
        : purpose === 'dynamite' ? 'Dynamite !' : `Lancer · ${name(d.player)}`;
      const d6 = d.d6 as number | undefined;
      const d4 = d.d4 as number | undefined;
      let result: string;
      if (purpose === 'move' || purpose === 'dynamite') {
        const sum = d.sum as number;
        result = sum === 7 ? '7 : lieu au choix' : `${sum}`;
      } else if (purpose === 'attack') {
        result = d6 === undefined ? `${d4} dégât${(d4 ?? 0) > 1 ? 's' : ''}` : d6 === d4 ? 'Raté !' : `Écart : ${Math.abs((d6 ?? 0) - (d4 ?? 0))}`;
      } else {
        result = `${d6 ?? d4}`;
      }
      setOverlay({ kind: 'dice', d6, d4, label, result });
      useFx.setState({ rolling: true });
      sfx('dice_roll', 0.6);
      await wait(480);
      useFx.setState({ rolling: false });
      sfx('dice_land', 0.6);
      await wait(620);
      setOverlay(null);
      return;
    }
    case 'reroll':
      bubble(d.player as number, 'Relance !', 'info');
      await wait(450);
      return;
    case 'move': {
      const area = d.area as AreaId;
      areaFx(area, 'dest', 1500 * Math.max(f, 0.5));
      sfx('move_player', 0.6);
      await wait(350);
      return;
    }
    case 'draw': {
      const p = d.player as number;
      const deck = d.deck as DeckId;
      deckFx(deck, 'draw', 700 * f);
      sfx('card_draw', 0.8);
      if (typeof d.card === 'string') {
        const card = d.card as CardId;
        await wait(fly(`deck-${deck}`, 'fx-stage', { type: 'back', deck }, f) / f);
        setOverlay({ kind: 'card', card, label: p === me ? (deck === 'hermit' ? 'Vous piochez (secret)' : 'Vous piochez') : `${name(p)} pioche` });
        await wait(1250);
        setOverlay(null);
        if (cardDef(card).kind === 'equipment') {
          await wait(fly('fx-stage', `mat-${p}`, { type: 'chip', card }, f) / f);
        }
      } else {
        await wait(fly(`deck-${deck}`, `mat-${p}`, { type: 'back', deck }, f) / f);
      }
      return;
    }
    case 'hermit_give': {
      const from = d.from as number;
      const to = d.to as number;
      const content: FlyerContent = typeof d.card === 'string' ? { type: 'card', card: d.card as CardId } : { type: 'back', deck: 'hermit' };
      arrow(playerEl(from), playerEl(to), 'hermit', f);
      pulse([to], 'focus', 1200 * f);
      sfx('card_play', 0.6);
      await wait(fly(`mat-${from}`, `mat-${to}`, content, f) / f + 150);
      return;
    }
    case 'show': {
      arrow(playerEl(d.from as number), playerEl(d.to as number), 'hermit', f);
      bubble(d.from as number, typeof d.character === 'string' ? `Montre : ${CHARACTERS[d.character as CharacterId].name}` : 'Montre sa carte', 'gold');
      await wait(900);
      return;
    }
    case 'attack': {
      const attacker = d.attacker as number;
      const targets = d.targets as number[];
      pulse([attacker], 'attack', 1100 * f);
      pulse(targets, 'target', 1400 * f);
      for (const t of targets) arrow(playerEl(attacker), playerEl(t), 'attack', f);
      sfx('attack_swing', 0.8);
      await wait(700);
      return;
    }
    case 'miss':
      bubble(d.attacker as number, 'Raté !', 'miss');
      await wait(500);
      return;
    case 'no_damage':
      bubble(d.player as number, 'Aucun dégât', 'info');
      await wait(450);
      return;
    case 'damage': {
      const p = d.player as number;
      pulse([p], 'hit', 700 * f);
      bubble(p, `−${d.amount}`, 'dmg');
      sfx('damage_hit', 0.8);
      await wait(650);
      return;
    }
    case 'heal': {
      const p = d.player as number;
      if (!d.amount) {
        bubble(p, 'Aucun dégât à soigner', 'info');
        await wait(350);
        return;
      }
      pulse([p], 'heal', 900 * f);
      bubble(p, `+${d.amount}`, 'heal');
      await wait(550);
      return;
    }
    case 'set_damage': {
      const p = d.player as number;
      pulse([p], (d.to as number) < (d.from as number) ? 'heal' : 'hit', 800 * f);
      bubble(p, `Dégâts → ${d.to}`, 'gold');
      await wait(650);
      return;
    }
    case 'protected':
      pulse([d.player as number], 'protect', 900 * f);
      bubble(d.player as number, 'Protégé !', 'protect');
      await wait(550);
      return;
    case 'guardian_angel':
    case 'barrier':
      pulse([d.player as number], 'protect', 1200 * f);
      bubble(d.player as number, e.type === 'barrier' ? 'Barrière spectrale' : 'Ange gardien', 'protect');
      await wait(700);
      return;
    case 'expire':
      bubble(d.player as number, 'Protection terminée', 'info');
      await wait(400);
      return;
    case 'ability': {
      const p = d.player as number;
      const c = CHARACTERS[d.character as CharacterId];
      pulse([p], 'ability', 1200 * f);
      bubble(p, c ? c.ability.name : 'Capacité', 'ability');
      sfx('ability_use', 0.8);
      await wait(900);
      return;
    }
    case 'woods': {
      const tone: Tone = d.effect === 'heal' ? 'heal' : 'attack';
      areaFx('woods', 'action', 1200 * f);
      arrow(playerEl(d.player as number), playerEl(d.target as number), tone, f);
      await wait(650);
      return;
    }
    case 'card_target':
      arrow(playerEl(d.player as number), playerEl(d.target as number), 'card', f);
      pulse([d.target as number], 'target', 1000 * f);
      await wait(650);
      return;
    case 'explosion':
      areaFx(d.area as AreaId, 'boom', 1100 * f);
      sfx('damage_hit', 0.9);
      await wait(800);
      return;
    case 'equip': {
      const p = d.player as number;
      if (d.from === 'discard') {
        const card = d.card as CardId;
        await wait(fly(`deck-${cardDef(card).deck}`, `mat-${p}`, { type: 'chip', card }, f) / f);
      }
      bubble(p, `+ ${cardName(d.card as CardId)}`, 'gold');
      sfx('card_play', 0.6);
      await wait(400);
      return;
    }
    case 'equipment_move': {
      const card = d.card as CardId;
      arrow(`mat-${d.from}`, `mat-${d.to}`, 'card', f);
      sfx('card_play', 0.7);
      await wait(fly(`mat-${d.from}`, `mat-${d.to}`, { type: 'chip', card }, f) / f);
      bubble(d.to as number, `+ ${cardName(card)}`, 'gold');
      await wait(250);
      return;
    }
    case 'discard_equipment':
      bubble(d.player as number, 'Équipement défaussé', 'info');
      await wait(450);
      return;
    case 'reveal': {
      const p = d.player as number;
      const c = CHARACTERS[d.character as CharacterId];
      pulse([p], 'reveal', 1500 * f);
      sfx('reveal_dramatic', 0.8);
      setOverlay({ kind: 'banner', tone: 'reveal', character: c.id, text: `${name(p)} est ${c.name} (${FACTION_LABEL[c.faction]})` });
      await wait(1500);
      setOverlay(null);
      return;
    }
    case 'death': {
      const p = d.player as number;
      const c = CHARACTERS[d.character as CharacterId];
      pulse([p], 'death', 1800 * f);
      sfx('player_death', 0.9);
      setOverlay({ kind: 'banner', tone: 'death', character: c.id, text: `${name(p)} meurt : c'était ${c.name} (${FACTION_LABEL[c.faction]})` });
      await wait(1700);
      setOverlay(null);
      return;
    }
    case 'voided':
      bubble(d.player as number, 'Capacité annulée', 'miss');
      await wait(650);
      return;
    case 'extra_turn_gain':
    case 'extra_turn':
      bubble(d.player as number, 'Tour supplémentaire !', 'gold');
      await wait(650);
      return;
    case 'reshuffle':
      deckFx(d.deck as DeckId, 'shuffle', 800 * f);
      sfx('card_shuffle', 0.6);
      await wait(600);
      return;
    case 'game_over': {
      const won = me !== null && (d.winners as number[]).includes(me);
      sfx(won ? 'win_game' : 'lose_game', 1);
      return;
    }
    default:
      if (CAPTION_ONLY.has(e.type)) await wait(e.type === 'hermit_result' ? 550 : 380);
      else await wait(250);
  }
}

// ─── File d'attente ─────────────────────────────────────────

function commit(frame: Frame): void {
  const st = useStore.getState();
  useStore.setState({ view: frame.view, seats: frame.seats, log: [...st.log, ...frame.events] });
}

async function run(): Promise<void> {
  running = true;
  const gen = generation;
  while (queue.length > 0) {
    if (gen !== generation) return;
    const frame = queue.shift() as Frame;
    current = frame;
    const f = speedFactor();
    if (f > 0) {
      for (const e of frame.events) {
        if (gen !== generation) return;
        await playEvent(e, frame, f, gen);
      }
    }
    if (gen !== generation) return;
    commit(frame);
    current = null;
    // Laisse les pions se déplacer et les jauges se mettre à jour.
    const moved = frame.events.some((e) => e.type === 'move' || e.type === 'death');
    if (f > 0) await sleep((moved ? 480 : 120) * Math.min(1, f));
  }
  if (gen !== generation) return;
  running = false;
  useFx.setState({ animating: false });
}

/** Ajoute l'état reçu de l'hôte à la file des scènes à jouer. */
export function enqueueFrame(frame: Frame): void {
  queue.push(frame);
  useFx.setState({ animating: true });
  if (!running) void run();
}

/** Abandonne toutes les animations en cours (nouvelle partie, reconnexion, départ). */
export function resetDirector(): void {
  generation++;
  queue.length = 0;
  current = null;
  running = false;
  useFx.setState({ ...initialFx });
}

/** Termine immédiatement toutes les animations en attente (clic « passer »). */
export function skipAnimations(): void {
  const pending = [...(current ? [current] : []), ...queue.splice(0)];
  generation++;
  current = null;
  running = false;
  for (const fr of pending) commit(fr);
  useFx.setState({ ...initialFx, caption: useFx.getState().caption });
}

import { advance, applyAction } from '../engine';
import { createInitialState } from '../setup';
import { COVER_KINDS } from '../flow';
import type { AreaId, CardId, CharacterId, GameState, Option } from '../types';

export const RING: AreaId[] = ['hermit', 'underworld', 'church', 'cemetery', 'woods', 'altar'];

export interface ScenarioPlayer {
  c: CharacterId;
  area?: AreaId | null;
  damage?: number;
  revealed?: boolean;
  equipment?: CardId[];
  alive?: boolean;
}

/** Crée une partie contrôlée : personnages, lieux et dés imposés. Le joueur 0 commence. */
export function scenario(players: ScenarioPlayer[], opts: { rolls?: number[]; active?: number } = {}): GameState {
  const s = createInitialState({ playerNames: players.map((_, i) => `J${i}`), pool: 'mixed', seed: 42 });
  s.areas = [...RING];
  players.forEach((sp, i) => {
    const p = s.players[i];
    p.character = sp.c;
    p.area = sp.area === undefined ? null : sp.area;
    p.damage = sp.damage ?? 0;
    p.revealed = sp.revealed ?? false;
    p.equipment = [...(sp.equipment ?? [])];
    if (sp.alive === false) {
      p.alive = false;
      p.revealed = true;
      p.deathBatch = 0;
    }
    // Retire des paquets les équipements distribués pour conserver 48 cartes.
    for (const e of p.equipment) {
      for (const d of Object.values(s.decks)) {
        const i2 = d.draw.indexOf(e);
        if (i2 >= 0) d.draw.splice(i2, 1);
      }
    }
  });
  const active = opts.active ?? 0;
  s.turn.active = active;
  s.stack = [{ t: 'startTurn', p: active }];
  s.forcedRolls = [...(opts.rolls ?? [])];
  advance(s);
  return s;
}

export function options(s: GameState): Option[] {
  return s.pending?.options ?? [];
}

export function optionIds(s: GameState): string[] {
  return options(s).map((o) => o.id);
}

/** Choisit l'option dont l'identifiant vaut (ou commence par) `id`. */
export function choose(s: GameState, id: string): GameState {
  const d = s.pending;
  if (!d) throw new Error('Aucune décision en attente');
  const opt = d.options.find((o) => o.id === id) ?? d.options.find((o) => o.id.startsWith(id));
  if (!opt) throw new Error(`Option ${id} introuvable parmi ${d.options.map((o) => o.id).join(', ')} (${d.kind})`);
  return applyAction(s, { type: 'choose', player: d.player, decisionId: d.id, optionId: opt.id }).state;
}

export function rolls(s: GameState, ...values: number[]): GameState {
  s.forcedRolls = [...(s.forcedRolls ?? []), ...values];
  return s;
}

/** Place une carte précise en haut d'une pioche. */
export function stackDeck(s: GameState, deck: 'hermit' | 'white' | 'black', card: CardId): GameState {
  const pile = s.decks[deck];
  pile.draw = pile.draw.filter((c) => c !== card);
  pile.discard = pile.discard.filter((c) => c !== card);
  pile.draw.push(card);
  return s;
}

export function texts(s: GameState): string[] {
  return s.log.map((e) => e.text);
}

/** Valide automatiquement les décisions « couverture » à option unique. */
export function skipCovers(s: GameState): GameState {
  while (s.pending && (COVER_KINDS as readonly string[]).includes(s.pending.kind) && s.pending.options.length === 1) {
    s = choose(s, s.pending.options[0].id);
  }
  return s;
}

/** Choisit puis valide les décisions de couverture qui suivent. */
export function play(s: GameState, ...ids: string[]): GameState {
  for (const id of ids) s = skipCovers(choose(skipCovers(s), id));
  return skipCovers(s);
}

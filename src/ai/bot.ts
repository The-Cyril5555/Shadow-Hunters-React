// Bot : choisit ses actions à partir de sa seule PlayerView et de ses croyances.
import {
  AREAS, CHARACTERS, DAVID_CARDS, WEAPONS, areaForRoll, cardType, zoneOf,
  type Action, type AreaId, type CardId, type CharacterId, type Faction, type Option, type PlayerView,
  type PublicPlayer, type VisibleEvent,
} from '../engine';
import { Beliefs } from './beliefs';

export type BotLevel = 'easy' | 'normal' | 'hard';
export type BotPersonality = 'aggressive' | 'balanced' | 'prudent';

export interface BotConfig {
  level: BotLevel;
  personality: BotPersonality;
  seed: number;
}

const EPSILON: Record<BotLevel, number> = { easy: 0.3, normal: 0.07, hard: 0 };
const ATTACK_THRESHOLD: Record<BotPersonality, number> = { aggressive: 0.02, balanced: 0.15, prudent: 0.3 };

/** Probabilité de chaque somme d6 + d4. */
const ROLL_PROBS: [number, number][] = [[2, 1], [3, 2], [4, 3], [5, 4], [6, 4], [7, 4], [8, 3], [9, 2], [10, 1]].map(([s, c]) => [s, c / 24]);

export class Bot {
  readonly seat: number;
  readonly config: BotConfig;
  private beliefs: Beliefs | null = null;
  private rng: number;
  private factions: Map<number, Record<Faction, number>> = new Map();

  constructor(seat: number, config: BotConfig) {
    this.seat = seat;
    this.config = config;
    this.rng = config.seed | 0 || 1;
  }

  private random(): number {
    let t = (this.rng = (this.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private ensure(view: PlayerView): Beliefs {
    if (!this.beliefs) this.beliefs = new Beliefs(view);
    return this.beliefs;
  }

  observe(events: VisibleEvent[], view: PlayerView): void {
    const b = this.ensure(view);
    b.observe(this.config.level === 'easy' ? events.filter((e) => e.type === 'hermit_result') : events, view);
  }

  // ─── Évaluations ─────────────────────────────────────────

  private get me(): number {
    return this.seat;
  }

  private meP(view: PlayerView): PublicPlayer {
    return view.players[this.me];
  }

  private myChar(view: PlayerView): CharacterId {
    return this.meP(view).character as CharacterId;
  }

  private hp(view: PlayerView, j: number): number {
    const c = view.players[j].character;
    if (c) return CHARACTERS[c].hp;
    return this.ensure(view).expectedHp(view, j, this.factions);
  }

  private remaining(view: PlayerView, j: number): number {
    return this.hp(view, j) - view.players[j].damage;
  }

  private fp(j: number): Record<Faction, number> {
    return this.factions.get(j) ?? { hunter: 1 / 3, shadow: 1 / 3, neutral: 1 / 3 };
  }

  /** Envie de nuire à j, de −1 (allié sûr) à 1 (ennemi sûr). */
  enemyScore(view: PlayerView, j: number): number {
    if (j === this.me) return -1;
    const pj = view.players[j];
    if (!pj.alive) return 0;
    const me = this.myChar(view);
    const f = this.fp(j);
    const grudge = Math.min(0.4, (this.ensure(view).grudge.get(j) ?? 0) * 0.1);
    const asFaction = (mine: Faction): number => {
      if (mine === 'hunter') return f.shadow - f.hunter * 0.9 - f.neutral * 0.1;
      if (mine === 'shadow') return f.hunter - f.shadow * 0.9 + f.neutral * 0.25;
      return 0;
    };
    switch (me) {
      case 'daniel':
        return asFaction('hunter') * 0.8 + grudge;
      case 'agnes': {
        const meP = this.meP(view);
        const n = view.playerCount;
        const ally = meP.agnesLeft ? (this.me + 1) % n : (this.me + n - 1) % n;
        if (j === ally) return -1;
        const af = this.fp(ally);
        const allyChar = view.players[ally].character;
        const allyFaction: Record<Faction, number> = allyChar
          ? { hunter: 0, shadow: 0, neutral: 0, [CHARACTERS[allyChar].faction]: 1 }
          : af;
        return (allyFaction.hunter * (f.shadow - f.hunter) + allyFaction.shadow * (f.hunter - f.shadow)) * 0.8 + grudge;
      }
      case 'bob':
        return 0.15 + (pj.equipment.length > 0 ? 0.35 : 0) + grudge;
      case 'charles': {
        const dead = view.players.filter((p) => !p.alive).length;
        return 0.1 + (dead >= 2 ? 0.5 : 0.15) + grudge;
      }
      case 'bryan': {
        const probs = this.ensure(view).characterProbs(view, j, this.factions);
        let big = 0;
        for (const [c, p] of probs) if (CHARACTERS[c].hp >= 13) big += p;
        return big * 0.8 + grudge;
      }
      case 'catherine': {
        const alive = view.players.filter((p) => p.alive).length;
        return (alive <= 4 ? 0.35 : 0.05) + grudge;
      }
      case 'allie':
      case 'david':
        return grudge;
      default:
        return asFaction(CHARACTERS[me].faction) + grudge * 0.5;
    }
  }

  equipValue(view: PlayerView, card: CardId): number {
    const t = cardType(card);
    const me = this.myChar(view);
    const faction = CHARACTERS[me].faction;
    let v: number;
    if (WEAPONS.includes(t)) v = this.config.personality === 'aggressive' ? 1.3 : 1;
    else {
      const table: Record<string, number> = {
        masamune: this.config.personality === 'aggressive' ? 0.5 : -0.4,
        machine_gun: 0.9, handgun: 0.6, holy_robe: 0.6, talisman: 0.7, fortune_brooch: 0.4,
        mystic_compass: 0.5, silver_rosary: 0.6, spear_of_longinus: faction === 'hunter' ? 1.3 : 0.4,
      };
      v = table[t] ?? 0.5;
    }
    if (me === 'bob') v += 0.8;
    if (me === 'david' && DAVID_CARDS.includes(t)) v += 2;
    return v;
  }

  private expectedAttackDamage(view: PlayerView, target: number): number {
    const meP = this.meP(view);
    const d4only = meP.equipment.some((c) => cardType(c) === 'masamune') || (meP.character === 'valkyrie' && meP.revealed);
    let dmg = d4only ? 2.5 : 1.875;
    const t = view.players[target];
    let bonus = meP.equipment.filter((c) => WEAPONS.includes(cardType(c))).length;
    if (meP.revealed && CHARACTERS[this.myChar(view)].faction === 'hunter' && meP.equipment.some((c) => cardType(c) === 'spear_of_longinus')) bonus += 2;
    if (meP.equipment.some((c) => cardType(c) === 'holy_robe')) bonus -= 1;
    if (t.equipment.some((c) => cardType(c) === 'holy_robe')) bonus -= 1;
    dmg += bonus * (d4only ? 1 : 0.83);
    if (t.guardianAngel || t.barrier) return 0;
    return Math.max(0, dmg);
  }

  private harmValue(view: PlayerView, j: number, dmg: number): number {
    const e = this.enemyScore(view, j);
    const rem = this.remaining(view, j);
    const kill = dmg >= rem ? 1.6 : 1;
    return e * dmg * kill;
  }

  private areaValue(view: PlayerView, area: AreaId): number {
    const meP = this.meP(view);
    const me = this.myChar(view);
    const hp = CHARACTERS[me].hp;
    const dmgRatio = meP.damage / hp;
    const unknownRatio = view.players.filter((p) => !p.character).length / view.playerCount;
    let v = 0;
    switch (area) {
      case 'church': v = 0.8 + dmgRatio * 1.2 + (me === 'david' ? 0.8 : 0); break;
      case 'cemetery': v = (this.config.personality === 'aggressive' ? 1 : 0.7) - (hp - meP.damage <= 4 ? 0.6 : 0); break;
      case 'hermit': v = 0.5 + unknownRatio * 0.6; break;
      case 'underworld': v = 1; break;
      case 'woods': {
        let best = dmgRatio > 0 ? 0.5 : 0;
        for (const p of view.players) if (p.alive && p.id !== this.me) best = Math.max(best, this.harmValue(view, p.id, 2) * 0.5);
        v = 0.3 + best;
        break;
      }
      case 'altar': {
        let best = 0;
        for (const p of view.players) {
          if (!p.alive || p.id === this.me) continue;
          for (const e of p.equipment) best = Math.max(best, this.equipValue(view, e) + 0.3 * this.enemyScore(view, p.id));
        }
        v = 0.2 + best * 0.8 + (me === 'bryan' ? 0.6 : 0);
        break;
      }
    }
    if (me === 'bob' && area !== 'hermit' && area !== 'woods') v += 0.3;
    // Cibles potentielles et menaces dans la zone d'arrivée.
    const zone = zoneOf(view, area);
    const aggro = this.config.personality === 'aggressive' ? 1.2 : this.config.personality === 'prudent' ? 0.5 : 0.8;
    for (const p of view.players) {
      if (!p.alive || p.id === this.me || !p.area || !zone.includes(p.area)) continue;
      const e = this.enemyScore(view, p.id);
      v += Math.max(0, e) * 0.4 * aggro;
      v -= Math.max(0, e) * 0.5 * dmgRatio;
    }
    return v;
  }

  private rollValue(view: PlayerView): number {
    const cur = this.meP(view).area;
    let best7 = -Infinity;
    for (const a of Object.keys(AREAS) as AreaId[]) if (a !== cur) best7 = Math.max(best7, this.areaValue(view, a));
    let total = 0;
    let mass = 0;
    for (const [sum, p] of ROLL_PROBS) {
      const a = areaForRoll(sum);
      if (a === cur) continue;
      total += p * (a ? this.areaValue(view, a) : best7);
      mass += p;
    }
    return mass > 0 ? total / mass : 0;
  }

  // ─── Choix ───────────────────────────────────────────────

  /** Renvoie l'action à jouer (décision ou action libre), ou null s'il n'y a rien à faire. */
  act(view: PlayerView): Action | null {
    this.ensure(view);
    this.factions = this.ensure(view).factionProbs(view);
    const free = this.freeAction(view);
    if (free) return free;
    const d = view.pending;
    if (!d || d.player !== this.me || !d.options) return null;
    const opts = d.options;
    let chosen: Option;
    if (opts.length === 1) chosen = opts[0];
    else if (this.random() < EPSILON[this.config.level]) chosen = opts[Math.floor(this.random() * opts.length)];
    else chosen = this.best(view, d.kind, opts);
    return { type: 'choose', player: this.me, decisionId: d.id, optionId: chosen.id };
  }

  /** Actions possibles à tout moment : Allie, David, révélations opportunes. */
  private freeAction(view: PlayerView): Action | null {
    const meP = this.meP(view);
    if (!meP.alive || view.finished) return null;
    const me = this.myChar(view);
    for (const o of view.anytime) {
      if (o.id === 'allie' && this.remaining(view, this.me) <= 3) return { type: 'ability', player: this.me, optionId: o.id };
      if (o.id.startsWith('david:')) {
        const t = cardType(o.card as CardId);
        if (DAVID_CARDS.includes(t) || (view.turn.number > 20 && WEAPONS.includes(t))) {
          return { type: 'ability', player: this.me, optionId: o.id };
        }
      }
    }
    if (!view.canReveal || view.pending?.player !== this.me) return null;
    const kind = view.pending.kind;
    // Révélations utiles avant d'attaquer.
    if (kind === 'attack') {
      const hasSpear = meP.equipment.some((c) => cardType(c) === 'spear_of_longinus');
      const confident = view.players.some((p) => p.alive && p.id !== this.me && this.enemyScore(view, p.id) > 0.7);
      if (hasSpear && CHARACTERS[me].faction === 'hunter' && confident) return { type: 'reveal', player: this.me };
      if ((me === 'valkyrie' || me === 'vampire') && confident && (meP.damage >= 4 || view.turn.number > 12)) {
        return { type: 'reveal', player: this.me };
      }
    }
    if (kind === 'turn_start' && me === 'catherine' && meP.damage >= 3 && this.config.personality !== 'aggressive') {
      return { type: 'reveal', player: this.me };
    }
    return null;
  }

  private best(view: PlayerView, kind: string, opts: Option[]): Option {
    let best = opts[0];
    let bestScore = -Infinity;
    for (const o of opts) {
      const score = this.score(view, kind, o) + this.random() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }

  private revealCost(view: PlayerView, o: Option): number {
    if (!o.reveal) return 0;
    const f = CHARACTERS[this.myChar(view)].faction;
    // Se révéler expose, surtout en début de partie.
    const early = view.turn.number < 8 ? 0.4 : 0.15;
    return f === 'neutral' ? early * 0.5 : early;
  }

  private score(view: PlayerView, kind: string, o: Option): number {
    const meP = this.meP(view);
    const me = this.myChar(view);
    const hp = CHARACTERS[me].hp;
    const t = o.target;
    const cost = this.revealCost(view, o);
    switch (kind) {
      case 'turn_start': {
        const [k] = o.id.split(':');
        if (k === 'roll') return this.rollValue(view);
        if (k === 'teleport') return this.areaValue(view, o.area as AreaId) - cost - 0.05;
        if (k === 'franklin') return this.harmValue(view, t as number, 3.5) * 0.7 - cost - 0.6;
        if (k === 'george') return this.harmValue(view, t as number, 2.5) * 0.7 - cost - 0.5;
        if (k === 'ultra_soul') return this.harmValue(view, t as number, 3) - cost;
        if (k === 'fuka') {
          const p = view.players[t as number];
          const delta = 7 - p.damage;
          if (t === this.me) return p.damage > 7 ? (p.damage - 7) * 0.5 - cost : -5;
          return this.harmValue(view, t as number, Math.max(0, delta)) * (delta > 0 ? 0.35 : -0.35) - cost - 0.3;
        }
        if (k === 'ellen') {
          const c = view.players[t as number].character;
          const strong = c ? ['werewolf', 'vampire', 'valkyrie', 'ultra_soul', 'wight', 'unknown', 'charles', 'bob'].includes(c) : false;
          return this.enemyScore(view, t as number) * (strong ? 1.5 : 0.4) - cost - 0.6;
        }
        if (k === 'agnes') return -0.5;
        return -1;
      }
      case 'compass':
      case 'choose_area':
        return o.area ? this.areaValue(view, o.area) : this.rollValue(view) + 0.2;
      case 'area_action': {
        const [k, a] = o.id.split(':');
        if (k === 'skip') return 0;
        if (k === 'draw') {
          if (a === 'white') return 0.8 + (meP.damage / hp);
          if (a === 'black') return (this.config.personality === 'aggressive' ? 0.9 : 0.6) - (hp - meP.damage <= 3 ? 1 : 0);
          return 0.5 + view.players.filter((p) => !p.character).length / view.playerCount * 0.6;
        }
        if (k === 'woods_dmg') {
          if (t === this.me) return -3;
          const brooch = view.players[t as number].equipment.some((c) => cardType(c) === 'fortune_brooch');
          return brooch ? -0.1 : this.harmValue(view, t as number, 2);
        }
        if (k === 'woods_heal') {
          const p = view.players[t as number];
          if (p.damage === 0) return -0.1;
          return t === this.me ? 0.9 : -this.enemyScore(view, t as number) * 0.8;
        }
        if (k === 'steal') return this.equipValue(view, o.card as CardId) + 0.3 * this.enemyScore(view, t as number);
        return 0;
      }
      case 'hermit_give':
        return this.hermitGiveScore(view, t as number);
      case 'hermit_respond': {
        if (o.id.startsWith('give:')) {
          const v = this.equipValue(view, o.card as CardId);
          return -v - (o.label.includes('mensonge') ? 0.3 : 0);
        }
        if (o.id.startsWith('hurt')) {
          const n = Number(o.id.split(':')[1] ?? 1);
          const rem = hp - meP.damage;
          return -(n * (rem <= n ? 10 : rem <= 4 ? 1.5 : 0.7)) - (o.label.includes('mensonge') ? 0.2 : 0);
        }
        if (o.id === 'heal') return 1;
        if (o.id === 'nothing') {
          // L'Inconnu préfère passer pour un Hunter plutôt que subir des dégâts.
          return o.label.includes('mensonge') ? -0.4 : 0;
        }
        return 0;
      }
      case 'card_target':
        return this.cardTargetScore(view, o);
      case 'reveal_heal': {
        if (o.id === 'nothing') return 0;
        const threshold = CHARACTERS[me].faction === 'shadow' ? 5 : 3;
        return meP.damage >= threshold || hp - meP.damage <= 4 ? 1 : -0.5;
      }
      case 'attack': {
        if (o.id === 'pass') return ATTACK_THRESHOLD[this.config.personality];
        if (o.id === 'attack_all') {
          let v = 0;
          for (const p of view.players) {
            if (p.alive && p.id !== this.me && p.area && meP.area && zoneOf(view, meP.area).includes(p.area) !== this.hasHandgun(meP)) {
              v += this.harmValue(view, p.id, this.expectedAttackDamage(view, p.id));
            }
          }
          return v;
        }
        return this.harmValue(view, t as number, this.expectedAttackDamage(view, t as number)) - this.counterRisk(view, t as number);
      }
      case 'bob_rob': {
        if (o.id === 'damage') return 0.5;
        return this.equipValue(view, o.card as CardId) - cost * 0.5;
      }
      case 'counter':
        if (o.id === 'no') return 0.2;
        return this.enemyScore(view, t as number) * 1.2 - cost;
      case 'charles_again': {
        if (o.id === 'stop') return 0;
        const rem = hp - meP.damage;
        if (rem <= 3) return -5;
        const dead = view.players.filter((p) => !p.alive).length;
        return (dead >= 2 ? 0.8 : 0.1) - cost - (rem <= 5 ? 0.6 : 0);
      }
      case 'loot':
        return o.id === 'none' ? 0 : this.equipValue(view, o.card as CardId);
      case 'end_turn': {
        if (o.id === 'end') return 0;
        if (o.id === 'gregor') return meP.damage >= hp - 6 ? 1 - cost : -0.5;
        if (o.id === 'wight') {
          const dead = view.players.filter((p) => !p.alive).length;
          return dead >= 2 ? 1 - cost : -0.2;
        }
        return 0;
      }
      default:
        return 0;
    }
  }

  private hasHandgun(p: PublicPlayer): boolean {
    return p.equipment.some((c) => cardType(c) === 'handgun');
  }

  private counterRisk(view: PlayerView, t: number): number {
    const p = view.players[t];
    if (p.character === 'werewolf' && !p.abilityVoided) return 0.8;
    if (!p.character) {
      const probs = this.ensure(view).characterProbs(view, t, this.factions);
      return (probs.get('werewolf') ?? 0) * 0.5;
    }
    return 0;
  }

  private hermitGiveScore(view: PlayerView, t: number): number {
    const card = view.pending?.card;
    if (!card) return 0;
    const type = cardType(card);
    const probs = this.ensure(view).characterProbs(view, t, this.factions);
    const cond = (c: CharacterId): boolean => {
      const f = CHARACTERS[c].faction;
      const l = CHARACTERS[c].letter;
      switch (type) {
        case 'aid': case 'slap': return f === 'hunter';
        case 'huddle': case 'spell': case 'exorcism': return f === 'shadow';
        case 'nurturance': return f === 'neutral';
        case 'anger': return f !== 'neutral';
        case 'blackmail': return f !== 'shadow';
        case 'greed': return f !== 'hunter';
        case 'bully': return ['A', 'B', 'C', 'E', 'U'].includes(l);
        case 'tough_lesson': return ['D', 'F', 'G', 'V', 'W'].includes(l);
        default: return true;
      }
    };
    let pTrue = 0;
    let tot = 0;
    for (const [c, p] of probs) {
      tot += p;
      if (cond(c)) pTrue += p;
    }
    pTrue = tot > 0 ? pTrue / tot : 0.5;
    const known = !!view.players[t].character;
    const entropy = pTrue <= 0 || pTrue >= 1 ? 0 : -(pTrue * Math.log2(pTrue) + (1 - pTrue) * Math.log2(1 - pTrue));
    const info = known ? 0 : entropy * 0.8;
    const e = this.enemyScore(view, t);
    const p = view.players[t];
    switch (type) {
      case 'prediction': return known ? -1 : 1 + (this.fp(t).neutral < 0.9 ? 0.3 : 0);
      case 'slap': case 'spell': case 'bully': return info + pTrue * e;
      case 'exorcism': case 'tough_lesson': return info + pTrue * e * 2;
      case 'aid': case 'huddle': case 'nurturance':
        return info + pTrue * (p.damage > 0 ? -e : e);
      default:
        return info + pTrue * (0.4 + e * 0.5);
    }
  }

  private cardTargetScore(view: PlayerView, o: Option): number {
    const card = view.pending?.card;
    if (!card) return 0;
    const type = cardType(card);
    const t = o.target as number;
    const tp = view.players[t];
    const talisman = tp.equipment.some((c) => cardType(c) === 'talisman');
    switch (type) {
      case 'first_aid': {
        const delta = 7 - tp.damage;
        if (t === this.me) return tp.damage > 7 ? tp.damage - 7 : delta > 0 ? -delta : 0;
        return delta > 0 ? this.harmValue(view, t, delta) : -this.enemyScore(view, t) * -delta;
      }
      case 'blessing':
        return -this.enemyScore(view, t) * Math.min(tp.damage, 3.5);
      case 'vampire_bat':
      case 'bloodthirsty_spider':
        return talisman ? -0.2 : this.harmValue(view, t, 2);
      case 'spiritual_doll':
        return this.harmValue(view, t, 3);
      case 'moody_goblin':
        return this.equipValue(view, o.card as CardId) + 0.3 * this.enemyScore(view, t);
      case 'banana_peel':
        return -this.equipValue(view, o.card as CardId) - this.enemyScore(view, t);
      default:
        return 0;
    }
  }
}

export function randomBotConfig(seed: number, level: BotLevel): BotConfig {
  const personalities: BotPersonality[] = ['aggressive', 'balanced', 'prudent'];
  return { level, personality: personalities[Math.abs(seed) % 3], seed };
}

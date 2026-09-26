// Modèle de croyances d'un bot : pour chaque autre joueur, une probabilité sur son
// personnage. Il n'utilise que les informations visibles par ce bot (sa PlayerView et
// les événements qu'il a le droit de voir) : aucune triche possible.
import {
  CHARACTERS, FACTION_COUNTS, HERMIT_RULES, charactersInPool, cardType, hermitConditionHolds,
  type CharacterId, type Faction, type PlayerView, type VisibleEvent,
} from '../engine';

const FACTIONS: Faction[] = ['hunter', 'shadow', 'neutral'];

/** Probabilité qu'un personnage de faction `a` s'en prenne volontairement à la faction `b`. */
const HOSTILITY: Record<Faction, Record<Faction, number>> = {
  hunter: { hunter: 0.3, shadow: 1, neutral: 0.55 },
  shadow: { hunter: 1, shadow: 0.3, neutral: 0.75 },
  neutral: { hunter: 0.7, shadow: 0.7, neutral: 0.7 },
};

export class Beliefs {
  readonly me: number;
  readonly myCharacter: CharacterId;
  private readonly n: number;
  private readonly pool: CharacterId[];
  private readonly mixed: boolean;
  /** Vraisemblance non normalisée de chaque personnage, par joueur. */
  private like: Map<number, Map<CharacterId, number>> = new Map();
  private lastDraw = new Map<number, string>();
  /** Rancune : dégâts reçus de chaque joueur. */
  readonly grudge = new Map<number, number>();

  constructor(view: PlayerView) {
    if (view.me === null) throw new Error('Un bot doit occuper un siège.');
    this.me = view.me;
    this.myCharacter = view.players[view.me].character as CharacterId;
    this.n = view.playerCount;
    this.pool = charactersInPool(view.pool).map((c) => c.id);
    this.mixed = view.pool === 'mixed';
    for (let j = 0; j < this.n; j++) {
      if (j === this.me) continue;
      this.like.set(j, new Map(this.pool.map((c) => [c, 1])));
    }
  }

  get myFaction(): Faction {
    return CHARACTERS[this.myCharacter].faction;
  }

  private multiply(j: number, f: (c: CharacterId) => number): void {
    const m = this.like.get(j);
    if (!m) return;
    for (const [c, w] of m) m.set(c, Math.max(1e-6, w * f(c)));
  }

  /** Personnages connus : impossibles pour les autres joueurs. */
  private excluded(view: PlayerView, j: number): Set<CharacterId> {
    const out = new Set<CharacterId>();
    const exclude = (c: CharacterId) => {
      out.add(c);
      if (this.mixed) {
        for (const o of this.pool) if (CHARACTERS[o].letter === CHARACTERS[c].letter) out.add(o);
      }
    };
    exclude(this.myCharacter);
    for (const p of view.players) if (p.id !== j && p.character) exclude(p.character);
    return out;
  }

  /** Distribution sur les factions de chaque joueur (équilibrée sur les effectifs connus). */
  factionProbs(view: PlayerView): Map<number, Record<Faction, number>> {
    const result = new Map<number, Record<Faction, number>>();
    const remaining: Record<Faction, number> = { ...FACTION_COUNTS[this.n] };
    const unknown: number[] = [];
    for (const p of view.players) {
      if (p.character) {
        const f = CHARACTERS[p.character].faction;
        remaining[f]--;
        result.set(p.id, { hunter: 0, shadow: 0, neutral: 0, [f]: 1 });
      } else {
        unknown.push(p.id);
      }
    }
    const rows = new Map<number, Record<Faction, number>>();
    for (const j of unknown) {
      const excl = this.excluded(view, j);
      const m = this.like.get(j) as Map<CharacterId, number>;
      const row = { hunter: 0, shadow: 0, neutral: 0 };
      for (const f of FACTIONS) {
        const cands = this.pool.filter((c) => CHARACTERS[c].faction === f && !excl.has(c));
        if (cands.length === 0 || remaining[f] <= 0) continue;
        row[f] = cands.reduce((acc, c) => acc + (m.get(c) ?? 1), 0) / cands.length;
      }
      rows.set(j, row);
    }
    // Équilibrage de Sinkhorn : les sommes par faction doivent coller aux effectifs restants.
    for (let it = 0; it < 30; it++) {
      for (const row of rows.values()) {
        const tot = row.hunter + row.shadow + row.neutral || 1;
        for (const f of FACTIONS) row[f] /= tot;
      }
      for (const f of FACTIONS) {
        const col = [...rows.values()].reduce((acc, r) => acc + r[f], 0);
        if (col <= 0) continue;
        const k = Math.max(0, remaining[f]) / col;
        for (const row of rows.values()) row[f] *= k;
      }
    }
    for (const [j, row] of rows) {
      const tot = row.hunter + row.shadow + row.neutral || 1;
      result.set(j, { hunter: row.hunter / tot, shadow: row.shadow / tot, neutral: row.neutral / tot });
    }
    return result;
  }

  /** Probabilités des personnages d'un joueur inconnu. */
  characterProbs(view: PlayerView, j: number, factions = this.factionProbs(view)): Map<CharacterId, number> {
    const known = view.players[j].character;
    if (known) return new Map([[known, 1]]);
    const fp = factions.get(j) as Record<Faction, number>;
    const excl = this.excluded(view, j);
    const m = this.like.get(j) as Map<CharacterId, number>;
    const out = new Map<CharacterId, number>();
    for (const f of FACTIONS) {
      const cands = this.pool.filter((c) => CHARACTERS[c].faction === f && !excl.has(c));
      const tot = cands.reduce((acc, c) => acc + (m.get(c) ?? 1), 0);
      for (const c of cands) out.set(c, fp[f] * ((m.get(c) ?? 1) / (tot || 1)));
    }
    return out;
  }

  expectedHp(view: PlayerView, j: number, factions = this.factionProbs(view)): number {
    let hp = 0;
    let tot = 0;
    for (const [c, p] of this.characterProbs(view, j, factions)) {
      hp += p * CHARACTERS[c].hp;
      tot += p;
    }
    return tot > 0 ? hp / tot : 11;
  }

  /** Met à jour les croyances à partir des nouveaux événements visibles. */
  observe(events: VisibleEvent[], view: PlayerView): void {
    for (const e of events) this.observeOne(e, view);
  }

  private factionOfKnown(view: PlayerView, j: number): Faction | null {
    if (j === this.me) return this.myFaction;
    const c = view.players[j]?.character;
    return c ? CHARACTERS[c].faction : null;
  }

  private hostileEvidence(view: PlayerView, source: number, target: number, strength: number): void {
    if (source === target) return;
    const tf = this.factionOfKnown(view, target);
    const sf = this.factionOfKnown(view, source);
    const soften = (x: number) => 1 - strength * (1 - x);
    if (tf && source !== this.me) this.multiply(source, (c) => soften(HOSTILITY[CHARACTERS[c].faction][tf]));
    if (sf && target !== this.me) this.multiply(target, (c) => soften(HOSTILITY[sf][CHARACTERS[c].faction]));
  }

  private friendlyEvidence(view: PlayerView, source: number, target: number, strength: number): void {
    if (source === target) return;
    const tf = this.factionOfKnown(view, target);
    const sf = this.factionOfKnown(view, source);
    const soften = (x: number) => 1 - strength * x;
    if (tf && source !== this.me) this.multiply(source, (c) => soften(HOSTILITY[CHARACTERS[c].faction][tf]));
    if (sf && target !== this.me) this.multiply(target, (c) => soften(HOSTILITY[sf][CHARACTERS[c].faction]));
  }

  private observeOne(e: VisibleEvent, view: PlayerView): void {
    const d = e.data as Record<string, number | string | number[] | undefined>;
    switch (e.type) {
      case 'hermit_result': {
        // Seul le donneur connaît la carte : c'est une vraie preuve.
        if (d.from !== this.me || typeof d.card !== 'string') return;
        const rule = HERMIT_RULES[cardType(d.card)];
        if (!rule || rule.effect.kind === 'show') return;
        const observedTrue = d.outcome !== 'nothing';
        this.multiply(d.to as number, (c) => {
          if (hermitConditionHolds(c, rule.cond) === observedTrue) return 1;
          return c === 'unknown' ? 0.6 : 0.002;
        });
        return;
      }
      case 'attack': {
        const attacker = d.attacker as number;
        for (const t of (d.targets as number[]) ?? []) this.hostileEvidence(view, attacker, t, d.mode === 'counter' ? 0.2 : 0.7);
        return;
      }
      case 'damage': {
        const src = d.source as number | null | undefined;
        if (typeof src === 'number' && d.player === this.me && src !== this.me) {
          this.grudge.set(src, (this.grudge.get(src) ?? 0) + Number(d.amount ?? 1));
        }
        return;
      }
      case 'card_target': {
        const type = typeof d.card === 'string' ? cardType(d.card) : '';
        if (['vampire_bat', 'bloodthirsty_spider', 'spiritual_doll'].includes(type)) {
          this.hostileEvidence(view, d.player as number, d.target as number, 0.6);
        } else if (type === 'blessing') {
          this.friendlyEvidence(view, d.player as number, d.target as number, 0.5);
        }
        return;
      }
      case 'woods': {
        if (d.effect === 'damage') this.hostileEvidence(view, d.player as number, d.target as number, 0.6);
        else this.friendlyEvidence(view, d.player as number, d.target as number, 0.4);
        return;
      }
      case 'draw':
        if (typeof d.card === 'string') this.lastDraw.set(d.player as number, cardType(d.card));
        return;
      case 'nothing': {
        const p = d.player as number;
        const last = this.lastDraw.get(p);
        if (p === this.me || !last) return;
        // Ne pas se révéler sur Avènement / Rituel : indice faible.
        if (last === 'advent') this.multiply(p, (c) => (CHARACTERS[c].faction === 'hunter' ? 0.6 : 1));
        if (last === 'diabolic_ritual') this.multiply(p, (c) => (CHARACTERS[c].faction === 'shadow' ? 0.6 : 1));
        if (last === 'chocolate') this.multiply(p, (c) => (['A', 'E', 'U'].includes(CHARACTERS[c].letter) ? 0.7 : 1));
        this.lastDraw.delete(p);
        return;
      }
    }
  }
}

// Vue d'un joueur : tout ce qu'il a le droit de savoir, rien de plus.
import { anytimeOptions, canReveal } from './engine';
import type {
  AreaId, CardId, CharacterId, CharacterPool, DecisionKind, DeckId, GameEvent, GameState, Option, TurnState,
} from './types';

export interface PublicPlayer {
  id: number;
  name: string;
  alive: boolean;
  damage: number;
  area: AreaId | null;
  equipment: CardId[];
  revealed: boolean;
  /** Personnage connu du spectateur de la vue (sinon null). */
  character: CharacterId | null;
  abilityUsed: boolean;
  abilityVoided: boolean;
  guardianAngel: boolean;
  barrier: boolean;
  agnesLeft: boolean;
  deathBatch: number | null;
  killedBy: number | null;
}

export interface PublicDeck {
  drawCount: number;
  discardCount: number;
  /** Défausse visible (face visible pour Lumière et Ténèbres, cachée pour Ermite). */
  discard: CardId[];
}

export interface PendingView {
  id: number;
  player: number;
  kind: DecisionKind;
  publicLabel: string;
  /** Présent seulement pour le joueur qui doit décider. */
  prompt?: string;
  options?: Option[];
  card?: CardId;
}

export interface VisibleEvent {
  seq: number;
  type: string;
  text: string;
  data: Record<string, unknown>;
}

export interface PlayerView {
  me: number | null;
  playerCount: number;
  pool: CharacterPool;
  players: PublicPlayer[];
  areas: AreaId[];
  decks: Record<DeckId, PublicDeck>;
  turn: TurnState;
  pending: PendingView | null;
  anytime: Option[];
  canReveal: boolean;
  finished: boolean;
  winners: number[];
  endReason: string;
  lastSeq: number;
}

export function knowsCharacter(s: GameState, viewer: number | null, target: number): boolean {
  const p = s.players[target];
  return s.finished || p.revealed || !p.alive || viewer === target || (viewer !== null && p.knownBy.includes(viewer));
}

export function viewFor(s: GameState, viewer: number | null): PlayerView {
  const pending = s.pending;
  let pendingView: PendingView | null = null;
  if (pending) {
    pendingView = { id: pending.id, player: pending.player, kind: pending.kind, publicLabel: pending.publicLabel };
    if (viewer === pending.player) {
      pendingView.prompt = pending.prompt;
      pendingView.options = pending.options;
      if (pending.card) pendingView.card = pending.card;
    }
  }
  const deck = (d: DeckId): PublicDeck => ({
    drawCount: s.decks[d].draw.length,
    discardCount: s.decks[d].discard.length,
    discard: d === 'hermit' ? [] : [...s.decks[d].discard],
  });
  return {
    me: viewer,
    playerCount: s.players.length,
    pool: s.config.pool,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      damage: p.damage,
      area: p.area,
      equipment: [...p.equipment],
      revealed: p.revealed,
      character: knowsCharacter(s, viewer, p.id) ? p.character : null,
      abilityUsed: p.abilityUsed,
      abilityVoided: p.abilityVoided,
      guardianAngel: p.guardianAngel,
      barrier: p.barrier,
      agnesLeft: p.revealed || s.finished ? p.agnesLeft : false,
      deathBatch: p.deathBatch,
      killedBy: p.killedBy,
    })),
    areas: [...s.areas],
    decks: { hermit: deck('hermit'), white: deck('white'), black: deck('black') },
    turn: { ...s.turn },
    pending: pendingView,
    anytime: viewer === null ? [] : anytimeOptions(s, viewer),
    canReveal: viewer === null ? false : canReveal(s, viewer),
    finished: s.finished,
    winners: [...s.winners],
    endReason: s.endReason,
    lastSeq: s.eventSeq,
  };
}

export function eventVisible(e: GameEvent, viewer: number | null): VisibleEvent | null {
  if (e.visibleTo === 'all' || (viewer !== null && e.visibleTo.includes(viewer))) {
    return { seq: e.seq, type: e.type, text: e.text, data: e.data };
  }
  if (e.redacted) return { seq: e.seq, ...e.redacted };
  return null;
}

export function eventsFor(events: GameEvent[], viewer: number | null, sinceSeq = 0): VisibleEvent[] {
  const out: VisibleEvent[] = [];
  for (const e of events) {
    if (e.seq <= sinceSeq) continue;
    const v = eventVisible(e, viewer);
    if (v) out.push(v);
  }
  return out;
}

// Parties entièrement jouées par des bots (tests, équilibrage).
import { applyAction, createGame, eventsFor, viewFor, type CharacterPool, type GameState } from '../engine';
import { Bot, randomBotConfig, type BotConfig, type BotLevel } from './bot';

export interface SimulationResult {
  state: GameState;
  actions: number;
}

export function simulateGame(opts: { players: number; pool: CharacterPool; seed: number; level?: BotLevel; maxActions?: number; onState?: (s: GameState) => void; configFor?: (seat: number, s: GameState) => BotConfig }): SimulationResult {
  const names = Array.from({ length: opts.players }, (_, i) => `Bot ${i + 1}`);
  const s = createGame({ playerNames: names, pool: opts.pool, seed: opts.seed });
  const bots = names.map((_, i) => new Bot(i, opts.configFor?.(i, s) ?? randomBotConfig(opts.seed * 31 + i, opts.level ?? 'normal')));
  const seen = names.map(() => 0);
  let actions = 0;
  const max = opts.maxActions ?? 20_000;
  while (!s.finished) {
    if (++actions > max) throw new Error(`Partie ${opts.seed} bloquée (tour ${s.turn.number}).`);
    let acted = false;
    // Le décideur en premier, puis les actions libres des autres.
    const order = [s.pending?.player ?? 0, ...bots.map((b) => b.seat)];
    for (const seat of order) {
      const view = viewFor(s, seat);
      bots[seat].observe(eventsFor(s.log, seat, seen[seat]), view);
      seen[seat] = s.eventSeq;
      const action = bots[seat].act(view);
      if (action) {
        applyAction(s, action, true);
        opts.onState?.(s);
        acted = true;
        break;
      }
    }
    if (!acted) throw new Error(`Aucun bot ne joue (partie ${opts.seed}).`);
  }
  return { state: s, actions };
}

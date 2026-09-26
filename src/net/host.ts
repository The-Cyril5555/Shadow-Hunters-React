// Hôte d'une partie : détient l'état de référence, applique les actions, pilote les bots.
// Il tourne à l'identique dans le navigateur (solo, P2P) et sur le serveur Node.
import { Bot, randomBotConfig, type BotLevel } from '../bots/bot';
import {
  COVER_KINDS, EngineError, applyAction, createGame, eventsFor, viewFor,
  type Action, type CharacterPool, type GameState, type PlayerView, type VisibleEvent,
} from '../engine';
import { BOT_DELAY, COVER_DELAY, type BotSpeed } from './protocol';

export interface HostSeat {
  name: string;
  kind: 'human' | 'bot';
  level: BotLevel;
}

export interface HostOptions {
  seats: HostSeat[];
  pool: CharacterPool;
  seed: number;
  speed: BotSpeed;
  /** Appelé après chaque changement d'état. */
  onUpdate: () => void;
  /** Reprise d'une partie sauvegardée. */
  state?: GameState;
}

export class GameHost {
  state: GameState;
  readonly seats: HostSeat[];
  speed: BotSpeed;
  private bots = new Map<number, Bot>();
  private botSeen = new Map<number, number>();
  private autopilot = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly onUpdate: () => void;
  private readonly seed: number;

  constructor(opts: HostOptions) {
    this.seats = opts.seats;
    this.speed = opts.speed;
    this.onUpdate = opts.onUpdate;
    this.seed = opts.seed;
    this.state = opts.state ?? createGame({ playerNames: opts.seats.map((s) => s.name), pool: opts.pool, seed: opts.seed });
    opts.seats.forEach((s, i) => {
      if (s.kind === 'bot') this.bots.set(i, this.makeBot(i, s.level));
    });
  }

  private makeBot(seat: number, level: BotLevel): Bot {
    const bot = new Bot(seat, randomBotConfig(this.seed * 131 + seat * 17 + 7, level));
    // Reconstruit ses croyances à partir de tout ce qu'il a pu voir jusqu'ici.
    bot.observe(eventsFor(this.state.log, seat, 0), viewFor(this.state, seat));
    this.botSeen.set(seat, this.state.eventSeq);
    return bot;
  }

  /** Démarre le pilotage des bots. */
  start(): void {
    this.schedule();
  }

  view(seat: number | null): PlayerView {
    return viewFor(this.state, seat);
  }

  events(seat: number | null, since = 0): VisibleEvent[] {
    return eventsFor(this.state.log, seat, since);
  }

  /** Action d'un joueur humain ; renvoie un message d'erreur éventuel. */
  submit(seat: number, action: Action): string | null {
    if (action.player !== seat) return 'Action refusée : mauvais joueur.';
    return this.apply(action);
  }

  private apply(action: Action): string | null {
    if (this.disposed) return 'Partie fermée.';
    try {
      applyAction(this.state, action, true);
    } catch (e) {
      if (e instanceof EngineError) return e.message;
      // Une erreur interne ne doit jamais faire tomber le serveur ni l'onglet hôte.
      console.error('Erreur du moteur de jeu', e);
      return 'Erreur interne du moteur de jeu.';
    }
    this.onUpdate();
    this.schedule();
    return null;
  }

  setAutopilot(seat: number, on: boolean): void {
    if (this.seats[seat]?.kind !== 'human') return;
    if (on) {
      this.autopilot.add(seat);
      if (!this.bots.has(seat)) this.bots.set(seat, this.makeBot(seat, 'normal'));
    } else {
      this.autopilot.delete(seat);
      this.bots.delete(seat);
    }
    this.schedule();
  }

  isAutopilot(seat: number): boolean {
    return this.autopilot.has(seat);
  }

  setSpeed(speed: BotSpeed): void {
    this.speed = speed;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private feedBot(seat: number): { bot: Bot; view: PlayerView } | null {
    const bot = this.bots.get(seat);
    if (!bot) return null;
    const view = viewFor(this.state, seat);
    bot.observe(eventsFor(this.state.log, seat, this.botSeen.get(seat) ?? 0), view);
    this.botSeen.set(seat, this.state.eventSeq);
    return { bot, view };
  }

  /** Prochaine action automatique : décision d'un bot, couverture ou action libre d'un bot. */
  private nextAutomatic(): { action: Action; delay: number } | null {
    const s = this.state;
    if (s.finished) return null;
    const d = s.pending;
    if (d) {
      const isCover = (COVER_KINDS as readonly string[]).includes(d.kind) && d.options.length === 1;
      if (isCover) {
        return { action: { type: 'choose', player: d.player, decisionId: d.id, optionId: d.options[0].id }, delay: COVER_DELAY[this.speed] };
      }
      const fed = this.feedBot(d.player);
      if (fed) {
        const action = fed.bot.act(fed.view);
        if (action) return { action, delay: BOT_DELAY[this.speed] };
      }
    }
    // Actions libres des autres bots (Allie qui se soigne, David qui pille…).
    for (const seat of this.bots.keys()) {
      if (d && seat === d.player) continue;
      const fed = this.feedBot(seat);
      const action = fed?.bot.act(fed.view);
      if (action && action.type !== 'choose') return { action, delay: Math.min(400, BOT_DELAY[this.speed]) };
    }
    return null;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.disposed) return;
    if (this.speed === 'instant') {
      // Mode instantané (tests, serveur) : on enchaîne sans minuterie, sans récursion.
      for (let guard = 0; guard < 50_000; guard++) {
        const next = this.nextAutomatic();
        if (!next) return;
        try {
          applyAction(this.state, next.action, true);
        } catch (e) {
          if (!(e instanceof EngineError)) console.error('Erreur du moteur de jeu', e);
          return;
        }
        this.onUpdate();
      }
      return;
    }
    const next = this.nextAutomatic();
    if (!next) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      // Action devenue obsolète entre-temps : on recalcule.
      if (this.apply(next.action)) this.schedule();
    }, next.delay);
  }
}

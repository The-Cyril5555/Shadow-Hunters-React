// Salon : lobby puis partie. Isomorphe (navigateur hôte P2P, serveur Node, solo local).
import type { BotLevel } from '../ai/bot';
import type { GameState } from '../engine';
import { GameHost } from './host';
import {
  DEFAULT_SETTINGS, MAX_SEATS, MIN_SEATS, PROTOCOL_VERSION, randomToken,
  type ClientMessage, type HostMessage, type LobbySettings, type LobbyState, type SeatInfo,
} from './protocol';

/** Lien vers un client (connexion locale, canal WebRTC ou WebSocket). */
export interface ClientLink {
  id: string;
  send(msg: HostMessage): void;
}

interface Seat {
  name: string;
  kind: 'human' | 'bot';
  level: BotLevel;
  token: string;
  linkId: string | null;
  /** Dernier événement envoyé à ce siège. */
  sentSeq: number;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

export interface RoomSnapshot {
  code: string;
  settings: LobbySettings;
  seats: { name: string; kind: 'human' | 'bot'; level: BotLevel; token: string }[];
  state: GameState | null;
  seed: number;
}

export interface RoomOptions {
  code: string;
  settings?: Partial<LobbySettings>;
  /** Délai avant qu'un bot ne remplace un joueur déconnecté (ms). */
  autopilotDelay?: number;
  onChange?: () => void;
  seed?: number;
}

const BOT_NAMES = ['Ombre', 'Corbeau', 'Brume', 'Lanterne', 'Chardon', 'Cendre', 'Givre', 'Minuit', 'Sabbat', 'Grimoire'];

export class Room {
  readonly code: string;
  settings: LobbySettings;
  private seats: Seat[] = [];
  private links = new Map<string, ClientLink>();
  /** Lien → siège (null tant que le client ne s'est pas présenté). */
  private linkSeat = new Map<string, number | null>();
  host: GameHost | null = null;
  private readonly autopilotDelay: number;
  private readonly onChange?: () => void;
  private seed: number;

  constructor(opts: RoomOptions) {
    this.code = opts.code;
    this.settings = { ...DEFAULT_SETTINGS, ...opts.settings };
    this.autopilotDelay = opts.autopilotDelay ?? 20_000;
    this.onChange = opts.onChange;
    this.seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  }

  static restore(snapshot: RoomSnapshot, opts: Omit<RoomOptions, 'code' | 'settings' | 'seed'> = {}): Room {
    const room = new Room({ ...opts, code: snapshot.code, settings: snapshot.settings, seed: snapshot.seed });
    room.seats = snapshot.seats.map((s) => ({ ...s, linkId: null, sentSeq: 0, disconnectTimer: null }));
    if (snapshot.state) room.startGame(snapshot.state);
    return room;
  }

  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      settings: this.settings,
      seats: this.seats.map((s) => ({ name: s.name, kind: s.kind, level: s.level, token: s.token })),
      state: this.host?.state ?? null,
      seed: this.seed,
    };
  }

  get started(): boolean {
    return this.host !== null;
  }

  get humanCount(): number {
    return this.seats.filter((s) => s.kind === 'human').length;
  }

  // ─── Liens ────────────────────────────────────────────────

  connect(link: ClientLink): void {
    this.links.set(link.id, link);
    this.linkSeat.set(link.id, null);
  }

  disconnect(linkId: string): void {
    const seat = this.linkSeat.get(linkId);
    this.links.delete(linkId);
    this.linkSeat.delete(linkId);
    if (seat === null || seat === undefined) return;
    const s = this.seats[seat];
    if (!s || s.linkId !== linkId) return;
    s.linkId = null;
    if (!this.started) {
      // Dans le lobby, un joueur parti libère sa place.
      this.seats.splice(seat, 1);
      this.reindexLinks();
    } else {
      s.disconnectTimer = setTimeout(() => {
        s.disconnectTimer = null;
        this.host?.setAutopilot(seat, true);
        this.broadcastGame(false);
      }, this.autopilotDelay);
    }
    this.broadcastLobby();
    this.broadcastGame(false);
    this.onChange?.();
  }

  private reindexLinks(): void {
    this.linkSeat.forEach((_, id) => this.linkSeat.set(id, null));
    this.seats.forEach((s, i) => {
      if (s.linkId) this.linkSeat.set(s.linkId, i);
    });
  }

  private send(linkId: string, msg: HostMessage): void {
    this.links.get(linkId)?.send(msg);
  }

  // ─── Messages ─────────────────────────────────────────────

  receive(linkId: string, msg: ClientMessage): void {
    const seat = this.linkSeat.get(linkId);
    if (seat === undefined) return;
    if (msg.t === 'ping') return this.send(linkId, { t: 'pong' });
    if (msg.t === 'hello') return this.hello(linkId, msg.name, msg.token, msg.v);
    if (seat === null) return this.send(linkId, { t: 'error', message: 'Présentez-vous d\'abord.' });
    const admin = seat === 0;
    switch (msg.t) {
      case 'lobby:settings':
        if (!admin) return;
        this.settings = { ...this.settings, ...msg.settings };
        this.host?.setSpeed(this.settings.botSpeed);
        this.broadcastLobby();
        this.onChange?.();
        return;
      case 'lobby:addBot':
        if (!admin || this.started) return;
        this.addBot();
        return;
      case 'lobby:removeSeat':
        if (!admin || this.started || msg.index === 0) return;
        this.removeSeat(msg.index);
        return;
      case 'lobby:start':
        if (!admin || this.started) return;
        if (this.seats.length < MIN_SEATS) return this.send(linkId, { t: 'error', message: `Il faut au moins ${MIN_SEATS} joueurs (ajoutez des bots).` });
        this.startGame();
        return;
      case 'action': {
        if (!this.host) return;
        const err = this.host.submit(seat, msg.action);
        if (err) this.send(linkId, { t: 'error', message: err });
        return;
      }
      case 'resync':
        return this.sendGame(seat, true);
    }
  }

  private hello(linkId: string, rawName: string, token: string | undefined, v: number): void {
    if (v !== PROTOCOL_VERSION) {
      this.send(linkId, { t: 'error', message: 'Version du jeu différente : rechargez la page.' });
      return;
    }
    const name = rawName.trim().slice(0, 20) || 'Joueur';
    // Reconnexion à un siège existant.
    const existing = token ? this.seats.findIndex((s) => s.token === token && s.kind === 'human') : -1;
    if (existing >= 0) {
      const s = this.seats[existing];
      if (s.linkId && s.linkId !== linkId) {
        this.send(s.linkId, { t: 'closed', reason: 'Vous vous êtes connecté depuis un autre onglet.' });
        this.links.delete(s.linkId);
        this.linkSeat.delete(s.linkId);
      }
      s.linkId = linkId;
      if (s.disconnectTimer) clearTimeout(s.disconnectTimer);
      s.disconnectTimer = null;
      this.linkSeat.set(linkId, existing);
      this.host?.setAutopilot(existing, false);
      this.send(linkId, { t: 'welcome', seat: existing, token: s.token, lobby: this.lobbyState() });
      if (this.started) this.sendGame(existing, true);
      this.broadcastLobby();
      this.broadcastGame(false);
      return;
    }
    if (this.started) {
      this.send(linkId, { t: 'error', message: 'La partie a déjà commencé.' });
      return;
    }
    if (this.seats.length >= MAX_SEATS) {
      this.send(linkId, { t: 'error', message: 'Le salon est complet.' });
      return;
    }
    const seat: Seat = { name: this.uniqueName(name), kind: 'human', level: 'normal', token: randomToken(), linkId, sentSeq: 0, disconnectTimer: null };
    this.seats.push(seat);
    const index = this.seats.length - 1;
    this.linkSeat.set(linkId, index);
    this.send(linkId, { t: 'welcome', seat: index, token: seat.token, lobby: this.lobbyState() });
    this.broadcastLobby();
    this.onChange?.();
  }

  private uniqueName(name: string): string {
    const taken = new Set(this.seats.map((s) => s.name));
    if (!taken.has(name)) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
  }

  addBot(level?: BotLevel): void {
    if (this.seats.length >= MAX_SEATS || this.started) return;
    const used = new Set(this.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(`${n} (bot)`)) ?? `Bot ${this.seats.length + 1}`;
    this.seats.push({
      name: `${name} (bot)`, kind: 'bot', level: level ?? this.settings.botLevel, token: randomToken(), linkId: null, sentSeq: 0, disconnectTimer: null,
    });
    this.broadcastLobby();
    this.onChange?.();
  }

  private removeSeat(index: number): void {
    const s = this.seats[index];
    if (!s) return;
    if (s.linkId) {
      this.send(s.linkId, { t: 'closed', reason: 'L\'hôte vous a retiré du salon.' });
      this.linkSeat.set(s.linkId, null);
    }
    this.seats.splice(index, 1);
    this.reindexLinks();
    this.broadcastLobby();
    this.onChange?.();
  }

  startGame(state?: GameState): void {
    if (this.host) return;
    this.host = new GameHost({
      seats: this.seats.map((s) => ({ name: s.name, kind: s.kind, level: s.level })),
      pool: this.settings.pool,
      seed: this.seed,
      speed: this.settings.botSpeed,
      state,
      onUpdate: () => {
        this.broadcastGame(false);
        this.onChange?.();
      },
    });
    this.seats.forEach((s) => (s.sentSeq = 0));
    this.broadcastLobby();
    this.broadcastGame(true);
    this.host.start();
    this.onChange?.();
  }

  // ─── Diffusion ────────────────────────────────────────────

  seatInfos(): SeatInfo[] {
    return this.seats.map((s, index) => ({
      index,
      name: s.name,
      kind: s.kind,
      connected: s.kind === 'bot' || s.linkId !== null,
      autopilot: this.host?.isAutopilot(index) ?? false,
    }));
  }

  lobbyState(): LobbyState {
    return { code: this.code, seats: this.seatInfos(), settings: this.settings, started: this.started, adminSeat: 0 };
  }

  private broadcastLobby(): void {
    const lobby = this.lobbyState();
    for (const s of this.seats) if (s.linkId) this.send(s.linkId, { t: 'lobby', lobby });
  }

  private sendGame(seat: number, full: boolean): void {
    const s = this.seats[seat];
    if (!s?.linkId || !this.host) return;
    const since = full ? 0 : s.sentSeq;
    const events = this.host.events(seat, since);
    s.sentSeq = this.host.state.eventSeq;
    this.send(s.linkId, { t: 'game', view: this.host.view(seat), events, full, seats: this.seatInfos() });
  }

  private broadcastGame(full: boolean): void {
    if (!this.host) return;
    this.seats.forEach((_, i) => this.sendGame(i, full));
  }

  dispose(): void {
    this.host?.dispose();
    for (const s of this.seats) if (s.disconnectTimer) clearTimeout(s.disconnectTimer);
    for (const id of this.links.keys()) this.send(id, { t: 'closed', reason: 'La partie a été fermée par l\'hôte.' });
    this.links.clear();
  }
}

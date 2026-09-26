// Gestion de la session en cours : solo, hôte P2P, invité P2P ou serveur.
import type { Action } from '../engine';
import { Room, type RoomSnapshot } from '../net/room';
import { PROTOCOL_VERSION, randomCode, type ClientMessage, type HostMessage, type LobbySettings } from '../net/protocol';
import type { Connection } from '../net/transports/connection';
import { connectLocal } from '../net/transports/local';
import { KEYS, load, remove, save } from './storage';
import { useStore, type SessionMode } from './store';

let conn: Connection | null = null;
let room: Room | null = null;
let closeHost: (() => void) | null = null;
let unsubscribe: Array<() => void> = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function tokens(): Record<string, string> {
  return load<Record<string, string>>(KEYS.tokens, {});
}

function handle(msg: HostMessage): void {
  const st = useStore.getState();
  switch (msg.t) {
    case 'welcome': {
      const code = msg.lobby.code;
      save(KEYS.tokens, { ...tokens(), [code]: msg.token });
      useStore.setState({
        seat: msg.seat,
        lobby: msg.lobby,
        code,
        notes: load(`${KEYS.notes}-${code}`, {}),
        busy: null,
        screen: msg.lobby.started ? 'game' : 'lobby',
      });
      return;
    }
    case 'lobby':
      if (!msg.lobby.started && st.screen === 'game') {
        // L'hôte a relancé une partie : retour au salon.
        useStore.setState({ lobby: msg.lobby, seats: msg.lobby.seats, screen: 'lobby', view: null, log: [], fxFrom: 0 });
        return;
      }
      useStore.setState({ lobby: msg.lobby, seats: msg.lobby.seats, ...(msg.lobby.started && st.screen === 'lobby' ? { screen: 'game' } : {}) });
      return;
    case 'game': {
      const log = msg.full ? msg.events : [...st.log, ...msg.events];
      useStore.setState({
        view: msg.view,
        seats: msg.seats,
        log,
        ...(msg.full ? { fxFrom: msg.view.lastSeq } : {}),
        ...(st.screen === 'lobby' || st.screen === 'multi' || st.screen === 'solo' ? { screen: 'game' } : {}),
      });
      return;
    }
    case 'error':
      useStore.setState({ error: msg.message, busy: null });
      return;
    case 'closed':
      endSession(msg.reason);
      return;
    case 'pong':
      return;
  }
}

function attach(c: Connection, mode: SessionMode): void {
  conn = c;
  unsubscribe.push(c.onMessage(handle));
  if (c.onClose) unsubscribe.push(c.onClose((reason) => endSession(reason)));
  useStore.setState({ mode, error: null });
}

export function send(msg: ClientMessage): void {
  conn?.send(msg);
}

export function act(action: Action): void {
  send({ t: 'action', action });
}

function hello(code: string, token = tokens()[code]): void {
  const name = useStore.getState().settings.name || 'Joueur';
  send({ t: 'hello', v: PROTOCOL_VERSION, name, token });
}

/** Écrit (ou efface, si la partie est finie) la sauvegarde du solo. */
function persist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!room || useStore.getState().mode !== 'solo') return;
  const snap = room.snapshot();
  if (!snap.state) return;
  if (snap.state.finished) {
    remove(KEYS.save);
    useStore.setState({ hasSave: false });
  } else {
    save(KEYS.save, snap);
    useStore.setState({ hasSave: true });
  }
}

function scheduleSave(): void {
  if (!room) return;
  if (room.host?.state.finished) return persist();
  if (!saveTimer) saveTimer = setTimeout(persist, 400);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', persist);

// ─── Solo ───────────────────────────────────────────────────

export function startSolo(players: number, settings: LobbySettings): void {
  leave();
  const code = `SOLO-${randomCode(4)}`;
  room = new Room({ code, settings, onChange: scheduleSave });
  attach(connectLocal(room), 'solo');
  hello(code);
  for (let i = 1; i < players; i++) room.addBot();
  // Le premier message local arrive après une micro-tâche : on lance la partie tout de suite.
  room.startGame();
}

export function resumeSolo(): boolean {
  const snap = load<RoomSnapshot | null>(KEYS.save, null);
  if (!snap?.state) return false;
  leave();
  room = Room.restore(snap, { onChange: scheduleSave });
  attach(connectLocal(room), 'solo');
  hello(snap.code, snap.seats[0]?.token);
  return true;
}

export function discardSave(): void {
  remove(KEYS.save);
  useStore.setState({ hasSave: false });
}

// ─── Multijoueur ────────────────────────────────────────────

export async function hostP2P(settings: LobbySettings): Promise<void> {
  leave();
  useStore.setState({ busy: 'Ouverture du salon…', error: null });
  try {
    const { hostPeerRoom } = await import('../net/transports/peer');
    const hosted = await hostPeerRoom((code) => new Room({ code, settings }));
    room = hosted.room;
    closeHost = hosted.close;
    attach(connectLocal(room), 'p2p-host');
    hello(hosted.code);
  } catch (e) {
    useStore.setState({ busy: null, error: (e as Error).message });
  }
}

export async function joinP2P(code: string): Promise<void> {
  leave();
  useStore.setState({ busy: 'Connexion à l\'hôte…', error: null });
  try {
    const { joinPeerRoom } = await import('../net/transports/peer');
    const c = await joinPeerRoom(code);
    attach(c, 'p2p-guest');
    hello(code.trim().toUpperCase());
  } catch (e) {
    useStore.setState({ busy: null, error: (e as Error).message });
  }
}

export async function connectToServer(serverUrl: string, code?: string): Promise<void> {
  leave();
  useStore.setState({ busy: code ? 'Connexion au salon…' : 'Création du salon sur le serveur…', error: null });
  try {
    const { connectServer } = await import('../net/transports/ws-client');
    const c = await connectServer(serverUrl, code);
    attach(c, 'ws');
    // Le serveur attend « hello » ; le jeton éventuel est retrouvé après le « welcome ».
    const name = useStore.getState().settings.name || 'Joueur';
    send({ t: 'hello', v: PROTOCOL_VERSION, name, token: code ? tokens()[code.trim().toUpperCase()] : undefined });
  } catch (e) {
    useStore.setState({ busy: null, error: (e as Error).message });
  }
}

// ─── Fin de session ─────────────────────────────────────────

function endSession(reason?: string): void {
  leave();
  useStore.setState({ screen: 'menu', error: reason ?? null });
}

export function leave(): void {
  unsubscribe.forEach((u) => u());
  unsubscribe = [];
  persist();
  conn?.close();
  conn = null;
  if (closeHost) closeHost();
  else room?.dispose();
  closeHost = null;
  room = null;
  useStore.setState({ mode: null, code: null, seat: null, lobby: null, seats: [], view: null, log: [], fxFrom: 0, busy: null });
}

export function isHostingLocally(): boolean {
  return room !== null;
}

/** Réglage de vitesse des bots, appliqué en cours de partie si l'on est hôte. */
export function setBotSpeed(speed: LobbySettings['botSpeed']): void {
  send({ t: 'lobby:settings', settings: { botSpeed: speed } });
}

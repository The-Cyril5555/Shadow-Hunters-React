// Client WebSocket vers le serveur Node (server/index.ts).
import type { ClientMessage, HostMessage } from '../protocol';
import type { Connection } from './connection';

export function normalizeServerUrl(url: string): string {
  let u = url.trim();
  if (!u) return u;
  if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
  else if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
  else if (!u.startsWith('ws://') && !u.startsWith('wss://')) u = 'wss://' + u;
  return u.replace(/\/+$/, '');
}

/** Crée (code absent) ou rejoint un salon sur le serveur. */
export function connectServer(serverUrl: string, code?: string): Promise<Connection> {
  const base = normalizeServerUrl(serverUrl);
  const url = code ? `${base}/?room=${encodeURIComponent(code.trim().toUpperCase())}` : `${base}/?create=1`;
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      reject(new Error('Adresse de serveur invalide.'));
      return;
    }
    const listeners = new Set<(msg: HostMessage) => void>();
    const closeListeners = new Set<(reason: string) => void>();
    let opened = false;
    let ping: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      if (!opened) {
        ws.close();
        reject(new Error('Le serveur ne répond pas. S\'il est hébergé gratuitement, il peut mettre une minute à se réveiller : réessayez.'));
      }
    }, 70_000);
    ws.onopen = () => {
      opened = true;
      clearTimeout(timeout);
      ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping' })), 25_000);
      resolve({
        kind: 'ws',
        send: (msg: ClientMessage) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); },
        onMessage: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        onClose: (cb) => { closeListeners.add(cb); return () => closeListeners.delete(cb); },
        close: () => ws.close(),
      });
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as HostMessage;
        listeners.forEach((l) => l(msg));
      } catch {
        /* message illisible ignoré */
      }
    };
    ws.onclose = (ev) => {
      if (ping) clearInterval(ping);
      if (!opened) {
        clearTimeout(timeout);
        reject(new Error(ev.reason || 'Connexion au serveur impossible.'));
        return;
      }
      closeListeners.forEach((l) => l(ev.reason || 'La connexion au serveur a été perdue.'));
    };
  });
}

// Connexion locale : le client et le salon vivent dans le même onglet (solo, hôte P2P).
import type { Room } from '../room';
import type { ClientMessage, HostMessage } from '../protocol';
import type { Connection } from './connection';

let nextId = 1;

export function connectLocal(room: Room): Connection {
  const id = `local-${nextId++}`;
  const listeners = new Set<(msg: HostMessage) => void>();
  let closed = false;
  room.connect({
    id,
    // Livraison asynchrone, comme sur un vrai réseau (évite les réentrances dans React).
    send: (msg) => queueMicrotask(() => {
      if (!closed) listeners.forEach((l) => l(msg));
    }),
  });
  return {
    kind: 'local',
    send: (msg: ClientMessage) => {
      if (!closed) room.receive(id, structuredClone(msg));
    },
    onMessage: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close: () => {
      closed = true;
      room.disconnect(id);
    },
  };
}

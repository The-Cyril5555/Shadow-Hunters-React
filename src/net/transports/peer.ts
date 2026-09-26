// Pair-à-pair WebRTC via PeerJS : l'onglet de l'hôte fait tourner la partie.
import Peer, { type DataConnection } from 'peerjs';
import type { Room } from '../room';
import { isClientMessage, randomCode, type ClientMessage, type HostMessage } from '../protocol';
import type { Connection } from './connection';

const PREFIX = 'shadow-hunters-react-';

export interface PeerHost {
  code: string;
  close(): void;
}

function describePeerError(err: { type?: string; message?: string }): string {
  switch (err.type) {
    case 'peer-unavailable': return 'Salon introuvable : vérifiez le code (l\'hôte doit garder son onglet ouvert).';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return 'Impossible de joindre le service de mise en relation. Vérifiez votre connexion.';
    case 'browser-incompatible': return 'Ce navigateur ne prend pas en charge WebRTC.';
    default: return err.message || 'Erreur de connexion pair-à-pair.';
  }
}

/** Ouvre un salon P2P : les clients distants sont reliés au salon local. */
export function hostPeerRoom(makeRoom: (code: string) => Room): Promise<PeerHost & { room: Room }> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryOpen = () => {
      const code = randomCode();
      const peer = new Peer(PREFIX + code, { debug: 0 });
      let room: Room | null = null;
      peer.on('open', () => {
        room = makeRoom(code);
        const r = room;
        resolve({ code, room: r, close: () => { r.dispose(); peer.destroy(); } });
      });
      peer.on('connection', (conn: DataConnection) => {
        const id = `peer-${conn.connectionId}`;
        conn.on('open', () => {
          room?.connect({ id, send: (msg: HostMessage) => { if (conn.open) conn.send(msg); } });
        });
        conn.on('data', (data) => {
          if (isClientMessage(data)) room?.receive(id, data);
        });
        conn.on('close', () => room?.disconnect(id));
        conn.on('error', () => room?.disconnect(id));
      });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && attempts++ < 5) {
          peer.destroy();
          tryOpen();
          return;
        }
        if (!room) reject(new Error(describePeerError(err)));
      });
      peer.on('disconnected', () => {
        // Perte du service de mise en relation : les connexions établies restent actives.
        if (!peer.destroyed) peer.reconnect();
      });
    };
    tryOpen();
  });
}

/** Rejoint un salon P2P à partir de son code. */
export function joinPeerRoom(code: string): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 });
    const listeners = new Set<(msg: HostMessage) => void>();
    const closeListeners = new Set<(reason: string) => void>();
    let settled = false;
    let conn: DataConnection | null = null;
    const fail = (message: string) => {
      if (!settled) {
        settled = true;
        reject(new Error(message));
        peer.destroy();
      } else {
        closeListeners.forEach((l) => l(message));
      }
    };
    const timeout = setTimeout(() => fail('Le salon ne répond pas (délai dépassé).'), 15_000);
    peer.on('open', () => {
      conn = peer.connect(PREFIX + code.trim().toUpperCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        clearTimeout(timeout);
        settled = true;
        resolve({
          kind: 'peer',
          send: (msg: ClientMessage) => { if (conn?.open) conn.send(msg); },
          onMessage: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
          onClose: (cb) => { closeListeners.add(cb); return () => closeListeners.delete(cb); },
          close: () => { conn?.close(); peer.destroy(); },
        });
      });
      conn.on('data', (data) => listeners.forEach((l) => l(data as HostMessage)));
      conn.on('close', () => fail('La connexion avec l\'hôte a été perdue.'));
      conn.on('error', (e) => fail(e.message));
    });
    peer.on('error', (err) => {
      clearTimeout(timeout);
      fail(describePeerError(err));
    });
  });
}

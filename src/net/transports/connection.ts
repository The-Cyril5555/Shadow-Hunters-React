import type { ClientMessage, HostMessage } from '../protocol';

/** Connexion d'un client vers un hôte, quel que soit le transport. */
export interface Connection {
  kind: 'local' | 'peer' | 'ws';
  send(msg: ClientMessage): void;
  onMessage(cb: (msg: HostMessage) => void): () => void;
  /** Appelé si la connexion est perdue. */
  onClose?(cb: (reason: string) => void): () => void;
  close(): void;
}

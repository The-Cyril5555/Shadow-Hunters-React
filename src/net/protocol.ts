// Protocole entre un client et l'hôte d'une partie (même format en local, en P2P et via le serveur).
import type { BotLevel } from '../ai/bot';
import type { Action, CharacterPool, PlayerView, VisibleEvent } from '../engine';

export const PROTOCOL_VERSION = 1;
export const MAX_SEATS = 8;
export const MIN_SEATS = 4;

export type BotSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface LobbySettings {
  pool: CharacterPool;
  botLevel: BotLevel;
  botSpeed: BotSpeed;
}

export interface SeatInfo {
  index: number;
  name: string;
  kind: 'human' | 'bot';
  connected: boolean;
  /** Un bot joue temporairement à la place d'un humain déconnecté. */
  autopilot: boolean;
}

export interface LobbyState {
  code: string;
  seats: SeatInfo[];
  settings: LobbySettings;
  started: boolean;
  adminSeat: number;
}

export type ClientMessage =
  | { t: 'hello'; v: number; name: string; token?: string }
  | { t: 'lobby:settings'; settings: Partial<LobbySettings> }
  | { t: 'lobby:addBot' }
  | { t: 'lobby:removeSeat'; index: number }
  | { t: 'lobby:start' }
  | { t: 'action'; action: Action }
  | { t: 'resync' }
  | { t: 'ping' };

export type HostMessage =
  | { t: 'welcome'; seat: number; token: string; lobby: LobbyState }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'game'; view: PlayerView; events: VisibleEvent[]; full: boolean; seats: SeatInfo[] }
  | { t: 'error'; message: string }
  | { t: 'pong' }
  | { t: 'closed'; reason: string };

export const DEFAULT_SETTINGS: LobbySettings = { pool: 'mixed', botLevel: 'normal', botSpeed: 'normal' };

export const BOT_DELAY: Record<BotSpeed, number> = { slow: 1700, normal: 1000, fast: 450, instant: 0 };
export const COVER_DELAY: Record<BotSpeed, number> = { slow: 700, normal: 450, fast: 200, instant: 0 };

export function randomToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 5): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function isClientMessage(x: unknown): x is ClientMessage {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string';
}

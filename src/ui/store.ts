import { create } from 'zustand';
import type { Faction, PlayerView, VisibleEvent } from '../engine';
import type { BotSpeed, LobbyState, SeatInfo } from '../net/protocol';
import { KEYS, load, save } from './storage';

export type Screen = 'menu' | 'solo' | 'multi' | 'lobby' | 'game' | 'rules' | 'settings';
export type SessionMode = 'solo' | 'p2p-host' | 'p2p-guest' | 'ws';

export interface Settings {
  name: string;
  volume: number;
  speed: BotSpeed;
  reducedMotion: boolean;
  serverUrl: string;
}

export interface Note {
  faction?: Faction | null;
  text?: string;
}

const DEFAULT_SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';

const defaultSettings: Settings = {
  name: '',
  volume: 0.6,
  speed: 'normal',
  reducedMotion: false,
  serverUrl: DEFAULT_SERVER,
};

interface UiState {
  screen: Screen;
  previousScreen: Screen;
  settings: Settings;
  mode: SessionMode | null;
  code: string | null;
  seat: number | null;
  lobby: LobbyState | null;
  seats: SeatInfo[];
  view: PlayerView | null;
  log: VisibleEvent[];
  /** Les effets visuels ne rejouent que les événements après ce numéro. */
  fxFrom: number;
  error: string | null;
  busy: string | null;
  notes: Record<number, Note>;
  hasSave: boolean;
  go(screen: Screen): void;
  updateSettings(patch: Partial<Settings>): void;
  setError(error: string | null): void;
  setNote(player: number, patch: Partial<Note>): void;
}

export const useStore = create<UiState>((set, get) => ({
  screen: 'menu',
  previousScreen: 'menu',
  settings: { ...defaultSettings, ...load<Partial<Settings>>(KEYS.settings, {}) },
  mode: null,
  code: null,
  seat: null,
  lobby: null,
  seats: [],
  view: null,
  log: [],
  fxFrom: 0,
  error: null,
  busy: null,
  notes: {},
  hasSave: load<unknown>(KEYS.save, null) !== null,
  go: (screen) => set({ screen, previousScreen: get().screen }),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    save(KEYS.settings, settings);
    set({ settings });
  },
  setError: (error) => set({ error }),
  setNote: (player, patch) => {
    const notes = { ...get().notes, [player]: { ...get().notes[player], ...patch } };
    set({ notes });
    const code = get().code;
    if (code) save(`${KEYS.notes}-${code}`, notes);
  },
}));

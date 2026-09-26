// État des effets visuels en cours (séparé du store principal pour ne pas
// redessiner toute la partie à chaque étincelle).
import { create } from 'zustand';
import type { AreaId, CardId, CharacterId, DeckId } from '../engine';

export type Overlay =
  | { kind: 'dice'; d6?: number; d4?: number; label: string; result: string }
  | { kind: 'card'; card: CardId; label: string }
  | { kind: 'banner'; text: string; tone: 'turn' | 'me' | 'reveal' | 'death'; character?: CharacterId };

export type Tone = 'attack' | 'heal' | 'card' | 'hermit' | 'info';

export interface Arrow {
  id: number;
  from: string;
  to: string;
  tone: Tone;
}

export type FlyerContent =
  | { type: 'back'; deck: DeckId }
  | { type: 'card'; card: CardId }
  | { type: 'chip'; card: CardId };

export interface Flyer {
  id: number;
  from: string;
  to: string;
  content: FlyerContent;
  ms: number;
}

export interface Bubble {
  id: number;
  target: string;
  text: string;
  tone: 'dmg' | 'heal' | 'info' | 'miss' | 'ability' | 'protect' | 'gold';
}

/** Effet appliqué à un joueur (tapis et pion). */
export type Pulse = 'turn' | 'hit' | 'heal' | 'attack' | 'target' | 'protect' | 'ability' | 'reveal' | 'death' | 'focus';

export interface FxState {
  overlay: (Overlay & { key: number }) | null;
  rolling: boolean;
  caption: { text: string; key: number } | null;
  arrows: Arrow[];
  flyers: Flyer[];
  bubbles: Bubble[];
  pulses: Record<number, Pulse>;
  areaFx: Partial<Record<AreaId, 'dest' | 'action' | 'boom'>>;
  deckFx: Partial<Record<DeckId, 'draw' | 'shuffle'>>;
  /** Des actions sont en attente d'animation : on bloque les choix du joueur. */
  animating: boolean;
}

export const initialFx: FxState = {
  overlay: null,
  rolling: false,
  caption: null,
  arrows: [],
  flyers: [],
  bubbles: [],
  pulses: {},
  areaFx: {},
  deckFx: {},
  animating: false,
};

export const useFx = create<FxState>(() => ({ ...initialFx }));

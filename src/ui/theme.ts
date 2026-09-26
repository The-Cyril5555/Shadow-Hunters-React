import type { AreaId, DeckId, Faction } from '../engine';

const BASE = import.meta.env.BASE_URL;

export const PLAYER_COLORS = ['#e85d5d', '#4f9dff', '#5ecf6a', '#f2c14e', '#b77cff', '#ff9447', '#4fd6d0', '#f27ac0'];
export const PLAYER_COLOR_NAMES = ['rouge', 'bleu', 'vert', 'jaune', 'violet', 'orange', 'cyan', 'rose'];

export function playerColor(id: number): string {
  return PLAYER_COLORS[id % PLAYER_COLORS.length];
}

export const FACTION_COLORS: Record<Faction, string> = {
  hunter: '#4aa3ff',
  shadow: '#ff5566',
  neutral: '#e8c34a',
};

export const FACTION_LABEL: Record<Faction, string> = { hunter: 'Hunter', shadow: 'Shadow', neutral: 'Neutre' };

export const DECK_STYLE: Record<DeckId, { label: string; symbol: string }> = {
  hermit: { label: 'Ermite', symbol: '☽' },
  white: { label: 'Lumière', symbol: '✚' },
  black: { label: 'Ténèbres', symbol: '☠' },
};

export function characterImage(id: string | null): string {
  return `${BASE}assets/characters/${id ?? 'back'}.png`;
}

export function areaImage(id: AreaId): string {
  return `${BASE}assets/areas/${id}.png`;
}

export function uiImage(name: string): string {
  return `${BASE}assets/ui/${name}`;
}

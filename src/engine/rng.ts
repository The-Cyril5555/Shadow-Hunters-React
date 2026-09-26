// PRNG mulberry32 : un seul entier 32 bits d'état, stocké dans le GameState.
import type { GameState } from './types';

export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: { rng: number }, n: number): number {
  return Math.floor(nextRandom(state) * n);
}

export function rollDie(state: GameState, sides: number): number {
  // Dés imposés : utilisé par les tests pour rendre un scénario déterministe.
  if (state.forcedRolls?.length) return state.forcedRolls.shift() as number;
  return 1 + randInt(state, sides);
}

export function shuffle<T>(state: { rng: number }, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

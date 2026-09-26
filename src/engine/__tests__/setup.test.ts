import { describe, expect, it } from 'vitest';
import { createGame } from '../engine';
import { CHARACTERS, FACTION_COUNTS } from '../data/characters';
import { deckCards } from '../data/cards';

describe('mise en place', () => {
  it('respecte la répartition officielle des factions', () => {
    for (let n = 4; n <= 8; n++) {
      for (const pool of ['base', 'expansion', 'mixed'] as const) {
        for (let seed = 0; seed < 30; seed++) {
          const s = createGame({ playerNames: Array.from({ length: n }, (_, i) => `J${i}`), pool, seed });
          const counts = { hunter: 0, shadow: 0, neutral: 0 };
          for (const p of s.players) counts[CHARACTERS[p.character].faction]++;
          expect(counts).toEqual(FACTION_COUNTS[n]);
          const ids = s.players.map((p) => p.character);
          expect(new Set(ids).size).toBe(n);
          if (pool === 'mixed') {
            const letters = ids.map((c) => CHARACTERS[c].letter);
            expect(new Set(letters).size).toBe(n);
          }
          if (pool === 'base') expect(ids.every((c) => !CHARACTERS[c].expansion)).toBe(true);
          if (pool === 'expansion') expect(ids.every((c) => CHARACTERS[c].expansion)).toBe(true);
        }
      }
    }
  });

  it('4 joueurs : 2 Hunters, 2 Shadows, aucun Neutre', () => {
    expect(FACTION_COUNTS[4]).toEqual({ hunter: 2, shadow: 2, neutral: 0 });
  });

  it('a 16 cartes par paquet et 6 lieux', () => {
    expect(deckCards('hermit')).toHaveLength(16);
    expect(deckCards('white')).toHaveLength(16);
    expect(deckCards('black')).toHaveLength(16);
    const s = createGame({ playerNames: ['a', 'b', 'c', 'd'], pool: 'base', seed: 3 });
    expect(new Set(s.areas).size).toBe(6);
    expect(s.pending?.kind).toBe('turn_start');
  });

  it('points de vie selon l\'initiale', () => {
    const hp: Record<string, number> = { A: 8, B: 10, C: 11, D: 13, E: 10, F: 12, G: 14, U: 11, V: 13, W: 14 };
    for (const c of Object.values(CHARACTERS)) expect(c.hp).toBe(hp[c.letter]);
  });
});

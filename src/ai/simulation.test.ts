import { describe, expect, it } from 'vitest';
import { CHARACTERS, type GameState } from '../engine';
import { simulateGame } from './simulate';

function checkInvariants(s: GameState): void {
  let cards = 0;
  for (const d of Object.values(s.decks)) cards += d.draw.length + d.discard.length;
  for (const p of s.players) {
    cards += p.equipment.length;
    expect(p.damage).toBeGreaterThanOrEqual(0);
    expect(p.damage).toBeLessThanOrEqual(CHARACTERS[p.character].hp);
    if (p.alive) expect(p.damage).toBeLessThan(CHARACTERS[p.character].hp);
  }
  const lootPending = s.pending?.kind === 'loot' || s.stack.some((st) => st.t === 'loot');
  if (!lootPending && !s.finished) {
    for (const p of s.players) if (!p.alive) expect(p.equipment).toEqual([]);
  }
  // Cartes en cours de résolution : carte Ermite en main, carte à usage unique avant défausse.
  cards += s.stack.filter((st) => st.t === 'discard').length;
  if (s.pending && (s.pending.kind === 'hermit_give' || s.pending.kind === 'hermit_respond')) cards++;
  expect(cards).toBe(48);
}

describe('simulation de parties entre bots', () => {
  it('toutes les parties se terminent avec au moins un gagnant et des invariants respectés', () => {
    let games = 0;
    for (let g = 0; g < 450; g++) {
      const players = 4 + (g % 5);
      const pool = (['base', 'expansion', 'mixed'] as const)[g % 3];
      const level = (['easy', 'normal', 'hard'] as const)[Math.floor(g / 3) % 3];
      const { state } = simulateGame({ players, pool, seed: 9000 + g, level, onState: g % 10 === 0 ? checkInvariants : undefined });
      checkInvariants(state);
      expect(state.finished).toBe(true);
      expect(state.winners.length).toBeGreaterThan(0);
      expect(state.turn.number).toBeLessThan(400);
      games++;
    }
    expect(games).toBe(450);
  });

  it('une même graine donne la même partie', () => {
    const a = simulateGame({ players: 6, pool: 'mixed', seed: 77 });
    const b = simulateGame({ players: 6, pool: 'mixed', seed: 77 });
    expect(a.state.log.map((e) => e.text)).toEqual(b.state.log.map((e) => e.text));
  });
});

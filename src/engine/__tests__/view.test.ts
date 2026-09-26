import { describe, expect, it } from 'vitest';
import { createGame } from '../engine';
import { viewFor } from '../view';

describe('vue d\'un joueur', () => {
  it('ne révèle que son propre personnage', () => {
    const s = createGame({ playerNames: ['a', 'b', 'c', 'd', 'e'], pool: 'mixed', seed: 11 });
    for (let me = 0; me < 5; me++) {
      const v = viewFor(s, me);
      v.players.forEach((p) => {
        if (p.id === me) expect(p.character).toBe(s.players[me].character);
        else expect(p.character).toBeNull();
      });
    }
  });

  it('les options d\'une décision ne sont visibles que du décideur, jamais son contexte', () => {
    const s = createGame({ playerNames: ['a', 'b', 'c', 'd'], pool: 'base', seed: 5 });
    const active = s.pending!.player;
    const mine = viewFor(s, active);
    expect(mine.pending?.options?.length).toBeGreaterThan(0);
    const other = viewFor(s, (active + 1) % 4);
    expect(other.pending?.options).toBeUndefined();
    expect(other.pending?.publicLabel).toBeTruthy();
    expect(JSON.stringify(mine)).not.toContain('ctx');
  });

  it('les pioches ne révèlent pas leur ordre', () => {
    const s = createGame({ playerNames: ['a', 'b', 'c', 'd'], pool: 'base', seed: 5 });
    const v = viewFor(s, 0);
    expect(JSON.stringify(v.decks)).not.toContain('#');
    expect(v.decks.white.drawCount).toBe(16);
  });
});

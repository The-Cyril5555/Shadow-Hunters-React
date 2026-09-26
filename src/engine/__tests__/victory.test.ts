import { describe, expect, it } from 'vitest';
import { applyAction } from '../engine';
import { computeWinners } from '../victory';
import type { GameState } from '../types';
import { choose, play, rolls, scenario, skipCovers, type ScenarioPlayer } from './helpers';

function kill(players: ScenarioPlayer[], dice = [3, 1]): GameState {
  const ps = players.map((p, i) => (i === 0 ? { ...p, area: 'hermit' as const } : p));
  const s = play(scenario(ps, { rolls: [3, 3] }), 'roll', 'skip');
  return skipCovers(choose(rolls(s, ...dice), 'attack:1'));
}

describe('conditions de victoire', () => {
  it('Hunters : tous les Shadows sont morts', () => {
    const s = kill([{ c: 'franklin' }, { c: 'vampire', area: 'church', damage: 12 }, { c: 'emi' }, { c: 'werewolf', alive: false }]);
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([0, 2]);
  });

  it('Shadows : tous les Hunters sont morts', () => {
    const s = kill([{ c: 'vampire' }, { c: 'franklin', area: 'church', damage: 11 }, { c: 'werewolf' }, { c: 'emi', alive: false }]);
    expect(s.winners).toEqual([0, 2]);
  });

  it('Shadows : trois Neutres sont morts', () => {
    const s = kill([
      { c: 'vampire' }, { c: 'bob', area: 'church', damage: 9 }, { c: 'allie', alive: false }, { c: 'charles', alive: false },
      { c: 'franklin' }, { c: 'emi' }, { c: 'werewolf' },
    ]);
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([0, 6]);
  });

  it('Daniel gagne s\'il est le premier mort', () => {
    const s = kill([{ c: 'franklin' }, { c: 'daniel', area: 'church', damage: 12 }, { c: 'vampire' }, { c: 'werewolf' }, { c: 'emi' }]);
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([1]);
  });

  it('Catherine gagne si elle est l\'une des deux dernières en vie', () => {
    const s = kill([{ c: 'catherine' }, { c: 'franklin', area: 'church', damage: 11 }, { c: 'vampire', area: 'woods' }, { c: 'werewolf', alive: false }, { c: 'emi', alive: false }]);
    expect(s.finished).toBe(true);
    // Les Shadows gagnent (même morts) et Catherine fait partie des deux survivants.
    expect(s.winners).toEqual([0, 2, 3]);
  });

  it('Allie gagne si elle est en vie à la fin', () => {
    const s = kill([{ c: 'franklin' }, { c: 'vampire', area: 'church', damage: 12 }, { c: 'allie' }, { c: 'werewolf', alive: false }, { c: 'emi' }]);
    expect(s.winners).toEqual([0, 2, 4]);
  });

  it('Agnès gagne avec le joueur à sa droite (ou à sa gauche après Caprice)', () => {
    const s = kill([{ c: 'franklin' }, { c: 'vampire', area: 'church', damage: 12 }, { c: 'agnes' }, { c: 'werewolf', alive: false }, { c: 'emi' }]);
    // Droite d'Agnès (siège 2) = siège 1 (Vampire, perdant).
    expect(s.winners).toEqual([0, 4]);
    const s2 = structuredClone(s);
    s2.players[2].agnesLeft = true;
    // Gauche = siège 3 (Loup-garou, perdant) ; testons avec un Hunter à gauche.
    s2.players[3].character = 'george';
    expect(computeWinners(s2)).toContain(2);
  });

  it('Bob gagne avec 5 équipements', () => {
    const s0 = scenario([{ c: 'bob', area: 'hermit', equipment: ['talisman#1', 'chainsaw#1', 'handgun#1', 'holy_robe#1'] }, { c: 'franklin' }, { c: 'vampire' }, { c: 'werewolf' }, { c: 'emi' }], { rolls: [3, 3] });
    s0.decks.white.draw = s0.decks.white.draw.filter((c) => c !== 'mystic_compass#1');
    s0.decks.white.draw.push('mystic_compass#1');
    const s = play(s0, 'roll', 'draw:white');
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([0]);
  });

  it('David gagne avec 3 reliques', () => {
    const s0 = scenario([{ c: 'franklin' }, { c: 'david', equipment: ['talisman#1', 'holy_robe#1'] }, { c: 'vampire' }, { c: 'werewolf' }, { c: 'emi' }]);
    s0.decks.white.draw = s0.decks.white.draw.filter((c) => c !== 'silver_rosary#1');
    s0.decks.white.discard.push('silver_rosary#1');
    const s = applyAction(s0, { type: 'ability', player: 1, optionId: 'david:silver_rosary#1' }).state;
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([1]);
  });

  it('Charles gagne s\'il tue alors qu\'il y a 3 morts ou plus', () => {
    const s = kill([
      { c: 'charles' }, { c: 'franklin', area: 'church', damage: 11 }, { c: 'allie', alive: false }, { c: 'bob', alive: false },
      { c: 'vampire' }, { c: 'emi' }, { c: 'werewolf' },
    ]);
    expect(s.finished).toBe(true);
    expect(s.winners).toContain(0);
  });

  it('Bryan gagne s\'il tue un personnage de 13 PV ou plus, ou s\'il est au Sanctuaire à la fin', () => {
    const s = kill([{ c: 'bryan' }, { c: 'george', area: 'church', damage: 13 }, { c: 'emi' }, { c: 'vampire' }, { c: 'werewolf' }]);
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual([0]);
    const s2 = kill([{ c: 'franklin' }, { c: 'vampire', area: 'church', damage: 12 }, { c: 'bryan', area: 'altar' }, { c: 'werewolf', alive: false }, { c: 'emi' }]);
    expect(s2.winners).toContain(2);
  });
});

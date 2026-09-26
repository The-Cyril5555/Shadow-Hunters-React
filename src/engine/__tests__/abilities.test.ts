import { describe, expect, it } from 'vitest';
import { applyAction, anytimeOptions } from '../engine';
import { dealDamage } from '../helpers';
import type { GameState } from '../types';
import { choose, optionIds, play, rolls, scenario, skipCovers, type ScenarioPlayer } from './helpers';

function toAttack(players: ScenarioPlayer[]): GameState {
  const ps = players.map((p, i) => (i === 0 ? { ...p, area: 'hermit' as const } : p));
  return play(scenario(ps, { rolls: [3, 3] }), 'roll', 'skip');
}

const REST: ScenarioPlayer[] = [{ c: 'emi', area: 'woods' }, { c: 'werewolf', area: 'altar' }, { c: 'allie', area: 'altar' }];

describe('capacités de début de tour', () => {
  it('Franklin : d6 dégâts, une fois par partie', () => {
    let s = scenario([{ c: 'franklin', area: 'hermit', revealed: true }, { c: 'vampire', area: 'church' }, ...REST], { rolls: [5] });
    expect(optionIds(s)).toContain('franklin:1');
    s = play(s, 'franklin:1');
    expect(s.players[1].damage).toBe(5);
    expect(s.players[0].abilityUsed).toBe(true);
    expect(s.pending?.kind).toBe('turn_start');
    expect(optionIds(s).some((id) => id.startsWith('franklin'))).toBe(false);
  });

  it('une capacité non révélée révèle le personnage', () => {
    const s = play(scenario([{ c: 'george', area: 'hermit' }, { c: 'vampire', area: 'church' }, ...REST], { rolls: [3] }), 'george:1');
    expect(s.players[0].revealed).toBe(true);
    expect(s.players[1].damage).toBe(3);
  });

  it('Ellen annule définitivement une capacité', () => {
    let s = play(scenario([{ c: 'ellen', area: 'hermit', revealed: true }, { c: 'werewolf', area: 'church', revealed: true }, { c: 'emi' }, { c: 'vampire' }, { c: 'allie' }]), 'ellen:1');
    expect(s.players[1].abilityVoided).toBe(true);
    // Le Loup-garou ne peut plus contre-attaquer : on passe directement au joueur suivant.
    s = play(rolls(s, 3, 3), 'roll', 'skip');
    s = choose(rolls(s, 4, 2), 'attack:1');
    expect(s.players[1].damage).toBe(2);
    expect(s.pending?.kind).toBe('turn_start');
    expect(s.pending?.player).toBe(1);
  });

  it('Fu-ka place les dégâts sur 7', () => {
    const s = play(scenario([{ c: 'fuka', revealed: true }, { c: 'vampire', damage: 2 }, ...REST]), 'fuka:1');
    expect(s.players[1].damage).toBe(7);
  });

  it('Ultra Soul : 3 dégâts à un joueur sur la Porte de l\'Outremonde, une fois par tour', () => {
    let s = scenario([{ c: 'ultra_soul', revealed: true }, { c: 'franklin', area: 'underworld' }, { c: 'emi', area: 'church' }, { c: 'vampire' }, { c: 'allie' }]);
    expect(optionIds(s).filter((id) => id.startsWith('ultra_soul'))).toEqual(['ultra_soul:1']);
    s = play(s, 'ultra_soul:1');
    expect(s.players[1].damage).toBe(3);
    expect(optionIds(s).some((id) => id.startsWith('ultra_soul'))).toBe(false);
  });

  it('Agnès change de condition de victoire', () => {
    const s = play(scenario([{ c: 'agnes' }, { c: 'franklin' }, ...REST]), 'agnes');
    expect(s.players[0].agnesLeft).toBe(true);
    expect(s.players[0].revealed).toBe(true);
  });

  it('Catherine révélée soigne 1 au début de son tour', () => {
    const s = scenario([{ c: 'catherine', revealed: true, damage: 3 }, { c: 'franklin' }, ...REST]);
    expect(s.players[0].damage).toBe(2);
  });
});

describe('capacités de combat', () => {
  it('Vampire : soigne 2 après avoir infligé des dégâts', () => {
    const s = skipCovers(choose(rolls(toAttack([{ c: 'vampire', revealed: true, damage: 5 }, { c: 'franklin', area: 'church' }, ...REST]), 5, 1), 'attack:1'));
    expect(s.players[1].damage).toBe(4);
    expect(s.players[0].damage).toBe(3);
  });

  it('Loup-garou : peut se révéler et contre-attaquer', () => {
    let s = choose(rolls(toAttack([{ c: 'franklin' }, { c: 'werewolf', area: 'church' }, ...REST.slice(0, 1), { c: 'vampire', area: 'altar' }, { c: 'allie', area: 'altar' }]), 4, 2), 'attack:1');
    expect(s.pending?.kind).toBe('counter');
    expect(s.pending?.player).toBe(1);
    expect(optionIds(s)).toEqual(['counter', 'no']);
    rolls(s, 6, 1);
    s = skipCovers(choose(s, 'counter'));
    expect(s.players[1].revealed).toBe(true);
    expect(s.players[0].damage).toBe(5);
  });

  it('les autres joueurs non révélés reçoivent une décision de couverture', () => {
    const s = choose(rolls(toAttack([{ c: 'franklin' }, { c: 'vampire', area: 'church' }, ...REST]), 4, 2), 'attack:1');
    expect(s.pending?.kind).toBe('counter');
    expect(optionIds(s)).toEqual(['no']);
  });

  it('Charles : s\'inflige 2 dégâts pour attaquer à nouveau', () => {
    let s = skipCovers(choose(rolls(toAttack([{ c: 'charles', revealed: true }, { c: 'franklin', area: 'church', revealed: true }, ...REST]), 4, 2), 'attack:1'));
    expect(s.pending?.kind).toBe('charles_again');
    rolls(s, 5, 1);
    s = choose(s, 'again');
    expect(s.players[0].damage).toBe(2);
    expect(s.players[1].damage).toBe(6);
    expect(s.pending?.kind).toBe('charles_again');
  });

  it('Bob : vole un équipement au lieu d\'infliger 2 dégâts ou plus', () => {
    let s = choose(rolls(toAttack([{ c: 'bob', revealed: true }, { c: 'franklin', area: 'church', equipment: ['talisman#1'] }, ...REST]), 5, 2), 'attack:1');
    expect(s.pending?.kind).toBe('bob_rob');
    s = skipCovers(choose(s, 'steal:talisman#1'));
    expect(s.players[0].equipment).toEqual(['talisman#1']);
    expect(s.players[1].damage).toBe(0);
  });
});

describe('capacités de fin de tour et à tout moment', () => {
  it('Gregor : barrière contre tous les dégâts jusqu\'à son prochain tour', () => {
    let s = play(scenario([{ c: 'gregor', area: 'hermit', revealed: true }, { c: 'vampire', area: 'woods' }, { c: 'franklin', area: 'woods' }, { c: 'werewolf', area: 'woods' }], { rolls: [4, 4] }), 'roll', 'skip');
    expect(s.pending?.kind).toBe('end_turn');
    s = choose(s, 'gregor');
    expect(s.players[0].barrier).toBe(true);
    expect(dealDamage(s, 0, 3, 1, 'card')).toBe(0);
    expect(s.players[0].damage).toBe(0);
  });

  it('Spectre : autant de tours supplémentaires que de morts', () => {
    let s = play(scenario([{ c: 'wight', area: 'hermit', revealed: true }, { c: 'franklin', area: 'woods' }, { c: 'emi', alive: false }, { c: 'allie', alive: false }, { c: 'vampire', area: 'woods' }], { rolls: [4, 4] }), 'roll', 'skip');
    s = choose(s, 'wight');
    expect(s.turn.active).toBe(0);
    expect(s.turn.extraTurns).toBe(1);
  });

  it('Allie : soin complet à tout moment, une fois', () => {
    const s0 = scenario([{ c: 'franklin' }, { c: 'allie', damage: 6 }, { c: 'vampire' }, { c: 'werewolf' }, { c: 'emi' }]);
    const opts = anytimeOptions(s0, 1);
    expect(opts.map((o) => o.id)).toEqual(['allie']);
    const s = applyAction(s0, { type: 'ability', player: 1, optionId: 'allie' }).state;
    expect(s.players[1].damage).toBe(0);
    expect(s.players[1].revealed).toBe(true);
    expect(anytimeOptions(s, 1)).toEqual([]);
  });

  it('David : récupère un équipement dans la défausse', () => {
    const s0 = scenario([{ c: 'franklin' }, { c: 'david' }, { c: 'vampire' }, { c: 'werewolf' }, { c: 'emi' }]);
    s0.decks.black.draw = s0.decks.black.draw.filter((c) => c !== 'handgun#1');
    s0.decks.black.discard.push('handgun#1');
    const s = applyAction(s0, { type: 'ability', player: 1, optionId: 'david:handgun#1' }).state;
    expect(s.players[1].equipment).toEqual(['handgun#1']);
    expect(s.decks.black.discard).toEqual([]);
  });

  it('se révéler à tout moment', () => {
    const s0 = scenario([{ c: 'franklin' }, { c: 'vampire' }, { c: 'emi' }, { c: 'werewolf' }]);
    const s = applyAction(s0, { type: 'reveal', player: 2 }).state;
    expect(s.players[2].revealed).toBe(true);
    expect(() => applyAction(s, { type: 'reveal', player: 2 })).toThrow();
  });
});

describe('révélations forcées', () => {
  it('Daniel se révèle quand un autre personnage meurt', () => {
    const s = skipCovers(choose(rolls(toAttack([{ c: 'franklin' }, { c: 'vampire', area: 'church', damage: 12 }, { c: 'daniel', area: 'woods' }, { c: 'werewolf', area: 'woods' }, { c: 'emi', area: 'woods' }]), 3, 1), 'attack:1'));
    expect(s.players[1].alive).toBe(false);
    expect(s.players[2].revealed).toBe(true);
  });

  it('Bryan se révèle s\'il tue un personnage de 12 PV ou moins', () => {
    const s = skipCovers(choose(rolls(toAttack([{ c: 'bryan' }, { c: 'franklin', area: 'church', damage: 11 }, { c: 'emi', area: 'woods' }, { c: 'vampire', area: 'woods' }, { c: 'werewolf', area: 'woods' }]), 3, 1), 'attack:1'));
    expect(s.players[1].alive).toBe(false);
    expect(s.players[0].revealed).toBe(true);
    expect(s.finished).toBe(false);
  });
});

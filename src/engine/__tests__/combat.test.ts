import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { choose, optionIds, play, rolls, scenario, skipCovers, type ScenarioPlayer } from './helpers';

/** Le joueur 0 part de la Cabane, va à l'Église (3+3), passe l'action et arrive à la phase d'attaque. */
function toAttack(players: ScenarioPlayer[]): GameState {
  const ps = players.map((p, i) => (i === 0 ? { ...p, area: 'hermit' as const } : p));
  const s = play(scenario(ps, { rolls: [3, 3] }), 'roll', 'skip');
  expect(s.pending?.kind).toBe('attack');
  return s;
}

function attack(s: GameState, id: string, ...dice: number[]): GameState {
  rolls(s, ...dice);
  return skipCovers(choose(s, id));
}

const FOES: ScenarioPlayer[] = [{ c: 'vampire', area: 'cemetery' }, { c: 'emi', area: 'woods' }, { c: 'werewolf', area: 'altar' }];

describe('attaque', () => {
  it('les dégâts valent l\'écart entre le d6 et le d4', () => {
    const s = attack(toAttack([{ c: 'franklin' }, ...FOES]), 'attack:1', 5, 2);
    expect(s.players[1].damage).toBe(3);
  });

  it('des dés identiques : l\'attaque rate', () => {
    const s = attack(toAttack([{ c: 'franklin' }, ...FOES]), 'attack:1', 3, 3);
    expect(s.players[1].damage).toBe(0);
    expect(s.log.some((e) => e.type === 'miss')).toBe(true);
  });

  it('seuls les joueurs de la même zone sont à portée, on peut ne pas attaquer', () => {
    const s = toAttack([{ c: 'franklin' }, ...FOES]);
    expect(optionIds(s)).toEqual(['attack:1', 'pass']);
  });

  it('armes +1 chacune, seulement si l\'attaque réussit', () => {
    const eq = ['chainsaw#1', 'butcher_knife#1'];
    expect(attack(toAttack([{ c: 'franklin', equipment: eq }, ...FOES]), 'attack:1', 6, 4).players[1].damage).toBe(4);
    expect(attack(toAttack([{ c: 'franklin', equipment: eq }, ...FOES]), 'attack:1', 2, 2).players[1].damage).toBe(0);
  });

  it('Lance de Longinus : +2 seulement pour un Hunter révélé', () => {
    expect(attack(toAttack([{ c: 'franklin', equipment: ['spear_of_longinus#1'] }, ...FOES]), 'attack:1', 4, 3).players[1].damage).toBe(1);
    expect(attack(toAttack([{ c: 'franklin', revealed: true, equipment: ['spear_of_longinus#1'] }, ...FOES]), 'attack:1', 4, 3).players[1].damage).toBe(3);
    const shadow = [{ c: 'valkyrie' as const, revealed: false, equipment: ['spear_of_longinus#1'] }, { c: 'franklin' as const, area: 'cemetery' as const }, { c: 'emi' as const, area: 'woods' as const }, { c: 'werewolf' as const, area: 'altar' as const }];
    expect(attack(toAttack(shadow), 'attack:1', 4, 3).players[1].damage).toBe(1);
  });

  it('Robe sacrée : -1 aux dégâts infligés et reçus, peut descendre à 0', () => {
    expect(attack(toAttack([{ c: 'franklin', equipment: ['holy_robe#1'] }, ...FOES]), 'attack:1', 4, 1).players[1].damage).toBe(2);
    const robed = [...FOES];
    robed[0] = { ...robed[0], equipment: ['holy_robe#1'] };
    expect(attack(toAttack([{ c: 'franklin' }, ...robed]), 'attack:1', 4, 3).players[1].damage).toBe(0);
  });

  it('Masamune : attaque obligatoire, d4 seulement', () => {
    const s = toAttack([{ c: 'franklin', equipment: ['masamune#1'] }, ...FOES]);
    expect(optionIds(s)).toEqual(['attack:1']);
    expect(attack(s, 'attack:1', 4).players[1].damage).toBe(4);
  });

  it('Valkyrie révélée : d4 seulement', () => {
    const ps: ScenarioPlayer[] = [{ c: 'valkyrie', revealed: true }, { c: 'franklin', area: 'cemetery' }, { c: 'emi', area: 'woods' }, { c: 'werewolf', area: 'altar' }];
    expect(attack(toAttack(ps), 'attack:1', 3).players[1].damage).toBe(3);
  });

  it('Mitrailleuse : touche tous les joueurs à portée avec un seul jet', () => {
    const foes: ScenarioPlayer[] = [{ c: 'vampire', area: 'cemetery' }, { c: 'emi', area: 'church' }, { c: 'werewolf', area: 'altar' }];
    const s = toAttack([{ c: 'franklin', equipment: ['machine_gun#1'] }, ...foes]);
    expect(optionIds(s)).toEqual(['attack_all', 'pass']);
    const s2 = attack(s, 'attack_all', 5, 3);
    expect([s2.players[1].damage, s2.players[2].damage, s2.players[3].damage]).toEqual([2, 2, 0]);
  });

  it('Pistolet : portée inversée', () => {
    const s = toAttack([{ c: 'franklin', equipment: ['handgun#1'] }, ...FOES]);
    expect(optionIds(s)).toEqual(['attack:2', 'attack:3', 'pass']);
  });

  it('Ange gardien : aucun dégât d\'attaque', () => {
    let s = toAttack([{ c: 'franklin' }, ...FOES]);
    s.players[1].guardianAngel = true;
    s = attack(s, 'attack:1', 6, 1);
    expect(s.players[1].damage).toBe(0);
  });
});

describe('morts et butin', () => {
  const dying: ScenarioPlayer[] = [{ c: 'vampire', area: 'cemetery', damage: 12, equipment: ['talisman#1', 'chainsaw#1'] }, { c: 'emi', area: 'woods' }, { c: 'werewolf', area: 'altar' }];

  it('la victime est révélée et le tueur prend un équipement, le reste est défaussé', () => {
    let s = attack(toAttack([{ c: 'franklin' }, ...dying]), 'attack:1', 3, 1);
    expect(s.players[1].alive).toBe(false);
    expect(s.players[1].revealed).toBe(true);
    expect(s.pending?.kind).toBe('loot');
    s = play(s, 'take:chainsaw#1');
    expect(s.players[0].equipment).toEqual(['chainsaw#1']);
    expect(s.players[1].equipment).toEqual([]);
    expect(s.decks.white.discard).toContain('talisman#1');
  });

  it('Rosaire d\'argent : le tueur prend tout', () => {
    const s = attack(toAttack([{ c: 'franklin', equipment: ['silver_rosary#1'] }, ...dying]), 'attack:1', 3, 1);
    expect(s.players[0].equipment).toEqual(['silver_rosary#1', 'talisman#1', 'chainsaw#1']);
  });
});

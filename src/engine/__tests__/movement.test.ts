import { describe, expect, it } from 'vitest';
import { optionIds, play, scenario, stackDeck, texts, type ScenarioPlayer } from './helpers';

describe('déplacement', () => {
  it('va au lieu correspondant à la somme des dés', () => {
    const s = play(scenario([{ c: 'emi', area: 'hermit' }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }], { rolls: [4, 4] }), 'roll');
    expect(s.players[0].area).toBe('cemetery');
  });

  it('relance si le résultat mène au lieu actuel', () => {
    const s = play(scenario([{ c: 'emi', area: 'church' }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }], { rolls: [3, 3, 6, 4] }), 'roll');
    expect(s.players[0].area).toBe('altar');
    expect(s.log.some((e) => e.type === 'reroll')).toBe(true);
  });

  it('sur un 7, le joueur choisit un autre lieu', () => {
    const s = play(scenario([{ c: 'emi', area: 'church' }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }], { rolls: [4, 3] }), 'roll');
    expect(s.pending?.kind).toBe('choose_area');
    expect(optionIds(s)).not.toContain('area:church');
    expect(optionIds(s)).toHaveLength(5);
    const s2 = play(s, 'area:woods');
    expect(s2.players[0].area).toBe('woods');
  });

  it('Emi révélée peut se téléporter sur un lieu adjacent', () => {
    const s = scenario([{ c: 'emi', area: 'church', revealed: true }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }]);
    expect(optionIds(s)).toEqual(expect.arrayContaining(['teleport:underworld', 'teleport:cemetery']));
    const s2 = play(s, 'teleport:underworld');
    expect(s2.players[0].area).toBe('underworld');
  });

  it('Emi non révélée se révèle en se téléportant', () => {
    const s = play(scenario([{ c: 'emi', area: 'church' }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }]), 'teleport:cemetery');
    expect(s.players[0].revealed).toBe(true);
  });

  it('la Boussole mystique permet de choisir entre deux jets', () => {
    const s = play(scenario([{ c: 'franklin', area: 'church', equipment: ['mystic_compass#1'] }, { c: 'vampire' }, { c: 'emi' }, { c: 'werewolf' }], { rolls: [1, 1, 5, 4] }), 'roll');
    expect(s.pending?.kind).toBe('compass');
    expect(optionIds(s)).toEqual(['pick:0:hermit', 'pick:1:woods']);
    expect(play(s, 'pick:1').players[0].area).toBe('woods');
  });
});

describe('actions des lieux', () => {
  const base: ScenarioPlayer[] = [{ c: 'franklin', area: 'church' }, { c: 'vampire', area: 'hermit' }, { c: 'emi', area: 'hermit' }, { c: 'werewolf', area: 'hermit' }];

  it('Forêt hantée : 2 dégâts ou 1 soin, Broche de fortune protège', () => {
    let s = play(scenario(base, { rolls: [5, 4] }), 'roll');
    expect(s.pending?.kind).toBe('area_action');
    s = play(s, 'woods_dmg:1');
    expect(s.players[1].damage).toBe(2);

    const withBrooch = [...base];
    withBrooch[1] = { ...base[1], equipment: ['fortune_brooch#1'] };
    s = play(scenario(withBrooch, { rolls: [5, 4] }), 'roll', 'woods_dmg:1');
    expect(s.players[1].damage).toBe(0);

    const hurt = [...base];
    hurt[2] = { ...base[2], damage: 3 };
    s = play(scenario(hurt, { rolls: [5, 4] }), 'roll', 'woods_heal:2');
    expect(s.players[2].damage).toBe(2);
  });

  it('Sanctuaire ancien : vole un équipement', () => {
    const withEq = [...base];
    withEq[3] = { ...base[3], equipment: ['talisman#1'] };
    const s = play(scenario(withEq, { rolls: [6, 4] }), 'roll', 'steal:3:talisman#1');
    expect(s.players[0].equipment).toEqual(['talisman#1']);
    expect(s.players[3].equipment).toEqual([]);
  });

  it('Porte de l\'Outremonde : pioche dans le paquet de son choix', () => {
    let s = play(scenario(base, { rolls: [2, 2] }), 'roll');
    expect(optionIds(s)).toEqual(['draw:hermit', 'draw:white', 'draw:black', 'skip']);
    s = stackDeck(s, 'white', 'holy_robe#1');
    s = play(s, 'draw:white');
    expect(s.players[0].equipment).toEqual(['holy_robe#1']);
  });

  it('l\'action du lieu est optionnelle', () => {
    const s = play(scenario(base, { rolls: [4, 4] }), 'roll', 'skip');
    expect(texts(s).some((t) => t.includes('ne fait rien'))).toBe(true);
  });

  it('une pioche vide est reformée à partir de la défausse', () => {
    const fromHermit = [...base];
    fromHermit[0] = { ...base[0], area: 'hermit' };
    let s = scenario(fromHermit, { rolls: [3, 3] });
    s.decks.white.discard = [...s.decks.white.draw];
    s.decks.white.draw = [];
    s = play(s, 'roll', 'draw:white');
    expect(s.log.some((e) => e.type === 'reshuffle')).toBe(true);
  });
});

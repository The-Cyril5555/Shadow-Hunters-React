import { describe, expect, it } from 'vitest';
import type { CardId, GameState } from '../types';
import { optionIds, play, rolls, scenario, stackDeck, type ScenarioPlayer } from './helpers';

/** Le joueur 0 va à l'Église (ou au Cimetière) et pioche la carte donnée. */
function drawCard(card: CardId, players: ScenarioPlayer[], extraRolls: number[] = []): GameState {
  const white = !['banana_peel', 'bloodthirsty_spider', 'diabolic_ritual', 'dynamite', 'moody_goblin', 'spiritual_doll', 'vampire_bat'].includes(card.split('#')[0]);
  const ps = players.map((p, i) => (i === 0 ? { ...p, area: 'hermit' as const } : p));
  let s = scenario(ps, { rolls: white ? [3, 3] : [4, 4] });
  s = stackDeck(s, white ? 'white' : 'black', card);
  rolls(s, ...extraRolls);
  return play(s, 'roll', white ? 'draw:white' : 'draw:black');
}

const P4: ScenarioPlayer[] = [{ c: 'franklin' }, { c: 'vampire', area: 'woods' }, { c: 'emi', area: 'woods' }, { c: 'werewolf', area: 'altar' }];

describe('cartes Lumière', () => {
  it('Eau bénite soigne 2', () => {
    const s = drawCard('holy_water#1', [{ c: 'franklin', damage: 3 }, ...P4.slice(1)]);
    expect(s.players[0].damage).toBe(1);
  });

  it('Éclair du jugement : 2 dégâts à tous les autres', () => {
    const s = drawCard('flare_of_judgement#1', P4);
    expect(s.players.map((p) => p.damage)).toEqual([0, 2, 2, 2]);
  });

  it('Premiers secours place les dégâts d\'un joueur sur 7', () => {
    let s = drawCard('first_aid#1', [{ c: 'franklin', damage: 10 }, ...P4.slice(1)]);
    expect(optionIds(s)).toContain('target:0');
    s = play(s, 'target:0');
    expect(s.players[0].damage).toBe(7);
  });

  it('Savoir caché : le joueur rejoue', () => {
    const s = drawCard('concealed_knowledge#1', P4);
    expect(s.turn.active).toBe(0);
    expect(s.turn.number).toBe(2);
  });

  it('Ange gardien : immunisé contre les attaques', () => {
    const s = drawCard('guardian_angel#1', P4);
    expect(s.players[0].guardianAngel).toBe(true);
  });

  it('Miroir de désenchantement : révèle un Shadow, sauf l\'Inconnu', () => {
    expect(drawCard('disenchant_mirror#1', [{ c: 'vampire' }, ...P4.slice(1).map((p) => ({ ...p, c: p.c === 'vampire' ? 'george' as const : p.c }))]).players[0].revealed).toBe(true);
    expect(drawCard('disenchant_mirror#1', [{ c: 'unknown' }, ...P4.slice(1)]).players[0].revealed).toBe(false);
    expect(drawCard('disenchant_mirror#1', P4).players[0].revealed).toBe(false);
  });

  it('Bénédiction soigne un autre joueur du résultat du d6', () => {
    const ps = [...P4];
    ps[1] = { ...ps[1], damage: 5 };
    const s = play(drawCard('blessing#1', ps, [3]), 'target:1');
    expect(s.players[1].damage).toBe(2);
    expect(optionIds(drawCard('blessing#1', ps))).not.toContain('target:0');
  });

  it('Chocolat : réservé aux personnages A, E, U', () => {
    let s = drawCard('chocolate#1', [{ c: 'emi', damage: 4 }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }]);
    expect(optionIds(s)).toEqual(['reveal', 'nothing']);
    s = play(s, 'reveal');
    expect(s.players[0].revealed).toBe(true);
    expect(s.players[0].damage).toBe(0);
    // Charles (C, 11 PV) n'est pas concerné, même s'il a 11 PV ou moins.
    expect(optionIds(drawCard('chocolate#1', [{ c: 'charles', damage: 4 }, { c: 'vampire' }, { c: 'franklin' }, { c: 'werewolf' }, { c: 'emi' }]))).toEqual(['nothing']);
  });

  it('Avènement : un Hunter déjà révélé est soigné directement', () => {
    const s = drawCard('advent#1', [{ c: 'franklin', damage: 6, revealed: true }, ...P4.slice(1)]);
    expect(s.players[0].damage).toBe(0);
    expect(optionIds(drawCard('advent#1', [{ c: 'vampire', damage: 6 }, { c: 'franklin' }, { c: 'emi' }, { c: 'werewolf' }]))).toEqual(['nothing']);
  });
});

describe('cartes Ténèbres', () => {
  it('Rituel diabolique : un Shadow peut se révéler pour se soigner', () => {
    const s = play(drawCard('diabolic_ritual#1', [{ c: 'vampire', damage: 8 }, { c: 'franklin' }, { c: 'emi' }, { c: 'werewolf' }]), 'reveal');
    expect(s.players[0].damage).toBe(0);
    expect(s.players[0].revealed).toBe(true);
  });

  it('Chauve-souris vampire : 2 dégâts et 1 soin, sauf Talisman', () => {
    let s = play(drawCard('vampire_bat#1', [{ c: 'franklin', damage: 2 }, ...P4.slice(1)]), 'target:1');
    expect(s.players[1].damage).toBe(2);
    expect(s.players[0].damage).toBe(1);
    const ps = [...P4];
    ps[1] = { ...ps[1], equipment: ['talisman#1'] };
    s = play(drawCard('vampire_bat#1', ps), 'target:1');
    expect(s.players[1].damage).toBe(0);
  });

  it('Araignée sanguinaire : 2 dégâts à la cible et à soi', () => {
    const s = play(drawCard('bloodthirsty_spider#1', P4), 'target:3');
    expect(s.players[3].damage).toBe(2);
    expect(s.players[0].damage).toBe(2);
  });

  it('Poupée spirituelle : 1-4 la cible, 5-6 soi-même', () => {
    expect(play(drawCard('spiritual_doll#1', P4, [4]), 'target:1').players[1].damage).toBe(3);
    const s = play(drawCard('spiritual_doll#1', P4, [5]), 'target:1');
    expect(s.players[1].damage).toBe(0);
    expect(s.players[0].damage).toBe(3);
  });

  it('Dynamite : 3 dégâts à tout le lieu tiré, rien sur un 7', () => {
    const ps = [...P4];
    ps[2] = { ...ps[2], equipment: ['talisman#1'] };
    const s = drawCard('dynamite#1', ps, [6, 3]);
    expect(s.players.map((p) => p.damage)).toEqual([0, 3, 0, 0]);
    expect(drawCard('dynamite#1', P4, [4, 3]).players.every((p) => p.damage === 0)).toBe(true);
  });

  it('Gobelin lunatique : vole un équipement', () => {
    const ps = [...P4];
    ps[3] = { ...ps[3], equipment: ['chainsaw#1'] };
    const s = play(drawCard('moody_goblin#1', ps), 'steal:3:chainsaw#1');
    expect(s.players[0].equipment).toEqual(['chainsaw#1']);
  });

  it('Peau de banane : donner un équipement, ou 1 dégât sans équipement', () => {
    expect(drawCard('banana_peel#1', P4).players[0].damage).toBe(1);
    const s = play(drawCard('banana_peel#1', [{ c: 'franklin', equipment: ['talisman#1'] }, ...P4.slice(1)]), 'give:2:talisman#1');
    expect(s.players[2].equipment).toEqual(['talisman#1']);
    expect(s.players[0].damage).toBe(0);
  });

  it('un équipement pioché est posé devant soi', () => {
    const s = drawCard('machine_gun#1', P4);
    expect(s.players[0].equipment).toEqual(['machine_gun#1']);
  });
});

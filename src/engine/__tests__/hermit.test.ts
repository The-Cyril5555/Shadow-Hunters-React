import { describe, expect, it } from 'vitest';
import { eventsFor, viewFor } from '../view';
import type { CharacterId } from '../types';
import { optionIds, play, scenario, stackDeck } from './helpers';

function giveHermit(card: string, target: CharacterId, extra: { damage?: number; equipment?: string[] } = {}) {
  let s = scenario([
    { c: 'franklin', area: 'church' },
    { c: target, area: 'church', ...extra },
    { c: 'allie', area: 'church' },
    { c: 'bob', area: 'church' },
    { c: 'werewolf', area: 'church' },
  ], { rolls: [1, 1] });
  s = stackDeck(s, 'hermit', card);
  s = play(s, 'roll', 'draw:hermit');
  expect(s.pending?.kind).toBe('hermit_give');
  s = play(s, 'give:1');
  expect(s.pending?.kind).toBe('hermit_respond');
  expect(s.pending?.player).toBe(1);
  return s;
}

describe('cartes Ermite', () => {
  it('la cible doit appliquer l\'effet si le pari est juste', () => {
    const s = giveHermit('slap#1', 'emi');
    expect(optionIds(s)).toEqual(['hurt:1']);
    expect(play(s, 'hurt:1').players[1].damage).toBe(1);
  });

  it('rien ne se passe si le pari est faux', () => {
    const s = giveHermit('slap#1', 'vampire');
    expect(optionIds(s)).toEqual(['nothing']);
  });

  it('l\'Inconnu peut mentir', () => {
    const s = giveHermit('exorcism#1', 'unknown');
    expect(optionIds(s)).toEqual(['hurt:2', 'nothing']);
    expect(play(s, 'nothing').players[1].damage).toBe(0);
    const s2 = giveHermit('aid#1', 'unknown');
    expect(optionIds(s2)).toEqual(['nothing', 'hurt:1']);
  });

  it('l\'Inconnu dont la capacité est annulée ne peut plus mentir', () => {
    let s = scenario([{ c: 'franklin', area: 'church' }, { c: 'unknown', area: 'church' }, { c: 'allie' }, { c: 'bob' }, { c: 'werewolf' }], { rolls: [1, 1] });
    s.players[1].abilityVoided = true;
    s = stackDeck(s, 'hermit', 'spell#1');
    s = play(s, 'roll', 'draw:hermit', 'give:1');
    expect(optionIds(s)).toEqual(['hurt:1']);
  });

  it('soin ou dégât : sans dégât à soigner, on subit 1 dégât', () => {
    expect(optionIds(giveHermit('huddle#1', 'vampire'))).toEqual(['hurt:1']);
    const s = giveHermit('huddle#1', 'vampire', { damage: 3 });
    expect(optionIds(s)).toEqual(['heal']);
    expect(play(s, 'heal').players[1].damage).toBe(2);
  });

  it('donner un équipement ou subir 1 dégât', () => {
    const s = giveHermit('greed#1', 'vampire', { equipment: ['talisman#1'] });
    expect(optionIds(s)).toEqual(['give:talisman#1', 'hurt:1']);
    const s2 = play(s, 'give:talisman#1');
    expect(s2.players[0].equipment).toEqual(['talisman#1']);
  });

  it('Brimade et Dure leçon dépendent de l\'initiale (PV)', () => {
    expect(optionIds(giveHermit('bully#1', 'emi'))).toEqual(['hurt:1']);
    expect(optionIds(giveHermit('bully#1', 'george'))).toEqual(['nothing']);
    expect(optionIds(giveHermit('tough_lesson#1', 'george'))).toEqual(['hurt:2']);
    expect(optionIds(giveHermit('tough_lesson#1', 'charles'))).toEqual(['nothing']);
  });

  it('Prédiction : la cible montre sa carte au seul joueur actif', () => {
    const s = play(giveHermit('prediction#1', 'vampire'), 'show');
    expect(s.players[1].knownBy).toEqual([0]);
    expect(viewFor(s, 0).players[1].character).toBe('vampire');
    expect(viewFor(s, 2).players[1].character).toBeNull();
  });

  it('la carte reste secrète pour les autres joueurs', () => {
    const s = play(giveHermit('spell#1', 'vampire'), 'hurt:1');
    const others = JSON.stringify(eventsFor(s.log, 3));
    expect(others).not.toContain('spell');
    expect(others).not.toContain('Sortilège');
    expect(others).toContain('donne une carte Ermite');
    expect(JSON.stringify(eventsFor(s.log, 0))).toContain('Sortilège');
    expect(JSON.stringify(eventsFor(s.log, 1))).toContain('Sortilège');
    expect(JSON.stringify(viewFor(s, 3))).not.toContain('spell#1');
    expect(s.decks.hermit.discard).toContain('spell#1');
  });
});

import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../engine';
import { Room } from './room';
import { PROTOCOL_VERSION, type HostMessage } from './protocol';

function client(room: Room, id: string) {
  const inbox: HostMessage[] = [];
  room.connect({ id, send: (m) => inbox.push(structuredClone(m)) });
  return {
    inbox,
    say: (m: Parameters<Room['receive']>[1]) => room.receive(id, m),
    last<T extends HostMessage['t']>(t: T) {
      return [...inbox].reverse().find((m) => m.t === t) as Extract<HostMessage, { t: T }> | undefined;
    },
  };
}

describe('salon et hôte', () => {
  it('deux humains et deux bots jouent une partie complète avec des vues distinctes', () => {
    const room = new Room({ code: 'TEST', settings: { botSpeed: 'instant' }, seed: 1234 });
    const a = client(room, 'a');
    const b = client(room, 'b');
    a.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Alice' });
    b.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Bruno' });
    expect(a.last('welcome')?.seat).toBe(0);
    expect(b.last('welcome')?.seat).toBe(1);
    // Seul l'administrateur (siège 0) peut ajouter des bots et lancer.
    b.say({ t: 'lobby:addBot' });
    expect(a.last('lobby')?.lobby.seats).toHaveLength(2);
    a.say({ t: 'lobby:start' });
    expect(a.last('error')?.message).toMatch(/au moins 4/);
    a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:start' });
    expect(room.started).toBe(true);

    const clients = [a, b];
    for (let guard = 0; guard < 5000 && !room.host!.state.finished; guard++) {
      let acted = false;
      for (const [seat, c] of clients.entries()) {
        const view = c.last('game')!.view;
        if (view.pending?.player === seat && view.pending.options) {
          c.say({ t: 'action', action: { type: 'choose', player: seat, decisionId: view.pending.id, optionId: view.pending.options[0].id } });
          acted = true;
          break;
        }
      }
      if (!acted) break;
    }
    expect(room.host!.state.finished).toBe(true);

    const state = room.host!.state;
    const viewA = a.inbox.filter((m) => m.t === 'game');
    // Pendant la partie, Alice ne voit jamais le personnage caché de Bruno.
    for (const m of viewA) {
      if (m.t !== 'game' || m.view.finished) continue;
      const bruno = m.view.players[1];
      // Seule une carte Prédiction peut lui avoir montré le personnage.
      if (!bruno.revealed && bruno.alive && bruno.character) expect(state.players[1].knownBy).toContain(0);
    }
    expect(a.last('game')!.view.players[0].character).toBe(state.players[0].character);
    expect(CHARACTERS[state.players[0].character]).toBeDefined();
  });

  it('un joueur déconnecté retrouve son siège avec son jeton', () => {
    const room = new Room({ code: 'TEST', settings: { botSpeed: 'instant' }, seed: 5 });
    const a = client(room, 'a');
    a.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Alice' });
    const b = client(room, 'b');
    b.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Bruno' });
    const token = b.last('welcome')!.token;
    a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:start' });
    room.disconnect('b');
    const b2 = client(room, 'b2');
    b2.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Bruno', token });
    expect(b2.last('welcome')?.seat).toBe(1);
    expect(b2.inbox.some((m) => m.t === 'game' && m.full)).toBe(true);
    room.dispose();
  });

  it('refuse un nouveau joueur une fois la partie lancée', () => {
    const room = new Room({ code: 'X', settings: { botSpeed: 'instant' } });
    const a = client(room, 'a');
    a.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Alice' });
    for (let i = 0; i < 4; i++) a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:start' });
    const c = client(room, 'c');
    c.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Chloé' });
    expect(c.last('error')?.message).toMatch(/déjà commencé/);
    room.dispose();
  });
});

describe('nouvelle partie dans le même salon', () => {
  it('l\'administrateur peut relancer après la fin', () => {
    const room = new Room({ code: 'R', settings: { botSpeed: 'instant' }, seed: 3 });
    const a = client(room, 'a');
    a.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Alice' });
    for (let i = 0; i < 4; i++) a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:start' });
    for (let g = 0; g < 3000 && !room.host!.state.finished; g++) {
      const v = a.last('game')!.view;
      if (v.pending?.player === 0 && v.pending.options) {
        a.say({ t: 'action', action: { type: 'choose', player: 0, decisionId: v.pending.id, optionId: v.pending.options[0].id } });
      }
    }
    expect(room.host!.state.finished).toBe(true);
    a.say({ t: 'lobby:restart' });
    expect(room.started).toBe(false);
    expect(a.last('lobby')!.lobby.seats).toHaveLength(5);
    a.say({ t: 'lobby:start' });
    expect(room.started).toBe(true);
    room.dispose();
  });
});

describe('robustesse', () => {
  it('ignore les réglages et actions invalides', () => {
    const room = new Room({ code: 'Z', settings: { botSpeed: 'instant' } });
    const a = client(room, 'a');
    a.say({ t: 'hello', v: PROTOCOL_VERSION, name: 'Alice' });
    a.say({ t: 'lobby:settings', settings: { pool: 'n\'importe quoi', botSpeed: 'instant' } as never });
    expect(room.settings.pool).toBe('mixed');
    for (let i = 0; i < 3; i++) a.say({ t: 'lobby:addBot' });
    a.say({ t: 'lobby:start' });
    a.say({ t: 'action', action: { type: 'choose', player: 1, decisionId: 1, optionId: 'roll' } });
    expect(a.last('error')?.message).toMatch(/mauvais joueur/);
    a.say({ t: 'action', action: { type: 'bidon', player: 0 } as never });
    expect(a.last('error')?.message).toBeTruthy();
    room.dispose();
  });
});

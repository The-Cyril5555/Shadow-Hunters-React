import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, type ClientMessage, type HostMessage } from '../src/net/protocol';
import { startServer } from './app';

let srv: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  srv = await startServer({ port: 0, log: () => undefined });
});
afterAll(async () => {
  await srv.close();
});

function connect(query: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/?${query}`);
  const inbox: HostMessage[] = [];
  const waiters: (() => void)[] = [];
  ws.on('message', (d) => {
    inbox.push(JSON.parse(String(d)));
    waiters.splice(0).forEach((w) => w());
  });
  const opened = new Promise<void>((res, rej) => {
    ws.on('open', () => res());
    ws.on('close', (code, reason) => rej(new Error(`${code} ${reason}`)));
  });
  return {
    ws,
    inbox,
    opened,
    send: (m: ClientMessage) => ws.send(JSON.stringify(m)),
    async until<T extends HostMessage['t']>(t: T, pred: (m: Extract<HostMessage, { t: T }>) => boolean = () => true, ms = 20_000) {
      const start = Date.now();
      for (;;) {
        const found = [...inbox].reverse().find((m) => m.t === t && pred(m as Extract<HostMessage, { t: T }>));
        if (found) return found as Extract<HostMessage, { t: T }>;
        if (Date.now() - start > ms) throw new Error(`Délai dépassé en attendant ${t}`);
        await new Promise<void>((r) => {
          waiters.push(r);
          setTimeout(r, 200);
        });
      }
    },
  };
}

describe('serveur WebSocket', () => {
  it('refuse un salon inconnu', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/?room=ZZZZZ`);
    const code = await new Promise<number>((res) => ws.on('close', (c) => res(c)));
    expect(code).toBe(4004);
  });

  it('deux joueurs et deux bots jouent une partie complète', async () => {
    const a = connect('create=1');
    await a.opened;
    a.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Alice' });
    const welcome = await a.until('welcome');
    const code = welcome.lobby.code;
    const b = connect(`room=${code}`);
    await b.opened;
    b.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Bruno' });
    expect((await b.until('welcome')).seat).toBe(1);
    a.send({ t: 'lobby:settings', settings: { botSpeed: 'instant' } });
    a.send({ t: 'lobby:addBot' });
    a.send({ t: 'lobby:addBot' });
    a.send({ t: 'lobby:start' });
    const clients = [a, b];
    const deadline = Date.now() + 60_000;
    for (;;) {
      const views = clients.map((c) => [...c.inbox].reverse().find((m) => m.t === 'game') as Extract<HostMessage, { t: 'game' }> | undefined);
      if (views[0]?.view.finished) break;
      if (Date.now() > deadline) throw new Error('La partie ne se termine pas');
      let acted = false;
      views.forEach((m, seat) => {
        const p = m?.view.pending;
        if (m && p && p.player === seat && p.options) {
          clients[seat].send({ t: 'action', action: { type: 'choose', player: seat, decisionId: p.id, optionId: p.options[0].id } });
          acted = true;
        }
      });
      await new Promise((r) => setTimeout(r, acted ? 30 : 60));
    }
    const final = await a.until('game', (m) => m.view.finished);
    expect(final.view.winners.length).toBeGreaterThan(0);
    // En fin de partie, toutes les identités sont visibles.
    expect(final.view.players.every((p) => p.character !== null)).toBe(true);
    a.ws.close();
    b.ws.close();
  }, 90_000);
});

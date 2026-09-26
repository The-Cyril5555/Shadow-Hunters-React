// Serveur multijoueur : héberge des salons (lobby + partie) et relaie les messages en WebSocket.
import { createServer, type Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Room } from '../src/net/room';
import { isClientMessage, randomCode, randomToken } from '../src/net/protocol';

export interface ServerOptions {
  port: number;
  /** Nombre maximal de salons simultanés. */
  maxRooms?: number;
  /** Durée d'inactivité avant suppression d'un salon (ms). */
  idleMs?: number;
  log?: (msg: string) => void;
}

interface Hosted {
  room: Room;
  sockets: Set<WebSocket>;
  lastActivity: number;
}

export function startServer(opts: ServerOptions): Promise<{ server: Server; port: number; close(): Promise<void>; rooms: Map<string, Hosted> }> {
  const log = opts.log ?? ((m: string) => console.log(`[${new Date().toISOString()}] ${m}`));
  const maxRooms = opts.maxRooms ?? 300;
  const idleMs = opts.idleMs ?? 30 * 60_000;
  const rooms = new Map<string, Hosted>();

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url?.startsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Serveur Shadow Hunters : connectez-vous en WebSocket depuis le jeu.');
  });

  const wss = new WebSocketServer({ server, maxPayload: 32 * 1024 });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let hosted: Hosted | undefined;
    if (url.searchParams.has('create')) {
      if (rooms.size >= maxRooms) {
        ws.close(4003, 'Serveur complet, réessayez plus tard.');
        return;
      }
      let code = randomCode();
      while (rooms.has(code)) code = randomCode();
      hosted = { room: new Room({ code }), sockets: new Set(), lastActivity: Date.now() };
      rooms.set(code, hosted);
      log(`Salon ${code} créé (${rooms.size} salon(s))`);
    } else {
      const code = (url.searchParams.get('room') ?? '').toUpperCase();
      hosted = rooms.get(code);
      if (!hosted) {
        ws.close(4004, 'Salon introuvable : vérifiez le code.');
        return;
      }
    }
    const h = hosted;
    const id = randomToken();
    h.sockets.add(ws);
    h.room.connect({
      id,
      send: (msg) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      },
    });
    ws.on('message', (data) => {
      h.lastActivity = Date.now();
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (isClientMessage(msg)) h.room.receive(id, msg);
    });
    ws.on('close', () => {
      h.sockets.delete(ws);
      h.lastActivity = Date.now();
      h.room.disconnect(id);
    });
    ws.on('error', () => ws.close());
  });

  // Nettoyage des salons abandonnés.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, h] of rooms) {
      const empty = h.sockets.size === 0;
      const finished = h.room.host?.state.finished ?? false;
      if ((empty && now - h.lastActivity > (h.room.started && !finished ? idleMs : 5 * 60_000)) || now - h.lastActivity > 6 * idleMs) {
        h.room.dispose();
        rooms.delete(code);
        log(`Salon ${code} supprimé (inactif)`);
      }
    }
  }, 60_000);

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : opts.port;
      log(`Serveur Shadow Hunters à l'écoute sur le port ${port}`);
      resolve({
        server,
        port,
        rooms,
        close: () => new Promise<void>((done) => {
          clearInterval(sweep);
          for (const h of rooms.values()) h.room.dispose();
          for (const c of wss.clients) c.terminate();
          wss.close();
          server.close(() => done());
        }),
      });
    });
  });
}

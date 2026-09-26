// Effets visuels et sonores déclenchés par les nouveaux événements.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, type CharacterId, type PlayerView, type VisibleEvent } from '../../engine';
import { CardFace } from '../components/CardFace';
import { play, type Sfx } from '../sound';
import { FACTION_LABEL } from '../theme';

type Overlay =
  | { kind: 'dice'; d6?: number; d4?: number; caption: string }
  | { kind: 'card'; card: string; caption: string }
  | { kind: 'banner'; text: string };

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  cls: string;
}

const SOUNDS: Record<string, Sfx> = {
  move: 'move_player',
  attack: 'attack_swing',
  damage: 'damage_hit',
  death: 'player_death',
  reveal: 'reveal_dramatic',
  ability: 'ability_use',
  equip: 'card_play',
  equipment_move: 'card_play',
  reshuffle: 'card_shuffle',
  hermit_give: 'card_draw',
};

function Die({ value, sides, rolling }: { value?: number; sides: 4 | 6; rolling: boolean }) {
  const [shown, setShown] = useState(value ?? 1);
  useEffect(() => {
    if (!rolling) {
      setShown(value ?? 1);
      return;
    }
    const t = setInterval(() => setShown(1 + Math.floor(Math.random() * sides)), 70);
    return () => clearInterval(t);
  }, [rolling, value, sides]);
  return (
    <div>
      <div className={`die${sides === 4 ? ' d4' : ''}`}>{shown}</div>
      <div className="die-label">D{sides}</div>
    </div>
  );
}

export function FxLayer({ view, log, fxFrom, reducedMotion }: { view: PlayerView; log: VisibleEvent[]; fxFrom: number; reducedMotion: boolean }) {
  const processed = useRef(fxFrom);
  const queue = useRef<{ overlay: Overlay; ms: number }[]>([]);
  const [current, setCurrent] = useState<{ overlay: Overlay; key: number } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (fxFrom > processed.current) processed.current = fxFrom;
  }, [fxFrom]);

  useEffect(() => {
    const fresh = log.filter((e) => e.seq > processed.current);
    if (fresh.length === 0) return;
    processed.current = fresh[fresh.length - 1].seq;
    const me = view.me;
    const name = (id: unknown) => view.players[id as number]?.name ?? '?';
    const pushOverlay = (overlay: Overlay, ms: number) => queue.current.push({ overlay, ms });
    const newFloaters: Floater[] = [];
    for (const e of fresh) {
      const d = e.data;
      const sfx = SOUNDS[e.type];
      if (sfx) play(sfx, 0.7);
      switch (e.type) {
        case 'dice': {
          const purpose = d.purpose === 'move' ? 'Déplacement' : d.purpose === 'attack' ? 'Attaque' : d.purpose === 'dynamite' ? 'Dynamite' : 'Dé';
          pushOverlay({ kind: 'dice', d6: d.d6 as number | undefined, d4: d.d4 as number | undefined, caption: `${purpose} — ${name(d.player)}` }, 1200);
          break;
        }
        case 'draw':
          if (typeof d.card === 'string') {
            play('card_draw', 0.8);
            pushOverlay({ kind: 'card', card: d.card, caption: d.player === me ? 'Vous piochez' : `${name(d.player)} pioche` }, 2000);
          }
          break;
        case 'reveal':
        case 'death': {
          const c = CHARACTERS[d.character as CharacterId];
          const txt = e.type === 'death' ? `${name(d.player)} meurt : ${c.name}` : `${name(d.player)} est ${c.name} (${FACTION_LABEL[c.faction]})`;
          pushOverlay({ kind: 'banner', text: txt }, 1800);
          break;
        }
        case 'turn_start':
          if (d.player === me) {
            play('turn_start', 0.8);
            pushOverlay({ kind: 'banner', text: 'À vous de jouer !' }, 1100);
          }
          break;
        case 'game_over': {
          const won = me !== null && (d.winners as number[]).includes(me);
          play(won ? 'win_game' : 'lose_game');
          break;
        }
        case 'damage':
        case 'heal':
        case 'set_damage': {
          const id = d.player as number;
          const el = document.getElementById(`mat-${id}`);
          if (!el) break;
          const r = el.getBoundingClientRect();
          const amount = e.type === 'set_damage' ? `→ ${d.to}` : e.type === 'damage' ? `−${d.amount}` : `+${d.amount}`;
          if (e.type === 'heal' && !d.amount) break;
          newFloaters.push({ id: e.seq, x: r.left + r.width / 2, y: r.top + 20, text: amount, cls: e.type === 'heal' ? 'heal' : 'dmg' });
          break;
        }
      }
    }
    if (newFloaters.length && !reducedMotion) {
      setFloaters((f) => [...f, ...newFloaters]);
      const ids = new Set(newFloaters.map((f) => f.id));
      setTimeout(() => setFloaters((f) => f.filter((x) => !ids.has(x.id))), 1400);
    }
    if (!timer.current) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  function next() {
    const item = queue.current.shift();
    if (!item) {
      setCurrent(null);
      timer.current = null;
      return;
    }
    // Rattrape le retard si les effets s'accumulent.
    const ms = queue.current.length > 3 ? Math.min(item.ms, 450) : item.ms;
    keyRef.current++;
    setCurrent({ overlay: item.overlay, key: keyRef.current });
    if (item.overlay.kind === 'dice' && !reducedMotion) {
      setRolling(true);
      play('dice_roll', 0.6);
      setTimeout(() => {
        setRolling(false);
        play('dice_land', 0.6);
      }, Math.min(450, ms / 2));
    }
    timer.current = setTimeout(next, ms);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const o = current?.overlay;
  return (
    <>
      <div className="fx-layer" onClick={() => { if (timer.current) { clearTimeout(timer.current); next(); } }}>
        <AnimatePresence mode="wait">
          {o && (
            <motion.div
              key={current.key}
              className="fx-center"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.85, rotateY: o.kind === 'card' ? 90 : 0 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.22 }}
              style={{ pointerEvents: 'auto' }}
            >
              {o.kind === 'dice' && (
                <>
                  <div className="dice-row">
                    {o.d6 !== undefined && <Die value={o.d6} sides={6} rolling={rolling} />}
                    {o.d4 !== undefined && <Die value={o.d4} sides={4} rolling={rolling} />}
                  </div>
                  <div className="fx-caption">{o.caption}</div>
                </>
              )}
              {o.kind === 'card' && (
                <>
                  <CardFace card={o.card} width={190} />
                  <div className="fx-caption">{o.caption}</div>
                </>
              )}
              {o.kind === 'banner' && <div className="banner">{o.text}</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {floaters.map((f) => (
        <motion.div
          key={f.id}
          className={`floater ${f.cls}`}
          style={{ left: f.x, top: f.y }}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -40 }}
          transition={{ duration: 1.3 }}
        >
          {f.text}
        </motion.div>
      ))}
    </>
  );
}

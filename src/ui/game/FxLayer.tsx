// Rendu des effets pilotés par le metteur en scène (src/ui/director.ts).
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { cardName } from '../../engine';
import { CardBack, CardFace } from '../components/CardFace';
import { skipAnimations } from '../director';
import { useFx, type Arrow, type Bubble, type Flyer } from '../fx';
import { characterImage } from '../theme';

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
    <motion.div animate={rolling ? { rotate: [0, -12, 10, -6, 0], y: [0, -10, 0] } : { rotate: 0, y: 0 }} transition={{ duration: 0.45, repeat: rolling ? Infinity : 0 }}>
      <div className={`die${sides === 4 ? ' d4' : ''}`}>{shown}</div>
      <div className="die-label">D{sides}</div>
    </motion.div>
  );
}

/** Scène centrale du plateau : dés, carte piochée, grandes annonces, et légende de l'action en cours. */
export function FxStage() {
  const overlay = useFx((s) => s.overlay);
  const rolling = useFx((s) => s.rolling);
  const caption = useFx((s) => s.caption);
  const animating = useFx((s) => s.animating);
  return (
    <>
      <div className="fx-caption-bar" aria-live="polite">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.div key={caption.key} className="fx-caption-text" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {caption.text}
            </motion.div>
          )}
        </AnimatePresence>
        {animating && (
          <button className="btn btn-small btn-ghost fx-skip" onClick={skipAnimations} title="Afficher tout de suite le résultat">
            Passer ⏭
          </button>
        )}
      </div>
      <div className="fx-layer" id="fx-stage">
        <AnimatePresence mode="wait">
          {overlay && (
            <motion.div
              key={overlay.key}
              className="fx-center"
              initial={{ opacity: 0, scale: 0.8, rotateY: overlay.kind === 'card' ? 90 : 0 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.25 }}
            >
              {overlay.kind === 'dice' && (
                <>
                  <div className="dice-row">
                    {overlay.d6 !== undefined && <Die value={overlay.d6} sides={6} rolling={rolling} />}
                    {overlay.d4 !== undefined && <Die value={overlay.d4} sides={4} rolling={rolling} />}
                  </div>
                  <div className="fx-caption">{overlay.label}</div>
                  {!rolling && (
                    <motion.div className="fx-result" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                      {overlay.result}
                    </motion.div>
                  )}
                </>
              )}
              {overlay.kind === 'card' && (
                <>
                  <CardFace card={overlay.card} width={190} />
                  <div className="fx-caption">{overlay.label}</div>
                </>
              )}
              {overlay.kind === 'banner' && (
                <div className={`banner banner-${overlay.tone}`}>
                  {overlay.character && (
                    <motion.img
                      className="banner-portrait"
                      src={characterImage(overlay.character)}
                      alt=""
                      initial={{ rotateY: 180, scale: 0.6 }}
                      animate={{ rotateY: 0, scale: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                  <span>{overlay.text}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── Effets positionnés sur la page ─────────────────────────

function center(id: string): { x: number; y: number } | null {
  const node = document.getElementById(id);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function ArrowFx({ a }: { a: Arrow }) {
  const [pts, setPts] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  useLayoutEffect(() => {
    const from = center(a.from);
    const to = center(a.to);
    if (from && to) setPts({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  }, [a.from, a.to]);
  if (!pts) return null;
  // Légère courbe pour que les flèches ne se superposent pas aux pions.
  const mx = (pts.x1 + pts.x2) / 2;
  const my = (pts.y1 + pts.y2) / 2 - Math.min(80, Math.hypot(pts.x2 - pts.x1, pts.y2 - pts.y1) / 4);
  const d = `M ${pts.x1} ${pts.y1} Q ${mx} ${my} ${pts.x2} ${pts.y2}`;
  return (
    <g className={`fx-arrow ${a.tone}`}>
      <motion.path d={d} markerEnd={`url(#head-${a.tone})`} initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }} transition={{ duration: 1, times: [0, 0.7, 1] }} />
      <motion.circle cx={pts.x2} cy={pts.y2} initial={{ r: 0, opacity: 0 }} animate={{ r: [0, 16, 4], opacity: [0, 0.8, 0] }} transition={{ duration: 0.6, delay: 0.45 }} />
    </g>
  );
}

function FlyerFx({ f }: { f: Flyer }) {
  const [path, setPath] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  useLayoutEffect(() => {
    const from = center(f.from);
    const to = center(f.to);
    if (from && to) setPath({ from, to });
  }, [f.from, f.to]);
  if (!path) return null;
  const c = f.content;
  return (
    <motion.div
      className="flyer"
      initial={{ left: path.from.x, top: path.from.y, scale: 0.6, rotate: -8, opacity: 0.9 }}
      animate={{ left: path.to.x, top: path.to.y, scale: 1, rotate: 0, opacity: 1 }}
      transition={{ duration: f.ms / 1000, ease: [0.3, 0.7, 0.3, 1] }}
    >
      {c.type === 'back' && <div className="flyer-card"><CardBack deck={c.deck} /></div>}
      {c.type === 'card' && <CardFace card={c.card} width={70} />}
      {c.type === 'chip' && <span className="equip-chip flyer-chip">{cardName(c.card)}</span>}
    </motion.div>
  );
}

function BubbleFx({ b }: { b: Bubble }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const node = document.getElementById(b.target);
    if (!node) return;
    const r = node.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top + Math.min(26, r.height / 2) });
  }, [b.target]);
  if (!pos) return null;
  return (
    <motion.div
      className={`bubble ${b.tone}`}
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, y: 6, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: [6, -8, -22, -40], scale: [0.6, 1.15, 1, 1] }}
      transition={{ duration: 1.5, times: [0, 0.15, 0.7, 1] }}
    >
      {b.text}
    </motion.div>
  );
}

/** Calque au-dessus de toute la page : flèches, cartes qui volent, bulles. */
export function FxOverlayGlobal() {
  const arrows = useFx((s) => s.arrows);
  const flyers = useFx((s) => s.flyers);
  const bubbles = useFx((s) => s.bubbles);
  return (
    <div className="fx-global" aria-hidden>
      <svg className="fx-arrows">
        <defs>
          {(['attack', 'heal', 'card', 'hermit', 'info'] as const).map((t) => (
            <marker key={t} id={`head-${t}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className={`fx-head ${t}`} />
            </marker>
          ))}
        </defs>
        {arrows.map((a) => <ArrowFx key={a.id} a={a} />)}
      </svg>
      {flyers.map((f) => <FlyerFx key={f.id} f={f} />)}
      {bubbles.map((b) => <BubbleFx key={b.id} b={b} />)}
    </div>
  );
}

import { LayoutGroup, motion } from 'motion/react';
import { CHARACTERS, type PublicPlayer } from '../../engine';
import { playerColor } from '../theme';

const LETTERS_BY_HP = new Map<number, string[]>();
for (const c of Object.values(CHARACTERS)) {
  const l = LETTERS_BY_HP.get(c.hp) ?? [];
  if (!l.includes(c.letter)) l.push(c.letter);
  LETTERS_BY_HP.set(c.hp, l);
}

/** Piste des dégâts 0 → 14, comme sur le plateau : un cube par joueur. */
export function LifeTrack({ players }: { players: PublicPlayer[] }) {
  const rows = Array.from({ length: 15 }, (_, i) => i);
  return (
    <LayoutGroup id="life">
    <div className="life" aria-label="Piste des dégâts">
      <h3>DÉGÂTS</h3>
      {rows.map((n) => {
        const here = players.filter((p) => p.damage === n);
        const letters = LETTERS_BY_HP.get(n);
        return (
          <div key={n} className={`life-row${letters ? ' limit' : ''}`}>
            <span className="n">{n}</span>
            <span className="cubes">
              {here.map((p) => (
                <motion.span
                  key={p.id}
                  layoutId={`cube-${p.id}`}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                  className="cube"
                  style={{ ['--pc' as string]: playerColor(p.id), opacity: p.alive ? 1 : 0.4 }}
                  title={`${p.name} : ${p.damage} dégât${p.damage > 1 ? 's' : ''}${p.alive ? '' : ' (mort)'}`}
                />
              ))}
            </span>
            <span className="letters" title={letters ? `Meurt ici : personnages ${letters.join(', ')} (${n} PV)` : undefined}>
              {letters?.join(' ')}
            </span>
          </div>
        );
      })}
    </div>
    </LayoutGroup>
  );
}

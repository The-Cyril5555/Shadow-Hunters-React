import { LayoutGroup, motion } from 'motion/react';
import { AREAS, type AreaId, type PlayerView } from '../../engine';
import { useFx } from '../fx';
import { areaImage, playerColor } from '../theme';

interface Props {
  view: PlayerView;
  selectableAreas: Set<AreaId>;
  selectableTargets: Set<number>;
  onArea(area: AreaId): void;
  onTarget(player: number): void;
  reducedMotion: boolean;
}

const ZONE_NAMES = ['I', 'II', 'III'];

export function Board({ view, selectableAreas, selectableTargets, onArea, onTarget, reducedMotion }: Props) {
  const me = view.me;
  const myArea = me !== null ? view.players[me].area : null;
  const areaFx = useFx((s) => s.areaFx);
  const pulses = useFx((s) => s.pulses);
  const active = view.turn.active;
  return (
    <LayoutGroup>
      <div className="board">
        {[0, 1, 2].map((z) => (
          <div className="zone" key={z} title="Zone d'attaque : on peut attaquer les joueurs des deux lieux d'une même zone.">
            <span className="zone-label">ZONE {ZONE_NAMES[z]}</span>
            {view.areas.slice(z * 2, z * 2 + 2).map((a) => {
              const def = AREAS[a];
              const selectable = selectableAreas.has(a);
              const here = view.players.filter((p) => p.alive && p.area === a);
              return (
                <div
                  key={a}
                  id={`area-${a}`}
                  className={`area${selectable ? ' selectable' : ''}${myArea === a ? ' here' : ''}${areaFx[a] ? ` fx-${areaFx[a]}` : ''}`}
                  title={`${def.name} (${def.numbers.join('-')}) : ${def.text}`}
                  onClick={selectable ? () => onArea(a) : undefined}
                  role={selectable ? 'button' : undefined}
                  tabIndex={selectable ? 0 : undefined}
                  onKeyDown={(e) => selectable && (e.key === 'Enter' || e.key === ' ') && onArea(a)}
                >
                  <img src={areaImage(a)} alt="" />
                  <div className="area-name">{def.name}</div>
                  <div className="area-num">{def.numbers.join('-')}</div>
                  <div className="tokens">
                    {here.map((p) => {
                      const sel = selectableTargets.has(p.id);
                      return (
                        <motion.div
                          key={p.id}
                          id={`token-${p.id}`}
                          layoutId={`token-${p.id}`}
                          layout={!reducedMotion}
                          transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                          className={`token${p.id === me ? ' me' : ''}${sel ? ' selectable' : ''}${p.id === active && !view.finished ? ' active' : ''}${pulses[p.id] ? ` fx-${pulses[p.id]}` : ''}`}
                          style={{ ['--pc' as string]: playerColor(p.id) }}
                          title={p.name}
                          onClick={sel ? (e) => { e.stopPropagation(); onTarget(p.id); } : undefined}
                        >
                          {p.id + 1}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}

import { useState } from 'react';
import type { Option, PlayerView } from '../../engine';
import type { SeatInfo } from '../../net/protocol';
import { CardFace } from '../components/CardFace';
import { play } from '../sound';
import { playerColor } from '../theme';

const GROUP_TITLES: Record<string, string> = {
  move: 'Déplacement',
  ability: 'Capacité spéciale',
  draw: 'Piocher',
  woods_dmg: 'Infliger 2 dégâts',
  woods_heal: 'Soigner 1 dégât',
  steal: 'Prendre un équipement',
  give: 'Donner un équipement',
  target: 'Choisir un joueur',
  attack: 'Attaquer',
};

interface Props {
  view: PlayerView;
  seats: SeatInfo[];
  focus: number | null;
  onFocus(target: number | null): void;
  onChoose(option: Option): void;
  /** Des actions sont encore en train d'être animées. */
  waiting?: boolean;
}

function OptionButton({ o, onChoose, label }: { o: Option; onChoose(o: Option): void; label?: string }) {
  const [armed, setArmed] = useState(false);
  const click = () => {
    if (o.reveal && !armed) {
      setArmed(true);
      return;
    }
    play('button_click', 0.5);
    onChoose(o);
  };
  return (
    <button className={`btn${o.reveal ? ' btn-reveal' : ''}${o.group === 'skip' || o.group === 'end' ? ' btn-ghost' : ''}`} onClick={click}>
      {armed ? 'Confirmer : vous serez révélé' : label ?? o.label}
    </button>
  );
}

export function DecisionPanel({ view, seats, focus, onFocus, onChoose, waiting }: Props) {
  const d = view.pending;
  if (waiting && !view.finished) {
    return <div className="panel decision waiting" aria-live="polite"><span className="spinner" /> Action en cours…</div>;
  }
  if (view.finished) {
    return <div className="panel decision waiting">La partie est terminée.</div>;
  }
  if (!d) return <div className="panel decision waiting"><span className="spinner" /> …</div>;
  if (d.player !== view.me || !d.options) {
    const who = view.players[d.player]?.name ?? '?';
    const seat = seats[d.player];
    const away = seat?.kind === 'human' && !seat.connected;
    return (
      <div className="panel decision waiting" aria-live="polite">
        <span className="spinner" />
        <span><strong>{who}</strong> {d.publicLabel}…{away ? ' (déconnecté)' : ''}</span>
      </div>
    );
  }
  let options = d.options;
  if (focus !== null) {
    const focused = options.filter((o) => o.target === focus);
    if (focused.length) options = focused;
  }
  const groups: [string, Option[]][] = [];
  for (const o of options) {
    const g = o.group ?? '';
    const found = groups.find(([k]) => k === g);
    if (found) found[1].push(o);
    else groups.push([g, [o]]);
  }
  const clickable = d.options.some((o) => o.target !== undefined || o.area !== undefined);
  // Beaucoup d'options visant des joueurs (Forêt hantée, Sanctuaire…) : une ligne par joueur.
  const targeted = options.filter((o) => o.target !== undefined);
  const byTarget = new Map<number, Option[]>();
  for (const o of targeted) byTarget.set(o.target as number, [...(byTarget.get(o.target as number) ?? []), o]);
  const compact = focus === null && targeted.length >= 8 && byTarget.size < targeted.length;
  const shortLabel = (o: Option) => {
    const name = view.players[o.target as number]?.name ?? '';
    const cleaned = o.label.replace(` à ${name}`, '').replace(` ${name}`, '').replace('à vous-même', '').trim();
    return cleaned || GROUP_TITLES[o.group ?? ''] || o.label;
  };
  return (
    <div className="panel decision" aria-live="polite">
      <div className="with-card">
        {d.card && <CardFace card={d.card} width={150} />}
        <div style={{ display: 'grid', gap: 10, flex: 1 }}>
          <div className="prompt">{d.prompt}</div>
          {clickable && focus === null && <div className="tag">Astuce : vous pouvez aussi cliquer sur un joueur ou un lieu.</div>}
          {focus !== null && (
            <div>
              <button className="btn btn-small btn-ghost" onClick={() => onFocus(null)}>← Toutes les options</button>
            </div>
          )}
          {compact ? (
            <div className="target-rows">
              {[...byTarget.entries()].map(([t, opts]) => (
                <div className="target-row" key={t}>
                  <span className="who"><span className="seat-num" style={{ ['--pc' as string]: playerColor(t) }}>{t + 1}</span>{t === view.me ? 'Vous' : view.players[t].name}</span>
                  {opts.map((o) => <OptionButton key={o.id} o={o} onChoose={onChoose} label={shortLabel(o)} />)}
                </div>
              ))}
              <div className="options">
                {options.filter((o) => o.target === undefined).map((o) => <OptionButton key={o.id} o={o} onChoose={onChoose} />)}
              </div>
            </div>
          ) : (
          <div className="options">
            {groups.map(([g, opts]) => (
              <div key={g} style={{ display: 'contents' }}>
                {GROUP_TITLES[g] && groups.length > 1 && <div className="group-title">{GROUP_TITLES[g]}</div>}
                {opts.map((o) => <OptionButton key={o.id} o={o} onChoose={onChoose} />)}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

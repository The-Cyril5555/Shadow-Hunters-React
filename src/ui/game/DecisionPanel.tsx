import { useState } from 'react';
import type { Option, PlayerView } from '../../engine';
import type { SeatInfo } from '../../net/protocol';
import { CardFace } from '../components/CardFace';
import { play } from '../sound';

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
}

function OptionButton({ o, onChoose }: { o: Option; onChoose(o: Option): void }) {
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
      {armed ? 'Confirmer : vous serez révélé' : o.label}
    </button>
  );
}

export function DecisionPanel({ view, seats, focus, onFocus, onChoose }: Props) {
  const d = view.pending;
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
          <div className="options">
            {groups.map(([g, opts]) => (
              <div key={g} style={{ display: 'contents' }}>
                {GROUP_TITLES[g] && groups.length > 1 && <div className="group-title">{GROUP_TITLES[g]}</div>}
                {opts.map((o) => <OptionButton key={o.id} o={o} onChoose={onChoose} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

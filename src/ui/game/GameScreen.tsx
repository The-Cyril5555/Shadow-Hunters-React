import { useEffect, useMemo, useState } from 'react';
import type { AreaId, Option } from '../../engine';
import type { BotSpeed } from '../../net/protocol';
import { Modal } from '../components/Modal';
import { RulesContent } from '../screens/RulesContent';
import { act, isHostingLocally, leave, setBotSpeed, startSolo } from '../session';
import { useStore } from '../store';
import { Board } from './Board';
import { DecisionPanel } from './DecisionPanel';
import { Decks } from './Decks';
import { FxLayer } from './FxLayer';
import { GameOver } from './GameOver';
import { Journal } from './Journal';
import { LifeTrack } from './LifeTrack';
import { MyPanel } from './MyPanel';
import { Notebook } from './Notebook';
import { PlayerMat } from './PlayerMat';

const PHASES: Record<string, string> = {
  start: 'début du tour',
  move: 'déplacement',
  area: 'action du lieu',
  attack: 'attaque',
  end: 'fin du tour',
};

const SPEEDS: [BotSpeed, string][] = [['slow', 'Lente'], ['normal', 'Normale'], ['fast', 'Rapide']];

export function GameScreen() {
  const view = useStore((s) => s.view);
  const log = useStore((s) => s.log);
  const seats = useStore((s) => s.seats);
  const fxFrom = useStore((s) => s.fxFrom);
  const notes = useStore((s) => s.notes);
  const settings = useStore((s) => s.settings);
  const lobby = useStore((s) => s.lobby);
  const mode = useStore((s) => s.mode);
  const go = useStore((s) => s.go);
  const [focus, setFocus] = useState<number | null>(null);
  const [modal, setModal] = useState<'rules' | 'notebook' | 'quit' | null>(null);
  const [overClosed, setOverClosed] = useState(false);

  const pendingId = view?.pending?.id;
  useEffect(() => setFocus(null), [pendingId]);
  useEffect(() => {
    if (!view?.finished) setOverClosed(false);
  }, [view?.finished]);

  const pending = view?.pending;
  const me = view?.me;
  const { areaOptions, targetOptions } = useMemo(() => {
    const mine = pending && pending.player === me && pending.options ? pending.options : [];
    const areaOptions = new Map<AreaId, Option>();
    const targetOptions = new Map<number, Option[]>();
    for (const o of mine) {
      if (o.area && o.target === undefined) areaOptions.set(o.area, o);
      if (o.target !== undefined) targetOptions.set(o.target, [...(targetOptions.get(o.target) ?? []), o]);
    }
    return { areaOptions, targetOptions };
  }, [pending, me]);

  if (!view) {
    return <div className="screen"><span className="spinner" /> Chargement de la partie…</div>;
  }

  const choose = (o: Option) => {
    if (!view.pending || view.me === null) return;
    act({ type: 'choose', player: view.me, decisionId: view.pending.id, optionId: o.id });
  };
  const pickTarget = (id: number) => {
    const opts = targetOptions.get(id) ?? [];
    if (opts.length === 1 && !opts[0].reveal) choose(opts[0]);
    else setFocus(id);
  };
  const pickArea = (a: AreaId) => {
    const o = areaOptions.get(a);
    if (o && !o.reveal) choose(o);
    else if (o) setFocus(null);
  };

  const active = view.players[view.turn.active];
  const deciding = view.pending?.player;
  const quit = () => {
    leave();
    go('menu');
  };
  const replay = mode === 'solo'
    ? () => startSolo(view.playerCount, lobby?.settings ?? { pool: view.pool, botLevel: 'normal', botSpeed: settings.speed })
    : undefined;

  return (
    <div className={`game${settings.reducedMotion ? ' reduced-motion' : ''}`}>
      <header className="panel game-header">
        <div className="turn-info">
          <span className="gothic">Tour {view.turn.number}</span>
          <span>
            Au tour de <strong>{active?.name}</strong>
            {view.turn.active === view.me ? ' (vous)' : ''}
          </span>
          <span className="phase">{PHASES[view.turn.phase]}</span>
          {view.turn.extraTurns > 0 && <span className="tag">+{view.turn.extraTurns} tour(s)</span>}
          {lobby && mode !== 'solo' && <span className="tag">Salon {lobby.code}</span>}
        </div>
        {isHostingLocally() && (
          <label className="tag" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Bots
            <select
              value={lobby?.settings.botSpeed ?? settings.speed}
              onChange={(e) => setBotSpeed(e.target.value as BotSpeed)}
              style={{ width: 'auto', padding: '4px 6px' }}
              aria-label="Vitesse des bots"
            >
              {SPEEDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        <button className="btn btn-small" onClick={() => setModal('notebook')}>Carnet</button>
        <button className="btn btn-small" onClick={() => setModal('rules')}>Règles</button>
        <button className="btn btn-small btn-ghost" onClick={() => setModal('quit')}>Quitter</button>
      </header>

      <div className="players-strip">
        {view.players.map((p) => (
          <PlayerMat
            key={p.id}
            player={p}
            seat={seats[p.id]}
            me={p.id === view.me}
            active={p.id === view.turn.active}
            deciding={p.id === deciding}
            selectable={targetOptions.has(p.id)}
            note={notes[p.id]}
            onSelect={() => pickTarget(p.id)}
          />
        ))}
      </div>

      <div className="life-col"><LifeTrack players={view.players} /></div>

      <div className="board-col panel">
        <Board
          view={view}
          selectableAreas={new Set(areaOptions.keys())}
          selectableTargets={new Set(targetOptions.keys())}
          onArea={pickArea}
          onTarget={pickTarget}
          reducedMotion={settings.reducedMotion}
        />
        <FxLayer view={view} log={log} fxFrom={fxFrom} reducedMotion={settings.reducedMotion} />
      </div>

      <div className="side-col">
        <Decks view={view} />
        <Journal log={log} />
      </div>

      <div className="me-row">
        <MyPanel view={view} />
        <DecisionPanel view={view} seats={seats} focus={focus} onFocus={setFocus} onChoose={choose} />
      </div>

      {view.finished && !overClosed && (
        <GameOver view={view} onMenu={quit} onReplay={replay} onClose={() => setOverClosed(true)} />
      )}
      {modal === 'rules' && <Modal title="Règles" onClose={() => setModal(null)} wide><RulesContent /></Modal>}
      {modal === 'notebook' && <Notebook view={view} onClose={() => setModal(null)} />}
      {modal === 'quit' && (
        <Modal title="Quitter la partie ?" onClose={() => setModal(null)}>
          <p>
            {mode === 'solo'
              ? 'La partie est sauvegardée : vous pourrez la reprendre depuis le menu.'
              : mode === 'p2p-host'
                ? 'Vous êtes l\'hôte : quitter met fin à la partie pour tous les joueurs.'
                : 'Vous pourrez revenir dans le salon avec le même code, un bot jouera à votre place en attendant.'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-danger" onClick={quit}>Quitter</button>
            <button className="btn" onClick={() => setModal(null)}>Rester</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

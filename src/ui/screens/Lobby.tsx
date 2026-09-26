import { useState } from 'react';
import { FACTION_COUNTS } from '../../engine';
import { MAX_SEATS, MIN_SEATS } from '../../net/protocol';
import { leave, send } from '../session';
import { useStore } from '../store';
import { playerColor } from '../theme';
import { LEVELS, POOL_OPTIONS, SPEEDS, Segmented } from './SoloSetup';

export function Lobby() {
  const lobby = useStore((s) => s.lobby);
  const seat = useStore((s) => s.seat);
  const mode = useStore((s) => s.mode);
  const go = useStore((s) => s.go);
  const [copied, setCopied] = useState(false);
  if (!lobby) return <div className="screen"><span className="spinner" /></div>;
  const admin = seat === lobby.adminSeat;
  const n = lobby.seats.length;
  const counts = FACTION_COUNTS[Math.max(4, Math.min(8, n))];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div className="screen">
      <div className="screen-narrow">
        <div className="screen-header">
          <h1 className="gothic">Salon</h1>
          <button className="btn btn-small btn-ghost" onClick={() => { leave(); go('menu'); }}>Quitter</button>
        </div>
      </div>
      <div className="panel screen-narrow" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div className="tag" style={{ marginBottom: 6 }}>Code à partager {mode === 'p2p-host' || mode === 'p2p-guest' ? '(pair-à-pair)' : '(serveur)'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div className="code-box" style={{ flex: 1 }}>{lobby.code}</div>
            <button className="btn" onClick={copy}>{copied ? 'Copié !' : 'Copier'}</button>
          </div>
        </div>
        <div className="panel" style={{ padding: 0 }}>
          {lobby.seats.map((s) => (
            <div className="lobby-seat" key={s.index}>
              <span className="dot" style={{ background: playerColor(s.index) }} />
              <span style={{ flex: 1 }}>
                {s.name}
                {s.index === seat ? ' (vous)' : ''}
                {s.index === lobby.adminSeat ? ' ★' : ''}
              </span>
              <span className="tag">{s.kind === 'bot' ? 'bot' : s.connected ? 'connecté' : 'absent'}</span>
              {admin && s.index !== lobby.adminSeat && (
                <button className="btn btn-small btn-ghost" onClick={() => send({ t: 'lobby:removeSeat', index: s.index })} aria-label={`Retirer ${s.name}`}>✕</button>
              )}
            </div>
          ))}
        </div>
        <small className="muted">
          {n} / {MAX_SEATS} joueurs{n >= MIN_SEATS ? ` · ${counts.hunter} Hunters, ${counts.shadow} Shadows, ${counts.neutral} Neutre${counts.neutral > 1 ? 's' : ''}` : ` · il en faut au moins ${MIN_SEATS}`}
        </small>
        {admin ? (
          <>
            <button className="btn" disabled={n >= MAX_SEATS} onClick={() => send({ t: 'lobby:addBot' })}>+ Ajouter un bot</button>
            <div className="field" role="group" aria-label="Personnages">
              <span>Personnages</span>
              <Segmented value={lobby.settings.pool} options={POOL_OPTIONS} onChange={(pool) => send({ t: 'lobby:settings', settings: { pool } })} />
            </div>
            <div className="field" role="group" aria-label="Niveau des nouveaux bots">
              <span>Niveau des nouveaux bots</span>
              <Segmented value={lobby.settings.botLevel} options={LEVELS} onChange={(botLevel) => send({ t: 'lobby:settings', settings: { botLevel } })} />
            </div>
            <div className="field" role="group" aria-label="Vitesse des bots">
              <span>Vitesse des bots</span>
              <Segmented value={lobby.settings.botSpeed} options={SPEEDS} onChange={(botSpeed) => send({ t: 'lobby:settings', settings: { botSpeed } })} />
            </div>
            <button className="btn btn-primary btn-block" style={{ textAlign: 'center' }} disabled={n < MIN_SEATS} onClick={() => send({ t: 'lobby:start' })}>
              Lancer la partie
            </button>
          </>
        ) : (
          <p className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> En attente du lancement par l'hôte…</p>
        )}
      </div>
    </div>
  );
}

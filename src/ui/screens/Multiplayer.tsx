import { useState } from 'react';
import type { BotLevel } from '../../ai/bot';
import type { CharacterPool } from '../../engine';
import { connectToServer, hostP2P, joinP2P } from '../session';
import { useStore } from '../store';
import { NameField, POOL_OPTIONS, Segmented } from './SoloSetup';

type Transport = 'p2p' | 'server';

export function Multiplayer() {
  const go = useStore((s) => s.go);
  const busy = useStore((s) => s.busy);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [transport, setTransport] = useState<Transport>('p2p');
  const [code, setCode] = useState('');
  const [pool, setPool] = useState<CharacterPool>('mixed');
  const level: BotLevel = 'normal';
  const serverMissing = transport === 'server' && !settings.serverUrl.trim();

  const create = () => {
    const lobby = { pool, botLevel: level, botSpeed: settings.speed };
    if (transport === 'p2p') void hostP2P(lobby);
    else void connectToServer(settings.serverUrl);
  };
  const join = () => {
    if (!code.trim()) return;
    if (transport === 'p2p') void joinP2P(code);
    else void connectToServer(settings.serverUrl, code);
  };

  return (
    <div className="screen">
      <div className="screen-narrow">
        <div className="screen-header">
          <h1 className="gothic">Multijoueur</h1>
          <button className="btn btn-small btn-ghost" onClick={() => go('menu')}>Retour</button>
        </div>
      </div>
      <div className="panel screen-narrow" style={{ padding: 18 }}>
        <NameField />
        <div className="field" role="group" aria-label="Connexion">
          <span>Connexion</span>
          <Segmented<Transport> value={transport} options={[['p2p', 'Sans serveur (P2P)'], ['server', 'Serveur']]} onChange={setTransport} />
          <small className="muted">
            {transport === 'p2p'
              ? 'Le navigateur de l\'hôte fait tourner la partie et les bots. Rien à installer ; l\'hôte doit garder son onglet ouvert.'
              : 'Un serveur Node fait tourner la partie : plus robuste, et les joueurs peuvent se reconnecter.'}
          </small>
        </div>
        {transport === 'server' && (
          <label className="field">
            <span>Adresse du serveur</span>
            <input type="url" placeholder="wss://mon-serveur.onrender.com" value={settings.serverUrl} onChange={(e) => update({ serverUrl: e.target.value })} />
          </label>
        )}
        <h3 className="tag" style={{ margin: '18px 0 8px' }}>Créer un salon</h3>
        {transport === 'p2p' && (
          <div className="field" role="group" aria-label="Personnages">
            <span>Personnages</span>
            <Segmented<CharacterPool> value={pool} options={POOL_OPTIONS} onChange={setPool} />
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ textAlign: 'center' }} disabled={!!busy || serverMissing} onClick={create}>
          Créer un salon
        </button>
        <h3 className="tag" style={{ margin: '22px 0 8px' }}>Rejoindre un salon</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="CODE" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && join()} style={{ fontFamily: 'var(--pixel)', letterSpacing: '0.15em' }} />
          <button className="btn" disabled={!!busy || !code.trim() || serverMissing} onClick={join}>Rejoindre</button>
        </div>
        {busy && <p className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> {busy}</p>}
      </div>
    </div>
  );
}

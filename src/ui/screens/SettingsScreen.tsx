import { discardSave } from '../session';
import { useStore } from '../store';
import { play } from '../sound';
import { SPEEDS, Segmented } from './SoloSetup';

export function SettingsScreen() {
  const go = useStore((s) => s.go);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const hasSave = useStore((s) => s.hasSave);
  return (
    <div className="screen">
      <div className="screen-narrow">
        <div className="screen-header">
          <h1 className="gothic">Paramètres</h1>
          <button className="btn btn-small btn-ghost" onClick={() => go('menu')}>Retour</button>
        </div>
      </div>
      <div className="panel screen-narrow" style={{ padding: 18 }}>
        <label className="field">
          <span>Volume des effets ({Math.round(settings.volume * 100)} %)</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => update({ volume: Number(e.target.value) })} onMouseUp={() => play('button_click')} />
        </label>
        <div className="field" role="group" aria-label="Vitesse des bots par défaut">
          <span>Vitesse des bots par défaut</span>
          <Segmented value={settings.speed} options={SPEEDS} onChange={(speed) => update({ speed })} />
        </div>
        <div className="field" role="group" aria-label="Animations">
          <span>Animations</span>
          <Segmented value={settings.reducedMotion ? 'off' : 'on'} options={[['on', 'Activées'], ['off', 'Réduites']]} onChange={(v) => update({ reducedMotion: v === 'off' })} />
        </div>
        <label className="field">
          <span>Serveur multijoueur par défaut</span>
          <input type="url" placeholder="wss://mon-serveur.onrender.com" value={settings.serverUrl} onChange={(e) => update({ serverUrl: e.target.value })} />
        </label>
        {hasSave && <button className="btn btn-danger" onClick={discardSave}>Supprimer la partie sauvegardée</button>}
      </div>
    </div>
  );
}

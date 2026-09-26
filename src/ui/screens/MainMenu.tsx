import { AREA_IDS } from '../../engine';
import { discardSave, resumeSolo } from '../session';
import { useStore } from '../store';
import { areaImage, uiImage } from '../theme';

export function MainMenu() {
  const go = useStore((s) => s.go);
  const hasSave = useStore((s) => s.hasSave);
  return (
    <div className="screen">
      <img className="menu-title" src={uiImage('title_menu_color.png')} alt="Shadow Hunters" />
      <p className="menu-sub">Identités cachées · Hunters, Shadows et Neutres<br />4 à 8 joueurs · humains et bots</p>
      <div className="menu-buttons">
        {hasSave && (
          <button className="btn btn-primary" onClick={() => resumeSolo() || discardSave()}>
            Reprendre la partie
            <span className="sub" style={{ color: '#5a3a10' }}>Partie solo sauvegardée</span>
          </button>
        )}
        <button className={`btn${hasSave ? '' : ' btn-primary'}`} onClick={() => go('solo')}>
          Partie solo
          <span className="sub" style={hasSave ? undefined : { color: '#5a3a10' }}>Vous contre 3 à 7 bots</span>
        </button>
        <button className="btn" onClick={() => go('multi')}>
          Multijoueur en ligne
          <span className="sub">Avec vos amis, complété par des bots</span>
        </button>
        <button className="btn" onClick={() => go('rules')}>Règles et cartes</button>
        <button className="btn btn-ghost" onClick={() => go('settings')}>Paramètres</button>
      </div>
      <div className="menu-areas" aria-hidden>
        {AREA_IDS.map((a) => <img key={a} src={areaImage(a)} alt="" />)}
      </div>
      <p className="tag" style={{ textAlign: 'center', lineHeight: 1.8 }}>
        Adaptation non officielle du jeu de Yasutaka Ikeda (Game Republic / Z-Man Games)
      </p>
    </div>
  );
}

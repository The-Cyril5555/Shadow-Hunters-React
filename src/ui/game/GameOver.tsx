import { CHARACTERS, type PlayerView } from '../../engine';
import { FactionChip } from '../components/CharacterCard';
import { Modal } from '../components/Modal';
import { characterImage, playerColor } from '../theme';

export function GameOver({ view, onMenu, onReplay, onClose }: { view: PlayerView; onMenu(): void; onReplay?: () => void; onClose(): void }) {
  const won = view.me !== null && view.winners.includes(view.me);
  return (
    <Modal title={won ? 'Victoire !' : 'Défaite…'} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{view.endReason}</p>
      <div className="game-over-grid">
        {view.players.map((p) => {
          const c = p.character ? CHARACTERS[p.character] : null;
          const w = view.winners.includes(p.id);
          return (
            <div key={p.id} className={`game-over-card${w ? ' won' : ''}`}>
              <img src={characterImage(p.character)} alt="" />
              <strong style={{ color: playerColor(p.id) }}>{p.name}</strong>
              {c && <span>{c.name}</span>}
              {c && <FactionChip id={c.id} />}
              <span className="tag">{w ? 'Gagnant' : 'Perdant'}{p.alive ? '' : ' · mort'}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {onReplay && <button className="btn btn-primary" onClick={onReplay}>Rejouer</button>}
        <button className="btn" onClick={onClose}>Voir le plateau</button>
        <button className="btn btn-ghost" onClick={onMenu}>Menu principal</button>
      </div>
    </Modal>
  );
}

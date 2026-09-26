import type { Faction, PlayerView } from '../../engine';
import { CHARACTERS } from '../../engine';
import { Modal } from '../components/Modal';
import { useStore } from '../store';
import { FACTION_COLORS, FACTION_LABEL, playerColor } from '../theme';

/** Carnet de déduction : vos suppositions sur chaque joueur (visibles de vous seul). */
export function Notebook({ view, onClose }: { view: PlayerView; onClose(): void }) {
  const notes = useStore((s) => s.notes);
  const setNote = useStore((s) => s.setNote);
  return (
    <Modal title="Carnet de déduction" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Notez vos soupçons. Rien n'est partagé avec les autres joueurs.
      </p>
      <div className="card-list">
        {view.players.filter((p) => p.id !== view.me).map((p) => {
          const known = p.character ? CHARACTERS[p.character] : null;
          const note = notes[p.id] ?? {};
          return (
            <div key={p.id} className="panel" style={{ padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="dot" style={{ background: playerColor(p.id) }} />
                <strong>{p.name}</strong>
                {known ? (
                  <span className="muted">{known.name} ({FACTION_LABEL[known.faction]}) — connu</span>
                ) : (
                  <div className="segmented" style={{ flex: 1 }}>
                    {(['hunter', 'shadow', 'neutral'] as Faction[]).map((f) => (
                      <button
                        key={f}
                        className={`btn btn-small${note.faction === f ? ' active' : ''}`}
                        style={note.faction === f ? { background: FACTION_COLORS[f] } : undefined}
                        onClick={() => setNote(p.id, { faction: note.faction === f ? null : f })}
                      >
                        {FACTION_LABEL[f]} ?
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Notes (ex. : a pris 1 dégât sur Gifle → Hunter ?)"
                value={note.text ?? ''}
                onChange={(e) => setNote(p.id, { text: e.target.value })}
              />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

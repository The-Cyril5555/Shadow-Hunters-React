import { useState } from 'react';
import type { DeckId, PlayerView } from '../../engine';
import { CardBack, CardFace } from '../components/CardFace';
import { DECK_STYLE } from '../theme';
import { Modal } from '../components/Modal';

export function Decks({ view }: { view: PlayerView }) {
  const [open, setOpen] = useState<DeckId | null>(null);
  return (
    <div className="panel decks">
      {(['hermit', 'white', 'black'] as DeckId[]).map((d) => {
        const deck = view.decks[d];
        const top = deck.discard[deck.discard.length - 1];
        return (
          <div className="deck" key={d}>
            <span className="tag">{DECK_STYLE[d].label}</span>
            <div className="pile" title={`${deck.drawCount} carte(s) dans la pioche`}>
              <CardBack deck={d} empty={deck.drawCount === 0} />
            </div>
            <span className="count">Pioche {deck.drawCount}<br />Défausse {deck.discardCount}</span>
            {d !== 'hermit' && top && (
              <button className="btn btn-small discard-btn" onClick={() => setOpen(d)} title="Voir la défausse">Défausse</button>
            )}
          </div>
        );
      })}
      {open && (
        <Modal title={`Défausse ${DECK_STYLE[open].label}`} onClose={() => setOpen(null)}>
          <div className="cards-grid">
            {[...view.decks[open].discard].reverse().map((c) => <CardFace key={c} card={c} width={150} />)}
          </div>
        </Modal>
      )}
    </div>
  );
}

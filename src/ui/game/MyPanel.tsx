import { useState } from 'react';
import type { PlayerView } from '../../engine';
import { CharacterCard } from '../components/CharacterCard';
import { act } from '../session';
import { EquipChip } from './PlayerMat';

export function MyPanel({ view }: { view: PlayerView }) {
  const [armed, setArmed] = useState<string | null>(null);
  if (view.me === null) return <div className="panel me-panel">Spectateur</div>;
  const me = view.players[view.me];
  const character = me.character;
  const confirm = (key: string, fn: () => void) => {
    if (armed === key) {
      setArmed(null);
      fn();
    } else {
      setArmed(key);
      setTimeout(() => setArmed((k) => (k === key ? null : k)), 4000);
    }
  };
  return (
    <div className="panel me-panel">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tag" style={{ marginBottom: 6 }}>
          Votre personnage {me.revealed ? '(révélé)' : '(secret)'}{!me.alive ? ' — mort' : ''}
        </div>
        {character && <CharacterCard id={character} />}
        {me.equipment.length > 0 && (
          <div className="equip" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {me.equipment.map((e) => <EquipChip key={e} card={e} />)}
          </div>
        )}
        {me.agnesLeft && <p className="small muted">Caprice : c'est désormais le joueur à votre gauche qui compte.</p>}
      </div>
      <div className="actions">
        {view.canReveal && (
          <button className="btn btn-reveal" onClick={() => confirm('reveal', () => act({ type: 'reveal', player: view.me as number }))}>
            {armed === 'reveal' ? 'Confirmer la révélation' : 'Se révéler'}
            <span className="sub">À tout moment</span>
          </button>
        )}
        {view.anytime.map((o) => (
          <button key={o.id} className="btn" onClick={() => confirm(o.id, () => act({ type: 'ability', player: view.me as number, optionId: o.id }))}>
            {armed === o.id ? 'Confirmer' : o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

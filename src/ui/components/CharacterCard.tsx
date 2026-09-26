import { CHARACTERS, type CharacterId } from '../../engine';
import { FACTION_COLORS, FACTION_LABEL, characterImage } from '../theme';

export function FactionChip({ id }: { id: CharacterId }) {
  const c = CHARACTERS[id];
  return (
    <span className="faction-chip" style={{ background: FACTION_COLORS[c.faction] }}>
      {FACTION_LABEL[c.faction]}
    </span>
  );
}

export function CharacterCard({ id, compact }: { id: CharacterId; compact?: boolean }) {
  const c = CHARACTERS[id];
  return (
    <div className="char-card">
      <img src={characterImage(id)} alt={c.name} className="pixel" style={compact ? { width: 64, height: 96 } : undefined} />
      <div>
        <div className="title">
          <h3 className="gothic">{c.name}</h3>
          <FactionChip id={id} />
          <span className="tag">{c.hp} PV · {c.letter}{c.expansion ? ' · extension' : ''}</span>
        </div>
        <p><span className="ability-name">{c.ability.name}</span>{c.ability.oncePerGame ? ' (une fois par partie)' : ''} — {c.ability.text}</p>
        <p className="muted"><strong>Victoire :</strong> {c.win}</p>
      </div>
    </div>
  );
}

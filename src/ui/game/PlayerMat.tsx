import { CHARACTERS, cardDef, type PublicPlayer } from '../../engine';
import type { SeatInfo } from '../../net/protocol';
import { FactionChip } from '../components/CharacterCard';
import type { Note } from '../store';
import { FACTION_COLORS, FACTION_LABEL, characterImage, playerColor } from '../theme';

interface Props {
  player: PublicPlayer;
  seat?: SeatInfo;
  me: boolean;
  active: boolean;
  deciding: boolean;
  selectable: boolean;
  note?: Note;
  finished?: boolean;
  onSelect?: () => void;
}

export function EquipChip({ card }: { card: string }) {
  const def = cardDef(card);
  return (
    <span className={`equip-chip ${def.deck}`} title={`${def.name} : ${def.text}`}>
      {def.name}
    </span>
  );
}

export function PlayerMat({ player: p, seat, me, active, deciding, selectable, note, finished, onSelect }: Props) {
  const c = p.character ? CHARACTERS[p.character] : null;
  const hp = c?.hp;
  const classes = ['mat', me && 'me', active && 'active', deciding && 'deciding', !p.alive && 'dead', selectable && 'selectable']
    .filter(Boolean).join(' ');
  return (
    <div
      id={`mat-${p.id}`}
      className={classes}
      style={{ ['--pc' as string]: playerColor(p.id) }}
      onClick={selectable ? onSelect : undefined}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={(e) => selectable && (e.key === 'Enter' || e.key === ' ') && onSelect?.()}
      aria-label={`${p.name}${c ? `, ${c.name}` : ''}, ${p.damage} dégâts${selectable ? ', cliquez pour choisir' : ''}`}
    >
      <img className="portrait" src={characterImage(p.character)} alt={c ? c.name : 'Personnage caché'} />
      <div style={{ minWidth: 0 }}>
        <div className="name" title={p.name}>
          <span className="seat-num">{p.id + 1}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{me ? ' (vous)' : ''}</span>
        </div>
        <div className="line">
          {c ? <>{c.name} <FactionChip id={c.id} /></> : <span>Identité cachée</span>}
          {c && !me && !p.revealed && p.alive && !finished && <span className="tag" title="Vous avez vu sa carte en secret (Prédiction)">vu</span>}
        </div>
        <div className="line">
          <span className="hp">{p.damage} / {hp ?? '?'}</span>
          <span className="status-icons">
            {!p.alive && <span title="Mort">☠︎</span>}
            {p.guardianAngel && <span title="Ange gardien : immunisé contre les attaques">♱</span>}
            {p.barrier && <span title="Barrière spectrale : immunisé contre tous les dégâts">⛨</span>}
            {p.abilityVoided && <span title="Capacité annulée par Ellen">⊘</span>}
            {p.abilityUsed && <span title="Capacité à usage unique déjà utilisée">✓</span>}
            {seat?.kind === 'bot' && <span title="Bot">⚙︎</span>}
            {seat && seat.kind === 'human' && !seat.connected && <span title="Déconnecté">⚡︎</span>}
            {seat?.autopilot && <span title="Un bot joue à sa place">⚙︎</span>}
          </span>
          {note?.faction && !c && (
            <span className="note-chip" style={{ color: FACTION_COLORS[note.faction] }} title="Votre supposition (carnet)">
              {FACTION_LABEL[note.faction]} ?
            </span>
          )}
        </div>
        {hp && <div className="hp-bar"><div style={{ width: `${Math.min(100, (p.damage / hp) * 100)}%` }} /></div>}
        {p.equipment.length > 0 && (
          <div className="equip">
            {p.equipment.map((e) => <EquipChip key={e} card={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}

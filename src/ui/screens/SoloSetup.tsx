import { useState } from 'react';
import type { BotLevel } from '../../ai/bot';
import { FACTION_COUNTS, type CharacterPool } from '../../engine';
import type { BotSpeed } from '../../net/protocol';
import { startSolo } from '../session';
import { useStore } from '../store';

export const POOLS: [CharacterPool, string, string][] = [
  ['mixed', 'Mélange', 'Base et extension, une carte par initiale'],
  ['base', 'Base', 'Les 10 personnages d\'origine'],
  ['expansion', 'Extension', 'Les 10 personnages de l\'extension'],
];
export const POOL_OPTIONS: [CharacterPool, string][] = POOLS.map(([v, l]) => [v, l]);
export const LEVELS: [BotLevel, string][] = [['easy', 'Facile'], ['normal', 'Normal'], ['hard', 'Difficile']];
export const SPEEDS: [BotSpeed, string][] = [['slow', 'Lente'], ['normal', 'Normale'], ['fast', 'Rapide']];

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange(v: T): void; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={`btn btn-small${value === v ? ' active' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function NameField() {
  const name = useStore((s) => s.settings.name);
  const update = useStore((s) => s.updateSettings);
  return (
    <label className="field">
      <span>Votre nom</span>
      <input type="text" maxLength={20} value={name} placeholder="Joueur" onChange={(e) => update({ name: e.target.value })} />
    </label>
  );
}

export function SoloSetup() {
  const go = useStore((s) => s.go);
  const speed = useStore((s) => s.settings.speed);
  const update = useStore((s) => s.updateSettings);
  const [players, setPlayers] = useState(5);
  const [pool, setPool] = useState<CharacterPool>('mixed');
  const [level, setLevel] = useState<BotLevel>('normal');
  const counts = FACTION_COUNTS[players];
  return (
    <div className="screen">
      <div className="screen-narrow">
        <div className="screen-header">
          <h1 className="gothic">Partie solo</h1>
          <button className="btn btn-small btn-ghost" onClick={() => go('menu')}>Retour</button>
        </div>
      </div>
      <div className="panel screen-narrow" style={{ padding: 18 }}>
        <NameField />
        <div className="field" role="group" aria-label="Nombre de joueurs (vous compris)">
          <span>Nombre de joueurs (vous compris)</span>
          <Segmented value={String(players)} options={[4, 5, 6, 7, 8].map((n) => [String(n), String(n)])} onChange={(v) => setPlayers(Number(v))} />
          <small className="muted">{counts.hunter} Hunters · {counts.shadow} Shadows · {counts.neutral} Neutre{counts.neutral > 1 ? 's' : ''}</small>
        </div>
        <div className="field" role="group" aria-label="Personnages">
          <span>Personnages</span>
          <Segmented<CharacterPool> value={pool} options={POOL_OPTIONS} onChange={setPool} />
          <small className="muted">{POOLS.find(([v]) => v === pool)?.[2]}</small>
        </div>
        <div className="field" role="group" aria-label="Niveau des bots">
          <span>Niveau des bots</span>
          <Segmented<BotLevel> value={level} options={LEVELS} onChange={setLevel} />
        </div>
        <div className="field" role="group" aria-label="Vitesse des bots">
          <span>Vitesse des bots</span>
          <Segmented value={speed} options={SPEEDS} onChange={(v) => update({ speed: v })} />
        </div>
        <button className="btn btn-primary btn-block" style={{ textAlign: 'center', fontSize: 18 }} onClick={() => startSolo(players, { pool, botLevel: level, botSpeed: speed })}>
          Commencer la partie
        </button>
      </div>
    </div>
  );
}

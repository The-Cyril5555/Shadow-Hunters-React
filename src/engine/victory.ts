import { CHARACTERS } from './data/characters';
import { cardType, DAVID_CARDS } from './data/cards';
import { discard, emit, factionOf } from './helpers';
import type { GameState, PlayerState } from './types';

function facts(s: GameState) {
  const byFaction = (f: string) => s.players.filter((p) => factionOf(p) === f);
  const shadows = byFaction('shadow');
  const hunters = byFaction('hunter');
  const neutrals = byFaction('neutral');
  return {
    shadowsDead: shadows.length > 0 && shadows.every((p) => !p.alive),
    huntersDead: hunters.length > 0 && hunters.every((p) => !p.alive),
    neutralDeaths: neutrals.filter((p) => !p.alive).length,
    aliveCount: s.players.filter((p) => p.alive).length,
  };
}

function davidCount(p: PlayerState): number {
  return new Set(p.equipment.map(cardType).filter((t) => DAVID_CARDS.includes(t))).size;
}

/** Conditions qui mettent fin à la partie dès qu'elles sont remplies. */
export function victoryTriggered(s: GameState): string | null {
  const f = facts(s);
  if (f.shadowsDead) return 'Tous les Shadows sont morts.';
  if (f.huntersDead) return 'Tous les Hunters sont morts.';
  if (f.neutralDeaths >= 3) return 'Trois Neutres sont morts.';
  if (s.flags.charlesWin) return 'Charles a tué alors qu\'il y avait au moins 3 morts.';
  if (s.flags.bryanWin) return 'Bryan a tué un personnage de 13 PV ou plus.';
  for (const p of s.players) {
    if (p.character === 'bob' && p.alive && p.equipment.length >= 5) return 'Bob possède 5 équipements.';
    if (p.character === 'david' && p.alive && davidCount(p) >= 3) return 'David a réuni 3 reliques.';
    if ((p.character === 'daniel' || p.character === 'catherine') && p.deathBatch === 1) {
      return `${CHARACTERS[p.character].name} est le premier personnage mort.`;
    }
    if (p.character === 'catherine' && p.alive && f.aliveCount <= 2) return 'Catherine fait partie des deux derniers survivants.';
  }
  return null;
}

export function computeWinners(s: GameState): number[] {
  const f = facts(s);
  const wins = new Map<number, boolean>();
  for (const p of s.players) {
    let w = false;
    switch (p.character) {
      case 'agnes': continue;
      case 'allie': w = p.alive; break;
      case 'bob': w = p.equipment.length >= 5; break;
      case 'charles': w = s.flags.charlesWin; break;
      case 'daniel': w = p.deathBatch === 1 || (f.shadowsDead && p.alive); break;
      case 'bryan': w = s.flags.bryanWin || (p.alive && p.area === 'altar'); break;
      case 'catherine': w = p.deathBatch === 1 || (p.alive && f.aliveCount <= 2); break;
      case 'david': w = davidCount(p) >= 3; break;
      default:
        if (factionOf(p) === 'hunter') w = f.shadowsDead;
        else if (factionOf(p) === 'shadow') w = f.huntersDead || f.neutralDeaths >= 3;
    }
    wins.set(p.id, w);
  }
  const n = s.players.length;
  for (const p of s.players) {
    if (p.character !== 'agnes') continue;
    // Tour de jeu dans le sens horaire : le voisin de gauche joue après vous.
    const neighbour = p.agnesLeft ? (p.id + 1) % n : (p.id + n - 1) % n;
    wins.set(p.id, wins.get(neighbour) ?? false);
  }
  return s.players.filter((p) => wins.get(p.id)).map((p) => p.id);
}

export function checkVictory(s: GameState): boolean {
  if (s.finished) return true;
  const reason = victoryTriggered(s);
  if (!reason) return false;
  s.finished = true;
  // Les cartes encore en cours de résolution rejoignent leur défausse.
  for (const st of s.stack) if (st.t === 'discard') discard(s, st.card);
  if (s.pending && (s.pending.kind === 'hermit_give' || s.pending.kind === 'hermit_respond')) {
    discard(s, s.pending.ctx.card as string);
  }
  s.pending = null;
  s.stack = [];
  s.winners = computeWinners(s);
  s.endReason = reason;
  const names = s.winners.map((id) => s.players[id].name).join(', ') || 'personne';
  emit(s, 'game_over', `Fin de la partie : ${reason} Gagnants : ${names}.`, {
    winners: s.winners,
    characters: s.players.map((p) => p.character),
  });
  return true;
}

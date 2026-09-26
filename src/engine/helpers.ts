import { AREAS } from './data/areas';
import { CHARACTERS, type CharacterDef } from './data/characters';
import { cardDef, cardName, cardType, WEAPONS } from './data/cards';
import { shuffle } from './rng';
import type {
  AreaId, CardId, CardType, DeckId, Decision, DecisionKind, Faction, GameEvent, GameState,
  Option, PlayerState, Step, Visibility,
} from './types';

export function P(s: GameState, id: number): PlayerState {
  const p = s.players[id];
  if (!p) throw new Error(`Joueur inconnu : ${id}`);
  return p;
}

export function charOf(p: PlayerState): CharacterDef {
  return CHARACTERS[p.character];
}

export function factionOf(p: PlayerState): Faction {
  return CHARACTERS[p.character].faction;
}

export function hpOf(p: PlayerState): number {
  return CHARACTERS[p.character].hp;
}

export function name(s: GameState, id: number): string {
  return P(s, id).name;
}

export function alivePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => p.alive);
}

export function othersAlive(s: GameState, id: number): PlayerState[] {
  return s.players.filter((p) => p.alive && p.id !== id);
}

export function hasEquip(p: PlayerState, type: CardType): boolean {
  return p.equipment.some((c) => cardType(c) === type);
}

/** Le joueur peut-il utiliser la capacité de ce personnage (hors révélation) ? */
export function abilityReady(p: PlayerState, character: PlayerState['character']): boolean {
  if (!p.alive || p.character !== character || p.abilityVoided) return false;
  if (CHARACTERS[character].ability.oncePerGame && p.abilityUsed) return false;
  return true;
}

/** Capacité active tout de suite (personnage révélé si nécessaire). */
export function abilityActive(p: PlayerState, character: PlayerState['character']): boolean {
  if (!abilityReady(p, character)) return false;
  return p.revealed || !CHARACTERS[character].ability.requiresReveal;
}

// ─── Journal ────────────────────────────────────────────────

export function emit(
  s: GameState,
  type: string,
  text: string,
  data: Record<string, unknown> = {},
  visibleTo: Visibility = 'all',
  redacted?: GameEvent['redacted'],
): void {
  s.log.push({ seq: ++s.eventSeq, type, text, data, visibleTo, redacted });
}

// ─── Pile d'étapes et décisions ─────────────────────────────

/** Empile des étapes pour qu'elles s'exécutent dans l'ordre donné. */
export function pushSteps(s: GameState, ...steps: Step[]): void {
  for (let i = steps.length - 1; i >= 0; i--) s.stack.push(steps[i]);
}

export function ask(
  s: GameState,
  player: number,
  kind: DecisionKind,
  prompt: string,
  publicLabel: string,
  options: Option[],
  ctx: Record<string, unknown> = {},
  card?: CardId,
): void {
  const d: Decision = { id: s.nextDecisionId++, player, kind, prompt, publicLabel, options, ctx };
  if (card) d.card = card;
  s.pending = d;
}

// ─── Révélation, soins, dégâts ──────────────────────────────

export function reveal(s: GameState, id: number, reason = ''): void {
  const p = P(s, id);
  if (p.revealed) return;
  p.revealed = true;
  const c = charOf(p);
  emit(s, 'reveal', `${p.name} révèle son identité : ${c.name} (${factionLabel(c.faction)})${reason ? ` — ${reason}` : ''}.`, {
    player: id, character: p.character,
  });
}

export function factionLabel(f: Faction): string {
  return f === 'hunter' ? 'Hunter' : f === 'shadow' ? 'Shadow' : 'Neutre';
}

export function heal(s: GameState, id: number, amount: number, reason = ''): number {
  const p = P(s, id);
  if (!p.alive) return 0;
  const healed = Math.min(amount, p.damage);
  p.damage -= healed;
  emit(s, 'heal', healed > 0
    ? `${p.name} soigne ${healed} dégât${healed > 1 ? 's' : ''}${reason ? ` (${reason})` : ''}.`
    : `${p.name} n'a aucun dégât à soigner${reason ? ` (${reason})` : ''}.`, { player: id, amount: healed });
  return healed;
}

export function healFull(s: GameState, id: number, reason: string): void {
  heal(s, id, P(s, id).damage, reason);
}

export function setDamage(s: GameState, id: number, value: number, reason: string): void {
  const p = P(s, id);
  if (!p.alive) return;
  const before = p.damage;
  p.damage = Math.min(value, hpOf(p));
  emit(s, 'set_damage', `Les dégâts de ${p.name} passent de ${before} à ${p.damage} (${reason}).`, {
    player: id, from: before, to: p.damage,
  });
  checkDeath(s, id, null);
}

export type DamageCause = 'attack' | 'card' | 'area' | 'ability' | 'hermit' | 'self';

/** Inflige des dégâts ; renvoie les dégâts réellement subis. */
export function dealDamage(
  s: GameState, id: number, amount: number, source: number | null, cause: DamageCause, reason = '',
): number {
  const p = P(s, id);
  if (!p.alive || amount <= 0) return 0;
  if (p.barrier) {
    emit(s, 'protected', `${p.name} est protégé par la Barrière spectrale.`, { player: id });
    return 0;
  }
  if (cause === 'attack' && p.guardianAngel) {
    emit(s, 'protected', `${p.name} est protégé par l'Ange gardien.`, { player: id });
    return 0;
  }
  const dealt = Math.min(amount, hpOf(p) - p.damage);
  p.damage += dealt;
  emit(s, 'damage', `${p.name} subit ${amount} dégât${amount > 1 ? 's' : ''}${reason ? ` (${reason})` : ''}.`, {
    player: id, amount, source, cause,
  });
  checkDeath(s, id, source);
  return amount;
}

function checkDeath(s: GameState, id: number, source: number | null): void {
  const p = P(s, id);
  if (!p.alive || p.damage < hpOf(p)) return;
  p.alive = false;
  p.guardianAngel = false;
  p.barrier = false;
  s.newDeaths.push({ victim: id, killer: source !== null && source !== id ? source : null });
}

// ─── Lieux et portée ────────────────────────────────────────

export function areaIndex(s: { areas: AreaId[] }, area: AreaId): number {
  return s.areas.indexOf(area);
}

/** Les deux lieux de la même tuile (zone d'attaque). */
export function zoneOf(s: { areas: AreaId[] }, area: AreaId): AreaId[] {
  const i = areaIndex(s, area);
  const base = i - (i % 2);
  return [s.areas[base], s.areas[base + 1]];
}

export function adjacentAreas(s: { areas: AreaId[] }, area: AreaId): AreaId[] {
  const i = areaIndex(s, area);
  const prev = s.areas[(i + 5) % 6];
  const next = s.areas[(i + 1) % 6];
  return prev === next ? [prev] : [prev, next];
}

export function targetsInRange(s: GameState, id: number): number[] {
  const p = P(s, id);
  if (!p.area) return [];
  const zone = zoneOf(s, p.area);
  const inverted = hasEquip(p, 'handgun');
  return othersAlive(s, id)
    .filter((o) => o.area !== null && (inverted ? !zone.includes(o.area) : zone.includes(o.area)))
    .map((o) => o.id);
}

export function moveTo(s: GameState, id: number, area: AreaId, how: string): void {
  const p = P(s, id);
  p.area = area;
  emit(s, 'move', `${p.name} se rend à : ${AREAS[area].name}${how ? ` (${how})` : ''}.`, { player: id, area });
}

// ─── Cartes ─────────────────────────────────────────────────

export function drawFromDeck(s: GameState, deck: DeckId): CardId | null {
  const pile = s.decks[deck];
  if (pile.draw.length === 0) {
    if (pile.discard.length === 0) return null;
    pile.draw = shuffle(s, pile.discard);
    pile.discard = [];
    emit(s, 'reshuffle', `La défausse ${deck === 'hermit' ? 'Ermite' : deck === 'white' ? 'Lumière' : 'Ténèbres'} est mélangée pour reformer la pioche.`, { deck });
  }
  return pile.draw.pop() ?? null;
}

export function deckOf(card: CardId): DeckId {
  return cardDef(card).deck;
}

export function discard(s: GameState, card: CardId): void {
  s.decks[deckOf(card)].discard.push(card);
}

export function takeEquipment(s: GameState, from: number, to: number, card: CardId, how: string): void {
  const a = P(s, from);
  const b = P(s, to);
  const i = a.equipment.indexOf(card);
  if (i < 0) return;
  a.equipment.splice(i, 1);
  b.equipment.push(card);
  emit(s, 'equipment_move', `${b.name} récupère ${cardName(card)} de ${a.name}${how ? ` (${how})` : ''}.`, {
    from, to, card,
  });
}

export function attackBonus(s: GameState, attacker: PlayerState): number {
  let bonus = attacker.equipment.filter((c) => WEAPONS.includes(cardType(c))).length;
  if (hasEquip(attacker, 'spear_of_longinus') && attacker.revealed && factionOf(attacker) === 'hunter') bonus += 2;
  void s;
  return bonus;
}

export function deadCount(s: GameState): number {
  return s.players.filter((p) => !p.alive).length;
}

export function nextAliveAfter(s: GameState, id: number): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const q = (id + k) % n;
    if (s.players[q].alive) return q;
  }
  return id;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

import { cardDef, cardName } from './data/cards';
import { emit, abilityReady, deckOf, healFull, P, reveal, charOf } from './helpers';
import { processDeaths, resolveDecision, runStep } from './flow';
import { createInitialState } from './setup';
import { checkVictory } from './victory';
import { EngineError, type Action, type GameConfig, type GameEvent, type GameState, type Option } from './types';

/** Fait avancer la partie jusqu'à la prochaine décision (ou la fin). */
export function advance(s: GameState): void {
  for (let guard = 0; guard < 100_000; guard++) {
    if (s.newDeaths.length) processDeaths(s);
    if (checkVictory(s)) return;
    if (s.pending) return;
    const step = s.stack.pop();
    if (!step) throw new Error('Pile d\'étapes vide : état incohérent.');
    runStep(s, step);
  }
  throw new Error('Boucle de résolution infinie.');
}

export function createGame(config: GameConfig): GameState {
  const s = createInitialState(config);
  emit(s, 'game_start', `La partie commence avec ${s.players.length} joueurs. ${s.players[s.turn.active].name} commence.`, {
    first: s.turn.active,
  });
  advance(s);
  return s;
}

/** Capacités utilisables à tout moment (Allie, David). */
export function anytimeOptions(s: GameState, p: number): Option[] {
  const pl = s.players[p];
  if (!pl || s.finished || !pl.alive) return [];
  const rev = !pl.revealed;
  const sfx = rev ? ' (se révéler)' : '';
  const opts: Option[] = [];
  if (abilityReady(pl, 'allie') && pl.damage > 0) {
    opts.push({ id: 'allie', label: `Amour maternel : soigner tous vos dégâts${sfx}`, group: 'ability', reveal: rev });
  }
  if (abilityReady(pl, 'david')) {
    for (const d of ['white', 'black'] as const) {
      for (const c of s.decks[d].discard) {
        if (cardDef(c).kind === 'equipment') {
          opts.push({ id: `david:${c}`, label: `Pilleur de tombes : prendre ${cardName(c)}${sfx}`, card: c, group: 'ability', reveal: rev });
        }
      }
    }
  }
  return opts;
}

export function canReveal(s: GameState, p: number): boolean {
  const pl = s.players[p];
  return !!pl && !s.finished && pl.alive && !pl.revealed;
}

function applyAnytimeAbility(s: GameState, p: number, opt: Option): void {
  if (opt.reveal) reveal(s, p);
  const pl = P(s, p);
  pl.abilityUsed = true;
  emit(s, 'ability', `${pl.name} utilise ${charOf(pl).ability.name} (${charOf(pl).name}).`, { player: p, character: pl.character });
  if (opt.id === 'allie') {
    healFull(s, p, 'Amour maternel');
    return;
  }
  const card = opt.card as string;
  const pile = s.decks[deckOf(card)].discard;
  pile.splice(pile.indexOf(card), 1);
  pl.equipment.push(card);
  emit(s, 'equip', `${pl.name} récupère ${cardName(card)} dans la défausse.`, { player: p, card, from: 'discard' });
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * Applique une action et renvoie le nouvel état. Par défaut l'état d'origine n'est pas
 * modifié ; `inPlace` évite la copie (hôte de partie, simulations).
 */
export function applyAction(state: GameState, action: Action, inPlace = false): ActionResult {
  if (state.finished) throw new EngineError('La partie est terminée.');
  const s = inPlace ? state : structuredClone(state);
  const before = s.eventSeq;
  const pl = s.players[action.player];
  if (!pl) throw new EngineError('Joueur inconnu.');
  switch (action.type) {
    case 'choose': {
      const d = s.pending;
      if (!d || d.id !== action.decisionId) throw new EngineError('Cette décision n\'est plus d\'actualité.');
      if (d.player !== action.player) throw new EngineError('Ce n\'est pas à vous de décider.');
      const opt = d.options.find((o) => o.id === action.optionId);
      if (!opt) throw new EngineError('Option invalide.');
      s.pending = null;
      resolveDecision(s, d, opt);
      break;
    }
    case 'reveal':
      if (!canReveal(s, action.player)) throw new EngineError('Vous ne pouvez pas vous révéler.');
      reveal(s, action.player);
      break;
    case 'ability': {
      const opt = anytimeOptions(s, action.player).find((o) => o.id === action.optionId);
      if (!opt) throw new EngineError('Capacité indisponible.');
      applyAnytimeAbility(s, action.player, opt);
      break;
    }
    default:
      throw new EngineError('Action inconnue.');
  }
  advance(s);
  return { state: s, events: s.log.filter((e) => e.seq > before) };
}

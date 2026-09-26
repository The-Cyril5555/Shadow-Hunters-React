import { AREA_IDS } from './data/areas';
import { charactersInPool, FACTION_COUNTS, FACTION_LETTERS, type CharacterDef } from './data/characters';
import { deckCards } from './data/cards';
import { randInt, shuffle } from './rng';
import type { CharacterId, Faction, GameConfig, GameState } from './types';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;

function pickCharacters(s: { rng: number }, config: GameConfig, n: number): CharacterId[] {
  const counts = FACTION_COUNTS[n];
  const pool = charactersInPool(config.pool);
  const chosen: CharacterId[] = [];
  for (const f of ['hunter', 'shadow', 'neutral'] as Faction[]) {
    const candidates = pool.filter((c) => c.faction === f);
    if (config.pool === 'mixed') {
      // Une seule carte par initiale, comme le recommande la règle.
      const letters = shuffle(s, FACTION_LETTERS[f]).slice(0, counts[f]);
      for (const l of letters) {
        const options: CharacterDef[] = candidates.filter((c) => c.letter === l);
        chosen.push(options[randInt(s, options.length)].id);
      }
    } else {
      chosen.push(...shuffle(s, candidates).slice(0, counts[f]).map((c) => c.id));
    }
  }
  return shuffle(s, chosen);
}

export function createInitialState(config: GameConfig): GameState {
  const n = config.playerNames.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Shadow Hunters se joue de ${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs.`);
  const rngState = { rng: config.seed | 0 };
  const characters = pickCharacters(rngState, config, n);
  const areas = shuffle(rngState, AREA_IDS);
  const decks = {
    hermit: { draw: shuffle(rngState, deckCards('hermit')), discard: [] },
    white: { draw: shuffle(rngState, deckCards('white')), discard: [] },
    black: { draw: shuffle(rngState, deckCards('black')), discard: [] },
  };
  const first = randInt(rngState, n);
  return {
    version: 1,
    config,
    rng: rngState.rng,
    players: config.playerNames.map((name, id) => ({
      id,
      name,
      character: characters[id],
      revealed: false,
      alive: true,
      damage: 0,
      area: null,
      equipment: [],
      abilityUsed: false,
      abilityVoided: false,
      guardianAngel: false,
      barrier: false,
      agnesLeft: false,
      deathBatch: null,
      killedBy: null,
      knownBy: [],
    })),
    areas,
    decks,
    turn: { number: 0, active: first, phase: 'start', extraTurns: 0, ultraSoulUsed: false },
    stack: [{ t: 'startTurn', p: first }],
    pending: null,
    nextDecisionId: 1,
    log: [],
    eventSeq: 0,
    newDeaths: [],
    deathBatches: 0,
    flags: { charlesWin: false, bryanWin: false },
    combatDealt: false,
    finished: false,
    winners: [],
    endReason: '',
  };
}

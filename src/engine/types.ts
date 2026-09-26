// Types du moteur de règles. Tout l'état est sérialisable (JSON) pour pouvoir
// être sauvegardé, envoyé sur le réseau et rejoué.

export type Faction = 'hunter' | 'shadow' | 'neutral';

export type CharacterId =
  | 'emi' | 'franklin' | 'george' | 'ellen' | 'fuka' | 'gregor'
  | 'unknown' | 'vampire' | 'werewolf' | 'ultra_soul' | 'valkyrie' | 'wight'
  | 'allie' | 'bob' | 'charles' | 'daniel' | 'agnes' | 'bryan' | 'catherine' | 'david';

export type AreaId = 'hermit' | 'underworld' | 'church' | 'cemetery' | 'woods' | 'altar';

export type DeckId = 'hermit' | 'white' | 'black';

/** Type de carte (plusieurs exemplaires possibles). */
export type CardType =
  // Ermite (vision)
  | 'aid' | 'anger' | 'blackmail' | 'bully' | 'exorcism' | 'greed'
  | 'huddle' | 'nurturance' | 'prediction' | 'slap' | 'spell' | 'tough_lesson'
  // Blanches – usage unique
  | 'advent' | 'blessing' | 'chocolate' | 'concealed_knowledge' | 'disenchant_mirror'
  | 'first_aid' | 'flare_of_judgement' | 'guardian_angel' | 'holy_water'
  // Blanches – équipement
  | 'fortune_brooch' | 'mystic_compass' | 'holy_robe' | 'silver_rosary' | 'spear_of_longinus' | 'talisman'
  // Noires – usage unique
  | 'banana_peel' | 'bloodthirsty_spider' | 'diabolic_ritual' | 'dynamite' | 'moody_goblin'
  | 'spiritual_doll' | 'vampire_bat'
  // Noires – équipement
  | 'butcher_knife' | 'chainsaw' | 'rusted_broad_axe' | 'masamune' | 'handgun' | 'machine_gun';

/** Identifiant d'un exemplaire physique, ex. « vampire_bat#2 ». */
export type CardId = string;

export type CharacterPool = 'base' | 'expansion' | 'mixed';

export interface GameConfig {
  playerNames: string[];
  pool: CharacterPool;
  seed: number;
}

export interface PlayerState {
  id: number;
  name: string;
  character: CharacterId;
  revealed: boolean;
  alive: boolean;
  damage: number;
  area: AreaId | null;
  equipment: CardId[];
  /** Capacité « une fois par partie » déjà utilisée. */
  abilityUsed: boolean;
  /** Capacité annulée définitivement (Ellen). */
  abilityVoided: boolean;
  guardianAngel: boolean;
  barrier: boolean;
  /** Agnès a utilisé Caprice : c'est le joueur de gauche qui compte. */
  agnesLeft: boolean;
  /** Numéro du « lot » de morts (1 = premiers morts). */
  deathBatch: number | null;
  killedBy: number | null;
  /** Joueurs qui ont vu ce personnage en privé (Prédiction). */
  knownBy: number[];
}

export interface Pile {
  draw: CardId[];
  discard: CardId[];
}

export type Phase = 'start' | 'move' | 'area' | 'attack' | 'end';

export interface TurnState {
  number: number;
  active: number;
  phase: Phase;
  /** Tours supplémentaires à jouer par le joueur actif (Savoir caché, Spectre). */
  extraTurns: number;
  /** Rayon meurtrier déjà utilisé ce tour (Ultra Soul). */
  ultraSoulUsed: boolean;
}

export interface Option {
  id: string;
  label: string;
  /** Regroupement pour l'interface (« move », « ability », « attack »…). */
  group?: string;
  target?: number;
  area?: AreaId;
  card?: CardId;
  deck?: DeckId;
  /** Choisir cette option révèle le personnage du joueur. */
  reveal?: boolean;
}

export type DecisionKind =
  | 'turn_start' | 'compass' | 'choose_area' | 'area_action'
  | 'hermit_give' | 'hermit_respond' | 'card_target' | 'reveal_heal'
  | 'attack' | 'bob_rob' | 'counter' | 'charles_again' | 'loot' | 'end_turn';

export interface Decision {
  id: number;
  player: number;
  kind: DecisionKind;
  prompt: string;
  /** Texte montré aux autres joueurs pendant l'attente. */
  publicLabel: string;
  options: Option[];
  /** Carte concernée, visible uniquement par le décideur. */
  card?: CardId;
  /** Données internes de reprise : jamais envoyées aux clients. */
  ctx: Record<string, unknown>;
}

export type Visibility = 'all' | number[];

export interface GameEvent {
  seq: number;
  type: string;
  text: string;
  visibleTo: Visibility;
  data: Record<string, unknown>;
  /** Version publique d'un événement privé. */
  redacted?: { type: string; text: string; data: Record<string, unknown> };
}

export type Step =
  | { t: 'startTurn'; p: number }
  | { t: 'turnStartPrompt'; p: number }
  | { t: 'areaAction'; p: number }
  | { t: 'attackPhase'; p: number }
  | { t: 'endTurnPrompt'; p: number }
  | { t: 'finishTurn'; p: number }
  | { t: 'draw'; p: number; deck: DeckId }
  | { t: 'resolveCard'; p: number; card: CardId }
  | { t: 'discard'; card: CardId }
  | { t: 'attack'; p: number; targets: number[]; mode: AttackMode }
  | { t: 'attackHit'; p: number; target: number; amount: number }
  | { t: 'afterAttack'; p: number; targets: number[]; mode: AttackMode }
  | { t: 'counterPrompt'; p: number; attacker: number }
  | { t: 'charlesPrompt'; p: number; targets: number[] }
  | { t: 'processDeaths' }
  | { t: 'loot'; killer: number; victim: number };

export type AttackMode = 'normal' | 'counter' | 'charles';

export interface GameState {
  version: 1;
  config: GameConfig;
  rng: number;
  players: PlayerState[];
  /** Anneau des 6 lieux ; paires (0,1) (2,3) (4,5). */
  areas: AreaId[];
  decks: Record<DeckId, Pile>;
  turn: TurnState;
  stack: Step[];
  pending: Decision | null;
  nextDecisionId: number;
  log: GameEvent[];
  eventSeq: number;
  /** Morts non encore traitées (révélation, butin…). */
  newDeaths: { victim: number; killer: number | null }[];
  deathBatches: number;
  /** Conditions de victoire atteintes « au moment où » (Charles, Bryan). */
  flags: { charlesWin: boolean; bryanWin: boolean };
  /** L'attaque en cours a-t-elle infligé des dégâts (Vampire) ? */
  combatDealt: boolean;
  finished: boolean;
  winners: number[];
  endReason: string;
  /** Résultats de dés imposés (tests uniquement). */
  forcedRolls?: number[];
}

export type Action =
  | { type: 'choose'; player: number; decisionId: number; optionId: string }
  | { type: 'reveal'; player: number }
  | { type: 'ability'; player: number; optionId: string };

export class EngineError extends Error {}

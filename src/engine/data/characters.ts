import type { CharacterId, Faction } from '../types';

export type AbilityTiming =
  | 'turn_start'   // début de votre tour
  | 'movement'     // lors du déplacement
  | 'attack'       // lors de vos attaques
  | 'attacked'     // quand vous êtes attaqué
  | 'turn_end'     // fin de votre tour
  | 'anytime'      // quand vous voulez
  | 'hermit'       // quand on vous donne une carte Ermite
  | 'forced';      // obligation (révélation forcée)

export interface CharacterDef {
  id: CharacterId;
  name: string;
  faction: Faction;
  hp: number;
  /** Initiale imprimée sur la carte (utile pour Chocolat, Brimade, Dure leçon). */
  letter: string;
  expansion: boolean;
  ability: {
    name: string;
    text: string;
    timing: AbilityTiming;
    oncePerGame: boolean;
    /** La plupart des capacités exigent d'être révélé. */
    requiresReveal: boolean;
  };
  /** Condition de victoire (uniquement les Neutres ont une condition propre). */
  win: string;
}

const HUNTER_WIN = 'Tous les personnages Shadow sont morts.';
const SHADOW_WIN = 'Tous les personnages Hunter sont morts, ou 3 personnages Neutres sont morts.';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  // ─── Hunters ───────────────────────────────────────────────
  emi: {
    id: 'emi', name: 'Emi', faction: 'hunter', hp: 10, letter: 'E', expansion: false,
    ability: {
      name: 'Téléportation',
      text: 'Pour votre déplacement, vous pouvez lancer les dés normalement, ou vous déplacer sur une carte Lieu adjacente.',
      timing: 'movement', oncePerGame: false, requiresReveal: true,
    },
    win: HUNTER_WIN,
  },
  franklin: {
    id: 'franklin', name: 'Franklin', faction: 'hunter', hp: 12, letter: 'F', expansion: false,
    ability: {
      name: 'Foudre',
      text: 'Une fois par partie, au début de votre tour, vous pouvez choisir un joueur et lui infliger autant de dégâts que le résultat du dé à 6 faces.',
      timing: 'turn_start', oncePerGame: true, requiresReveal: true,
    },
    win: HUNTER_WIN,
  },
  george: {
    id: 'george', name: 'George', faction: 'hunter', hp: 14, letter: 'G', expansion: false,
    ability: {
      name: 'Démolition',
      text: 'Une fois par partie, au début de votre tour, vous pouvez choisir un joueur et lui infliger autant de dégâts que le résultat du dé à 4 faces.',
      timing: 'turn_start', oncePerGame: true, requiresReveal: true,
    },
    win: HUNTER_WIN,
  },
  ellen: {
    id: 'ellen', name: 'Ellen', faction: 'hunter', hp: 10, letter: 'E', expansion: true,
    ability: {
      name: 'Chaîne de la malédiction interdite',
      text: 'Une fois par partie, au début de votre tour, vous pouvez choisir un joueur : sa capacité spéciale est annulée jusqu\'à la fin de la partie.',
      timing: 'turn_start', oncePerGame: true, requiresReveal: true,
    },
    win: HUNTER_WIN,
  },
  fuka: {
    id: 'fuka', name: 'Fu-ka', faction: 'hunter', hp: 12, letter: 'F', expansion: true,
    ability: {
      name: 'Infirmière de choc',
      text: 'Une fois par partie, au début de votre tour, vous pouvez placer le marqueur de dégâts de n\'importe quel joueur sur 7.',
      timing: 'turn_start', oncePerGame: true, requiresReveal: true,
    },
    win: HUNTER_WIN,
  },
  gregor: {
    id: 'gregor', name: 'Gregor', faction: 'hunter', hp: 14, letter: 'G', expansion: true,
    ability: {
      name: 'Barrière spectrale',
      text: 'Une fois par partie, à la fin de votre tour, vous pouvez empêcher tous les dégâts qui vous seraient infligés jusqu\'au début de votre prochain tour.',
      timing: 'turn_end', oncePerGame: true, requiresReveal: true,
    },
    win: HUNTER_WIN,
  },
  // ─── Shadows ───────────────────────────────────────────────
  unknown: {
    id: 'unknown', name: 'Inconnu', faction: 'shadow', hp: 11, letter: 'U', expansion: false,
    ability: {
      name: 'Tromperie',
      text: 'Quand on vous donne une carte Ermite, vous pouvez mentir. Vous n\'avez pas besoin de vous révéler pour utiliser cette capacité.',
      timing: 'hermit', oncePerGame: false, requiresReveal: false,
    },
    win: SHADOW_WIN,
  },
  vampire: {
    id: 'vampire', name: 'Vampire', faction: 'shadow', hp: 13, letter: 'V', expansion: false,
    ability: {
      name: 'Morsure',
      text: 'Si vous attaquez un joueur et lui infligez des dégâts, vous soignez 2 de vos dégâts.',
      timing: 'attack', oncePerGame: false, requiresReveal: true,
    },
    win: SHADOW_WIN,
  },
  werewolf: {
    id: 'werewolf', name: 'Loup-garou', faction: 'shadow', hp: 14, letter: 'W', expansion: false,
    ability: {
      name: 'Contre-attaque',
      text: 'Après avoir été attaqué, vous pouvez immédiatement attaquer ce joueur.',
      timing: 'attacked', oncePerGame: false, requiresReveal: true,
    },
    win: SHADOW_WIN,
  },
  ultra_soul: {
    id: 'ultra_soul', name: 'Ultra Soul', faction: 'shadow', hp: 11, letter: 'U', expansion: true,
    ability: {
      name: 'Rayon meurtrier',
      text: 'Au début de votre tour, vous pouvez infliger 3 dégâts à un joueur qui se trouve sur la Porte de l\'Outremonde.',
      timing: 'turn_start', oncePerGame: false, requiresReveal: true,
    },
    win: SHADOW_WIN,
  },
  valkyrie: {
    id: 'valkyrie', name: 'Valkyrie', faction: 'shadow', hp: 13, letter: 'V', expansion: true,
    ability: {
      name: 'Cor de guerre',
      text: 'Quand vous attaquez, vous ne lancez que le dé à 4 faces et infligez autant de dégâts que le résultat.',
      timing: 'attack', oncePerGame: false, requiresReveal: true,
    },
    win: SHADOW_WIN,
  },
  wight: {
    id: 'wight', name: 'Spectre', faction: 'shadow', hp: 14, letter: 'W', expansion: true,
    ability: {
      name: 'Multiplication',
      text: 'Une fois par partie, à la fin de votre tour, vous pouvez jouer autant de tours supplémentaires qu\'il y a de personnages morts.',
      timing: 'turn_end', oncePerGame: true, requiresReveal: true,
    },
    win: SHADOW_WIN,
  },
  // ─── Neutres ───────────────────────────────────────────────
  allie: {
    id: 'allie', name: 'Allie', faction: 'neutral', hp: 8, letter: 'A', expansion: false,
    ability: {
      name: 'Amour maternel',
      text: 'Une fois par partie, quand vous voulez, vous pouvez soigner tous vos dégâts.',
      timing: 'anytime', oncePerGame: true, requiresReveal: true,
    },
    win: 'Vous êtes encore en vie quand la partie se termine.',
  },
  agnes: {
    id: 'agnes', name: 'Agnès', faction: 'neutral', hp: 8, letter: 'A', expansion: true,
    ability: {
      name: 'Caprice',
      text: 'Une fois par partie, au début de votre tour, vous pouvez changer votre condition de victoire en « Le joueur à votre gauche gagne la partie ».',
      timing: 'turn_start', oncePerGame: true, requiresReveal: true,
    },
    win: 'Le joueur à votre droite gagne la partie.',
  },
  bob: {
    id: 'bob', name: 'Bob', faction: 'neutral', hp: 10, letter: 'B', expansion: false,
    ability: {
      name: 'Braquage',
      text: 'Si votre attaque inflige 2 dégâts ou plus, vous pouvez prendre une carte Équipement à ce joueur au lieu de lui infliger les dégâts.',
      timing: 'attack', oncePerGame: false, requiresReveal: true,
    },
    win: 'Vous possédez 5 cartes Équipement ou plus.',
  },
  bryan: {
    id: 'bryan', name: 'Bryan', faction: 'neutral', hp: 10, letter: 'B', expansion: true,
    ability: {
      name: 'Oh mon Dieu !',
      text: 'Si vous tuez un personnage de 12 PV ou moins, vous devez révéler votre identité.',
      timing: 'forced', oncePerGame: false, requiresReveal: false,
    },
    win: 'Vous tuez un personnage de 13 PV ou plus, ou vous êtes sur le Sanctuaire ancien quand la partie se termine.',
  },
  charles: {
    id: 'charles', name: 'Charles', faction: 'neutral', hp: 11, letter: 'C', expansion: false,
    ability: {
      name: 'Festin sanglant',
      text: 'Après votre attaque, vous pouvez vous infliger 2 dégâts pour attaquer à nouveau le même personnage.',
      timing: 'attack', oncePerGame: false, requiresReveal: true,
    },
    win: 'Au moment où vous tuez un personnage, il y a au total 3 personnages morts ou plus.',
  },
  catherine: {
    id: 'catherine', name: 'Catherine', faction: 'neutral', hp: 11, letter: 'C', expansion: true,
    ability: {
      name: 'Stigmates',
      text: 'Au début de votre tour, vous soignez 1 dégât.',
      timing: 'turn_start', oncePerGame: false, requiresReveal: true,
    },
    win: 'Vous êtes le premier personnage à mourir, ou vous êtes l\'un des deux derniers personnages en vie.',
  },
  daniel: {
    id: 'daniel', name: 'Daniel', faction: 'neutral', hp: 13, letter: 'D', expansion: false,
    ability: {
      name: 'Cri',
      text: 'Dès qu\'un autre personnage meurt, vous devez révéler votre identité.',
      timing: 'forced', oncePerGame: false, requiresReveal: false,
    },
    win: 'Vous êtes le premier personnage à mourir, ou tous les personnages Shadow sont morts et vous êtes en vie.',
  },
  david: {
    id: 'david', name: 'David', faction: 'neutral', hp: 13, letter: 'D', expansion: true,
    ability: {
      name: 'Pilleur de tombes',
      text: 'Une fois par partie, quand vous voulez, vous pouvez prendre la carte Équipement de votre choix dans les défausses.',
      timing: 'anytime', oncePerGame: true, requiresReveal: true,
    },
    win: 'Vous possédez au moins 3 de ces cartes : Talisman, Lance de Longinus, Robe sacrée, Rosaire d\'argent.',
  },
};

export const ALL_CHARACTERS = Object.values(CHARACTERS);

/** Répartition officielle des factions : [Hunters, Shadows, Neutres]. */
export const FACTION_COUNTS: Record<number, Record<Faction, number>> = {
  4: { hunter: 2, shadow: 2, neutral: 0 },
  5: { hunter: 2, shadow: 2, neutral: 1 },
  6: { hunter: 2, shadow: 2, neutral: 2 },
  7: { hunter: 2, shadow: 2, neutral: 3 },
  8: { hunter: 3, shadow: 3, neutral: 2 },
};

export const FACTION_NAMES: Record<Faction, string> = {
  hunter: 'Hunter',
  shadow: 'Shadow',
  neutral: 'Neutre',
};

export const FACTION_LETTERS: Record<Faction, string[]> = {
  hunter: ['E', 'F', 'G'],
  shadow: ['U', 'V', 'W'],
  neutral: ['A', 'B', 'C', 'D'],
};

export function charactersInPool(pool: 'base' | 'expansion' | 'mixed') {
  if (pool === 'base') return ALL_CHARACTERS.filter((c) => !c.expansion);
  if (pool === 'expansion') return ALL_CHARACTERS.filter((c) => c.expansion);
  return ALL_CHARACTERS;
}

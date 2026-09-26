import type { CardId, CardType, DeckId, Faction } from '../types';

export interface CardDef {
  type: CardType;
  deck: DeckId;
  name: string;
  kind: 'vision' | 'single' | 'equipment';
  copies: number;
  text: string;
}

/** Condition « Je parie que tu es… » d'une carte Ermite. */
export interface HermitCondition {
  factions?: Faction[];
  letters?: string[];
}

export type HermitEffect =
  | { kind: 'heal_or_damage' }          // soigne 1 (si aucun dégât : subit 1)
  | { kind: 'give_or_damage' }          // donne un équipement ou subit 1 dégât
  | { kind: 'damage'; amount: number }
  | { kind: 'show' };                   // montre sa carte au joueur actif

export const HERMIT_RULES: Partial<Record<CardType, { cond: HermitCondition; effect: HermitEffect }>> = {
  aid: { cond: { factions: ['hunter'] }, effect: { kind: 'heal_or_damage' } },
  huddle: { cond: { factions: ['shadow'] }, effect: { kind: 'heal_or_damage' } },
  nurturance: { cond: { factions: ['neutral'] }, effect: { kind: 'heal_or_damage' } },
  anger: { cond: { factions: ['hunter', 'shadow'] }, effect: { kind: 'give_or_damage' } },
  blackmail: { cond: { factions: ['neutral', 'hunter'] }, effect: { kind: 'give_or_damage' } },
  greed: { cond: { factions: ['neutral', 'shadow'] }, effect: { kind: 'give_or_damage' } },
  slap: { cond: { factions: ['hunter'] }, effect: { kind: 'damage', amount: 1 } },
  spell: { cond: { factions: ['shadow'] }, effect: { kind: 'damage', amount: 1 } },
  exorcism: { cond: { factions: ['shadow'] }, effect: { kind: 'damage', amount: 2 } },
  bully: { cond: { letters: ['A', 'B', 'C', 'E', 'U'] }, effect: { kind: 'damage', amount: 1 } },
  tough_lesson: { cond: { letters: ['D', 'F', 'G', 'V', 'W'] }, effect: { kind: 'damage', amount: 2 } },
  prediction: { cond: {}, effect: { kind: 'show' } },
};

export const CARDS: Record<CardType, CardDef> = {
  // ─── Ermite (16) ───────────────────────────────────────────
  aid: { type: 'aid', deck: 'hermit', kind: 'vision', copies: 1, name: 'Aide de l\'Ermite',
    text: 'Je parie que tu es Hunter. Si c\'est le cas, soigne 1 dégât (si tu n\'as aucun dégât, subis 1 dégât).' },
  anger: { type: 'anger', deck: 'hermit', kind: 'vision', copies: 2, name: 'Colère de l\'Ermite',
    text: 'Je parie que tu es Hunter ou Shadow. Si c\'est le cas, donne une carte Équipement au joueur actif ou subis 1 dégât.' },
  blackmail: { type: 'blackmail', deck: 'hermit', kind: 'vision', copies: 2, name: 'Chantage de l\'Ermite',
    text: 'Je parie que tu es Neutre ou Hunter. Si c\'est le cas, donne une carte Équipement au joueur actif ou subis 1 dégât.' },
  bully: { type: 'bully', deck: 'hermit', kind: 'vision', copies: 1, name: 'Brimade de l\'Ermite',
    text: 'Je parie que tu as 11 PV ou moins (A, B, C, E, U). Si c\'est le cas, subis 1 dégât.' },
  exorcism: { type: 'exorcism', deck: 'hermit', kind: 'vision', copies: 1, name: 'Exorcisme de l\'Ermite',
    text: 'Je parie que tu es Shadow. Si c\'est le cas, subis 2 dégâts.' },
  greed: { type: 'greed', deck: 'hermit', kind: 'vision', copies: 2, name: 'Cupidité de l\'Ermite',
    text: 'Je parie que tu es Neutre ou Shadow. Si c\'est le cas, donne une carte Équipement au joueur actif ou subis 1 dégât.' },
  huddle: { type: 'huddle', deck: 'hermit', kind: 'vision', copies: 1, name: 'Réconfort de l\'Ermite',
    text: 'Je parie que tu es Shadow. Si c\'est le cas, soigne 1 dégât (si tu n\'as aucun dégât, subis 1 dégât).' },
  nurturance: { type: 'nurturance', deck: 'hermit', kind: 'vision', copies: 1, name: 'Bienveillance de l\'Ermite',
    text: 'Je parie que tu es Neutre. Si c\'est le cas, soigne 1 dégât (si tu n\'as aucun dégât, subis 1 dégât).' },
  prediction: { type: 'prediction', deck: 'hermit', kind: 'vision', copies: 1, name: 'Prédiction de l\'Ermite',
    text: 'Montre secrètement ta carte Personnage au joueur actif.' },
  slap: { type: 'slap', deck: 'hermit', kind: 'vision', copies: 2, name: 'Gifle de l\'Ermite',
    text: 'Je parie que tu es Hunter. Si c\'est le cas, subis 1 dégât.' },
  spell: { type: 'spell', deck: 'hermit', kind: 'vision', copies: 1, name: 'Sortilège de l\'Ermite',
    text: 'Je parie que tu es Shadow. Si c\'est le cas, subis 1 dégât.' },
  tough_lesson: { type: 'tough_lesson', deck: 'hermit', kind: 'vision', copies: 1, name: 'Dure leçon de l\'Ermite',
    text: 'Je parie que tu as 12 PV ou plus (D, F, G, V, W). Si c\'est le cas, subis 2 dégâts.' },

  // ─── Blanches / Église (16) ───────────────────────────────
  advent: { type: 'advent', deck: 'white', kind: 'single', copies: 1, name: 'Avènement',
    text: 'Si vous êtes Hunter, vous pouvez révéler votre identité. Si vous le faites, ou si vous êtes déjà révélé, soignez tous vos dégâts.' },
  blessing: { type: 'blessing', deck: 'white', kind: 'single', copies: 1, name: 'Bénédiction',
    text: 'Choisissez un autre joueur et lancez le dé à 6 faces : il soigne autant de dégâts que le résultat.' },
  chocolate: { type: 'chocolate', deck: 'white', kind: 'single', copies: 1, name: 'Chocolat',
    text: 'Si vous êtes Allie, Agnès, Emi, Ellen, l\'Inconnu ou Ultra Soul (A, E, U), vous pouvez révéler votre identité. Si vous le faites, ou si vous êtes déjà révélé, soignez tous vos dégâts.' },
  concealed_knowledge: { type: 'concealed_knowledge', deck: 'white', kind: 'single', copies: 1, name: 'Savoir caché',
    text: 'Quand ce tour se termine, vous jouez un nouveau tour.' },
  disenchant_mirror: { type: 'disenchant_mirror', deck: 'white', kind: 'single', copies: 1, name: 'Miroir de désenchantement',
    text: 'Si vous êtes un Shadow autre que l\'Inconnu, vous devez révéler votre identité.' },
  first_aid: { type: 'first_aid', deck: 'white', kind: 'single', copies: 1, name: 'Premiers secours',
    text: 'Placez le marqueur de dégâts d\'un joueur (vous compris) sur 7.' },
  flare_of_judgement: { type: 'flare_of_judgement', deck: 'white', kind: 'single', copies: 1, name: 'Éclair du jugement',
    text: 'Tous les personnages, sauf vous, subissent 2 dégâts.' },
  guardian_angel: { type: 'guardian_angel', deck: 'white', kind: 'single', copies: 1, name: 'Ange gardien',
    text: 'Vous ne subissez aucun dégât causé par les attaques jusqu\'au début de votre prochain tour.' },
  holy_water: { type: 'holy_water', deck: 'white', kind: 'single', copies: 2, name: 'Eau bénite',
    text: 'Soignez 2 dégâts.' },
  fortune_brooch: { type: 'fortune_brooch', deck: 'white', kind: 'equipment', copies: 1, name: 'Broche de fortune',
    text: 'Vous ne subissez aucun dégât de la Forêt hantée (vous pouvez toujours y être soigné).' },
  mystic_compass: { type: 'mystic_compass', deck: 'white', kind: 'equipment', copies: 1, name: 'Boussole mystique',
    text: 'Pour vous déplacer, vous pouvez lancer les dés deux fois et choisir le résultat.' },
  holy_robe: { type: 'holy_robe', deck: 'white', kind: 'equipment', copies: 1, name: 'Robe sacrée',
    text: 'Vos attaques infligent 1 dégât de moins et les dégâts que vous subissez des attaques sont réduits de 1.' },
  silver_rosary: { type: 'silver_rosary', deck: 'white', kind: 'equipment', copies: 1, name: 'Rosaire d\'argent',
    text: 'Si vous tuez un personnage, vous prenez toutes ses cartes Équipement.' },
  spear_of_longinus: { type: 'spear_of_longinus', deck: 'white', kind: 'equipment', copies: 1, name: 'Lance de Longinus',
    text: 'Si vous êtes un Hunter révélé, chaque attaque réussie inflige 2 dégâts supplémentaires.' },
  talisman: { type: 'talisman', deck: 'white', kind: 'equipment', copies: 1, name: 'Talisman',
    text: 'Vous ne subissez aucun dégât des cartes Ténèbres Araignée sanguinaire, Chauve-souris vampire et Dynamite.' },

  // ─── Noires / Cimetière (16) ──────────────────────────────
  banana_peel: { type: 'banana_peel', deck: 'black', kind: 'single', copies: 1, name: 'Peau de banane',
    text: 'Donnez une de vos cartes Équipement à un autre joueur. Si vous n\'en avez pas, subissez 1 dégât.' },
  bloodthirsty_spider: { type: 'bloodthirsty_spider', deck: 'black', kind: 'single', copies: 1, name: 'Araignée sanguinaire',
    text: 'Infligez 2 dégâts au personnage de votre choix, puis subissez 2 dégâts.' },
  diabolic_ritual: { type: 'diabolic_ritual', deck: 'black', kind: 'single', copies: 1, name: 'Rituel diabolique',
    text: 'Si vous êtes Shadow, vous pouvez révéler votre identité. Si vous le faites, soignez tous vos dégâts.' },
  dynamite: { type: 'dynamite', deck: 'black', kind: 'single', copies: 1, name: 'Dynamite',
    text: 'Lancez les deux dés : tous les personnages du Lieu correspondant subissent 3 dégâts. Sur un 7, rien ne se passe.' },
  moody_goblin: { type: 'moody_goblin', deck: 'black', kind: 'single', copies: 2, name: 'Gobelin lunatique',
    text: 'Prenez une carte Équipement au joueur de votre choix.' },
  spiritual_doll: { type: 'spiritual_doll', deck: 'black', kind: 'single', copies: 1, name: 'Poupée spirituelle',
    text: 'Choisissez un personnage et lancez le dé à 6 faces. Sur 1 à 4, il subit 3 dégâts. Sur 5 ou 6, c\'est vous qui subissez 3 dégâts.' },
  vampire_bat: { type: 'vampire_bat', deck: 'black', kind: 'single', copies: 3, name: 'Chauve-souris vampire',
    text: 'Infligez 2 dégâts au personnage de votre choix et soignez 1 de vos dégâts.' },
  butcher_knife: { type: 'butcher_knife', deck: 'black', kind: 'equipment', copies: 1, name: 'Couteau de boucher',
    text: 'Si votre attaque réussit, elle inflige 1 dégât supplémentaire.' },
  chainsaw: { type: 'chainsaw', deck: 'black', kind: 'equipment', copies: 1, name: 'Tronçonneuse',
    text: 'Si votre attaque réussit, elle inflige 1 dégât supplémentaire.' },
  rusted_broad_axe: { type: 'rusted_broad_axe', deck: 'black', kind: 'equipment', copies: 1, name: 'Hache rouillée',
    text: 'Si votre attaque réussit, elle inflige 1 dégât supplémentaire.' },
  masamune: { type: 'masamune', deck: 'black', kind: 'equipment', copies: 1, name: 'Sabre maudit Masamune',
    text: 'Vous devez attaquer si vous le pouvez. Vous ne lancez que le dé à 4 faces : le résultat donne les dégâts (l\'attaque ne peut pas rater).' },
  handgun: { type: 'handgun', deck: 'black', kind: 'equipment', copies: 1, name: 'Pistolet',
    text: 'Votre portée d\'attaque s\'inverse : vous pouvez attaquer dans tous les Lieux sauf ceux de votre propre zone.' },
  machine_gun: { type: 'machine_gun', deck: 'black', kind: 'equipment', copies: 1, name: 'Mitrailleuse',
    text: 'Votre attaque touche tous les personnages à portée (un seul jet de dés).' },
};

export const WEAPONS: CardType[] = ['butcher_knife', 'chainsaw', 'rusted_broad_axe'];
export const DAVID_CARDS: CardType[] = ['talisman', 'spear_of_longinus', 'holy_robe', 'silver_rosary'];

/** Tous les exemplaires physiques d'un paquet. */
export function deckCards(deck: DeckId): CardId[] {
  const ids: CardId[] = [];
  for (const def of Object.values(CARDS)) {
    if (def.deck !== deck) continue;
    for (let i = 1; i <= def.copies; i++) ids.push(`${def.type}#${i}`);
  }
  return ids;
}

export function cardType(id: CardId): CardType {
  return id.split('#')[0] as CardType;
}

export function cardDef(id: CardId): CardDef {
  return CARDS[cardType(id)];
}

export function cardName(id: CardId): string {
  return cardDef(id).name;
}

export const DECK_NAMES: Record<DeckId, string> = {
  hermit: 'Ermite',
  white: 'Lumière',
  black: 'Ténèbres',
};

import type { AreaId, DeckId } from '../types';

export interface AreaDef {
  id: AreaId;
  name: string;
  numbers: number[];
  text: string;
  deck?: DeckId;
}

export const AREAS: Record<AreaId, AreaDef> = {
  hermit: { id: 'hermit', name: 'Cabane de l\'Ermite', numbers: [2, 3], deck: 'hermit',
    text: 'Vous pouvez piocher une carte Ermite.' },
  underworld: { id: 'underworld', name: 'Porte de l\'Outremonde', numbers: [4, 5],
    text: 'Vous pouvez piocher une carte dans le paquet de votre choix.' },
  church: { id: 'church', name: 'Église', numbers: [6], deck: 'white',
    text: 'Vous pouvez piocher une carte Lumière.' },
  cemetery: { id: 'cemetery', name: 'Cimetière', numbers: [8], deck: 'black',
    text: 'Vous pouvez piocher une carte Ténèbres.' },
  woods: { id: 'woods', name: 'Forêt hantée', numbers: [9],
    text: 'Vous pouvez choisir un joueur : il subit 2 dégâts ou soigne 1 dégât.' },
  altar: { id: 'altar', name: 'Sanctuaire ancien', numbers: [10],
    text: 'Vous pouvez prendre une carte Équipement à un autre joueur.' },
};

export const AREA_IDS: AreaId[] = ['hermit', 'underworld', 'church', 'cemetery', 'woods', 'altar'];

/** Lieu correspondant à la somme des dés (7 = au choix, renvoie null). */
export function areaForRoll(sum: number): AreaId | null {
  for (const a of AREA_IDS) if (AREAS[a].numbers.includes(sum)) return a;
  return null;
}

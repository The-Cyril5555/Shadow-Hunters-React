import { cardDef, type CardId, type CardType } from '../../engine';

const SYMBOLS: Partial<Record<CardType, string>> = {
  aid: '✚', huddle: '✚', nurturance: '✚', anger: '✋', blackmail: '✋', greed: '✋',
  slap: '✊', spell: '✺', exorcism: '✠', bully: '✊', tough_lesson: '✊', prediction: '◉',
  advent: '✝', blessing: '✧', chocolate: '♥', concealed_knowledge: '⌛', disenchant_mirror: '◈',
  first_aid: '✚', flare_of_judgement: '☼', guardian_angel: '♱', holy_water: '⚱',
  fortune_brooch: '❂', mystic_compass: '✵', holy_robe: '♜', silver_rosary: '✤', spear_of_longinus: '↟', talisman: '⊛',
  banana_peel: '☾', bloodthirsty_spider: '✳', diabolic_ritual: '⛧', dynamite: '✹', moody_goblin: '☋',
  spiritual_doll: '♙', vampire_bat: '⋎', butcher_knife: '⚔', chainsaw: '⚙', rusted_broad_axe: '⚒',
  masamune: '⚔', handgun: '➶', machine_gun: '☷',
};

const KIND_LABEL = { vision: 'Vision · Ermite', single: 'Usage unique', equipment: 'Équipement' };

export function cardSymbol(type: CardType): string {
  return `${SYMBOLS[type] ?? '✦'}︎`;
}

export function CardFace({ card, width = 200 }: { card: CardId; width?: number }) {
  const def = cardDef(card);
  return (
    <div className={`card-face ${def.deck}`} style={{ ['--cw' as string]: `${width}px` }} role="img" aria-label={`${def.name} : ${def.text}`}>
      <div className="cf-name">{def.name}</div>
      <div className="cf-kind">{KIND_LABEL[def.kind]}</div>
      <div className="cf-symbol" aria-hidden>{cardSymbol(def.type)}</div>
      <div className="cf-text">{def.text}</div>
    </div>
  );
}

export function CardBack({ deck, empty }: { deck: 'hermit' | 'white' | 'black'; empty?: boolean }) {
  const symbol = deck === 'hermit' ? '☽' : deck === 'white' ? '✚' : '☠';
  return <div className={`card-back ${empty ? 'empty' : deck}`}>{empty ? '' : `${symbol}︎`}</div>;
}

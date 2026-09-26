// Résolution des étapes du tour et des décisions des joueurs.
import { AREA_IDS, AREAS, areaForRoll } from './data/areas';
import { CHARACTERS } from './data/characters';
import { CARDS, HERMIT_RULES, cardDef, cardName, cardType, DECK_NAMES, type HermitCondition } from './data/cards';
import {
  P, abilityActive, abilityReady, adjacentAreas, alivePlayers, ask, attackBonus, charOf, dealDamage, deadCount,
  discard, drawFromDeck, emit, factionOf, hasEquip, heal, healFull, hpOf, moveTo, name, nextAliveAfter,
  othersAlive, plural, pushSteps, reveal, setDamage, takeEquipment, targetsInRange,
} from './helpers';
import { rollDie } from './rng';
import type {
  AreaId, AttackMode, CardId, CharacterId, Decision, DeckId, GameState, Option, Step,
} from './types';

/** Décisions « couverture » : proposées aussi aux joueurs qui n'ont qu'une option,
 *  pour ne pas trahir leur identité par un temps de réflexion. */
export const COVER_KINDS = ['counter', 'bob_rob', 'charles_again', 'end_turn'] as const;

const REVEAL_SUFFIX = ' (se révéler)';

function abilityEvent(s: GameState, p: number, text?: string): void {
  const pl = P(s, p);
  const c = charOf(pl);
  emit(s, 'ability', text ?? `${pl.name} utilise ${c.ability.name} (${c.name}).`, { player: p, character: pl.character });
}

// ═══ Étapes ══════════════════════════════════════════════════

export function runStep(s: GameState, step: Step): void {
  switch (step.t) {
    case 'startTurn': return stepStartTurn(s, step.p);
    case 'turnStartPrompt': return stepTurnStartPrompt(s, step.p);
    case 'areaAction': return stepAreaAction(s, step.p);
    case 'attackPhase': return stepAttackPhase(s, step.p);
    case 'endTurnPrompt': return stepEndTurnPrompt(s, step.p);
    case 'finishTurn': return stepFinishTurn(s, step.p);
    case 'draw': return stepDraw(s, step.p, step.deck);
    case 'resolveCard': return stepResolveCard(s, step.p, step.card);
    case 'discard': return discard(s, step.card);
    case 'attack': return stepAttack(s, step.p, step.targets, step.mode);
    case 'attackHit': return stepAttackHit(s, step.p, step.target, step.amount);
    case 'afterAttack': return stepAfterAttack(s, step.p, step.targets, step.mode);
    case 'counterPrompt': return stepCounterPrompt(s, step.p, step.attacker);
    case 'charlesPrompt': return stepCharlesPrompt(s, step.p, step.targets);
    case 'processDeaths': return processDeaths(s);
    case 'loot': return stepLoot(s, step.killer, step.victim);
  }
}

// ─── Début et fin de tour ────────────────────────────────────

function stepStartTurn(s: GameState, p: number): void {
  const pl = P(s, p);
  if (!pl.alive) {
    pushSteps(s, { t: 'startTurn', p: nextAliveAfter(s, p) });
    return;
  }
  s.turn.number++;
  s.turn.active = p;
  s.turn.phase = 'start';
  s.turn.ultraSoulUsed = false;
  emit(s, 'turn_start', `Tour ${s.turn.number} : c'est à ${pl.name} de jouer.`, { player: p, number: s.turn.number });
  if (pl.guardianAngel) {
    pl.guardianAngel = false;
    emit(s, 'expire', `L'Ange gardien de ${pl.name} s'en va.`, { player: p, effect: 'guardian_angel' });
  }
  if (pl.barrier) {
    pl.barrier = false;
    emit(s, 'expire', `La Barrière spectrale de ${pl.name} se dissipe.`, { player: p, effect: 'barrier' });
  }
  if (abilityActive(pl, 'catherine') && pl.damage > 0) {
    abilityEvent(s, p);
    heal(s, p, 1, 'Stigmates');
  }
  pushSteps(s,
    { t: 'turnStartPrompt', p },
    { t: 'areaAction', p },
    { t: 'attackPhase', p },
    { t: 'endTurnPrompt', p },
    { t: 'finishTurn', p },
  );
}

function turnStartOptions(s: GameState, p: number): Option[] {
  const pl = P(s, p);
  const rev = !pl.revealed;
  const sfx = rev ? REVEAL_SUFFIX : '';
  const opts: Option[] = [{
    id: 'roll',
    label: hasEquip(pl, 'mystic_compass') ? 'Lancer les dés (Boussole : deux jets)' : 'Lancer les dés',
    group: 'move',
  }];
  if (abilityReady(pl, 'emi') && pl.area) {
    for (const a of adjacentAreas(s, pl.area)) {
      opts.push({ id: `teleport:${a}`, label: `Téléportation vers ${AREAS[a].name}${sfx}`, group: 'ability', area: a, reveal: rev });
    }
  }
  const targetAbility = (ch: CharacterId, verb: string, targets: { id: number; name: string }[]) => {
    if (!abilityReady(pl, ch)) return;
    for (const o of targets) {
      opts.push({ id: `${ch}:${o.id}`, label: `${verb} ${o.name}${sfx}`, group: 'ability', target: o.id, reveal: rev });
    }
  };
  const others = othersAlive(s, p);
  targetAbility('franklin', 'Foudre sur', others);
  targetAbility('george', 'Démolition sur', others);
  targetAbility('ellen', 'Malédiction sur', others.filter((o) => !o.abilityVoided));
  targetAbility('fuka', 'Dégâts à 7 pour', alivePlayers(s));
  if (!s.turn.ultraSoulUsed) targetAbility('ultra_soul', 'Rayon meurtrier sur', others.filter((o) => o.area === 'underworld'));
  if (abilityReady(pl, 'agnes') && !pl.agnesLeft) {
    opts.push({ id: 'agnes', label: `Caprice : soutenir le joueur de gauche${sfx}`, group: 'ability', reveal: rev });
  }
  return opts;
}

function stepTurnStartPrompt(s: GameState, p: number): void {
  const pl = P(s, p);
  if (!pl.alive) return;
  ask(s, p, 'turn_start', 'À vous de jouer : lancez les dés pour vous déplacer.', 'commence son tour', turnStartOptions(s, p));
}

function stepEndTurnPrompt(s: GameState, p: number): void {
  const pl = P(s, p);
  if (!pl.alive) return;
  s.turn.phase = 'end';
  const rev = !pl.revealed;
  const sfx = rev ? REVEAL_SUFFIX : '';
  const opts: Option[] = [];
  if (abilityReady(pl, 'gregor')) {
    opts.push({ id: 'gregor', label: `Barrière spectrale${sfx}`, group: 'ability', reveal: rev });
  }
  const dead = deadCount(s);
  if (abilityReady(pl, 'wight') && dead > 0) {
    opts.push({ id: 'wight', label: `Multiplication : ${plural(dead, 'tour')} en plus${sfx}`, group: 'ability', reveal: rev });
  }
  if (opts.length === 0 && pl.revealed) return;
  opts.push({ id: 'end', label: 'Terminer le tour', group: 'end' });
  ask(s, p, 'end_turn', 'Fin de votre tour.', 'termine son tour', opts);
}

function stepFinishTurn(s: GameState, p: number): void {
  const pl = P(s, p);
  if (pl.alive && s.turn.extraTurns > 0) {
    s.turn.extraTurns--;
    emit(s, 'extra_turn', `${pl.name} joue un tour supplémentaire.`, { player: p });
    pushSteps(s, { t: 'startTurn', p });
    return;
  }
  s.turn.extraTurns = 0;
  pushSteps(s, { t: 'startTurn', p: nextAliveAfter(s, p) });
}

// ─── Déplacement ─────────────────────────────────────────────

function rollMovement(s: GameState, p: number): { sum: number; area: AreaId | null } {
  const pl = P(s, p);
  for (let i = 0; i < 100; i++) {
    const d6 = rollDie(s, 6);
    const d4 = rollDie(s, 4);
    const sum = d6 + d4;
    const area = areaForRoll(sum);
    emit(s, 'dice', `${pl.name} lance les dés : ${d6} + ${d4} = ${sum}.`, { player: p, d6, d4, sum, purpose: 'move' });
    if (area !== null && area === pl.area) {
      emit(s, 'reroll', `${pl.name} est déjà à ${AREAS[area].name} : il relance.`, { player: p });
      continue;
    }
    return { sum, area };
  }
  return { sum: 7, area: null };
}

function askChooseArea(s: GameState, p: number): void {
  const cur = P(s, p).area;
  ask(s, p, 'choose_area', '7 ! Choisissez le lieu où vous rendre.', 'choisit sa destination',
    AREA_IDS.filter((a) => a !== cur).map((a) => ({ id: `area:${a}`, label: AREAS[a].name, area: a, group: 'move' })));
}

function doRoll(s: GameState, p: number): void {
  s.turn.phase = 'move';
  const pl = P(s, p);
  if (hasEquip(pl, 'mystic_compass')) {
    const a = rollMovement(s, p);
    const b = rollMovement(s, p);
    if (a.area === b.area) {
      if (a.area) moveTo(s, p, a.area, ''); else askChooseArea(s, p);
      return;
    }
    ask(s, p, 'compass', 'Boussole mystique : choisissez le résultat à garder.', 'choisit sa destination',
      [a, b].map((r, i) => ({
        id: `pick:${i}:${r.area ?? '7'}`,
        label: r.area ? `${r.sum} → ${AREAS[r.area].name}` : '7 → lieu au choix',
        group: 'move',
        ...(r.area ? { area: r.area } : {}),
      })));
    return;
  }
  const r = rollMovement(s, p);
  if (r.area) moveTo(s, p, r.area, ''); else askChooseArea(s, p);
}

function resolveTurnStart(s: GameState, p: number, opt: Option): void {
  const [kind, arg] = opt.id.split(':');
  if (kind === 'roll') return doRoll(s, p);
  const pl = P(s, p);
  if (opt.reveal) reveal(s, p);
  if (kind === 'teleport') {
    s.turn.phase = 'move';
    abilityEvent(s, p);
    moveTo(s, p, arg as AreaId, 'Téléportation');
    return;
  }
  const t = Number(arg);
  abilityEvent(s, p);
  switch (kind) {
    case 'franklin': {
      pl.abilityUsed = true;
      const r = rollDie(s, 6);
      emit(s, 'dice', `Foudre : le dé à 6 faces donne ${r}.`, { player: p, d6: r, purpose: 'ability' });
      dealDamage(s, t, r, p, 'ability', 'Foudre');
      break;
    }
    case 'george': {
      pl.abilityUsed = true;
      const r = rollDie(s, 4);
      emit(s, 'dice', `Démolition : le dé à 4 faces donne ${r}.`, { player: p, d4: r, purpose: 'ability' });
      dealDamage(s, t, r, p, 'ability', 'Démolition');
      break;
    }
    case 'ellen':
      pl.abilityUsed = true;
      P(s, t).abilityVoided = true;
      emit(s, 'voided', `La capacité de ${name(s, t)} est annulée jusqu'à la fin de la partie.`, { player: t });
      break;
    case 'fuka':
      pl.abilityUsed = true;
      setDamage(s, t, 7, 'Infirmière de choc');
      break;
    case 'ultra_soul':
      s.turn.ultraSoulUsed = true;
      dealDamage(s, t, 3, p, 'ability', 'Rayon meurtrier');
      break;
    case 'agnes':
      pl.abilityUsed = true;
      pl.agnesLeft = true;
      emit(s, 'agnes', `${pl.name} change de condition de victoire : c'est désormais le joueur de gauche qui compte.`, { player: p });
      break;
  }
  pushSteps(s, { t: 'turnStartPrompt', p });
}

// ─── Action du lieu ──────────────────────────────────────────

function canDraw(s: GameState, d: DeckId): boolean {
  return s.decks[d].draw.length + s.decks[d].discard.length > 0;
}

function stepAreaAction(s: GameState, p: number): void {
  const pl = P(s, p);
  if (!pl.alive || !pl.area) return;
  s.turn.phase = 'area';
  const def = AREAS[pl.area];
  const opts: Option[] = [];
  switch (pl.area) {
    case 'hermit':
    case 'church':
    case 'cemetery': {
      const d = def.deck as DeckId;
      if (canDraw(s, d)) opts.push({ id: `draw:${d}`, label: `Piocher une carte ${DECK_NAMES[d]}`, deck: d, group: 'draw' });
      break;
    }
    case 'underworld':
      for (const d of ['hermit', 'white', 'black'] as DeckId[]) {
        if (canDraw(s, d)) opts.push({ id: `draw:${d}`, label: `Piocher une carte ${DECK_NAMES[d]}`, deck: d, group: 'draw' });
      }
      break;
    case 'woods':
      for (const o of alivePlayers(s)) {
        opts.push({ id: `woods_dmg:${o.id}`, label: `Infliger 2 dégâts à ${o.id === p ? 'vous-même' : o.name}`, target: o.id, group: 'woods_dmg' });
        opts.push({ id: `woods_heal:${o.id}`, label: `Soigner 1 dégât à ${o.id === p ? 'vous-même' : o.name}`, target: o.id, group: 'woods_heal' });
      }
      break;
    case 'altar':
      for (const o of othersAlive(s, p)) {
        for (const e of o.equipment) {
          opts.push({ id: `steal:${o.id}:${e}`, label: `Prendre ${cardName(e)} à ${o.name}`, target: o.id, card: e, group: 'steal' });
        }
      }
      break;
  }
  if (opts.length === 0) {
    emit(s, 'area_none', `${pl.name} ne peut rien faire à ${def.name}.`, { player: p, area: pl.area });
    return;
  }
  opts.push({ id: 'skip', label: 'Ne rien faire', group: 'skip' });
  ask(s, p, 'area_action', `${def.name} : ${def.text}`, `agit à ${def.name}`, opts);
}

function resolveAreaAction(s: GameState, p: number, opt: Option): void {
  const [kind, a, b] = opt.id.split(':');
  switch (kind) {
    case 'draw':
      pushSteps(s, { t: 'draw', p, deck: a as DeckId });
      break;
    case 'woods_dmg': {
      const t = Number(a);
      emit(s, 'woods', `${name(s, p)} vise ${name(s, t)} depuis la Forêt hantée (2 dégâts).`, { player: p, target: t, effect: 'damage' });
      if (hasEquip(P(s, t), 'fortune_brooch')) {
        emit(s, 'protected', `${name(s, t)} est protégé par la Broche de fortune.`, { player: t });
      } else {
        dealDamage(s, t, 2, p, 'area', 'Forêt hantée');
      }
      break;
    }
    case 'woods_heal': {
      const t = Number(a);
      emit(s, 'woods', `${name(s, p)} choisit de soigner ${name(s, t)} grâce à la Forêt hantée.`, { player: p, target: t, effect: 'heal' });
      heal(s, t, 1, 'Forêt hantée');
      break;
    }
    case 'steal':
      takeEquipment(s, Number(a), p, b, 'Sanctuaire ancien');
      break;
    default:
      emit(s, 'skip', `${name(s, p)} ne fait rien.`, { player: p });
  }
}

// ─── Pioche ──────────────────────────────────────────────────

function stepDraw(s: GameState, p: number, deck: DeckId): void {
  const pl = P(s, p);
  if (!pl.alive) return;
  const card = drawFromDeck(s, deck);
  if (!card) {
    emit(s, 'empty', `Le paquet ${DECK_NAMES[deck]} est vide.`, { deck });
    return;
  }
  if (deck === 'hermit') {
    emit(s, 'draw', `Vous piochez ${cardName(card)}.`, { player: p, deck, card }, [p],
      { type: 'draw', text: `${pl.name} pioche une carte Ermite.`, data: { player: p, deck } });
    const targets = othersAlive(s, p);
    if (targets.length === 0) {
      discard(s, card);
      return;
    }
    ask(s, p, 'hermit_give', `${cardName(card)} — « ${CARDS[cardType(card)].text} » À qui donnez-vous cette carte ?`,
      'choisit à qui donner la carte Ermite',
      targets.map((o) => ({ id: `give:${o.id}`, label: o.name, target: o.id, group: 'target' })), { card }, card);
    return;
  }
  emit(s, 'draw', `${pl.name} pioche ${cardName(card)}.`, { player: p, deck, card });
  if (cardDef(card).kind === 'equipment') {
    pl.equipment.push(card);
    emit(s, 'equip', `${pl.name} s'équipe de ${cardName(card)}.`, { player: p, card });
    return;
  }
  pushSteps(s, { t: 'resolveCard', p, card }, { t: 'discard', card });
}

// ─── Cartes Ermite ───────────────────────────────────────────

export function hermitConditionHolds(character: CharacterId, cond: HermitCondition): boolean {
  const c = CHARACTERS[character];
  if (cond.factions) return cond.factions.includes(c.faction);
  if (cond.letters) return cond.letters.includes(c.letter);
  return true;
}

function askHermitRespond(s: GameState, t: number, giver: number, card: CardId): void {
  const tp = P(s, t);
  const rule = HERMIT_RULES[cardType(card)];
  if (!rule) throw new Error(`Carte Ermite inconnue ${card}`);
  const truth = hermitConditionHolds(tp.character, rule.cond);
  const canLie = tp.character === 'unknown' && !tp.abilityVoided;
  const giverName = name(s, giver);
  let applyOpts: Option[];
  switch (rule.effect.kind) {
    case 'show':
      applyOpts = [{ id: 'show', label: `Montrer votre carte à ${giverName}` }];
      break;
    case 'heal_or_damage':
      applyOpts = [tp.damage > 0
        ? { id: 'heal', label: 'Soigner 1 dégât' }
        : { id: 'hurt:1', label: 'Subir 1 dégât (vous n\'avez aucun dégât à soigner)' }];
      break;
    case 'give_or_damage':
      applyOpts = [
        ...tp.equipment.map((e) => ({ id: `give:${e}`, label: `Donner ${cardName(e)} à ${giverName}`, card: e })),
        { id: 'hurt:1', label: 'Subir 1 dégât' },
      ];
      break;
    case 'damage':
      applyOpts = [{ id: `hurt:${rule.effect.amount}`, label: `Subir ${plural(rule.effect.amount, 'dégât')}` }];
      break;
  }
  const nothing: Option = { id: 'nothing', label: 'Rien ne se passe' };
  let options: Option[];
  if (rule.effect.kind === 'show') options = applyOpts;
  else if (!canLie) options = truth ? applyOpts : [nothing];
  else if (truth) options = [...applyOpts, { ...nothing, label: 'Rien ne se passe (mensonge)' }];
  else options = [nothing, ...applyOpts.map((o) => ({ ...o, label: `${o.label} (mensonge)` }))];
  ask(s, t, 'hermit_respond', `${giverName} vous donne ${cardName(card)} : « ${CARDS[cardType(card)].text} »`,
    'lit la carte Ermite', options, { card, giver }, card);
}

function resolveHermitRespond(s: GameState, d: Decision, opt: Option): void {
  const card = d.ctx.card as CardId;
  const giver = d.ctx.giver as number;
  const t = d.player;
  const tName = name(s, t);
  const [kind, arg] = opt.id.split(':');
  const outcomeText: Record<string, string> = {
    show: 'montre sa carte',
    heal: 'soigne 1 dégât',
    hurt: `subit ${plural(Number(arg), 'dégât')}`,
    give: 'donne un équipement',
    nothing: 'rien ne se passe',
  };
  emit(s, 'hermit_result', `${cardName(card)} donnée à ${tName} : ${outcomeText[kind]}.`,
    { from: giver, to: t, card, outcome: kind }, [giver, t],
    { type: 'hermit_result', text: `${tName} lit la carte Ermite : ${outcomeText[kind]}.`, data: { from: giver, to: t, outcome: kind } });
  switch (kind) {
    case 'show': {
      const tp = P(s, t);
      if (!tp.knownBy.includes(giver)) tp.knownBy.push(giver);
      const c = CHARACTERS[tp.character];
      emit(s, 'show', `${tName} vous montre sa carte : ${c.name} (${c.faction === 'hunter' ? 'Hunter' : c.faction === 'shadow' ? 'Shadow' : 'Neutre'}).`,
        { from: t, to: giver, character: tp.character }, [giver, t],
        { type: 'show', text: `${tName} montre secrètement sa carte Personnage à ${name(s, giver)}.`, data: { from: t, to: giver } });
      break;
    }
    case 'heal':
      heal(s, t, 1, 'carte Ermite');
      break;
    case 'hurt':
      dealDamage(s, t, Number(arg), giver, 'hermit', 'carte Ermite');
      break;
    case 'give':
      takeEquipment(s, t, giver, opt.id.slice('give:'.length), 'carte Ermite');
      break;
    default:
      emit(s, 'nothing', `Rien ne se passe pour ${tName}.`, { player: t });
  }
  discard(s, card);
}

// ─── Cartes Lumière et Ténèbres à usage unique ───────────────

function askTarget(s: GameState, p: number, card: CardId, options: Option[]): void {
  ask(s, p, 'card_target', `${cardName(card)} : ${CARDS[cardType(card)].text}`, 'choisit une cible', options, { card }, card);
}

function targetOptions(players: { id: number; name: string }[], self: number): Option[] {
  return players.map((o) => ({ id: `target:${o.id}`, label: o.id === self ? 'Vous-même' : o.name, target: o.id, group: 'target' }));
}

function stepResolveCard(s: GameState, p: number, card: CardId): void {
  const pl = P(s, p);
  if (!pl.alive) return;
  const type = cardType(card);
  const cname = cardName(card);
  switch (type) {
    case 'holy_water':
      heal(s, p, 2, cname);
      break;
    case 'flare_of_judgement':
      for (const o of othersAlive(s, p)) dealDamage(s, o.id, 2, p, 'card', cname);
      break;
    case 'first_aid':
      askTarget(s, p, card, targetOptions(alivePlayers(s), p));
      break;
    case 'concealed_knowledge':
      s.turn.extraTurns++;
      emit(s, 'extra_turn_gain', `${pl.name} jouera un nouveau tour après celui-ci.`, { player: p });
      break;
    case 'guardian_angel':
      pl.guardianAngel = true;
      emit(s, 'guardian_angel', `${pl.name} est protégé des attaques jusqu'à son prochain tour.`, { player: p });
      break;
    case 'disenchant_mirror':
      if (factionOf(pl) === 'shadow' && pl.character !== 'unknown' && !pl.revealed) {
        reveal(s, p, cname);
      } else {
        emit(s, 'no_effect', `Le miroir ne révèle rien.`, { player: p });
      }
      break;
    case 'blessing':
    case 'bloodthirsty_spider':
    case 'spiritual_doll':
    case 'vampire_bat': {
      const targets = othersAlive(s, p);
      if (targets.length) askTarget(s, p, card, targetOptions(targets, p));
      break;
    }
    case 'advent':
    case 'chocolate':
    case 'diabolic_ritual':
      revealHeal(s, p, card);
      break;
    case 'banana_peel': {
      const targets = othersAlive(s, p);
      if (pl.equipment.length === 0 || targets.length === 0) {
        dealDamage(s, p, 1, null, 'card', cname);
        break;
      }
      const opts: Option[] = [];
      for (const e of pl.equipment) {
        for (const o of targets) opts.push({ id: `give:${o.id}:${e}`, label: `Donner ${cardName(e)} à ${o.name}`, target: o.id, card: e, group: 'give' });
      }
      askTarget(s, p, card, opts);
      break;
    }
    case 'moody_goblin': {
      const opts: Option[] = [];
      for (const o of othersAlive(s, p)) {
        for (const e of o.equipment) opts.push({ id: `steal:${o.id}:${e}`, label: `Prendre ${cardName(e)} à ${o.name}`, target: o.id, card: e, group: 'steal' });
      }
      if (opts.length === 0) emit(s, 'no_effect', `Personne n'a d'équipement à voler.`, { player: p });
      else askTarget(s, p, card, opts);
      break;
    }
    case 'dynamite': {
      const d6 = rollDie(s, 6);
      const d4 = rollDie(s, 4);
      const sum = d6 + d4;
      emit(s, 'dice', `Dynamite : ${d6} + ${d4} = ${sum}.`, { player: p, d6, d4, sum, purpose: 'dynamite' });
      const area = areaForRoll(sum);
      if (!area) {
        emit(s, 'no_effect', 'Un 7 : la dynamite fait long feu, rien ne se passe.', { player: p });
        break;
      }
      emit(s, 'explosion', `La dynamite explose à ${AREAS[area].name} !`, { area });
      for (const o of alivePlayers(s).filter((x) => x.area === area)) {
        if (hasEquip(o, 'talisman')) emit(s, 'protected', `${o.name} est protégé par le Talisman.`, { player: o.id });
        else dealDamage(s, o.id, 3, p, 'card', cname);
      }
      break;
    }
  }
}

function revealHeal(s: GameState, p: number, card: CardId): void {
  const pl = P(s, p);
  const type = cardType(card);
  const eligible = type === 'advent'
    ? factionOf(pl) === 'hunter'
    : type === 'chocolate'
      ? ['A', 'E', 'U'].includes(charOf(pl).letter)
      : factionOf(pl) === 'shadow';
  if (pl.revealed) {
    if (eligible && type !== 'diabolic_ritual') healFull(s, p, cardName(card));
    else emit(s, 'no_effect', `${cardName(card)} n'a aucun effet.`, { player: p });
    return;
  }
  const opts: Option[] = eligible
    ? [{ id: 'reveal', label: 'Révéler votre identité et soigner tous vos dégâts', reveal: true }, { id: 'nothing', label: 'Ne rien faire' }]
    : [{ id: 'nothing', label: 'Ne rien faire' }];
  ask(s, p, 'reveal_heal', `${cardName(card)} : ${CARDS[type].text}`, 'lit sa carte', opts, { card }, card);
}

function resolveCardTarget(s: GameState, d: Decision, opt: Option): void {
  const p = d.player;
  const card = d.ctx.card as CardId;
  const cname = cardName(card);
  const parts = opt.id.split(':');
  const t = Number(parts[1]);
  const type = cardType(card);
  if (type === 'moody_goblin') return takeEquipment(s, t, p, parts[2], cname);
  if (type === 'banana_peel') return takeEquipment(s, p, t, parts[2], cname);
  emit(s, 'card_target', `${name(s, p)} choisit ${t === p ? 'lui-même' : name(s, t)} (${cname}).`, { player: p, target: t, card });
  const tp = P(s, t);
  switch (type) {
    case 'first_aid':
      setDamage(s, t, 7, cname);
      break;
    case 'blessing': {
      const r = rollDie(s, 6);
      emit(s, 'dice', `Bénédiction : le dé à 6 faces donne ${r}.`, { player: p, d6: r, purpose: 'card' });
      heal(s, t, r, cname);
      break;
    }
    case 'vampire_bat':
      if (hasEquip(tp, 'talisman')) emit(s, 'protected', `${tp.name} est protégé par le Talisman.`, { player: t });
      else dealDamage(s, t, 2, p, 'card', cname);
      heal(s, p, 1, cname);
      break;
    case 'bloodthirsty_spider':
      if (hasEquip(tp, 'talisman')) emit(s, 'protected', `${tp.name} est protégé par le Talisman.`, { player: t });
      else dealDamage(s, t, 2, p, 'card', cname);
      if (hasEquip(P(s, p), 'talisman')) emit(s, 'protected', `${name(s, p)} est protégé par le Talisman.`, { player: p });
      else dealDamage(s, p, 2, null, 'self', cname);
      break;
    case 'spiritual_doll': {
      const r = rollDie(s, 6);
      emit(s, 'dice', `Poupée spirituelle : le dé à 6 faces donne ${r}.`, { player: p, d6: r, purpose: 'card' });
      if (r <= 4) dealDamage(s, t, 3, p, 'card', cname);
      else dealDamage(s, p, 3, null, 'self', cname);
      break;
    }
  }
}

// ─── Combat ──────────────────────────────────────────────────

function stepAttackPhase(s: GameState, p: number): void {
  const pl = P(s, p);
  if (!pl.alive) return;
  s.turn.phase = 'attack';
  const targets = targetsInRange(s, p);
  if (targets.length === 0) {
    emit(s, 'no_target', `${pl.name} n'a personne à portée d'attaque.`, { player: p });
    return;
  }
  const forced = hasEquip(pl, 'masamune');
  const opts: Option[] = hasEquip(pl, 'machine_gun')
    ? [{ id: 'attack_all', label: `Mitrailleuse : attaquer ${targets.map((t) => name(s, t)).join(', ')}`, group: 'attack' }]
    : targets.map((t) => ({ id: `attack:${t}`, label: `Attaquer ${name(s, t)}`, target: t, group: 'attack' }));
  if (!forced) opts.push({ id: 'pass', label: 'Ne pas attaquer', group: 'skip' });
  ask(s, p, 'attack', forced ? 'Masamune : vous devez attaquer !' : 'Voulez-vous attaquer ?', 'choisit s\'il attaque', opts, { targets });
}

function resolveAttackChoice(s: GameState, d: Decision, opt: Option): void {
  const p = d.player;
  if (opt.id === 'pass') {
    emit(s, 'pass', `${name(s, p)} n'attaque pas.`, { player: p });
    return;
  }
  const targets = opt.id === 'attack_all' ? (d.ctx.targets as number[]) : [opt.target as number];
  pushSteps(s, { t: 'attack', p, targets, mode: 'normal' });
}

function stepAttack(s: GameState, p: number, targets: number[], mode: AttackMode): void {
  const pl = P(s, p);
  const alive = targets.filter((t) => P(s, t).alive);
  if (!pl.alive || alive.length === 0) return;
  s.combatDealt = false;
  const verb = mode === 'counter' ? 'contre-attaque' : mode === 'charles' ? 'attaque à nouveau' : 'attaque';
  emit(s, 'attack', `${pl.name} ${verb} ${alive.map((t) => name(s, t)).join(', ')} !`, { attacker: p, targets: alive, mode });
  let base: number;
  if (hasEquip(pl, 'masamune') || abilityActive(pl, 'valkyrie')) {
    base = rollDie(s, 4);
    emit(s, 'dice', `${pl.name} lance uniquement le dé à 4 faces : ${base}.`, { player: p, d4: base, purpose: 'attack' });
  } else {
    const d6 = rollDie(s, 6);
    const d4 = rollDie(s, 4);
    base = Math.abs(d6 - d4);
    emit(s, 'dice', `${pl.name} lance les dés : ${d6} et ${d4}, écart de ${base}.`, { player: p, d6, d4, purpose: 'attack' });
  }
  const steps: Step[] = [];
  if (base === 0) {
    emit(s, 'miss', `L'attaque de ${pl.name} échoue !`, { attacker: p });
  } else {
    const bonus = attackBonus(s, pl) - (hasEquip(pl, 'holy_robe') ? 1 : 0);
    for (const t of alive) {
      const robe = hasEquip(P(s, t), 'holy_robe') ? 1 : 0;
      steps.push({ t: 'attackHit', p, target: t, amount: Math.max(0, base + bonus - robe) });
    }
  }
  steps.push({ t: 'afterAttack', p, targets: alive, mode });
  pushSteps(s, ...steps);
}

function applyHit(s: GameState, p: number, t: number, amount: number): void {
  if (dealDamage(s, t, amount, p, 'attack') > 0) s.combatDealt = true;
}

function stepAttackHit(s: GameState, p: number, t: number, amount: number): void {
  const a = P(s, p);
  const v = P(s, t);
  if (!v.alive) return;
  if (amount <= 0) {
    emit(s, 'no_damage', `L'attaque ne fait aucun dégât à ${v.name}.`, { player: t });
    return;
  }
  if (v.barrier || v.guardianAngel) {
    applyHit(s, p, t, amount);
    return;
  }
  if (a.alive && amount >= 2 && v.equipment.length > 0) {
    if (abilityReady(a, 'bob')) {
      const rev = !a.revealed;
      ask(s, p, 'bob_rob', `Braquage : prendre un équipement à ${v.name} au lieu de lui infliger ${plural(amount, 'dégât')} ?`, 'réfléchit', [
        ...v.equipment.map((e) => ({ id: `steal:${e}`, label: `Prendre ${cardName(e)}${rev ? REVEAL_SUFFIX : ''}`, card: e, target: t, reveal: rev })),
        { id: 'damage', label: `Infliger ${plural(amount, 'dégât')}` },
      ], { target: t, amount });
      return;
    }
    if (!a.revealed) {
      ask(s, p, 'bob_rob', `Votre attaque inflige ${plural(amount, 'dégât')} à ${v.name}.`, 'réfléchit',
        [{ id: 'damage', label: 'Continuer' }], { target: t, amount });
      return;
    }
  }
  applyHit(s, p, t, amount);
}

function resolveBobRob(s: GameState, d: Decision, opt: Option): void {
  const p = d.player;
  const t = d.ctx.target as number;
  if (opt.id === 'damage') return applyHit(s, p, t, d.ctx.amount as number);
  if (opt.reveal) reveal(s, p);
  abilityEvent(s, p);
  takeEquipment(s, t, p, opt.id.slice('steal:'.length), 'Braquage');
}

function stepAfterAttack(s: GameState, p: number, targets: number[], mode: AttackMode): void {
  const a = P(s, p);
  if (a.alive && s.combatDealt && abilityActive(a, 'vampire')) {
    abilityEvent(s, p);
    heal(s, p, 2, 'Morsure');
  }
  if (mode === 'counter') return;
  const steps: Step[] = targets.map((t) => ({ t: 'counterPrompt', p: t, attacker: p }));
  steps.push({ t: 'charlesPrompt', p, targets });
  pushSteps(s, ...steps);
}

function stepCounterPrompt(s: GameState, w: number, attacker: number): void {
  const wp = P(s, w);
  if (!wp.alive || !P(s, attacker).alive) return;
  if (abilityReady(wp, 'werewolf')) {
    ask(s, w, 'counter', `${name(s, attacker)} vous a attaqué. Contre-attaquer ?`, 'réfléchit', [
      { id: 'counter', label: wp.revealed ? 'Contre-attaquer' : 'Se révéler et contre-attaquer', target: attacker, reveal: !wp.revealed, group: 'attack' },
      { id: 'no', label: 'Ne rien faire' },
    ], { attacker });
  } else if (!wp.revealed) {
    ask(s, w, 'counter', `${name(s, attacker)} vous a attaqué.`, 'réfléchit', [{ id: 'no', label: 'Continuer' }], { attacker });
  }
}

function resolveCounter(s: GameState, d: Decision, opt: Option): void {
  if (opt.id !== 'counter') return;
  const w = d.player;
  if (opt.reveal) reveal(s, w);
  abilityEvent(s, w);
  pushSteps(s, { t: 'attack', p: w, targets: [d.ctx.attacker as number], mode: 'counter' });
}

function stepCharlesPrompt(s: GameState, p: number, targets: number[]): void {
  const a = P(s, p);
  const alive = targets.filter((t) => P(s, t).alive);
  if (!a.alive || alive.length === 0) return;
  if (abilityReady(a, 'charles')) {
    ask(s, p, 'charles_again', `Festin sanglant : vous infliger 2 dégâts pour attaquer à nouveau ${alive.map((t) => name(s, t)).join(', ')} ?`, 'réfléchit', [
      { id: 'again', label: a.revealed ? 'Attaquer à nouveau (2 dégâts pour vous)' : 'Se révéler et attaquer à nouveau (2 dégâts pour vous)', reveal: !a.revealed, group: 'attack' },
      { id: 'stop', label: 'En rester là' },
    ], { targets: alive });
  } else if (!a.revealed) {
    ask(s, p, 'charles_again', 'Votre attaque est terminée.', 'réfléchit', [{ id: 'stop', label: 'Continuer' }], { targets: alive });
  }
}

function resolveCharles(s: GameState, d: Decision, opt: Option): void {
  if (opt.id !== 'again') return;
  const p = d.player;
  if (opt.reveal) reveal(s, p);
  abilityEvent(s, p);
  dealDamage(s, p, 2, null, 'self', 'Festin sanglant');
  if (P(s, p).alive) pushSteps(s, { t: 'attack', p, targets: d.ctx.targets as number[], mode: 'charles' });
}

// ─── Morts et butin ──────────────────────────────────────────

export function processDeaths(s: GameState): void {
  const deaths = s.newDeaths;
  s.newDeaths = [];
  if (deaths.length === 0) return;
  const batch = ++s.deathBatches;
  for (const d of deaths) {
    const v = P(s, d.victim);
    v.deathBatch = batch;
    v.killedBy = d.killer;
    v.revealed = true;
    const c = charOf(v);
    emit(s, 'death', `${v.name} meurt${d.killer !== null ? ` (tué par ${name(s, d.killer)})` : ''} ! C'était ${c.name}, ${c.faction === 'hunter' ? 'un Hunter' : c.faction === 'shadow' ? 'un Shadow' : 'un Neutre'}.`, {
      player: d.victim, character: v.character, killer: d.killer,
    });
  }
  for (const p of alivePlayers(s)) {
    if (abilityReady(p, 'daniel') && !p.revealed) reveal(s, p.id, 'Cri');
  }
  for (const d of deaths) {
    if (d.killer === null) continue;
    const k = P(s, d.killer);
    const victimHp = hpOf(P(s, d.victim));
    if (k.character === 'charles' && deadCount(s) >= 3) s.flags.charlesWin = true;
    if (k.character === 'bryan') {
      if (victimHp >= 13) s.flags.bryanWin = true;
      else if (abilityReady(k, 'bryan') && !k.revealed) reveal(s, k.id, 'Oh mon Dieu !');
    }
  }
  pushSteps(s, ...deaths.map((d): Step => ({ t: 'loot', killer: d.killer ?? -1, victim: d.victim })));
}

function discardAll(s: GameState, victim: number): void {
  const v = P(s, victim);
  if (v.equipment.length === 0) return;
  emit(s, 'discard_equipment', `L'équipement de ${v.name} est défaussé.`, { player: victim, cards: [...v.equipment] });
  for (const e of v.equipment) discard(s, e);
  v.equipment = [];
}

function stepLoot(s: GameState, killer: number, victim: number): void {
  const v = P(s, victim);
  if (v.equipment.length === 0) return;
  const k = killer >= 0 ? P(s, killer) : null;
  if (!k || !k.alive) return discardAll(s, victim);
  if (hasEquip(k, 'silver_rosary')) {
    for (const e of [...v.equipment]) takeEquipment(s, victim, killer, e, 'Rosaire d\'argent');
    return;
  }
  ask(s, killer, 'loot', `Vous avez tué ${v.name} : prenez une de ses cartes Équipement.`, 'choisit un équipement à récupérer', [
    ...v.equipment.map((e) => ({ id: `take:${e}`, label: `Prendre ${cardName(e)}`, card: e, target: victim })),
    { id: 'none', label: 'Ne rien prendre' },
  ], { victim });
}

function resolveLoot(s: GameState, d: Decision, opt: Option): void {
  const victim = d.ctx.victim as number;
  if (opt.id !== 'none') takeEquipment(s, victim, d.player, opt.id.slice('take:'.length), 'butin');
  discardAll(s, victim);
}

// ═══ Décisions ════════════════════════════════════════════════

export function resolveDecision(s: GameState, d: Decision, opt: Option): void {
  const p = d.player;
  switch (d.kind) {
    case 'turn_start':
      return resolveTurnStart(s, p, opt);
    case 'compass': {
      const a = opt.id.split(':')[2];
      if (a === '7') askChooseArea(s, p); else moveTo(s, p, a as AreaId, 'Boussole mystique');
      return;
    }
    case 'choose_area':
      return moveTo(s, p, opt.area as AreaId, 'au choix');
    case 'area_action':
      return resolveAreaAction(s, p, opt);
    case 'hermit_give': {
      const card = d.ctx.card as CardId;
      const t = opt.target as number;
      emit(s, 'hermit_give', `${name(s, p)} donne ${cardName(card)} à ${name(s, t)}.`, { from: p, to: t, card }, [p, t],
        { type: 'hermit_give', text: `${name(s, p)} donne une carte Ermite à ${name(s, t)}.`, data: { from: p, to: t } });
      return askHermitRespond(s, t, p, card);
    }
    case 'hermit_respond':
      return resolveHermitRespond(s, d, opt);
    case 'card_target':
      return resolveCardTarget(s, d, opt);
    case 'reveal_heal': {
      const card = d.ctx.card as CardId;
      if (opt.id === 'reveal') {
        reveal(s, p, cardName(card));
        healFull(s, p, cardName(card));
      } else {
        emit(s, 'nothing', `${name(s, p)} ne fait rien.`, { player: p });
      }
      return;
    }
    case 'attack':
      return resolveAttackChoice(s, d, opt);
    case 'bob_rob':
      return resolveBobRob(s, d, opt);
    case 'counter':
      return resolveCounter(s, d, opt);
    case 'charles_again':
      return resolveCharles(s, d, opt);
    case 'loot':
      return resolveLoot(s, d, opt);
    case 'end_turn': {
      const pl = P(s, p);
      if (opt.id === 'end') return;
      if (opt.reveal) reveal(s, p);
      abilityEvent(s, p);
      pl.abilityUsed = true;
      if (opt.id === 'gregor') {
        pl.barrier = true;
        emit(s, 'barrier', `${pl.name} est protégé de tous les dégâts jusqu'à son prochain tour.`, { player: p });
      } else if (opt.id === 'wight') {
        const n = deadCount(s);
        s.turn.extraTurns += n;
        emit(s, 'extra_turn_gain', `${pl.name} gagne ${plural(n, 'tour')} supplémentaire${n > 1 ? 's' : ''}.`, { player: p });
      }
      return;
    }
  }
}

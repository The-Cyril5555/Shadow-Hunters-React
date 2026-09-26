// Effets sonores (sons repris du projet Godot).
import { useStore } from './store';

const BASE = import.meta.env.BASE_URL;

export type Sfx =
  | 'button_click' | 'card_draw' | 'card_play' | 'card_shuffle' | 'attack_swing' | 'damage_hit' | 'player_death'
  | 'dice_roll' | 'dice_land' | 'reveal_dramatic' | 'ability_use' | 'turn_start' | 'win_game' | 'lose_game'
  | 'move_player' | 'zone_church' | 'zone_cemetery' | 'zone_hermit' | 'panel_open' | 'panel_close';

const cache = new Map<Sfx, HTMLAudioElement>();

export function play(name: Sfx, volumeScale = 1): void {
  const volume = useStore.getState().settings.volume * volumeScale;
  if (volume <= 0 || typeof Audio === 'undefined') return;
  try {
    let base = cache.get(name);
    if (!base) {
      base = new Audio(`${BASE}assets/sfx/${name}.wav`);
      base.preload = 'auto';
      cache.set(name, base);
    }
    const a = base.cloneNode(true) as HTMLAudioElement;
    a.volume = Math.min(1, volume);
    void a.play().catch(() => undefined);
  } catch {
    /* audio indisponible */
  }
}

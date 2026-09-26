// Accès prudent au localStorage (navigation privée, stockage bloqué…).
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible ou plein */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignoré */
  }
}

export const KEYS = {
  settings: 'sh-settings',
  save: 'sh-solo-save',
  tokens: 'sh-seat-tokens',
  notes: 'sh-notes',
};

import { GameState, restore } from './sim';

const KEY = 'little-village-story/save/v1';

export function loadGame(now: number): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    return restore(raw ? JSON.parse(raw) : null, now);
  } catch {
    // Private mode or blocked storage: play without saving.
    return restore(null, now);
  }
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore: the game still works, it just won't remember progress.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

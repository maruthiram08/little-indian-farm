import { GameState, restore } from './sim';
import { PlaytestLog, restoreLog } from './playtest';

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

const LOG_KEY = 'little-village-story/playtest/v1';

export function loadLog(now: number): PlaytestLog {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return restoreLog(raw ? JSON.parse(raw) : null, now);
  } catch {
    return restoreLog(null, now);
  }
}

export function saveLog(log: PlaytestLog): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // Ignore: the report just won't survive a reload.
  }
}

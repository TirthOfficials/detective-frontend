"use client";
// localStorage wrapper that never throws (private windows, blocked storage).
import type { GameState } from "../types";

export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};

export function loadGame(id: string): GameState | null {
  const raw = storage.get(`mm:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState) {
  storage.set(`mm:${state.scenarioId}`, JSON.stringify(state));
}

export function clearGame(id: string) {
  storage.remove(`mm:${id}`);
}

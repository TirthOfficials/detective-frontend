"use client";
// Sound on/off preference, persisted in localStorage (mm:sound). Default OFF.
import { useCallback, useSyncExternalStore } from "react";
import { storage } from "./storage";

const KEY = "mm:sound";
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => storage.get(KEY) === "on", () => false);
  const set = useCallback((v: boolean) => {
    storage.set(KEY, v ? "on" : "off");
    listeners.forEach((l) => l());
  }, []);
  return [on, set];
}

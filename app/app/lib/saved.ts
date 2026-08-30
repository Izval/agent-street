/**
 * Saved / favorited agents — client-only store over localStorage.
 *
 * There is no server-side "favorites" concept and no batch-by-ids endpoint
 * (agents.ts only has per-id `get`), so we persist a light SNAPSHOT of each
 * saved agent. That lets `/saved` render instantly, offline, and without N
 * refetches, while staying honest via the `source` badge.
 *
 * SSR-safe: `useSavedAgents` is backed by `useSyncExternalStore` with an EMPTY
 * server snapshot, so the first client paint matches the server (empty) and
 * hydrates from localStorage on mount — no hydration mismatch. Cross-tab sync
 * comes from the `storage` event.
 */

import { useMemo } from "react";
import { useSyncExternalStore } from "react";

export interface SavedAgent {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  score: number;
  imageUrl?: string;
  source: "8004scan" | "seed";
  /** ms epoch; filled by `toggleSaved` on insert. */
  savedAt: number;
}

const KEY = "agent-street:saved:v1";
const MAX = 200;
/** Stable empty reference for SSR / disabled storage (useSyncExternalStore needs identity stability). */
const EMPTY: SavedAgent[] = [];

let cache: SavedAgent[] | null = null;
const listeners = new Set<() => void>();

function read(): SavedAgent[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedAgent[]) : null;
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: SavedAgent[]): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded / storage disabled — keep the in-memory cache */
  }
  for (const l of listeners) l();
}

// One shared storage listener (bound once, client-only) keeps tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null; // force a re-read on next getSnapshot
    read();
    for (const l of listeners) l();
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reactive list of saved agents (newest first). */
export function useSavedAgents(): SavedAgent[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Reactive "is this agent saved?". */
export function useIsSaved(id: string): boolean {
  const list = useSavedAgents();
  return useMemo(() => list.some((a) => a.id === id), [list, id]);
}

/** Toggle save state. Returns the NEW saved state (true = now saved). */
export function toggleSaved(agent: Omit<SavedAgent, "savedAt">): boolean {
  const list = read();
  const exists = list.some((a) => a.id === agent.id);
  if (exists) {
    write(list.filter((a) => a.id !== agent.id));
    return false;
  }
  write([{ ...agent, savedAt: Date.now() }, ...list].slice(0, MAX));
  return true;
}

/** Remove one saved agent by id. */
export function removeSaved(id: string): void {
  write(read().filter((a) => a.id !== id));
}

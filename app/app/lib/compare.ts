/**
 * Compare selection — client-only store over localStorage.
 *
 * The discover→compare→hire journey needs a way to pick a few agents and view
 * them side by side. Mirrors lib/saved.ts exactly (there is no server-side
 * "compare" concept and no batch-by-ids endpoint), persisting a light snapshot
 * so the floating pill renders instantly; /compare re-fetches full detail by id.
 *
 * SSR-safe via useSyncExternalStore with a stable EMPTY server snapshot; hydrates
 * from localStorage on mount (no hydration mismatch). Cross-tab sync via `storage`.
 */

import { useMemo } from "react";
import { useSyncExternalStore } from "react";

export interface CompareAgent {
  id: string;
  name: string;
  subcategoryLabel: string | null;
  score: number;
  imageUrl?: string;
  source: "8004scan" | "seed";
}

const KEY = "agent-street:compare:v1";
/** Side-by-side stays legible up to 4 columns. */
export const COMPARE_MAX = 4;
/** Stable empty reference for SSR / disabled storage. */
const EMPTY: CompareAgent[] = [];

let cache: CompareAgent[] | null = null;
const listeners = new Set<() => void>();

function read(): CompareAgent[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CompareAgent[]) : null;
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: CompareAgent[]): void {
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

/** Reactive list of agents queued for comparison (newest last). */
export function useCompare(): CompareAgent[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Reactive "is this agent in the compare set?". */
export function useInCompare(id: string): boolean {
  const list = useCompare();
  return useMemo(() => list.some((a) => a.id === id), [list, id]);
}

/**
 * Toggle an agent in/out of the compare set. Returns the NEW state (true = now in).
 * A no-op that returns false if adding would exceed COMPARE_MAX.
 */
export function toggleCompare(agent: CompareAgent): boolean {
  const list = read();
  const exists = list.some((a) => a.id === agent.id);
  if (exists) {
    write(list.filter((a) => a.id !== agent.id));
    return false;
  }
  if (list.length >= COMPARE_MAX) return false;
  write([...list, agent]);
  return true;
}

/** Remove one agent from the compare set by id. */
export function removeCompare(id: string): void {
  write(read().filter((a) => a.id !== id));
}

/** Empty the compare set. */
export function clearCompare(): void {
  write([]);
}

/**
 * Saved / bookmarked portfolios — client-only store over localStorage.
 *
 * The "heart" on a portfolio is a public like counter (server-side, per-device);
 * this is the separate, private bookmark ("save it for later") — the portfolio
 * equivalent of lib/saved.ts for agents. We persist a light snapshot so /saved
 * renders instantly and offline; the live figures come from the detail page.
 *
 * SSR-safe: `useSyncExternalStore` with an empty server snapshot; cross-tab sync
 * via the `storage` event. Mirrors lib/saved.ts exactly.
 */

import { useMemo, useSyncExternalStore } from "react";

export interface SavedPortfolio {
  slug: string;
  name: string;
  /** Creator label or short address, for the card byline. null if unknown. */
  creatorLabel: string | null;
  memberCount: number;
  /** Seed for the generative cover so /saved matches the real card art. */
  coverKey: string;
  savedAt: number;
}

const KEY = "agent-street:saved-portfolios:v1";
const MAX = 200;
const EMPTY: SavedPortfolio[] = [];

let cache: SavedPortfolio[] | null = null;
const listeners = new Set<() => void>();

function read(): SavedPortfolio[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedPortfolio[]) : null;
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: SavedPortfolio[]): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded / storage disabled — keep the in-memory cache */
  }
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
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

/** Reactive list of saved portfolios (newest first). */
export function useSavedPortfolios(): SavedPortfolio[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Reactive "is this portfolio saved?". */
export function useIsPortfolioSaved(slug: string): boolean {
  const list = useSavedPortfolios();
  return useMemo(() => list.some((p) => p.slug === slug), [list, slug]);
}

/** Toggle bookmark state. Returns the NEW state (true = now saved). */
export function togglePortfolioSaved(pf: Omit<SavedPortfolio, "savedAt">): boolean {
  const list = read();
  if (list.some((p) => p.slug === pf.slug)) {
    write(list.filter((p) => p.slug !== pf.slug));
    return false;
  }
  write([{ ...pf, savedAt: Date.now() }, ...list].slice(0, MAX));
  return true;
}

/** Remove one saved portfolio by slug. */
export function removeSavedPortfolio(slug: string): void {
  write(read().filter((p) => p.slug !== slug));
}

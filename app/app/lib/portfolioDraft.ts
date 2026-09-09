/**
 * Portfolio draft — the staging set behind the agent-page "+" button.
 *
 * It reads/writes the SAME localStorage key the builder (`/portfolio/new`) already
 * consumes (`agent-street:portfolio:draft:v1`), so adding an agent from anywhere
 * lands in the builder when the user goes to publish. `addToDraft` merges into
 * `members` without clobbering the draft's `name`/`tagline`.
 *
 * SSR-safe like lib/saved.ts: `useSyncExternalStore` with an empty server
 * snapshot; cross-tab sync via the `storage` event. Mirrors the compare-set
 * pattern (a running client-side selection surfaced by a floating pill).
 */

import { useSyncExternalStore } from "react";
import type { SavedAgent } from "./saved";

const KEY = "agent-street:portfolio:draft:v1";
const MAX = 50;

interface Draft {
  name: string;
  tagline: string;
  members: SavedAgent[];
}
const EMPTY: SavedAgent[] = [];

let cache: SavedAgent[] | null = null;
const listeners = new Set<() => void>();

function readRaw(): Draft {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Draft) : null;
    return {
      name: parsed?.name ?? "",
      tagline: parsed?.tagline ?? "",
      members: Array.isArray(parsed?.members) ? parsed!.members : [],
    };
  } catch {
    return { name: "", tagline: "", members: [] };
  }
}

/** Reactive snapshot of just the draft members (identity-stable for React). */
function readMembers(): SavedAgent[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  cache = readRaw().members;
  return cache;
}

function writeMembers(next: SavedAgent[]): void {
  cache = next;
  const cur = readRaw();
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ name: cur.name, tagline: cur.tagline, members: next }),
    );
  } catch {
    /* storage disabled — keep the in-memory cache */
  }
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    readMembers();
    for (const l of listeners) l();
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reactive draft member list. */
export function useDraftMembers(): SavedAgent[] {
  return useSyncExternalStore(subscribe, readMembers, () => EMPTY);
}

/** Reactive count of agents staged in the draft. */
export function useDraftCount(): number {
  return useDraftMembers().length;
}

/** Reactive "is this agent already in the draft?". */
export function useInDraft(id: string): boolean {
  return useDraftMembers().some((a) => a.id === id);
}

/** Add an agent to the draft (no-op if already present). Returns true if added. */
export function addToDraft(agent: Omit<SavedAgent, "savedAt">): boolean {
  const list = readMembers();
  if (list.some((a) => a.id === agent.id)) return false;
  writeMembers([...list, { ...agent, savedAt: Date.now() }].slice(0, MAX));
  return true;
}

/** Remove one agent from the draft. */
export function removeFromDraft(id: string): void {
  writeMembers(readMembers().filter((a) => a.id !== id));
}

/** Clear all staged members (keeps the draft's name/tagline). */
export function clearDraftMembers(): void {
  writeMembers([]);
}

/** Read the draft's name/tagline (empty strings when absent). */
export function readDraftMeta(): { name: string; tagline: string } {
  if (typeof window === "undefined") return { name: "", tagline: "" };
  const { name, tagline } = readRaw();
  return { name, tagline };
}

/** Persist the draft's name/tagline (keeps the staged members). */
export function setDraftMeta(name: string, tagline: string): void {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ name, tagline, members: readMembers() }),
    );
  } catch {
    /* storage disabled */
  }
}

/** Clear the whole draft (members + name/tagline). Used after publishing. */
export function clearDraft(): void {
  cache = [];
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage disabled */
  }
  for (const l of listeners) l();
}

/** Toggle an agent in the draft. Returns the NEW state (true = now in draft). */
export function toggleDraft(agent: Omit<SavedAgent, "savedAt">): boolean {
  if (readMembers().some((a) => a.id === agent.id)) {
    removeFromDraft(agent.id);
    return false;
  }
  addToDraft(agent);
  return true;
}

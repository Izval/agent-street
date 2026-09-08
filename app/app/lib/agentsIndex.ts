/**
 * agentsIndex — client-side prefetch of the full agent index for the ⌘K palette.
 *
 * Fetches /agents-index.json ONCE per session (module-cached, like DocSearch), so
 * the palette filters ~1500 tiny entries in memory with zero per-keystroke network.
 * Only ever called from effects → SSR-safe (no fetch during render).
 */

import type { IndexAgent } from "./agents";

let CACHE: IndexAgent[] | null = null;
let INFLIGHT: Promise<IndexAgent[]> | null = null;

/** The index if it has already loaded this session, else null (no fetch). */
export function peekAgentIndex(): IndexAgent[] | null {
  return CACHE;
}

/** Load the index once; resolves to [] on any failure (palette still works). */
export function loadAgentIndex(): Promise<IndexAgent[]> {
  if (CACHE) return Promise.resolve(CACHE);
  if (!INFLIGHT) {
    INFLIGHT = fetch("/agents-index.json", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<IndexAgent[]>) : ([] as IndexAgent[])))
      .then((d) => {
        CACHE = Array.isArray(d) ? d : [];
        return CACHE;
      })
      .catch(() => {
        INFLIGHT = null; // allow a retry on the next open
        return [] as IndexAgent[];
      });
  }
  return INFLIGHT;
}

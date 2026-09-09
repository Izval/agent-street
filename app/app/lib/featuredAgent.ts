/**
 * Featured-agent selection for the home hero.
 *
 * Two tiers, in priority order:
 *
 *  1. Editorial schedule (`FEATURED_SCHEDULE`) — a hand-curated calendar of
 *     `{ id, from, to }` windows. When "now" falls inside a window, that agent id
 *     is featured. This is editorial DATA, not a code coupling: ANY agent can be
 *     scheduled, the marketplace works with an EMPTY schedule (falls straight to
 *     tier 2), and every row EXPIRES — so there is no permanent flagship, no
 *     per-agent branch (`if (isX)`), and no call to any external engine. Removing
 *     every row leaves a clean merit-only marketplace.
 *
 *  2. Merit rotation — when no schedule window is active, deterministically rotate
 *     through the top pool (already sorted by on-chain 8004scan score, best first)
 *     by ISO-ish week number, so the featured slot changes once a week and is the
 *     same for everyone within a given week.
 *
 * SSR-safe & pure: same inputs ⇒ same output on server and client (no `window`,
 * no randomness). The `now` argument is injectable for tests.
 */

export interface FeaturedSlot {
  /** Agent token id (as used across the app, e.g. "341628"). */
  id: string;
  /** Inclusive start, `YYYY-MM-DD` (parsed as UTC midnight). */
  from: string;
  /** Exclusive end, `YYYY-MM-DD` (parsed as UTC midnight). */
  to: string;
}

/**
 * Editorial spotlight calendar. Rows are plain data and expire on their own; an
 * empty array means "pure merit rotation". Keep windows short and non-overlapping
 * — the first active row wins.
 */
export const FEATURED_SCHEDULE: FeaturedSlot[] = [
  // Launch spotlight: 2-week window, then the slot returns to merit rotation.
  { id: "341628", from: "2026-09-09", to: "2026-09-23" },
];

/** How many of the top-scored agents the weekly rotation cycles through. */
const ROTATION_POOL_SIZE = 8;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Whole weeks since the Unix epoch — a stable, monotonic weekly counter. */
export function weekIndex(now: Date): number {
  return Math.floor(now.getTime() / WEEK_MS);
}

/**
 * The agent id scheduled for `now`, or null when no window is active. Pool-free,
 * so the loader can fetch this specific agent in parallel with everything else.
 */
export function scheduledFeaturedId(now: Date = new Date()): string | null {
  const t = now.getTime();
  for (const s of FEATURED_SCHEDULE) {
    if (t >= Date.parse(s.from) && t < Date.parse(s.to)) return s.id;
  }
  return null;
}

/**
 * The merit pick: deterministic weekly rotation through the top of `rankedIds`
 * (which must already be sorted best-first). null when the pool is empty.
 */
export function meritFeaturedId(
  rankedIds: string[],
  now: Date = new Date(),
): string | null {
  if (rankedIds.length === 0) return null;
  const pool = rankedIds.slice(0, ROTATION_POOL_SIZE);
  return pool[weekIndex(now) % pool.length];
}

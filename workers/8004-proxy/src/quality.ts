// quality.ts — anti-spam gate + dedup for the marketplace listing feed.
//
// 8004scan indexes ~297k agents on BSC; a visible tail is junk (gibberish names,
// all-numeric names, empty/numeric descriptions) and the same listing is minted many
// times (one owner, many token_ids, identical name+description). Agent-Street is a
// CURATED marketplace, so we drop that noise at the data layer (the proxy) before it
// ever reaches a listing. This is uniform curation, not per-agent special-casing.
//
// Deliberately NOT subcategory-based: keyword classification is too fragile to gate on
// (it needs constant maintenance). An agent that matches no subcategory is still listed;
// only spam is removed. Keep these rules pure and conservative — false positives hide
// real agents, which is worse than letting a rare junk row through.

/** Tunables (kept together so the gate is easy to calibrate). */
const MIN_NAME_LEN = 2;
/** 4+ identical chars in a row in a NAME is junk (`aaaa`); no real name does this. */
const NAME_REPEAT_RUN = /(.)\1{3,}/;
/** 5+ identical chars in a row in a DESCRIPTION is junk (`rhfdddddd…`); the looser
 *  threshold tolerates elongated words in real prose ("woooow"). */
const DESC_REPEAT_RUN = /(.)\1{4,}/;
/** Below this vowel ratio a long alpha string is gibberish (`Zkgqxc9`, `qhbwown`). */
const MIN_VOWEL_RATIO = 0.15;
/** Only apply the vowel test to names with at least this many letters (protects
 *  short tickers like `BNB`, `CZ` that legitimately skip vowels). */
const VOWEL_TEST_MIN_LETTERS = 6;
/** A description that is this fraction digits (or worse) is a numeric-dump. */
const MAX_DIGIT_RATIO = 0.6;

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** Fraction of `letters` that are ASCII vowels. */
function vowelRatio(letters: string): number {
  if (!letters) return 0;
  let v = 0;
  for (const c of letters) if (VOWELS.has(c)) v++;
  return v / letters.length;
}

/** True when a name looks like spam rather than a real agent name. */
export function isJunkName(name: string): boolean {
  const s = (name ?? "").trim();
  if (s.length < MIN_NAME_LEN) return true;
  if (/^\d+$/.test(s)) return true; // "56002", "007", "1213804"
  if (NAME_REPEAT_RUN.test(s)) return true; // "aaaa"
  const letters = s.toLowerCase().replace(/[^a-z]/g, "");
  if (
    letters.length >= VOWEL_TEST_MIN_LETTERS &&
    vowelRatio(letters) < MIN_VOWEL_RATIO
  ) {
    return true; // "Zkgqxc9", "qhbwown"
  }
  return false;
}

/** True when a description is empty or spam (repeated runs / numeric dumps). */
export function isJunkDescription(description: string): boolean {
  const s = (description ?? "").trim();
  if (s.length === 0) return true; // empty descriptions are rejected
  if (DESC_REPEAT_RUN.test(s)) return true; // "rhfdddddd…"
  if (/^\d{6,}$/.test(s)) return true; // "82838554…"
  const digits = (s.match(/\d/g) ?? []).length;
  if (digits / s.length > MAX_DIGIT_RATIO) return true; // mostly digits
  return false;
}

/** Marketplace listing gate: keep only agents with a real name and description. */
export function qualityGate(agent: {
  name: string;
  description: string;
}): boolean {
  return !isJunkName(agent.name) && !isJunkDescription(agent.description);
}

// --- Dedup -------------------------------------------------------------- //
// 8004scan returns the same listing many times: one owner mints dozens of
// token_ids with an identical (or barely-tweaked) name+description — to a user those
// are the same card repeated. We collapse them and keep the strongest representative.

/** Minimal shape needed to dedup + pick the best representative. */
export interface DedupeCandidate {
  name: string;
  description: string;
  score: number;
  feedbacks: number;
  isVerified: boolean;
  tokenId: string;
  ownerAddress?: string;
}

const normText = (s: string) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Is `a` a stronger representative than `b`? score, then feedbacks, then verified,
 *  then lower tokenId (a stable tie-break so the result is deterministic). */
function strongerThan(a: DedupeCandidate, b: DedupeCandidate): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.feedbacks !== b.feedbacks) return a.feedbacks > b.feedbacks;
  if (a.isVerified !== b.isVerified) return a.isVerified;
  return (Number(a.tokenId) || Infinity) < (Number(b.tokenId) || Infinity);
}

/** Collapse rows sharing a key, keeping the strongest representative and first-seen
 *  order. A null key means "not groupable" — that row is always kept as-is. */
function collapse<T extends DedupeCandidate>(
  agents: T[],
  keyOf: (a: T) => string | null,
): T[] {
  const best = new Map<string, T>();
  const order: string[] = [];
  agents.forEach((a, i) => {
    const k = keyOf(a);
    if (k === null) {
      const uniq = " " + i; // unique bucket → never merged
      best.set(uniq, a);
      order.push(uniq);
      return;
    }
    const cur = best.get(k);
    if (!cur) {
      best.set(k, a);
      order.push(k);
    } else if (strongerThan(a, cur)) {
      best.set(k, a);
    }
  });
  return order.map((k) => best.get(k)!);
}

/**
 * Collapse duplicate listings to one card each (best representative). Two passes:
 *  1) identical content (name + description) — owner-agnostic, so cross-wallet
 *     copies (a platform minting the same agent under many wallets) collapse.
 *  2) same owner + same name — catches one owner's near-dupes whose descriptions
 *     were tweaked between mints (v1/v2), which pass 1 leaves as distinct.
 * Anonymous rows (no owner) are only ever collapsed by pass 1, never merged on name
 * alone, so two unrelated anon agents sharing a generic name both survive.
 */
export function dedupeAgents<T extends DedupeCandidate>(agents: T[]): T[] {
  const byContent = collapse(
    agents,
    (a) => normText(a.name) + " ¦ " + normText(a.description),
  );
  return collapse(byContent, (a) =>
    a.ownerAddress
      ? a.ownerAddress.toLowerCase() + " ¦ " + normText(a.name)
      : null,
  );
}

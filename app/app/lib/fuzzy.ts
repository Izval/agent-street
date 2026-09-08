/**
 * fuzzy.ts — typo-tolerant text matching for the ⌘K search index.
 *
 * Plain substring matching (`includes`) misses a query with a single typo
 * ("rebalncing", "pancke"). This adds edit-distance tolerance via the
 * Levenshtein algorithm and a small scoring model so results can be ranked
 * exact → prefix → substring → fuzzy, instead of returned in definition order.
 *
 * Dependency-free and small: the candidate lists (subcategories, skills) are a
 * few dozen short strings, so the O(n·m) DP is negligible per keystroke.
 */

/**
 * Levenshtein edit distance between two strings: the minimum number of
 * single-character insertions, deletions or substitutions to turn `a` into `b`.
 * Two-row DP, O(a·b) time and O(b) space.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * How many typos to forgive for a query of the given length. Short queries get
 * no slack (they collide too easily); longer ones tolerate more.
 */
function tolerance(len: number): number {
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

/**
 * Score a single query term against a single field text. `0` means no match;
 * higher is a better match. The tiers keep exact/prefix/substring hits above
 * any fuzzy (edit-distance) hit so clean queries still rank first.
 */
function termScore(term: string, text: string): number {
  if (!term || !text) return 0;

  if (text === term) return 100;
  if (text.startsWith(term)) return 85;

  const idx = text.indexOf(term);
  if (idx >= 0) return 65 - Math.min(idx, 20);

  const maxDist = tolerance(term.length);
  if (maxDist === 0) return 0;

  let best = 0;
  // Match against whole words so a typo in one word of a multi-word field
  // ("pancke liquidity") still resolves.
  for (const word of text.split(/[\s\-_/&]+/)) {
    if (!word) continue;
    if (word.startsWith(term)) {
      best = Math.max(best, 70);
      continue;
    }
    const dist = levenshtein(term, word);
    if (dist <= maxDist) {
      // 1 typo → 45, 2 → 35, 3 → 25 — always below a real substring hit.
      best = Math.max(best, 55 - dist * 10);
    }
  }
  return best;
}

/** A searchable field and how much its matches count toward the total. */
export interface Field {
  text: string;
  weight?: number;
}

/**
 * Score a full query (possibly several whitespace-separated terms) against a
 * record's fields. Every term must match at least one field (AND semantics);
 * the returned score is the weighted sum of each term's best field match.
 * Returns `0` when any term fails to match — i.e. the record is filtered out.
 */
export function scoreFields(query: string, fields: Field[]): number {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;

  const norm = fields
    .filter((f) => f.text)
    .map((f) => ({ text: f.text.toLowerCase(), weight: f.weight ?? 1 }));
  if (norm.length === 0) return 0;

  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const f of norm) best = Math.max(best, termScore(term, f.text) * f.weight);
    if (best === 0) return 0; // this term matched nothing → drop the record
    total += best;
  }
  return total;
}

/**
 * Filter and rank `items` by how well they match `query`. Non-matching items
 * are dropped; the rest come back sorted best-first, capped at `limit`.
 */
export function rankByQuery<T>(
  query: string,
  items: readonly T[],
  getFields: (item: T) => Field[],
  limit = Infinity,
): T[] {
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const score = scoreFields(query, getFields(item));
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

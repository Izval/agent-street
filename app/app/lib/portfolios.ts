/**
 * Agent Portfolios — curated + (later) user-made SETS of agents.
 *
 * A "portfolio" here is a SET of agents (the "frequently bought together" /
 * "customers also bought" of the marketplace, over `hire`), NOT the onchain
 * holdings of a single agent — that is `PortfolioResponse` in contracts.ts.
 * Different concept, different types, different routes (`/portfolios`,
 * `/portfolio/:slug`). Keep them apart.
 *
 * Data rule (DESIGN.md §18): a portfolio never shows invented ROI/PnL. "Performs
 * well" is expressed with REAL signals only — 8004scan reputation (score /
 * verified / x402) aggregated across members, and (Phase B) first-party demand
 * counters. Everything nullable, real empty states.
 *
 * No IVL coupling (CLAUDE.md §2): curated recipes are defined by SUBCATEGORY
 * slots (any of the ~23, across the 7 categories) and resolve to real agents from
 * the 8004-proxy. No hard-coded agentIds, no FLAGSHIP_ID, no `if (isIVL)`. IVL
 * only appears if it is genuinely top-scored in its subcategory — by merit.
 *
 * Taxonomy: the marketplace has 7 categories (top-level) and ~23 subcategories.
 * The 4 mandatory hackathon subcategories are a SUBSET, not the universe — the
 * curated set below deliberately covers every category.
 */

import type { Agent, AgentsClient } from "./agents";
import {
  categoryOf,
  subcategoriesInCategory,
  subcategoryLabel,
  type Category,
  type Subcategory,
} from "./taxonomy";
import { accentForCategory } from "./cover";

// ---------------------------------------------------------------- //
// Types
// ---------------------------------------------------------------- //

export type PortfolioSource = "curated" | "user";

/** One slot of a curated recipe: pick `take` top agents from a subcategory. */
export interface PortfolioSlot {
  subcategory: Subcategory;
  /** How many members to draw from this subcategory. Default 1. */
  take?: number;
  /** Optional editorial note ("core LP engine", "risk guard", …). */
  label?: string;
}

/**
 * Curated recipe: a portfolio defined by taxonomy, not by frozen agentIds.
 * Resolved to real agents at load — always populated, real, IVL-agnostic.
 */
export interface PortfolioRecipe {
  slug: string;
  name: string;
  tagline: string;
  /** Seed for the generative cover (lib/cover.ts). Defaults to the slug. */
  coverKey?: string;
  /** CSS accent token. Defaults to the category accent of the first slot. */
  accent?: string;
  slots: PortfolioSlot[];
}

/** Discoverability of a user portfolio (mirrors the worker). */
export type PortfolioVisibility = "public" | "unlisted" | "private";

/** First-party gamification counters (Phase B). null when there's no backend/data. */
export interface PortfolioStats {
  views: number | null;
  copies: number | null;
  hireAlls: number | null;
  followers: number | null;
  /** Public heart/like count (per-device toggle). */
  likes: number | null;
}

/** Aggregate over the resolved members — REAL 8004scan fields only. */
export interface PortfolioAggregate {
  count: number;
  /** Mean of member scores. null if no member has a score. */
  avgScore: number | null;
  verifiedCount: number;
  x402Count: number;
  /** Diversity across the full taxonomy (category + subcategory). */
  subcategories: Array<{ id: Subcategory; label: string; n: number }>;
  categories: Array<{ id: Category; n: number }>;
}

/** A recipe (or user portfolio) resolved to real agents, ready to render. */
export interface ResolvedPortfolio {
  slug: string;
  name: string;
  tagline: string;
  description?: string;
  accent: string;
  coverKey: string;
  source: PortfolioSource;
  agents: Agent[];
  /** Slots/members the recipe wanted but the proxy had no live agent for. */
  missing: Array<{ subcategory: Subcategory | null; label: string }>;
  aggregate: PortfolioAggregate;
  creator?: { address: string; label?: string } | null;
  stats?: PortfolioStats | null;
  visibility?: PortfolioVisibility;
}

// ---------------------------------------------------------------- //
// Curated recipes — cover ALL 7 categories (equal depth, not just the 4 mandatory)
// ---------------------------------------------------------------- //

export const PORTFOLIO_RECIPES: PortfolioRecipe[] = [
  {
    slug: "defi-core",
    name: "DeFi Core",
    tagline: "Rebalancing, yield and health — the DeFi triad working together.",
    slots: [
      { subcategory: "rebalancing", take: 1, label: "LP range engine" },
      { subcategory: "yield", take: 1, label: "Yield router" },
      { subcategory: "health", take: 1, label: "Liquidation guard" },
    ],
  },
  {
    slug: "range-and-rebalance",
    name: "Range & Rebalance",
    tagline: "Keep concentrated liquidity in range and trade the swings around it.",
    slots: [
      { subcategory: "rebalancing", take: 2, label: "CLMM rebalancers" },
      { subcategory: "grid", take: 1, label: "Grid around the range" },
    ],
  },
  {
    slug: "active-trader",
    name: "Active Trader",
    tagline: "Grid, DCA and momentum — an execution desk for sideways and trending markets.",
    slots: [
      { subcategory: "grid", take: 1 },
      { subcategory: "dca", take: 1 },
      { subcategory: "momentum", take: 1 },
    ],
  },
  {
    slug: "yield-and-staking",
    name: "Yield & Staking",
    tagline: "Set-and-forget passive income across yield, lending and liquid staking.",
    slots: [
      { subcategory: "yield", take: 1 },
      { subcategory: "lending", take: 1 },
      { subcategory: "liquid-staking", take: 1 },
    ],
  },
  {
    slug: "nft-flipper",
    name: "NFT Flipper",
    tagline: "Sweep floors, catch mints, and read the data that moves collections.",
    slots: [
      { subcategory: "nft-floor", take: 1 },
      { subcategory: "nft-mint", take: 1 },
      { subcategory: "infra-data", take: 1, label: "Market data" },
    ],
  },
  {
    slug: "rwa-treasury",
    name: "RWA Treasury",
    tagline: "Park capital in tokenized treasuries and real-world assets, with a yield leg.",
    slots: [
      { subcategory: "rwa-treasury", take: 1 },
      { subcategory: "rwa-assets", take: 1 },
      { subcategory: "yield", take: 1, label: "On-chain yield leg" },
    ],
  },
  {
    slug: "agent-economy",
    name: "Agent Economy",
    tagline: "x402 payments, ERC-8183 job agents and automation — agents hiring agents.",
    slots: [
      { subcategory: "payments-x402", take: 1 },
      { subcategory: "payments-jobs", take: 1 },
      { subcategory: "infra-automation", take: 1 },
    ],
  },
  {
    slug: "signals-to-trades",
    name: "Signals to Trades",
    tagline: "Turn onchain signals and narratives into momentum trades.",
    slots: [
      { subcategory: "social-signals", take: 1 },
      { subcategory: "social-narratives", take: 1 },
      { subcategory: "momentum", take: 1, label: "Execution" },
    ],
  },
  {
    slug: "automation-stack",
    name: "Automation Stack",
    tagline: "Wire up data, payments and workflows so the rest runs itself.",
    slots: [
      { subcategory: "infra-automation", take: 1 },
      { subcategory: "payments-jobs", take: 1 },
      { subcategory: "infra-data", take: 1 },
    ],
  },
];

export function getRecipe(slug: string): PortfolioRecipe | null {
  return PORTFOLIO_RECIPES.find((r) => r.slug === slug) ?? null;
}

// ---------------------------------------------------------------- //
// Resolution — recipes → real agents (from the 8004-proxy)
// ---------------------------------------------------------------- //

/** Merit ranking: real score first, then real demand (feedbacks, stars). */
function rankAgents(list: Agent[]): Agent[] {
  return [...list].sort(
    (a, b) => b.score - a.score || b.feedbacks - a.feedbacks || b.stars - a.stars,
  );
}

/** Candidate pool size per subcategory (enough to survive cross-slot dedup). */
const POOL_LIMIT = 12;

/**
 * Fetch one ranked pool per distinct subcategory, in parallel. Reused across
 * every recipe in a page so we never hit the proxy twice for the same subcategory.
 */
export async function fetchSubcategoryPools(
  agents: AgentsClient,
  subcategories: Subcategory[],
): Promise<Map<Subcategory, Agent[]>> {
  const distinct = [...new Set(subcategories)];
  const pools = await Promise.all(
    distinct.map((subcategory) =>
      agents
        .list({ subcategory, limit: POOL_LIMIT })
        .then((p) => rankAgents(p.agents))
        .catch(() => [] as Agent[]),
    ),
  );
  return new Map(distinct.map((c, i) => [c, pools[i]]));
}

function aggregate(members: Agent[]): PortfolioAggregate {
  const scored = members.filter((a) => Number.isFinite(a.score) && a.score > 0);
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((s, a) => s + a.score, 0) / scored.length) * 10) / 10
      : null;

  const catCounts = new Map<Subcategory, number>();
  const categoryCounts = new Map<Category, number>();
  for (const a of members) {
    if (a.subcategory) {
      catCounts.set(a.subcategory, (catCounts.get(a.subcategory) ?? 0) + 1);
      const ais = categoryOf(a.subcategory);
      if (ais) categoryCounts.set(ais, (categoryCounts.get(ais) ?? 0) + 1);
    }
  }

  return {
    count: members.length,
    avgScore,
    verifiedCount: members.filter((a) => a.isVerified).length,
    x402Count: members.filter((a) => a.x402Supported).length,
    subcategories: [...catCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([id, n]) => ({ id, label: subcategoryLabel(id), n })),
    categories: [...categoryCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([id, n]) => ({ id, n })),
  };
}

/** Compose one recipe from already-fetched subcategory pools (dedup across slots). */
export function composeRecipe(
  recipe: PortfolioRecipe,
  pools: Map<Subcategory, Agent[]>,
): ResolvedPortfolio {
  const picked: Agent[] = [];
  const seen = new Set<string>();
  const missing: Array<{ subcategory: Subcategory; label: string }> = [];

  for (const slot of recipe.slots) {
    const pool = pools.get(slot.subcategory) ?? [];
    const want = slot.take ?? 1;
    let got = 0;
    for (const a of pool) {
      if (got >= want) break;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      picked.push(a);
      got++;
    }
    if (got === 0) {
      missing.push({ subcategory: slot.subcategory, label: subcategoryLabel(slot.subcategory) });
    }
  }

  const firstCategory = categoryOf(recipe.slots[0]?.subcategory ?? ("rebalancing" as Subcategory));
  return {
    slug: recipe.slug,
    name: recipe.name,
    tagline: recipe.tagline,
    accent: recipe.accent ?? accentForCategory(firstCategory),
    coverKey: recipe.coverKey ?? `portfolio-${recipe.slug}`,
    source: "curated",
    agents: picked,
    missing,
    aggregate: aggregate(picked),
    creator: null,
    stats: null,
  };
}

/** Resolve many recipes efficiently (one proxy call per distinct subcategory). */
export async function resolvePortfolios(
  recipes: PortfolioRecipe[],
  agents: AgentsClient,
): Promise<ResolvedPortfolio[]> {
  const cats = recipes.flatMap((r) => r.slots.map((s) => s.subcategory));
  const pools = await fetchSubcategoryPools(agents, cats);
  return recipes.map((r) => composeRecipe(r, pools));
}

/** Resolve a single recipe. */
export async function resolveRecipe(
  recipe: PortfolioRecipe,
  agents: AgentsClient,
): Promise<ResolvedPortfolio> {
  const [resolved] = await resolvePortfolios([recipe], agents);
  return resolved;
}

// ---------------------------------------------------------------- //
// User portfolios — explicit member agentIds → ResolvedPortfolio
// ---------------------------------------------------------------- //

/** Minimal shape of a stored user portfolio (mirrors portfolios-client). */
export interface UserPortfolioInput {
  slug: string;
  name: string;
  tagline: string;
  members: Array<{ agentId: string; note?: string }>;
  creator?: { address: string; label?: string } | null;
  createdAt?: string;
  stats?: PortfolioStats | null;
  visibility?: PortfolioVisibility;
}

/**
 * Resolve a user portfolio by fetching each member from the 8004-proxy. Members
 * that don't resolve (delisted, wrong id) are reported in `missing` —
 * never a placeholder. Aggregate is the same real-8004scan computation.
 */
export async function resolveUserPortfolio(
  pf: UserPortfolioInput,
  agents: AgentsClient,
): Promise<ResolvedPortfolio> {
  const fetched = await Promise.all(pf.members.map((m) => agents.get(m.agentId).catch(() => null)));
  const picked: Agent[] = [];
  const missing: Array<{ subcategory: Subcategory | null; label: string }> = [];
  fetched.forEach((a, i) => {
    if (a) picked.push(a);
    else missing.push({ subcategory: null, label: pf.members[i].agentId });
  });

  const firstCategory = picked[0]?.subcategory ? categoryOf(picked[0].subcategory) : null;
  return {
    slug: pf.slug,
    name: pf.name,
    tagline: pf.tagline,
    accent: accentForCategory(firstCategory),
    coverKey: `portfolio-${pf.slug}`,
    source: "user",
    agents: picked,
    missing,
    aggregate: aggregate(picked),
    creator: pf.creator ?? null,
    stats: pf.stats ?? null,
    visibility: pf.visibility,
  };
}

// ---------------------------------------------------------------- //
// "Pairs well with" — complementary subcategories for the agent page.
// Real RECOMMENDATION (not a co-hire claim; that's the affinity engine).
// ---------------------------------------------------------------- //

/** Complementary subcategories per subcategory. Absent → falls back to same category. */
const PAIRS_WITH: Partial<Record<Subcategory, Subcategory[]>> = {
  rebalancing: ["grid", "health", "yield"],
  grid: ["rebalancing", "momentum", "dca"],
  yield: ["health", "lending", "liquid-staking"],
  health: ["rebalancing", "yield", "lending"],
  lending: ["yield", "health"],
  "liquid-staking": ["yield", "rebalancing"],
  dca: ["grid", "momentum"],
  momentum: ["social-signals", "grid"],
  "copy-trade": ["momentum", "social-signals"],
  "market-making": ["grid", "rebalancing"],
  perps: ["momentum", "health"],
  "payments-x402": ["payments-jobs", "infra-automation"],
  "payments-jobs": ["payments-x402", "infra-automation"],
  "infra-data": ["infra-automation", "social-signals"],
  "infra-automation": ["infra-data", "payments-x402"],
  "social-signals": ["momentum", "social-narratives"],
  "social-narratives": ["social-signals", "momentum"],
  "nft-floor": ["nft-mint", "infra-data"],
  "nft-mint": ["nft-floor", "infra-data"],
  "rwa-assets": ["rwa-treasury", "yield"],
  "rwa-treasury": ["rwa-assets", "yield"],
};

/** Complementary subcategories to suggest alongside `subcategory`. */
export function pairsWith(subcategory: Subcategory): Subcategory[] {
  const explicit = PAIRS_WITH[subcategory];
  if (explicit && explicit.length > 0) return explicit;
  // Fallback: same-category siblings (excluding self).
  const ais = categoryOf(subcategory);
  if (!ais) return [];
  return subcategoriesInCategory(ais)
    .map((c) => c.id)
    .filter((c) => c !== subcategory);
}

/**
 * Real complementary agents for the "Pairs well with" rail. Pulls top agents
 * from the complementary subcategories, dedups, and drops `excludeId`.
 */
export async function fetchPairsWith(
  agents: AgentsClient,
  subcategory: Subcategory,
  excludeId: string,
  limit = 8,
): Promise<Agent[]> {
  const cats = pairsWith(subcategory);
  if (cats.length === 0) return [];
  const pools = await fetchSubcategoryPools(agents, cats);
  const out: Agent[] = [];
  const seen = new Set<string>([excludeId]);
  // Round-robin across complementary subcategories for variety.
  const lists = cats.map((c) => pools.get(c) ?? []);
  for (let i = 0; out.length < limit; i++) {
    let progressed = false;
    for (const list of lists) {
      const a = list[i];
      if (!a) continue;
      progressed = true;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
      if (out.length >= limit) break;
    }
    if (!progressed) break;
  }
  return out;
}

/**
 * Fallback recommendations: peers from the SAME category (the union of its
 * subcategories), ranked and round-robined for variety. Used when an agent has
 * no subcategory (so `fetchPairsWith` has nothing complementary to pull) — every
 * agent belongs to a category, so the "Pairs well with" rail is never empty.
 */
export async function fetchCategoryPeers(
  agents: AgentsClient,
  category: Category,
  excludeId: string,
  limit = 8,
): Promise<Agent[]> {
  const subs = subcategoriesInCategory(category).map((c) => c.id);
  if (subs.length === 0) return [];
  const pools = await fetchSubcategoryPools(agents, subs);
  const out: Agent[] = [];
  const seen = new Set<string>([excludeId]);
  const lists = subs.map((s) => pools.get(s) ?? []);
  for (let i = 0; out.length < limit; i++) {
    let progressed = false;
    for (const list of lists) {
      const a = list[i];
      if (!a) continue;
      progressed = true;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
      if (out.length >= limit) break;
    }
    if (!progressed) break;
  }
  return out;
}

/**
 * Last-resort recommendations: the top-ranked agents in the corpus. Used when an
 * agent has neither a subcategory nor a category (the classifier matched no
 * keyword), so the "Pairs well with" rail still shows real, reputation-ranked
 * agents instead of nothing.
 */
export async function fetchPopularPeers(
  agents: AgentsClient,
  excludeId: string,
  limit = 8,
): Promise<Agent[]> {
  const page = await agents.list({ limit: limit + 4 }).catch(() => null);
  if (!page) return [];
  return rankAgents(page.agents)
    .filter((a) => a.id !== excludeId)
    .slice(0, limit);
}

/**
 * Client for the portfolios Worker (workers/portfolios) — user-made portfolios,
 * first-party gamification counters, leaderboard, and "frequently hired
 * together" affinity.
 *
 * Mirrors the Worker's output types by hand (separate packages, no cross-import),
 * exactly like lib/trending.ts mirrors the analytics Worker. Every call degrades
 * to `null`/`[]` if the Worker is unreachable — the marketplace works without it
 * (curated portfolios resolve app-side from the 8004-proxy).
 */

import type { PortfolioStats } from "./portfolios";
import type { Subcategory } from "./taxonomy";

export interface UserPortfolioMember {
  agentId: string;
  note?: string;
}

export interface UserPortfolio {
  slug: string;
  name: string;
  tagline: string;
  members: UserPortfolioMember[];
  creator: { address: string; label?: string } | null;
  createdAt: string;
  stats: PortfolioStats;
  source: "user";
}

export interface CreatePortfolioInput {
  name: string;
  tagline: string;
  members: UserPortfolioMember[];
  creator?: { address: string; label?: string } | null;
}

export interface CreatePortfolioResult {
  slug: string;
  /** Secret to edit/delete later. Store client-side (never rendered). */
  ownerSecret: string;
}

export type PortfolioEvent = "view" | "copy" | "hire_all" | "follow" | "unfollow";
export type LeaderboardWindow = "7d" | "30d" | "all";

export interface LeaderboardRow {
  slug: string;
  name: string;
  tagline: string;
  copies: number;
  hireAlls: number;
  views: number;
  creator: { address: string; label?: string } | null;
}

export interface AffinityRow {
  agentId: string;
  name: string;
  imageUrl?: string | null;
  subcategory: Subcategory | null;
  subcategoryLabel: string | null;
  /** Wallets that hired both this agent and the anchor agent (real co-hires). */
  coHires: number;
}

export interface AffinityResponse {
  agentId: string;
  rows: AffinityRow[];
  updatedAt: string;
  source: "demand";
}

export function createPortfoliosClient(opts: {
  baseUrl: string | undefined;
  signal?: AbortSignal;
  /** Service binding for server-side calls (worker-to-worker over *.workers.dev loops back). */
  fetcher?: Fetcher;
}) {
  const base = (opts.baseUrl ?? "").replace(/\/$/, "");
  const doFetch: typeof fetch = opts.fetcher
    ? (opts.fetcher.fetch.bind(opts.fetcher) as typeof fetch)
    : fetch;
  const enabled = base.length > 0 || Boolean(opts.fetcher);

  async function getJson<T>(path: string): Promise<T | null> {
    if (!enabled) return null;
    try {
      const res = await doFetch(`${base}${path}`, {
        signal: opts.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  return {
    baseUrl: base,

    /** User/trending/owner portfolios. null if the worker doesn't respond. */
    list(
      params: { scope?: "user" | "trending"; owner?: string; limit?: number } = {},
    ): Promise<UserPortfolio[] | null> {
      const p = new URLSearchParams();
      if (params.scope) p.set("scope", params.scope);
      if (params.owner) p.set("owner", params.owner);
      if (params.limit) p.set("limit", String(params.limit));
      const qs = p.toString();
      return getJson<{ portfolios: UserPortfolio[] }>(
        `/v1/portfolios${qs ? `?${qs}` : ""}`,
      ).then((r) => r?.portfolios ?? null);
    },

    /** One user portfolio (public). null if not found / worker down. */
    get(slug: string): Promise<UserPortfolio | null> {
      return getJson<UserPortfolio>(`/v1/portfolios/${encodeURIComponent(slug)}`);
    },

    /** Publish a user portfolio. null if the worker is unavailable. */
    async create(input: CreatePortfolioInput): Promise<CreatePortfolioResult | null> {
      if (!enabled) return null;
      try {
        const res = await doFetch(`${base}/v1/portfolios`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(input),
          signal: opts.signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as CreatePortfolioResult;
      } catch {
        return null;
      }
    },

    /** Delete a portfolio the caller owns (needs the owner secret). */
    async remove(slug: string, ownerSecret: string): Promise<boolean> {
      if (!enabled) return false;
      try {
        const res = await doFetch(`${base}/v1/portfolios/${encodeURIComponent(slug)}`, {
          method: "DELETE",
          headers: { "x-owner-secret": ownerSecret },
          signal: opts.signal,
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    /** Record a first-party event (best-effort; ignores errors). */
    async event(slug: string, type: PortfolioEvent): Promise<void> {
      if (!enabled) return;
      try {
        await doFetch(`${base}/v1/portfolios/${encodeURIComponent(slug)}/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type }),
          signal: opts.signal,
        });
      } catch {
        /* best-effort */
      }
    },

    /** Portfolio leaderboard by a gamification metric + time window. */
    leaderboard(
      params: { metric?: "copies" | "hires" | "views"; window?: LeaderboardWindow; limit?: number } = {},
    ): Promise<LeaderboardRow[] | null> {
      const p = new URLSearchParams();
      if (params.metric) p.set("metric", params.metric);
      if (params.window) p.set("window", params.window);
      if (params.limit) p.set("limit", String(params.limit));
      const qs = p.toString();
      return getJson<{ rows: LeaderboardRow[] }>(
        `/v1/portfolios/leaderboard${qs ? `?${qs}` : ""}`,
      ).then((r) => r?.rows ?? null);
    },

    /** "Frequently hired together" for an anchor agent (real co-hires). */
    affinity(agentId: string): Promise<AffinityResponse | null> {
      return getJson<AffinityResponse>(`/v1/affinity/${encodeURIComponent(agentId)}`);
    },
  };
}

export type PortfoliosClient = ReturnType<typeof createPortfoliosClient>;

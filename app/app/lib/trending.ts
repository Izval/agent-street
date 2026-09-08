/**
 * Demand engine client (workers/analytics) — trending by VIEWS + HIRES that we
 * count ourselves. Real %change/rankDelta (first-party data).
 *
 * Degrades to null if the worker doesn't respond (the rail shows an honest empty
 * state: "not enough demand data yet", never invented figures).
 */

import type {
  TrendingResponse,
  TrendingRow,
  TrendingMetric,
  TrendingWindow,
  UsageSeries,
} from "./contracts";
import type { Agent } from "./agents";

export function createTrendingClient(opts: {
  baseUrl: string;
  signal?: AbortSignal;
  /** Service binding to the analytics worker for server-side calls (same-account
   * worker-to-worker over *.workers.dev loops back and 404s). Omit in the browser,
   * where a plain fetch to the worker is a normal external request. */
  fetcher?: Fetcher;
}) {
  const base = opts.baseUrl.replace(/\/$/, "");

  /**
   * Resilient fetch: try the service binding first (the only path that works in a
   * deployed Worker — a direct fetch to *.workers.dev loops back and 404s), and on
   * a throw OR non-ok response fall back to a plain external fetch (which works in
   * `react-router dev`, where the binding can't reach the deployed worker).
   */
  async function doFetch(url: string, init?: RequestInit): Promise<Response> {
    const merged: RequestInit = {
      signal: opts.signal,
      ...init,
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
    };
    if (opts.fetcher) {
      try {
        const res = await opts.fetcher.fetch(url, merged);
        if (res.ok) return res;
      } catch {
        /* binding unusable (e.g. dev) → direct fetch below */
      }
    }
    return fetch(url, merged);
  }

  return {
    baseUrl: base,
    /** Top agents by demand. null if the worker doesn't respond. */
    async trending(
      params: { metric?: TrendingMetric; window?: TrendingWindow; subcategory?: string; limit?: number } = {},
    ): Promise<TrendingResponse | null> {
      const url = new URL(`${base}/v1/trending`);
      if (params.metric) url.searchParams.set("metric", params.metric);
      if (params.window) url.searchParams.set("window", params.window);
      if (params.subcategory) url.searchParams.set("subcategory", params.subcategory);
      if (params.limit) url.searchParams.set("limit", String(params.limit));
      try {
        const res = await doFetch(url.toString());
        if (!res.ok) return null;
        return (await res.json()) as TrendingResponse;
      } catch {
        return null;
      }
    },
    /** Per-agent demand over time (usage chart). null if the worker is down. */
    async series(
      agentId: string,
      params: { window?: TrendingWindow } = {},
    ): Promise<UsageSeries | null> {
      const url = new URL(`${base}/v1/series/${encodeURIComponent(agentId)}`);
      if (params.window) url.searchParams.set("window", params.window);
      try {
        const res = await doFetch(url.toString());
        if (!res.ok) return null;
        return (await res.json()) as UsageSeries;
      } catch {
        return null;
      }
    },

    /** Records a demand event (view/hire). Best-effort; ignores errors. */
    async event(agentId: string, type: "view" | "hire"): Promise<void> {
      try {
        await doFetch(`${base}/v1/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId, type }),
        });
      } catch {
        /* best-effort */
      }
    },
  };
}

/** On-chain metric a "reputation" ranking can be built from (all real 8004scan). */
export type ReputationBasis = "score" | "feedbacks" | "stars";

const BASIS: Record<ReputationBasis, { label: string; pick: (a: Agent) => number }> = {
  score: { label: "on-chain score", pick: (a) => Math.round(a.score) },
  feedbacks: { label: "reviews", pick: (a) => a.feedbacks },
  stars: { label: "stars", pick: (a) => a.stars },
};

/**
 * Persistent fallback for the Trending rail. First-party demand (views + hires)
 * takes time to accumulate, so when it's thin we rank the top agents by a REAL
 * on-chain metric (8004scan) instead of showing an empty rail. The
 * `source: "reputation"` label keeps it honest — these are never presented as
 * demand figures. `basis` lets each tab rank by a different real signal so the
 * lists are distinct (score / reviews / stars).
 */
export function reputationTrending(
  agents: Agent[],
  params: { window: TrendingWindow; limit?: number; basis?: ReputationBasis },
): TrendingResponse {
  const { label, pick } = BASIS[params.basis ?? "score"];
  const rows: TrendingRow[] = [...agents]
    .sort((x, y) => pick(y) - pick(x))
    .slice(0, params.limit ?? 8)
    .map((a) => ({
      agentId: a.id,
      name: a.name,
      imageUrl: a.imageUrl ?? null,
      subcategory: a.subcategory,
      subcategoryLabel: a.subcategoryLabel,
      count: pick(a),
      deltaPct: null,
      rankDelta: null,
      spark: [],
      verified: a.isVerified,
    }));
  return {
    window: params.window,
    // metric is irrelevant to a reputation ranking; kept for shape compatibility.
    metric: "views",
    rows,
    updatedAt: new Date().toISOString(),
    source: "reputation",
    basisLabel: label,
  };
}

export type TrendingClient = ReturnType<typeof createTrendingClient>;

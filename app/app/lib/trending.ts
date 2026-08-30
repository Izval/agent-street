/**
 * Demand engine client (workers/analytics) — trending by VIEWS + HIRES that we
 * count ourselves. Real %change/rankDelta (first-party data).
 *
 * Degrades to null if the worker doesn't respond (the rail shows an honest empty
 * state: "not enough demand data yet", never invented figures).
 */

import type { TrendingResponse, TrendingMetric, TrendingWindow } from "./contracts";

export function createTrendingClient(opts: { baseUrl: string; signal?: AbortSignal }) {
  const base = opts.baseUrl.replace(/\/$/, "");
  return {
    baseUrl: base,
    /** Top agents by demand. null if the worker doesn't respond. */
    async trending(
      params: { metric?: TrendingMetric; window?: TrendingWindow; category?: string; limit?: number } = {},
    ): Promise<TrendingResponse | null> {
      const url = new URL(`${base}/v1/trending`);
      if (params.metric) url.searchParams.set("metric", params.metric);
      if (params.window) url.searchParams.set("window", params.window);
      if (params.category) url.searchParams.set("category", params.category);
      if (params.limit) url.searchParams.set("limit", String(params.limit));
      try {
        const res = await fetch(url.toString(), {
          signal: opts.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return null;
        return (await res.json()) as TrendingResponse;
      } catch {
        return null;
      }
    },
    /** Records a demand event (view/hire). Best-effort; ignores errors. */
    async event(agentId: string, type: "view" | "hire"): Promise<void> {
      try {
        await fetch(`${base}/v1/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId, type }),
          signal: opts.signal,
        });
      } catch {
        /* best-effort */
      }
    },
  };
}

export type TrendingClient = ReturnType<typeof createTrendingClient>;

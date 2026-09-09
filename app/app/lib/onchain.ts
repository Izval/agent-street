/**
 * Onchain indexer Worker client (workers/onchain-indexer) — REAL data from the
 * `agent_wallet` on BSC. Consumes the shapes from `contracts.ts`.
 *
 * Honesty (DESIGN.md v2 §18): portfolio (balances×price), allocation and trades
 * are real onchain data. Derived metrics that require NAV history (PnL, drawdown,
 * win-rate, equity curve) stay `null` in v1 and are labeled "since indexed" —
 * they are never invented nor presented as exact.
 */

import type {
  PortfolioResponse,
  TradesResponse,
  PortfolioMetrics,
} from "./contracts";

async function getJson<T>(
  doFetch: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<T | null> {
  try {
    const res = await doFetch(url, { signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function createOnchainClient(opts: {
  baseUrl: string;
  signal?: AbortSignal;
  /** Service binding to the onchain-indexer worker (same-account worker-to-worker
   * over *.workers.dev loops back and 404s; falls back to fetch in local dev). */
  fetcher?: Fetcher;
}) {
  const base = opts.baseUrl.replace(/\/$/, "");
  const doFetch: typeof fetch = opts.fetcher
    ? (opts.fetcher.fetch.bind(opts.fetcher) as typeof fetch)
    : fetch;
  return {
    baseUrl: base,
    /** Real portfolio (balances + allocation + value). null if the indexer doesn't respond. */
    portfolio: (address: string) =>
      getJson<PortfolioResponse>(
        doFetch,
        `${base}/v1/portfolio/${encodeURIComponent(address)}`,
        opts.signal,
      ),
    /** Recent onchain activity (swaps + v3 liquidity mints/burns) on one chain.
     *  `chain` (56 mainnet · 97 testnet) — the agent can be active on both, so the
     *  caller queries each chain and merges. null if the indexer doesn't respond. */
    trades: (address: string, chain?: number) =>
      getJson<TradesResponse>(
        doFetch,
        `${base}/v1/trades/${encodeURIComponent(address)}${chain ? `?chain=${chain}` : ""}`,
        opts.signal,
      ),
  };
}

export type OnchainClient = ReturnType<typeof createOnchainClient>;

/**
 * Portfolio metrics (best-effort, labeled). In v1 only `totalUsd` and
 * `tradeCount` are real; the rest requires NAV history → `null` +
 * `since` (the UI shows "—" / "since indexed", without fabricating figures).
 */
export function deriveMetrics(
  portfolio: PortfolioResponse | null,
  trades: TradesResponse | null,
): PortfolioMetrics | null {
  if (!portfolio && !trades) return null;
  const since =
    trades?.trades.length ? trades.trades[trades.trades.length - 1].ts : null;
  return {
    totalUsd: portfolio?.totalUsd ?? 0,
    pnlUsd: null,
    pnlPct: null,
    dailyPnlUsd: null,
    maxDrawdownPct: null,
    winRatePct: null,
    tradeCount: trades?.count ?? 0,
    derived: true,
    since,
  };
}

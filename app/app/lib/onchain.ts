/**
 * Cliente del Worker indexer onchain (workers/onchain-indexer) — datos REALES
 * del `agent_wallet` en BSC. Consume las formas de `contracts.ts`.
 *
 * Honestidad (DESIGN.md v2 §18): portfolio (balances×precio), allocation y trades
 * son dato onchain real. Las métricas derivadas que requieren histórico de NAV
 * (PnL, drawdown, win-rate, equity curve) quedan `null` en v1 y se rotulan
 * "since indexed" — nunca se inventan ni se presentan como exactas.
 */

import type {
  PortfolioResponse,
  TradesResponse,
  PortfolioMetrics,
} from "./contracts";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function createOnchainClient(opts: { baseUrl: string; signal?: AbortSignal }) {
  const base = opts.baseUrl.replace(/\/$/, "");
  return {
    baseUrl: base,
    /** Portfolio real (balances + allocation + valor). null si el indexer no responde. */
    portfolio: (address: string) =>
      getJson<PortfolioResponse>(
        `${base}/v1/portfolio/${encodeURIComponent(address)}`,
        opts.signal,
      ),
    /** Swaps recientes onchain. null si el indexer no responde. */
    trades: (address: string) =>
      getJson<TradesResponse>(
        `${base}/v1/trades/${encodeURIComponent(address)}`,
        opts.signal,
      ),
  };
}

export type OnchainClient = ReturnType<typeof createOnchainClient>;

/**
 * Métricas del portfolio (best-effort, etiquetadas). En v1 solo `totalUsd` y
 * `tradeCount` son reales; el resto requiere histórico de NAV → `null` +
 * `since` (la UI muestra "—" / "since indexed", sin fabricar cifras).
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

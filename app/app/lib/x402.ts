/**
 * x402 hire flow client (Phase 3). Modeled on the factories in
 * `onchain.ts` / `trending.ts`. Everything runs server-side (loader/action of
 * the `/hire` route), so the cross-origin probe to the agent's endpoint doesn't
 * clash with CORS.
 *
 * Division of responsibilities (hard rule, see CLAUDE.md §2 and the plan):
 *   - QUOTE (HTTP 402 probe) → done by the front-end here. Real data from the agent.
 *   - PAYMENT (EIP-3009 signature + onchain settlement) → executed by the backend/SDK
 *     (`bag x402 buy`) behind the `HIRE_X402_URL` seam. Only consumed here.
 *
 * Honesty (DESIGN.md v2 §18): if the endpoint doesn't speak x402 or the seam
 * doesn't respond, `null` is returned — never an invented price or tx hash.
 */

import type { X402Accept, HireQuote, HireReceipt } from "./contracts";

/** Default symbols for known payment assets on BSC (for the label). */
const KNOWN_ASSETS: Record<string, { symbol: string; decimals: number }> = {
  // USDT BSC mainnet
  "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", decimals: 18 },
  // USDC BSC mainnet
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", decimals: 18 },
  // USDT BSC testnet
  "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd": { symbol: "USDT", decimals: 18 },
};

/** De-scales an amount in base units to a human number, without overflow. */
function scaleDown(raw: string, decimals: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const s = raw.padStart(decimals + 1, "0");
  const cut = s.length - decimals;
  const intPart = s.slice(0, cut) || "0";
  const fracPart = s.slice(cut).replace(/0+$/, "");
  const n = Number(fracPart ? `${intPart}.${fracPart}` : intPart);
  return Number.isFinite(n) ? n : null;
}

/** Normalizes an `accepts[i]` item from the 402 response to `X402Accept`. */
function toAccept(raw: unknown): X402Accept | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const asset = typeof r.asset === "string" ? r.asset : "";
  const payTo = typeof r.payTo === "string" ? r.payTo : "";
  const maxAmountRequired =
    typeof r.maxAmountRequired === "string" ? r.maxAmountRequired : "";
  if (!asset || !payTo || !maxAmountRequired) return null;
  return {
    scheme: typeof r.scheme === "string" ? r.scheme : "exact",
    network: typeof r.network === "string" ? r.network : "bsc",
    maxAmountRequired,
    asset,
    payTo,
    resource: typeof r.resource === "string" ? r.resource : "",
    description: typeof r.description === "string" ? r.description : undefined,
    mimeType: typeof r.mimeType === "string" ? r.mimeType : undefined,
    maxTimeoutSeconds:
      typeof r.maxTimeoutSeconds === "number" ? r.maxTimeoutSeconds : undefined,
    extra:
      r.extra && typeof r.extra === "object"
        ? (r.extra as Record<string, unknown>)
        : null,
  };
}

/** Derives the asset's symbol/decimals from `extra` or the known table. */
function assetMeta(accept: X402Accept): { symbol: string | null; decimals: number } {
  const extra = accept.extra ?? {};
  const known = KNOWN_ASSETS[accept.asset.toLowerCase()];
  const symbol =
    (typeof extra.symbol === "string" && extra.symbol) ||
    known?.symbol ||
    null;
  const decimals =
    (typeof extra.decimals === "number" && extra.decimals) ||
    known?.decimals ||
    18;
  return { symbol, decimals };
}

/** Builds a `HireQuote` from the chosen accept + task. */
function toQuote(accept: X402Accept, taskFallback: string): HireQuote {
  const { symbol, decimals } = assetMeta(accept);
  return {
    task: accept.description || accept.resource || taskFallback,
    amount: scaleDown(accept.maxAmountRequired, decimals),
    assetSymbol: symbol,
    assetAddress: accept.asset,
    network: accept.network,
    payTo: accept.payTo,
    expirySeconds: accept.maxTimeoutSeconds ?? null,
    accept,
    source: "x402",
  };
}

export interface HireClientOptions {
  /** Payment execution seam (env.HIRE_X402_URL). */
  payUrl: string;
  signal?: AbortSignal;
}

export function createHireClient(opts: HireClientOptions) {
  const payBase = opts.payUrl.replace(/\/$/, "");

  /**
   * HTTP 402 probe to the agent's endpoint. Returns the real quote or null if the
   * endpoint doesn't speak x402 / doesn't respond. `taskFallback` describes the task.
   */
  async function probeQuote(
    endpoint: string,
    taskFallback = "Rebalance LP (BNB-USDT)",
  ): Promise<HireQuote | null> {
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: opts.signal,
      });
      // x402: the paid resource responds 402 with { accepts: [...] }.
      if (res.status !== 402) return null;
      const body = (await res.json().catch(() => null)) as
        | { accepts?: unknown[] }
        | null;
      const list = Array.isArray(body?.accepts) ? body!.accepts : [];
      for (const item of list) {
        const accept = toAccept(item);
        if (accept) return toQuote(accept, taskFallback);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Quote from our own facilitator (when the agent's endpoint doesn't speak x402).
   * GET `${payBase}/v1/quote?agent=:id` responds 402 with the listing's `accept`
   * (marketplace pricing, honest). Returns null if it can't be quoted
   * (e.g. the agent doesn't expose an onchain payment wallet → 409).
   */
  async function facilitatorQuote(
    agentId: string,
    taskFallback = "Rebalance LP (BNB-USDT)",
  ): Promise<HireQuote | null> {
    try {
      const res = await fetch(
        `${payBase}/v1/quote?agent=${encodeURIComponent(agentId)}`,
        { method: "GET", headers: { accept: "application/json" }, signal: opts.signal },
      );
      if (res.status !== 402) return null;
      const body = (await res.json().catch(() => null)) as
        | { accepts?: unknown[] }
        | null;
      const list = Array.isArray(body?.accepts) ? body!.accepts : [];
      for (const item of list) {
        const accept = toAccept(item);
        if (accept) return toQuote(accept, taskFallback);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Verifies the payment (client-pays): the user already sent the real transfer to
   * `payTo` from their wallet; here we send the `txHash` to the seam, which verifies
   * it onchain and returns the canonical receipt. null if the seam doesn't respond.
   */
  async function pay(input: {
    agentId: string;
    agentName?: string | null;
    endpoint: string;
    accept: X402Accept;
    task: string;
    txHash: string;
    from?: string | null;
  }): Promise<HireReceipt | null> {
    try {
      const res = await fetch(`${payBase}/v1/hire`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input),
        signal: opts.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as HireReceipt;
    } catch {
      return null;
    }
  }

  return { payUrl: payBase, probeQuote, facilitatorQuote, pay };
}

export type HireClient = ReturnType<typeof createHireClient>;

/**
 * Data contracts v2 (WS0.2) — the interface between layers. The Wave 1
 * instances build AGAINST these shapes:
 *   - WS1.2 (onchain indexer) returns `PortfolioResponse` and `TradesResponse`.
 *   - WS1.3 (front-end clients) assembles `AgentDetail` = Agent + onchain +
 *     reputation + services, and computes `PortfolioMetrics` (best-effort, labeled).
 *
 * Honesty rule: derived/approximate fields are nullable and carry
 * `derived`/`since`. Nothing estimated is presented as exact (DESIGN.md v2 §18).
 */

import type { Agent } from "./agents";
import type { Aisle, Category, TemplateKind } from "./taxonomy";

// ---------------------------------------------------------------- //
// Trending by our own demand (WS Wave B) — views + hires that we
// count ourselves; %change and rankDelta are REAL (first-party data).
// ---------------------------------------------------------------- //

export type TrendingMetric = "views" | "hires";
export type TrendingWindow = "1h" | "24h" | "7d";

export interface TrendingRow {
  agentId: string; // token_id (for /agent/:id)
  name: string;
  imageUrl?: string | null;
  category: Category | null;
  categoryLabel: string | null;
  /** Count within the window (views or hires). */
  count: number;
  /** % vs previous window. null if there is no base to compare (shows "new"). */
  deltaPct: number | null;
  /** Rank movement vs previous window (+ goes up). null if new. */
  rankDelta: number | null;
  /** Short series for the demand sparkline. */
  spark: number[];
}

export interface TrendingResponse {
  window: TrendingWindow;
  metric: TrendingMetric;
  rows: TrendingRow[];
  updatedAt: string;
  source: "demand";
}

// ---------------------------------------------------------------- //
// Onchain indexer (Worker workers/onchain-indexer) — real data
// ---------------------------------------------------------------- //

export interface Holding {
  symbol: string;
  name: string;
  tokenAddress: string; // "native" for BNB
  /** Amount in token units (already de-scaled by decimals). */
  amount: number;
  /** USD price (CMC/price feed). null if there is no price for the token. */
  priceUsd: number | null;
  /** amount × priceUsd. null if there is no price (don't silently drop from total). */
  valueUsd: number | null;
  /** % of the portfolio by value (0–100). null if the token has no price. */
  pct: number | null;
}

export interface PortfolioResponse {
  address: string;
  chainId: number; // 56
  /** Sum of known valueUsd. */
  totalUsd: number;
  /** true if every holding with a balance has a price; false if any is missing. */
  fullyPriced: boolean;
  holdings: Holding[];
  /** ISO. Moment of the onchain read. */
  updatedAt: string;
  source: "onchain";
}

export type TradeSide = "buy" | "sell" | "swap";

export interface Trade {
  hash: string;
  /** ISO timestamp of the block. */
  ts: string;
  side: TradeSide;
  tokenIn: string; // symbol
  tokenOut: string; // symbol
  amountIn: number;
  amountOut: number;
  valueUsd: number | null;
  dex: string | null; // "PancakeSwap v3", etc.
  /** URL to the explorer (BscScan) to verify the tx. */
  explorerUrl: string;
}

export interface TradesResponse {
  address: string;
  chainId: number;
  count: number;
  trades: Trade[];
  updatedAt: string;
  source: "onchain";
}

// ---------------------------------------------------------------- //
// Derived metrics (best-effort · labeled "since indexed")
// ---------------------------------------------------------------- //

export interface PortfolioMetrics {
  totalUsd: number;
  pnlUsd: number | null;
  pnlPct: number | null;
  dailyPnlUsd: number | null;
  maxDrawdownPct: number | null;
  winRatePct: number | null;
  tradeCount: number;
  /** Always true here: these metrics are derived from the indexed history. */
  derived: true;
  /** ISO of when indexed data starts (for the "since indexed" note). */
  since: string | null;
}

/** Point on the equity curve (approximate NAV over time). */
export interface EquityPoint {
  ts: string;
  navUsd: number;
}

// ---------------------------------------------------------------- //
// Reputation (real, from 8004scan scores.breakdown)
// ---------------------------------------------------------------- //

export interface ReputationDimension {
  key: string; // "service" | "momentum" | ...
  score: number; // 0–100
  weight: number; // 0–1
}

export interface Reputation {
  totalScore: number;
  rank: number | null;
  networkRank: number | null;
  health: number | null;
  freshness: number | null;
  activity: number | null;
  popularity: number | null;
  metadataCompleteness: number | null;
  dimensions: ReputationDimension[];
  feedbacks: number;
  avgScore: number;
  source: "8004scan";
}

// ---------------------------------------------------------------- //
// Services & skills (8004scan services + agent-card A2A)
// ---------------------------------------------------------------- //

export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface AgentServices {
  a2aEndpoint: string | null;
  mcpEndpoint: string | null;
  protocolVersion: string | null;
  skills: AgentSkill[];
  x402: boolean;
  erc8183: boolean;
  /** true if the agent-card could be read live. */
  cardLive: boolean;
}

// ---------------------------------------------------------------- //
// Hire flow x402 (WS Phase 3) — real quote (HTTP 402 probe) + receipt.
// The front-end owns the quote + UI; the payment EXECUTION (EIP-3009
// signature / settlement) is done by the backend/SDK behind the seam
// HIRE_X402_URL. Honesty: nothing is fabricated; fields are nullable
// where the data doesn't exist yet (DESIGN.md v2 §18).
// ---------------------------------------------------------------- //

/**
 * Payment requirement normalized from `accepts[i]` of an HTTP 402 response
 * (x402 scheme). Passed through as-is to the payment seam to avoid losing precision.
 */
export interface X402Accept {
  scheme: string; // "exact"
  network: string; // "bsc" | "bsc-testnet" | eip155:...
  /** Amount in base units of the asset (string, not de-scaled). */
  maxAmountRequired: string;
  /** Address of the payment token (EIP-3009 / ERC-20). */
  asset: string;
  /** Payment recipient. */
  payTo: string;
  resource: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  /** Opaque scheme extra (e.g. { name, version, decimals, symbol }). */
  extra?: Record<string, unknown> | null;
}

/** Hire quote derived from the 402 of the agent's endpoint. */
export interface HireQuote {
  /** Description of the task to hire (from the resource or default). */
  task: string;
  /** Price de-scaled by the asset's decimals. null if it couldn't be derived. */
  amount: number | null;
  /** Symbol of the payment asset ("USDT", "USDC"…). */
  assetSymbol: string | null;
  assetAddress: string;
  network: string;
  payTo: string;
  /** Seconds the quote is valid (maxTimeoutSeconds). null if not declared. */
  expirySeconds: number | null;
  /** The raw accept, to forward to the payment seam without loss. */
  accept: X402Accept;
  source: "x402";
}

export type HireStatus = "settled" | "pending" | "failed";

/** Receipt returned by the payment seam. No invented tx: txHash only if real. */
export interface HireReceipt {
  status: HireStatus;
  txHash: string | null;
  explorerUrl: string | null;
  amount: number | null;
  assetSymbol: string | null;
  /** ISO of the settlement, null if still pending/failed. */
  settledAt: string | null;
  /** Honest message for failed/pending. */
  detail?: string | null;
}

// ---------------------------------------------------------------- //
// Composite detail — what routes/agent.tsx consumes (dashboard)
// ---------------------------------------------------------------- //

export interface AgentDetail {
  agent: Agent;
  aisle: Aisle | null;
  category: Category | null;
  template: TemplateKind;
  /** Onchain (nullable if the indexer didn't respond / wallet empty). */
  portfolio: PortfolioResponse | null;
  metrics: PortfolioMetrics | null;
  equity: EquityPoint[] | null;
  trades: TradesResponse | null;
  /** Real 8004scan reputation. */
  reputation: Reputation | null;
  services: AgentServices | null;
}

/**
 * Contratos de datos v2 (WS0.2) — la interfaz entre capas. Las instancias de la
 * Ola 1 construyen CONTRA estas formas:
 *   - WS1.2 (indexer onchain) devuelve `PortfolioResponse` y `TradesResponse`.
 *   - WS1.3 (clientes front) ensambla `AgentDetail` = Agent + onchain + reputación
 *     + services, y calcula `PortfolioMetrics` (best-effort, etiquetado).
 *
 * Regla de honestidad: los campos derivados/aproximados son nullable y llevan
 * `derived`/`since`. Nada estimado se presenta como exacto (DESIGN.md v2 §18).
 */

import type { Agent } from "./agents";
import type { Aisle, Category, TemplateKind } from "./taxonomy";

// ---------------------------------------------------------------- //
// Trending por demanda propia (WS Ola B) — views + hires que contamos
// nosotros; %change y rankDelta REALES (data de primera mano).
// ---------------------------------------------------------------- //

export type TrendingMetric = "views" | "hires";
export type TrendingWindow = "1h" | "24h" | "7d";

export interface TrendingRow {
  agentId: string; // token_id (para /agent/:id)
  name: string;
  imageUrl?: string | null;
  category: Category | null;
  categoryLabel: string | null;
  /** Conteo en la ventana (views o hires). */
  count: number;
  /** % vs ventana previa. null si no hay base para comparar (se muestra "nuevo"). */
  deltaPct: number | null;
  /** Movimiento de rank vs ventana previa (+sube). null si nuevo. */
  rankDelta: number | null;
  /** Serie corta para sparkline de demanda. */
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
// Indexer onchain (Worker workers/onchain-indexer) — datos reales
// ---------------------------------------------------------------- //

export interface Holding {
  symbol: string;
  name: string;
  tokenAddress: string; // "native" para BNB
  /** Cantidad en unidades del token (ya des-escalada por decimals). */
  amount: number;
  /** Precio USD (CMC/price feed). null si no hay precio para el token. */
  priceUsd: number | null;
  /** amount × priceUsd. null si no hay precio (no omitir del total en silencio). */
  valueUsd: number | null;
  /** % del portfolio por valor (0–100). null si el token no tiene precio. */
  pct: number | null;
}

export interface PortfolioResponse {
  address: string;
  chainId: number; // 56
  /** Suma de valueUsd conocidos. */
  totalUsd: number;
  /** true si todos los holdings con saldo tienen precio; false si alguno falta. */
  fullyPriced: boolean;
  holdings: Holding[];
  /** ISO. Momento de la lectura onchain. */
  updatedAt: string;
  source: "onchain";
}

export type TradeSide = "buy" | "sell" | "swap";

export interface Trade {
  hash: string;
  /** ISO timestamp del bloque. */
  ts: string;
  side: TradeSide;
  tokenIn: string; // símbolo
  tokenOut: string; // símbolo
  amountIn: number;
  amountOut: number;
  valueUsd: number | null;
  dex: string | null; // "PancakeSwap v3", etc.
  /** URL al explorer (BscScan) para verificar la tx. */
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
// Métricas derivadas (best-effort · etiquetadas "since indexed")
// ---------------------------------------------------------------- //

export interface PortfolioMetrics {
  totalUsd: number;
  pnlUsd: number | null;
  pnlPct: number | null;
  dailyPnlUsd: number | null;
  maxDrawdownPct: number | null;
  winRatePct: number | null;
  tradeCount: number;
  /** Siempre true aquí: estas métricas son derivadas del histórico indexado. */
  derived: true;
  /** ISO desde cuándo hay datos indexados (para la nota "since indexed"). */
  since: string | null;
}

/** Punto de la equity curve (NAV aproximado en el tiempo). */
export interface EquityPoint {
  ts: string;
  navUsd: number;
}

// ---------------------------------------------------------------- //
// Reputación (real, de 8004scan scores.breakdown)
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
  /** true si el agent-card se pudo leer en vivo. */
  cardLive: boolean;
}

// ---------------------------------------------------------------- //
// Detalle compuesto — lo que consume routes/agent.tsx (dashboard)
// ---------------------------------------------------------------- //

export interface AgentDetail {
  agent: Agent;
  aisle: Aisle | null;
  category: Category | null;
  template: TemplateKind;
  /** Onchain (nullable si el indexer no respondió / wallet vacía). */
  portfolio: PortfolioResponse | null;
  metrics: PortfolioMetrics | null;
  equity: EquityPoint[] | null;
  trades: TradesResponse | null;
  /** Reputación real 8004scan. */
  reputation: Reputation | null;
  services: AgentServices | null;
  /** Solo para el flagship IVL: rango/score en vivo de api.zvlint.com. */
  ivl: import("./ivl").IvlTicksResponse | null;
}

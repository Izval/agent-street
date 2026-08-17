/**
 * Cliente del motor IVL (api.zvlint.com) — API pública, sin secreto.
 *
 * Es el "seam" del agente y el diferenciador de Data Quality del flagship:
 * `/v1/ivl/ticks` devuelve el rango LP v3 (tickLower/tickUpper) listo para
 * PancakeSwap. Ver plan.md §3. Formas verificadas contra la API 17-ago-2026.
 */

export const DEFAULT_IVL_BASE = "https://api.zvlint.com";

export type IvlClassification = "stable" | "neutral" | "unstable" | string;
export type IvlAction =
  | "open_or_hold"
  | "withdraw_or_widen"
  | "reset"
  | string;
export type BreakoutRisk = "low" | "medium" | "high" | string;

/** Rango LP en unidades de precio + metadatos del pool. */
export interface IvlLpRange {
  lower: number;
  upper: number;
  vwap: number;
  sigma: number;
  pool_fee_tier: number;
}

/** Ticks concretos para mintear una posición v3 (el núcleo de IVL). */
export interface IvlTicks {
  tickLower: number;
  tickUpper: number;
  tickSpacing: number;
  feeTier: number;
  priceLower: number;
  priceUpper: number;
}

/** Respuesta de `GET /v1/ivl/ticks?pair=…` — el rango ejecutable. */
export interface IvlTicksResponse {
  pair: string;
  ivl_score: number;
  classification: IvlClassification;
  decision: {
    action: IvlAction;
    rationale: string;
    breakoutRisk: BreakoutRisk;
    lpRange: {
      lower: number;
      upper: number;
      basis: string;
      atr14: number;
    };
  };
  lp_range: IvlLpRange;
  ticks: IvlTicks;
}

/** Respuesta de `GET /v1/ivl?pair=…` — análisis completo del par. */
export interface IvlResponse {
  pair: string;
  ivl_score: number;
  classification: IvlClassification;
  ivl_raw: number;
  components: Record<string, number>;
  range_low: number;
  range_high: number;
  range_width_pct: number;
  lp_range: IvlLpRange;
  lvr: {
    arb: number;
    level: string;
    sigmaB: number;
    gamma: number;
  };
  breakout_risk: BreakoutRisk;
  scales_confirming: string[];
  per_scale: Record<string, unknown>;
}

/** Fila del screener (`GET /v1/screener`) — feed de "qué LPear". */
export interface ScreenerRow {
  pair: string;
  ivl_score: number;
  classification: IvlClassification;
  action: IvlAction;
  breakout_risk: BreakoutRisk;
  lp_lower: number;
  lp_upper: number;
}

export interface ScreenerResponse {
  generated_at: string;
  count: number;
  rows: ScreenerRow[];
}

export class IvlApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "IvlApiError";
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new IvlApiError(`IVL API ${res.status} for ${url}`, res.status);
  }
  return (await res.json()) as T;
}

export interface IvlClientOptions {
  /** Base URL del motor IVL. Default: api.zvlint.com. */
  baseUrl?: string;
  signal?: AbortSignal;
}

/** Crea un cliente IVL ligado a una base URL (inyectable desde el env de CF). */
export function createIvlClient(opts: IvlClientOptions = {}) {
  const base = (opts.baseUrl ?? DEFAULT_IVL_BASE).replace(/\/$/, "");
  const q = (pair: string) => encodeURIComponent(pair);
  return {
    baseUrl: base,
    /** Rango ejecutable (tickLower/tickUpper) para un par. */
    ticks: (pair: string, signal = opts.signal) =>
      getJson<IvlTicksResponse>(`${base}/v1/ivl/ticks?pair=${q(pair)}`, signal),
    /** Análisis IVL completo de un par. */
    ivl: (pair: string, signal = opts.signal) =>
      getJson<IvlResponse>(`${base}/v1/ivl?pair=${q(pair)}`, signal),
    /** Pools rankeados por score IVL. */
    screener: (signal = opts.signal) =>
      getJson<ScreenerResponse>(`${base}/v1/screener`, signal),
  };
}

export type IvlClient = ReturnType<typeof createIvlClient>;

/**
 * Color del medidor de score IVL (DESIGN.md §6): ≥70 verde, 40–69 marca, <40 rojo.
 * Devuelve el nombre del token semántico (usar con var(--…) o clases Tailwind).
 */
export function ivlScoreTone(score: number): "up" | "brand" | "down" {
  if (score >= 70) return "up";
  if (score >= 40) return "brand";
  return "down";
}

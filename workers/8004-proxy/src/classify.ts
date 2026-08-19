// classify.ts — clasifica agentes ERC-8004 en la taxonomía de 2 niveles.
//
// ESPEJO del contrato fuente-de-verdad `app/app/lib/taxonomy.ts` (no se puede
// importar cross-package). Mantener en sync: si cambia una `kw`, un `id`, un
// `search` o el ORDEN allá, cámbialo aquí. El orden de `CATEGORY_DEFS` = prioridad
// de clasificación (la primera regla que matchea gana: rebalancing > lending, etc.).
//
// El track principal exige "Agent Diversity": las 4 categorías OBLIGATORIAS
// (`rebalancing`, `grid`, `yield`, `health`) mantienen ids ESTABLES y se tratan
// con igual profundidad. La taxonomía extendida es una capa ENCIMA, no un reemplazo.

export type Aisle =
  | "trading"
  | "defi"
  | "nft"
  | "rwa"
  | "infra"
  | "payments"
  | "social";

export type Category =
  // trading
  | "grid" // ★ obligatoria
  | "dca"
  | "momentum"
  | "copy-trade"
  | "market-making"
  | "perps"
  // defi
  | "rebalancing" // ★ obligatoria (hogar de IVL)
  | "yield" // ★ obligatoria
  | "health" // ★ obligatoria
  | "lending"
  | "liquid-staking"
  // nft
  | "nft-floor"
  | "nft-mint"
  // rwa
  | "rwa-assets"
  | "rwa-treasury"
  // infra
  | "infra-data"
  | "infra-wallet"
  | "infra-automation"
  // payments
  | "payments-x402"
  | "payments-jobs"
  // social
  | "social-signals"
  | "social-narratives";

export type TemplateKind =
  | "trading" // win-rate · PnL · volumen · equity curve
  | "clmm" // IVL score · rango LP · APR · time-in-range
  | "yield" // APY comparado · TVL · protocolo
  | "health" // gauge health factor · distancia a liquidación · colateral
  | "nft" // floor · volumen · holdings
  | "rwa" // tipo de activo · respaldo · yield
  | "services"; // services/skills · x402 · uptime · freshness

export interface CategoryDef {
  id: Category;
  label: string;
  aisle: Aisle;
  template: TemplateKind;
  /** Una de las 4 obligatorias del hackathon (igual profundidad). */
  required?: boolean;
  /** Término de búsqueda server-side para la 8004scan API (`?search=`). */
  search?: string;
  /** Regla keyword para clasificar. Orden = prioridad. */
  kw?: RegExp;
}

/**
 * ESPEJO EXACTO de `CATEGORY_DEFS` en taxonomy.ts (mismo orden = misma prioridad,
 * mismas regex `kw`, mismos `search`). No reordenar sin sincronizar allá.
 */
export const CATEGORY_DEFS: CategoryDef[] = [
  // --- DeFi (incluye 3 obligatorias) ---
  {
    id: "rebalancing",
    label: "Rebalancing",
    aisle: "defi",
    template: "clmm",
    required: true,
    search: "rebalance",
    kw: /\b(rebalanc|liquidity\s*range|concentrated\s*liquidity|\bclmm\b|reposition|\blp\b|tick|ivl|range\s*order)\b/i,
  },
  {
    id: "yield",
    label: "Yield Optimization",
    aisle: "defi",
    template: "yield",
    required: true,
    search: "yield",
    kw: /\b(yield|apy|apr|farm|vault|auto-?compound|optimi[sz])\b/i,
  },
  {
    id: "health",
    label: "Health Factor",
    aisle: "defi",
    template: "health",
    required: true,
    search: "liquidation",
    kw: /\b(health\s*factor|liquidation|collateral|risk\s*monitor|guard|solvenc|\bltv\b)\b/i,
  },
  {
    id: "lending",
    label: "Lending",
    aisle: "defi",
    template: "yield",
    search: "lending",
    kw: /\b(lend|borrow|aave|venus|compound|money\s*market)\b/i,
  },
  {
    id: "liquid-staking",
    label: "Liquid Staking",
    aisle: "defi",
    template: "yield",
    search: "staking",
    kw: /\b(liquid\s*stak|\blst\b|stak|lista|slisbnb|restak)\b/i,
  },
  // --- Trading (incluye 1 obligatoria) ---
  {
    id: "grid",
    label: "Grid Trading",
    aisle: "trading",
    template: "trading",
    required: true,
    search: "grid",
    kw: /\b(grid|ladder|martingale)\b/i,
  },
  {
    id: "dca",
    label: "DCA",
    aisle: "trading",
    template: "trading",
    search: "dca",
    kw: /\b(dca|dollar\s*cost|accumulat)\b/i,
  },
  {
    id: "copy-trade",
    label: "Copy Trade",
    aisle: "trading",
    template: "trading",
    search: "copy trade",
    kw: /\b(copy\s*trad|mirror\s*trad|social\s*trad|follow\s*wallet)\b/i,
  },
  {
    id: "market-making",
    label: "Market Making",
    aisle: "trading",
    template: "trading",
    search: "market maker",
    kw: /\b(market\s*mak|\bmm\b|spread|orderbook)\b/i,
  },
  {
    id: "perps",
    label: "Perps",
    aisle: "trading",
    template: "trading",
    search: "perp",
    kw: /\b(perp|futures|leverage|funding\s*rate)\b/i,
  },
  {
    id: "momentum",
    label: "Momentum",
    aisle: "trading",
    template: "trading",
    search: "momentum",
    kw: /\b(momentum|trend|breakout|signal\s*trad|alpha)\b/i,
  },
  // --- Payments ---
  {
    id: "payments-x402",
    label: "x402 Payments",
    aisle: "payments",
    template: "services",
    search: "x402",
    kw: /\b(x402|eip-?3009|micropay|api\s*payment)\b/i,
  },
  {
    id: "payments-jobs",
    label: "Job Agents (ERC-8183)",
    aisle: "payments",
    template: "services",
    search: "erc-8183",
    kw: /\b(erc-?8183|job\s*market|task\s*deleg|seller\s*agent|negotiat)\b/i,
  },
  // --- Infra ---
  {
    id: "infra-data",
    label: "Data & Oracles",
    aisle: "infra",
    template: "services",
    search: "oracle",
    kw: /\b(oracle|data\s*feed|indexer|analytics|price\s*feed|radar|scanner)\b/i,
  },
  {
    id: "infra-wallet",
    label: "Wallet & Keys",
    aisle: "infra",
    template: "services",
    search: "wallet",
    kw: /\b(wallet\s*track|smart\s*wallet|account\s*abstract|session\s*key|keeper)\b/i,
  },
  {
    id: "infra-automation",
    label: "Automation",
    aisle: "infra",
    template: "services",
    search: "automation",
    kw: /\b(automat|workflow|scheduler|trigger|bot\s*framework)\b/i,
  },
  // --- Social ---
  {
    id: "social-signals",
    label: "Signals",
    aisle: "social",
    template: "services",
    search: "signal",
    kw: /\b(signal|sentiment|social\s*feed|twitter|telegram)\b/i,
  },
  {
    id: "social-narratives",
    label: "Narratives",
    aisle: "social",
    template: "services",
    search: "narrative",
    kw: /\b(narrative|meme|trend\s*hunt|four\.?meme)\b/i,
  },
  // --- NFT ---
  {
    id: "nft-floor",
    label: "Floor & Sweep",
    aisle: "nft",
    template: "nft",
    search: "nft",
    kw: /\b(nft|floor\s*price|sweep|collection\s*trad)\b/i,
  },
  {
    id: "nft-mint",
    label: "Mint",
    aisle: "nft",
    template: "nft",
    search: "mint",
    kw: /\b(mint\s*bot|allowlist|inscription)\b/i,
  },
  // --- RWA ---
  {
    id: "rwa-assets",
    label: "Tokenized Assets",
    aisle: "rwa",
    template: "rwa",
    search: "rwa",
    kw: /\b(rwa|real\s*world|tokeniz|commodit)\b/i,
  },
  {
    id: "rwa-treasury",
    label: "Treasury & T-Bills",
    aisle: "rwa",
    template: "rwa",
    search: "treasury",
    kw: /\b(treasury|t-?bill|bond|money\s*market\s*fund)\b/i,
  },
];

// --- Índices y helpers (derivados de CATEGORY_DEFS, en orden) ---

/** Todos los ids de categoría, en orden de prioridad. */
export const CATEGORIES: readonly Category[] = CATEGORY_DEFS.map((c) => c.id);

/** Las 4 obligatorias del hackathon (ids estables). */
export const REQUIRED_CATEGORIES: readonly Category[] = CATEGORY_DEFS.filter(
  (c) => c.required,
).map((c) => c.id);

export const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.id, c.label]),
) as Record<Category, string>;

/**
 * Término de búsqueda server-side por categoría para la 8004scan API (`?search=`).
 * Con 257k+ agentes en BSC, filtramos server-side por categoría en vez de
 * clasificar páginas enteras. Toda categoría de la taxonomía tiene su término.
 */
export const CATEGORY_SEARCH: Record<Category, string> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.id, c.search ?? c.id]),
) as Record<Category, string>;

export const AISLE_OF: Record<Category, Aisle> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.id, c.aisle]),
) as Record<Category, Aisle>;

export const TEMPLATE_OF: Record<Category, TemplateKind> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.id, c.template]),
) as Record<Category, TemplateKind>;

/** Texto de un agente a considerar para clasificar. */
export interface Classifiable {
  name?: string;
  description?: string;
  skills?: string[];
  tags?: string[];
  categories?: string[];
  protocols?: string[];
}

/**
 * Devuelve la categoría del agente, o null si ninguna keyword aplica.
 * Recorre `CATEGORY_DEFS` en orden y devuelve la primera cuya `kw` matchea sobre
 * name+description+skills+tags+categories+supported_protocols (en minúsculas).
 */
export function classifyAgent(a: Classifiable): Category | null {
  const hay = [
    a.name ?? "",
    a.description ?? "",
    ...(a.skills ?? []),
    ...(a.tags ?? []),
    ...(a.categories ?? []),
    ...(a.protocols ?? []),
  ]
    .join(" ")
    .toLowerCase();

  for (const def of CATEGORY_DEFS) {
    if (def.kw?.test(hay)) return def.id;
  }
  return null;
}

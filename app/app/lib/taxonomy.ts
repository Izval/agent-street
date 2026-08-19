/**
 * Taxonomía del marketplace (contrato WS0.2) — fuente de verdad.
 *
 * Dos niveles: AISLE (aisles tipo App Store) → CATEGORY (con subtipos). Las 4
 * categorías OBLIGATORIAS del hackathon (required:true) mantienen sus ids
 * ESTABLES — `rebalancing`, `grid`, `yield`, `health` — para no romper el proxy,
 * el seed ni los enlaces existentes. Agent Diversity: se tratan con igual
 * profundidad; la taxonomía nueva es una capa ENCIMA, no un reemplazo.
 *
 * El Worker `workers/8004-proxy/src/classify.ts` ESPEJA estas reglas keyword
 * (no puede importar cross-package). Mantener en sync: si cambia una `kw` aquí,
 * cámbiala allá. `template` decide la plantilla base (KPIs/charts/acento) que
 * usan la card y el detalle — es lo que evita el look genérico.
 */

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

/** Plantilla base: decide qué KPIs/charts/acento renderiza card y detalle. */
export type TemplateKind =
  | "trading" // win-rate · PnL · volumen · equity curve
  | "clmm" // IVL score · rango LP · APR · time-in-range
  | "yield" // APY comparado · TVL · protocolo
  | "health" // gauge health factor · distancia a liquidación · colateral
  | "nft" // floor · volumen · holdings
  | "rwa" // tipo de activo · respaldo · yield
  | "services"; // services/skills · x402 · uptime · freshness

export interface AisleDef {
  id: Aisle;
  label: string;
  /** Acento sutil por aisle (token CSS). NO compite con el amarillo de marca. */
  accent: string;
  /** Glyph corto para el sidebar (emoji/carácter; sin dependencias de iconos). */
  glyph: string;
}

export interface CategoryDef {
  id: Category;
  label: string;
  aisle: Aisle;
  template: TemplateKind;
  /** Una de las 4 obligatorias del hackathon (igual profundidad). */
  required?: boolean;
  /** Término de búsqueda server-side para la 8004scan API (`?search=`). */
  search?: string;
  /** Regla keyword para clasificar (espejada en el Worker). Orden = prioridad. */
  kw?: RegExp;
}

export const AISLES: AisleDef[] = [
  { id: "trading", label: "Trading", accent: "var(--accent-trading)", glyph: "◈" },
  { id: "defi", label: "DeFi", accent: "var(--accent-defi)", glyph: "⬡" },
  { id: "nft", label: "NFT", accent: "var(--accent-nft)", glyph: "◆" },
  { id: "rwa", label: "RWA", accent: "var(--accent-rwa)", glyph: "▣" },
  { id: "infra", label: "Infra", accent: "var(--accent-infra)", glyph: "⚙" },
  { id: "payments", label: "Payments", accent: "var(--accent-payments)", glyph: "⇄" },
  { id: "social", label: "Social", accent: "var(--accent-social)", glyph: "◎" },
];

/**
 * Definición de cada categoría. El ORDEN importa para clasificar: las reglas más
 * específicas / las 4 obligatorias van primero (rebalancing gana a lending, etc.).
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

// --- Índices y helpers ---
export const CATEGORY_BY_ID: Record<Category, CategoryDef> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.id, c]),
) as Record<Category, CategoryDef>;

export const CATEGORIES: Category[] = CATEGORY_DEFS.map((c) => c.id);

/** Las 4 obligatorias del hackathon (igual profundidad, siempre visibles). */
export const REQUIRED_CATEGORIES: Category[] = CATEGORY_DEFS.filter(
  (c) => c.required,
).map((c) => c.id);

export function categoriesInAisle(aisle: Aisle): CategoryDef[] {
  return CATEGORY_DEFS.filter((c) => c.aisle === aisle);
}

export function categoryLabel(id: Category): string {
  return CATEGORY_BY_ID[id]?.label ?? id;
}

export function categoryTemplate(id: Category | null | undefined): TemplateKind {
  return id ? (CATEGORY_BY_ID[id]?.template ?? "services") : "services";
}

export function aisleOf(id: Category): Aisle | null {
  return CATEGORY_BY_ID[id]?.aisle ?? null;
}

/** Texto clasificable → categoría (primera regla que matchea, por prioridad). */
export interface Classifiable {
  name?: string;
  description?: string;
  skills?: string[];
  tags?: string[];
  categories?: string[];
  protocols?: string[];
}

export function classify(a: Classifiable): Category | null {
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
  for (const c of CATEGORY_DEFS) {
    if (c.kw?.test(hay)) return c.id;
  }
  return null;
}

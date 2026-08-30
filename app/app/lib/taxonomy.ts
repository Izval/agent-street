/**
 * Marketplace taxonomy (WS0.2 contract) — source of truth.
 *
 * Two levels: AISLE (App Store-style aisles) → CATEGORY (with subtypes). The 4
 * MANDATORY hackathon categories (required:true) keep their STABLE ids —
 * `rebalancing`, `grid`, `yield`, `health` — so as not to break the proxy, the
 * seed or the existing links. Agent Diversity: they are treated with equal
 * depth; the new taxonomy is a layer ON TOP, not a replacement.
 *
 * The Worker `workers/8004-proxy/src/classify.ts` MIRRORS these keyword rules
 * (it can't import cross-package). Keep them in sync: if a `kw` changes here,
 * change it there. `template` decides the base template (KPIs/charts/accent)
 * used by the card and the detail — it is what avoids the generic look.
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
  | "grid" // ★ mandatory
  | "dca"
  | "momentum"
  | "copy-trade"
  | "market-making"
  | "perps"
  // defi
  | "rebalancing" // ★ mandatory (home of IVL)
  | "yield" // ★ mandatory
  | "health" // ★ mandatory
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

/** Base template: decides which KPIs/charts/accent the card and detail render. */
export type TemplateKind =
  | "trading" // win-rate · PnL · volumen · equity curve
  | "clmm" // IVL score · LP range · APR · time-in-range
  | "yield" // compared APY · TVL · protocol
  | "health" // health factor gauge · distance to liquidation · collateral
  | "nft" // floor · volume · holdings
  | "rwa" // asset type · backing · yield
  | "services"; // services/skills · x402 · uptime · freshness

export interface AisleDef {
  id: Aisle;
  label: string;
  /** Subtle per-aisle accent (CSS token). Does NOT compete with the brand yellow. */
  accent: string;
  /** Short glyph for the sidebar (emoji/character; no icon dependencies). */
  glyph: string;
}

export interface CategoryDef {
  id: Category;
  label: string;
  aisle: Aisle;
  template: TemplateKind;
  /** One of the 4 mandatory hackathon categories (equal depth). */
  required?: boolean;
  /** Server-side search term for the 8004scan API (`?search=`). */
  search?: string;
  /** Keyword rule for classifying (mirrored in the Worker). Order = priority. */
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
 * Definition of each category. ORDER matters for classification: the more
 * specific rules / the 4 mandatory ones go first (rebalancing beats lending, etc.).
 */
export const CATEGORY_DEFS: CategoryDef[] = [
  // --- DeFi (includes 3 mandatory) ---
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
  // --- Trading (includes 1 mandatory) ---
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

// --- Indexes and helpers ---
export const CATEGORY_BY_ID: Record<Category, CategoryDef> = Object.fromEntries(
  CATEGORY_DEFS.map((c) => [c.id, c]),
) as Record<Category, CategoryDef>;

export const CATEGORIES: Category[] = CATEGORY_DEFS.map((c) => c.id);

/** The 4 mandatory hackathon categories (equal depth, always visible). */
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

/** Classifiable text → category (first rule that matches, by priority). */
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

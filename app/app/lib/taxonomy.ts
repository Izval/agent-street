/**
 * Marketplace taxonomy (WS0.2 contract) — source of truth.
 *
 * Two levels: CATEGORY (App Store-style categories) → CATEGORY (with subtypes). The 4
 * MANDATORY hackathon subcategories (required:true) keep their STABLE ids —
 * `rebalancing`, `grid`, `yield`, `health` — so as not to break the proxy, the
 * seed or the existing links. Agent Diversity: they are treated with equal
 * depth; the new taxonomy is a layer ON TOP, not a replacement.
 *
 * The Worker `workers/8004-proxy/src/classify.ts` MIRRORS these keyword rules
 * (it can't import cross-package). Keep them in sync: if a `kw` changes here,
 * change it there. `template` decides the base template (KPIs/charts/accent)
 * used by the card and the detail — it is what avoids the generic look.
 */

export type Category =
  | "trading"
  | "liquidity"
  | "lending"
  | "yield"
  | "meme"
  | "nft"
  | "rwa"
  | "infra";

export type Subcategory =
  // trading
  | "grid" // ★ mandatory
  | "dca"
  | "momentum"
  | "copy-trade"
  | "market-making"
  | "perps"
  | "social-signals" // re-homed to trading ("Signals")
  | "social-narratives" // re-homed to trading ("Narratives")
  // liquidity providing
  | "rebalancing" // ★ mandatory (home of IVL)
  | "liquidity-pool"
  // lending
  | "lending"
  | "health" // ★ mandatory
  // yield
  | "yield" // ★ mandatory
  | "liquid-staking"
  // meme
  | "meme-trading"
  | "meme-launch"
  // nft
  | "nft-floor"
  | "nft-mint"
  // rwa
  | "rwa-assets"
  | "rwa-treasury"
  // infra (absorbs payments)
  | "infra-data"
  | "infra-automation"
  | "payments-x402"
  | "payments-jobs"
  // cyber
  | "cyber-audit"
  | "cyber-monitor"
  | "cyber-approvals";

/** Base template: decides which KPIs/charts/accent the card and detail render. */
export type TemplateKind =
  | "trading" // win-rate · PnL · volumen · equity curve
  | "clmm" // IVL score · LP range · APR · time-in-range
  | "yield" // compared APY · TVL · protocol
  | "health" // health factor gauge · distance to liquidation · collateral
  | "nft" // floor · volume · holdings
  | "rwa" // asset type · backing · yield
  | "services"; // services/skills · x402 · uptime · freshness

export interface CategoryDef {
  id: Category;
  /** Full display name (subcategory landing, bento). */
  label: string;
  /** Compact name for cramped nav (top pill strip). Falls back to `label`. */
  short?: string;
  /** Subtle per-category accent (CSS token). Does NOT compete with the brand yellow. */
  accent: string;
  /** Short glyph for the sidebar (emoji/character; no icon dependencies). */
  glyph: string;
}

export interface SubcategoryDef {
  id: Subcategory;
  label: string;
  category: Category;
  template: TemplateKind;
  /** One of the 4 mandatory hackathon subcategories (equal depth). */
  required?: boolean;
  /** Server-side search term for the 8004scan API (`?search=`). */
  search?: string;
  /** Keyword rule for classifying (mirrored in the Worker). Order = priority. */
  kw?: RegExp;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "trading", label: "Trading", accent: "var(--accent-trading)", glyph: "◈" },
  { id: "liquidity", label: "Liquidity Providing", short: "LP", accent: "var(--accent-liquidity)", glyph: "⬡" },
  { id: "lending", label: "Lending", accent: "var(--accent-lending)", glyph: "▤" },
  { id: "yield", label: "Yield", accent: "var(--accent-yield)", glyph: "✦" },
  { id: "meme", label: "Meme", accent: "var(--accent-meme)", glyph: "✺" },
  { id: "nft", label: "NFT", accent: "var(--accent-nft)", glyph: "◆" },
  { id: "rwa", label: "RWA", accent: "var(--accent-rwa)", glyph: "▣" },
  { id: "infra", label: "Infrastructure", short: "Infra", accent: "var(--accent-infra)", glyph: "⚙" },
];

/**
 * Definition of each subcategory. ORDER matters for classification: the more
 * specific rules / the 4 mandatory ones go first (rebalancing beats lending, etc.).
 */
export const SUBCATEGORY_DEFS: SubcategoryDef[] = [
  // --- Mandatory 4 first (stable ids, highest classify priority) ---
  {
    id: "rebalancing",
    label: "Rebalancing",
    category: "liquidity",
    template: "clmm",
    required: true,
    search: "rebalance",
    kw: /\b(rebalanc|liquidity\s*range|concentrated\s*liquidity|\bclmm\b|reposition|ivl|range\s*order)\b/i,
  },
  {
    id: "yield",
    label: "Yield Optimization",
    category: "yield",
    template: "yield",
    required: true,
    search: "yield",
    kw: /\b(yield|apy|apr|farm|vault|auto-?compound)\b/i,
  },
  {
    id: "health",
    label: "Health Factor",
    category: "lending",
    template: "health",
    required: true,
    search: "liquidation",
    kw: /\b(health\s*factor|liquidation|collateral|risk\s*monitor|solvenc|\bltv\b)\b/i,
  },
  {
    id: "grid",
    label: "Grid Trading",
    category: "trading",
    template: "trading",
    required: true,
    search: "grid",
    kw: /\b(grid|ladder|martingale)\b/i,
  },
  // --- Liquidity Providing ---
  {
    id: "liquidity-pool",
    label: "LP Management",
    category: "liquidity",
    template: "clmm",
    search: "liquidity",
    kw: /\b(liquidity\s*provid|add\s*liquidity|lp\s*position|v3\s*pool|pool\s*manag)\b/i,
  },
  // --- Lending ---
  {
    id: "lending",
    label: "Lending & Borrowing",
    category: "lending",
    template: "yield",
    search: "lending",
    kw: /\b(lend|borrow|aave|venus|compound|money\s*market)\b/i,
  },
  // --- Yield ---
  {
    id: "liquid-staking",
    label: "Liquid Staking",
    category: "yield",
    template: "yield",
    search: "staking",
    kw: /\b(liquid\s*stak|\blst\b|stak|lista|slisbnb|restak)\b/i,
  },
  // --- Meme (owns four.meme; must precede Narratives) ---
  {
    id: "meme-trading",
    label: "Meme Trading",
    category: "meme",
    template: "trading",
    search: "meme",
    kw: /\b(four\.?meme|meme\s*coin|meme\s*trad|degen)\b/i,
  },
  {
    id: "meme-launch",
    label: "Launches & Sniping",
    category: "meme",
    template: "trading",
    search: "launch",
    kw: /\b(meme\s*launch|token\s*launch|snipe|bonding\s*curve|pump)\b/i,
  },
  // --- Trading (rest) ---
  {
    id: "dca",
    label: "DCA",
    category: "trading",
    template: "trading",
    search: "dca",
    kw: /\b(dca|dollar\s*cost|accumulat)\b/i,
  },
  {
    id: "copy-trade",
    label: "Copy Trade",
    category: "trading",
    template: "trading",
    search: "copy trade",
    kw: /\b(copy\s*trad|mirror\s*trad|social\s*trad|follow\s*wallet)\b/i,
  },
  {
    id: "market-making",
    label: "Market Making",
    category: "trading",
    template: "trading",
    search: "market maker",
    kw: /\b(market\s*mak|\bmm\b|spread|orderbook)\b/i,
  },
  {
    id: "perps",
    label: "Perps",
    category: "trading",
    template: "trading",
    search: "perp",
    kw: /\b(perp|futures|leverage|funding\s*rate)\b/i,
  },
  {
    id: "momentum",
    label: "Momentum",
    category: "trading",
    template: "trading",
    search: "momentum",
    kw: /\b(momentum|trend|breakout|signal\s*trad)\b/i,
  },
  {
    id: "social-signals",
    label: "Signals",
    category: "trading",
    template: "services",
    search: "signal",
    kw: /\b(signal|sentiment|social\s*feed|twitter|telegram)\b/i,
  },
  {
    id: "social-narratives",
    label: "Narratives",
    category: "trading",
    template: "services",
    search: "narrative",
    kw: /\b(narrative|trend\s*hunt|thesis|rotation)\b/i,
  },
  // --- Infra (absorbs Payments) ---
  {
    id: "payments-x402",
    label: "x402 Payments",
    category: "infra",
    template: "services",
    search: "x402",
    kw: /\b(x402|eip-?3009|micropay|api\s*payment)\b/i,
  },
  {
    id: "payments-jobs",
    label: "Job Agents (ERC-8183)",
    category: "infra",
    template: "services",
    search: "erc-8183",
    kw: /\b(erc-?8183|job\s*market|task\s*deleg|seller\s*agent|negotiat)\b/i,
  },
  {
    id: "infra-data",
    label: "Data & Oracles",
    category: "infra",
    template: "services",
    search: "oracle",
    kw: /\b(oracle|data\s*feed|indexer|analytics|price\s*feed|radar|scanner|wallet\s*track|keeper)\b/i,
  },
  {
    id: "infra-automation",
    label: "Automation",
    category: "infra",
    template: "services",
    search: "automation",
    kw: /\b(automat|workflow|scheduler|trigger|bot\s*framework)\b/i,
  },
  // --- Infra: Security (cybersecurity, folded into Infrastructure) ---
  {
    id: "cyber-audit",
    label: "Audits & Security",
    category: "infra",
    template: "services",
    search: "audit",
    kw: /\b(audit|contract\s*secur|vulnerab|exploit\s*scan|formal\s*verif)\b/i,
  },
  {
    id: "cyber-monitor",
    label: "Threat Monitoring",
    category: "infra",
    template: "services",
    search: "security",
    kw: /\b(rug\s*pull|scam\s*detect|threat\s*monitor|honeypot|anomaly)\b/i,
  },
  {
    id: "cyber-approvals",
    label: "Approvals & Hygiene",
    category: "infra",
    template: "services",
    search: "approvals",
    kw: /\b(approval\s*revoke|token\s*approval|allowance|wallet\s*hygiene)\b/i,
  },
  // --- NFT ---
  {
    id: "nft-floor",
    label: "Floor & Sweep",
    category: "nft",
    template: "nft",
    search: "nft",
    kw: /\b(nft|floor\s*price|sweep|collection\s*trad)\b/i,
  },
  {
    id: "nft-mint",
    label: "Mint",
    category: "nft",
    template: "nft",
    search: "mint",
    kw: /\b(mint\s*bot|allowlist|inscription)\b/i,
  },
  // --- RWA ---
  {
    id: "rwa-assets",
    label: "Tokenized Assets",
    category: "rwa",
    template: "rwa",
    search: "rwa",
    kw: /\b(rwa|real\s*world|tokeniz|commodit)\b/i,
  },
  {
    id: "rwa-treasury",
    label: "Treasury & T-Bills",
    category: "rwa",
    template: "rwa",
    search: "treasury",
    kw: /\b(treasury|t-?bill|bond|money\s*market\s*fund)\b/i,
  },
];

// --- Indexes and helpers ---
export const SUBCATEGORY_BY_ID: Record<Subcategory, SubcategoryDef> = Object.fromEntries(
  SUBCATEGORY_DEFS.map((c) => [c.id, c]),
) as Record<Subcategory, SubcategoryDef>;

export const SUBCATEGORIES: Subcategory[] = SUBCATEGORY_DEFS.map((c) => c.id);

/** The 4 mandatory hackathon subcategories (equal depth, always visible). */
export const REQUIRED_SUBCATEGORIES: Subcategory[] = SUBCATEGORY_DEFS.filter(
  (c) => c.required,
).map((c) => c.id);

export function subcategoriesInCategory(category: Category): SubcategoryDef[] {
  return SUBCATEGORY_DEFS.filter((c) => c.category === category);
}

export function subcategoryLabel(id: Subcategory): string {
  return SUBCATEGORY_BY_ID[id]?.label ?? id;
}

export function subcategoryTemplate(id: Subcategory | null | undefined): TemplateKind {
  return id ? (SUBCATEGORY_BY_ID[id]?.template ?? "services") : "services";
}

export function categoryOf(id: Subcategory): Category | null {
  return SUBCATEGORY_BY_ID[id]?.category ?? null;
}

/** Classifiable text → subcategory (first rule that matches, by priority). */
export interface Classifiable {
  name?: string;
  description?: string;
  skills?: string[];
  tags?: string[];
  subcategories?: string[];
  protocols?: string[];
}

export function classify(a: Classifiable): Subcategory | null {
  const hay = [
    a.name ?? "",
    a.description ?? "",
    ...(a.skills ?? []),
    ...(a.tags ?? []),
    ...(a.subcategories ?? []),
    ...(a.protocols ?? []),
  ]
    .join(" ")
    .toLowerCase();
  for (const c of SUBCATEGORY_DEFS) {
    if (c.kw?.test(hay)) return c.id;
  }
  return null;
}

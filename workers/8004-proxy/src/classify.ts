// classify.ts — clasifica agentes ERC-8004 en la taxonomía de 2 niveles.
//
// ESPEJO del contrato fuente-de-verdad `app/app/lib/taxonomy.ts` (no se puede
// importar cross-package). Mantener en sync: si cambia una `kw`, un `id`, un
// `search` o el ORDEN allá, cámbialo aquí. El orden de `SUBCATEGORY_DEFS` = prioridad
// de clasificación (la primera regla que matchea gana: rebalancing > lending, etc.).
//
// El track principal exige "Agent Diversity": las 4 categorías OBLIGATORIAS
// (`rebalancing`, `grid`, `yield`, `health`) mantienen ids ESTABLES y se tratan
// con igual profundidad. La taxonomía extendida es una capa ENCIMA, no un reemplazo.

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
  | "grid" // ★ obligatoria
  | "dca"
  | "momentum"
  | "copy-trade"
  | "market-making"
  | "perps"
  | "social-signals" // re-homed to trading ("Signals")
  | "social-narratives" // re-homed to trading ("Narratives")
  // liquidity providing
  | "rebalancing" // ★ obligatoria (hogar de IVL)
  | "liquidity-pool"
  // lending
  | "lending"
  | "health" // ★ obligatoria
  // yield
  | "yield" // ★ obligatoria
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

export type TemplateKind =
  | "trading" // win-rate · PnL · volumen · equity curve
  | "clmm" // IVL score · rango LP · APR · time-in-range
  | "yield" // APY comparado · TVL · protocolo
  | "health" // gauge health factor · distancia a liquidación · colateral
  | "nft" // floor · volumen · holdings
  | "rwa" // tipo de activo · respaldo · yield
  | "services"; // services/skills · x402 · uptime · freshness

export interface SubcategoryDef {
  id: Subcategory;
  label: string;
  category: Category;
  template: TemplateKind;
  /** Una de las 4 obligatorias del hackathon (igual profundidad). */
  required?: boolean;
  /** Término de búsqueda server-side para la 8004scan API (`?search=`). */
  search?: string;
  /** Regla keyword para clasificar. Orden = prioridad. */
  kw?: RegExp;
}

/**
 * ESPEJO EXACTO de `SUBCATEGORY_DEFS` en taxonomy.ts (mismo orden = misma prioridad,
 * mismas regex `kw`, mismos `search`). No reordenar sin sincronizar allá.
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

// --- Índices y helpers (derivados de SUBCATEGORY_DEFS, en orden) ---

/** Todos los ids de categoría, en orden de prioridad. */
export const SUBCATEGORIES: readonly Subcategory[] = SUBCATEGORY_DEFS.map((c) => c.id);

/** Las 4 obligatorias del hackathon (ids estables). */
export const REQUIRED_SUBCATEGORIES: readonly Subcategory[] = SUBCATEGORY_DEFS.filter(
  (c) => c.required,
).map((c) => c.id);

export const SUBCATEGORY_LABELS: Record<Subcategory, string> = Object.fromEntries(
  SUBCATEGORY_DEFS.map((c) => [c.id, c.label]),
) as Record<Subcategory, string>;

/**
 * Término de búsqueda server-side por categoría para la 8004scan API (`?search=`).
 * Con 257k+ agentes en BSC, filtramos server-side por categoría en vez de
 * clasificar páginas enteras. Toda categoría de la taxonomía tiene su término.
 */
export const SUBCATEGORY_SEARCH: Record<Subcategory, string> = Object.fromEntries(
  SUBCATEGORY_DEFS.map((c) => [c.id, c.search ?? c.id]),
) as Record<Subcategory, string>;

export const CATEGORY_OF: Record<Subcategory, Category> = Object.fromEntries(
  SUBCATEGORY_DEFS.map((c) => [c.id, c.category]),
) as Record<Subcategory, Category>;

export const TEMPLATE_OF: Record<Subcategory, TemplateKind> = Object.fromEntries(
  SUBCATEGORY_DEFS.map((c) => [c.id, c.template]),
) as Record<Subcategory, TemplateKind>;

/** Texto de un agente a considerar para clasificar. */
export interface Classifiable {
  name?: string;
  description?: string;
  skills?: string[];
  tags?: string[];
  subcategories?: string[];
  protocols?: string[];
}

/**
 * Devuelve la categoría del agente, o null si ninguna keyword aplica.
 * Recorre `SUBCATEGORY_DEFS` en orden y devuelve la primera cuya `kw` matchea sobre
 * name+description+skills+tags+subcategories+supported_protocols (en minúsculas).
 */
export function classifyAgent(a: Classifiable): Subcategory | null {
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

  for (const def of SUBCATEGORY_DEFS) {
    if (def.kw?.test(hay)) return def.id;
  }
  return null;
}

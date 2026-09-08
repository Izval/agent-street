/**
 * Catalog of composable Skills (Skills tab).
 *
 * Skills do NOT come from 8004scan (those are agents). They are modules an agent
 * plugs in / calls. The catalog has two tiers, mirroring how Agents work
 * (real 8004scan feed + curated seed):
 *
 *   1. CURATED_SKILLS (this file, static) — immediate depth for every subcategory:
 *      - The 10 Altana composable skills (skills.altana.network) + the IVL
 *        range-quality skill, as ordinary listings.
 *      - A snapshot of the CoinMarketCap skill registry (analysis skills an agent
 *        can call — the family IVL itself was born in). Mapped to the taxonomy.
 *   2. Live source (lib/skills-live.ts) — the OFFICIAL BNB Chain Skills Hub
 *      (github.com/bnb-chain/bnbchain-skills), fetched server-side and merged in
 *      by the route loaders. Small today, grows via community PRs; canonical and
 *      BNB-native. The marketplace works without it (fetch failure ⇒ curated only).
 *
 * Everything is an ordinary listing — no special-casing (CLAUDE.md §2).
 */

import type { Subcategory } from "./taxonomy";

export type SkillProvider =
  | "IVL"
  | "Altana"
  | "CoinMarketCap"
  | "BNB Chain"
  | "CryptoSkill Hub";
export type SkillSource = "curated" | "cmc" | "bnb-hub" | "cryptoskill";

export interface Skill {
  id: string;
  name: string;
  provider: SkillProvider;
  subcategory: Subcategory;
  description: string;
  /** Protocol/venue the skill touches (shown as small text). */
  protocol: string;
  /** Which other skills/agents it composes well with. */
  composableWith: string[];
  link: string;
  /** Where this listing comes from — for provenance, not special-casing. */
  source: SkillSource;
  /** Free tags (e.g. CMC result type). Optional. */
  tags?: string[];
  /** true when the source vouches for the skill (e.g. BNB Hub AgentGuard scan). */
  verified?: boolean;
  /** Source-native quality score (0–100), for ranking within a subcategory. */
  score?: number;
  /** Original author/publisher, when the source provides one. */
  author?: string;
}

/** Display order for the overview page: our vetted listings first, then the rest. */
export const SOURCE_RANK: Record<SkillSource, number> = {
  curated: 0,
  cmc: 1,
  "bnb-hub": 2,
  cryptoskill: 3,
};

// --- Subcategory classifier (keyword → taxonomy subcategory) --------------------- //
// Used to place live skills (BNB Hub `SKILL.md` has no subcategory field) into the
// same taxonomy the rest of the marketplace uses. Order = most specific first.

// STRONG rules: specific, high-confidence signals → a precise subcategory.
const STRONG_RULES: Array<[RegExp, Subcategory]> = [
  [/\brebalanc|concentrated liquidity|range quality|tick(lower|upper)?\b/i, "rebalancing"],
  [/\bgrid\b/i, "grid"],
  [/health factor|liquidation buffer|liquidation cluster|collateral health|position risk|\bmargin\b/i, "health"],
  [/liquid staking|slisbnb|\blst\b|restaking/i, "liquid-staking"],
  [/lending|borrow|\baave\b|\bvenus\b|\bcompound\b|supply and borrow/i, "lending"],
  [/\byield|\bapy\b|staking reward|real[- ]yield|\bfarm|vault/i, "yield"],
  [/\bdca\b|dollar[- ]cost/i, "dca"],
  [/copy[- ]?trade|mirror trade/i, "copy-trade"],
  [/\bperp|perpetual|\bfutures\b|funding rate|open interest/i, "perps"],
  [/meme|four\.meme|pump\.fun/i, "meme-trading"],
  [/scanner|discovery|token radar|momentum|trending|new tokens/i, "momentum"],
  [/\bx402\b|api payment|micropayment/i, "payments-x402"],
  [/task delegation|hire an agent|agent[- ]to[- ]agent job/i, "payments-jobs"],
  [/sentiment|narrative|governance|\bdao\b/i, "social-narratives"],
  [/nft (floor|collection|marketplace|mint|trading)|floor price|opensea|\bblur\b/i, "nft-floor"],
  [/\brwa\b|real[- ]world asset|tokenized treasur/i, "rwa-treasury"],
];

// WEAK rules: broad/infra signals — only used when no strong rule matched.
const WEAK_RULES: Array<[RegExp, Subcategory]> = [
  [/mcp server|greenfield|erc-?8004|\bblocks\b|transactions|contract call|automation|\bswap\b|\bdex\b|\brouting\b|market maker/i, "market-making"],
  [/wallet tracker|track wallet|wallet monitor|portfolio track/i, "cyber-monitor"],
  [/audit|honeypot|security|exploit|risk scan/i, "cyber-audit"],
  [/payment|invoice|settle/i, "payments-x402"],
  [/data|analytics|indicator|oracle|screen|price feed|api\b/i, "infra-data"],
];

/** Precise subcategory from text, or null when no strong signal is present. */
export function classifySkillSubcategoryStrict(text: string): Subcategory | null {
  for (const [re, cat] of STRONG_RULES) if (re.test(text)) return cat;
  return null;
}

/** Best-effort subcategory with a default (used for the BNB Hub `SKILL.md`). */
export function classifySkillSubcategory(text: string): Subcategory {
  return (
    classifySkillSubcategoryStrict(text) ??
    WEAK_RULES.find(([re]) => re.test(text))?.[1] ??
    "infra-data"
  );
}

// --- Curated: Altana composable skills + IVL ------------------------------- //

const ALTANA_SKILLS: Skill[] = [
  {
    id: "ivl",
    name: "IVL — Range Quality",
    provider: "IVL",
    subcategory: "rebalancing",
    description:
      "Scores the quality of a range for concentrated liquidity and returns tickLower/tickUpper ready for PancakeSwap v3. The brain of rebalancing, pluggable into any agent.",
    protocol: "PancakeSwap v3",
    composableWith: ["PancakeSwap Liquidity", "IVL Rebalancer"],
    link: "https://api.zvlint.com",
    source: "curated",
  },
  {
    id: "pancakeswap-liquidity",
    name: "PancakeSwap Liquidity",
    provider: "Altana",
    subcategory: "rebalancing",
    description:
      "Opens and manages liquidity positions on PancakeSwap. Composable LP execution for rebalancing agents.",
    protocol: "PancakeSwap",
    composableWith: ["IVL — Range Quality"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "pancakeswap-trading",
    name: "PancakeSwap Trading",
    provider: "Altana",
    subcategory: "rebalancing",
    description:
      "Swaps and trading on PancakeSwap with best-price routing. Execution layer for onchain strategies.",
    protocol: "PancakeSwap",
    composableWith: ["Token Radar"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "aave-v3-lending",
    name: "Aave V3 Lending",
    provider: "Altana",
    subcategory: "yield",
    description:
      "Deposit, borrow and manage positions on Aave V3. A yield and collateral-management component.",
    protocol: "Aave V3",
    composableWith: ["Venus Lending"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "venus-lending",
    name: "Venus Lending",
    provider: "Altana",
    subcategory: "yield",
    description:
      "Supply and borrow on Venus (BSC). A yield engine and a health-factor data source.",
    protocol: "Venus",
    composableWith: ["Aave V3 Lending"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "lista-liquid-staking",
    name: "Lista Liquid Staking",
    provider: "Altana",
    subcategory: "yield",
    description:
      "Liquid staking of BNB via Lista (slisBNB) with rewards and exit liquidity.",
    protocol: "Lista",
    composableWith: ["Wallet Tracker"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "copy-trade",
    name: "Copy Trade",
    provider: "Altana",
    subcategory: "grid",
    description:
      "Replicates the trades of target wallets. A following strategy composable with grids and radars.",
    protocol: "BSC",
    composableWith: ["Wallet Tracker", "Token Radar"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "four-meme-trading",
    name: "Four.meme Trading",
    provider: "Altana",
    subcategory: "grid",
    description:
      "Trading on Four.meme for momentum and ladder strategies over emerging tokens.",
    protocol: "Four.meme",
    composableWith: ["Token Radar"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "token-radar",
    name: "Token Radar",
    provider: "Altana",
    subcategory: "grid",
    description:
      "Discovers and filters tokens by onchain signals. Feeds candidates to trading and grid strategies.",
    protocol: "BSC",
    composableWith: ["PancakeSwap Trading", "Copy Trade"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "wallet-tracker",
    name: "Wallet Tracker",
    provider: "Altana",
    subcategory: "health",
    description:
      "Tracks wallet positions and health in real time. A foundation for risk and health-factor monitoring.",
    protocol: "BSC",
    composableWith: ["x402 API Payments"],
    link: "https://skills.altana.network",
    source: "curated",
  },
  {
    id: "x402-api-payments",
    name: "x402 API Payments",
    provider: "Altana",
    subcategory: "payments-x402",
    description:
      "Agent-to-agent payments via x402 (EIP-3009). Enables the hire flow and paid task delegation.",
    protocol: "x402",
    composableWith: ["IVL Rebalancer", "Wallet Tracker"],
    link: "https://docs.altana.network/sdk/x402-server",
    source: "curated",
  },
];

// --- Curated: CoinMarketCap skill registry snapshot ------------------------ //
// Analysis skills an agent can call (the registry IVL itself came from). Sourced
// from the live CMC skill registry; listed as ordinary skills. Descriptions are
// condensed for the marketplace card. Run via the CMC agent endpoint.

const CMC_LINK = "https://coinmarketcap.com/api/agent";

const CMC_SKILLS: Skill[] = [
  {
    id: "cmc-rebalance-plan",
    name: "Rebalance Planner",
    provider: "CoinMarketCap",
    subcategory: "rebalancing",
    description:
      "Turns current holdings, target weights and constraints into a concrete rebalance memo — actions, turnover and tolerance bands.",
    protocol: "Portfolio analysis",
    composableWith: ["IVL — Range Quality", "Portfolio Concentration Mapper"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-portfolio-rebalance",
    name: "Portfolio Rebalance Plan",
    provider: "CoinMarketCap",
    subcategory: "rebalancing",
    description:
      "Builds an allocation-level rebalance plan from current holdings, target weights and risk constraints across altcoin and onchain positions.",
    protocol: "Portfolio analysis",
    composableWith: ["Rebalance Planner"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-real-yield-screener",
    name: "Real-Yield Screener",
    provider: "CoinMarketCap",
    subcategory: "yield",
    description:
      "Ranks public yield pools after separating base yield from reward-supported yield, filtering thin-liquidity and noisy rows.",
    protocol: "DeFi analytics",
    composableWith: ["Yield Decay Radar"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["candidate_set"],
  },
  {
    id: "cmc-yield-decay-radar",
    name: "Yield Decay Radar",
    provider: "CoinMarketCap",
    subcategory: "yield",
    description:
      "Flags yield pools most exposed to decay — reward dependency, thin TVL support, weak base yield and headline-APY fragility.",
    protocol: "DeFi analytics",
    composableWith: ["Real-Yield Screener"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["candidate_set"],
  },
  {
    id: "cmc-yield-strategy-builder",
    name: "Yield Strategy Builder",
    provider: "CoinMarketCap",
    subcategory: "yield",
    description:
      "Assembles a yield strategy plan from deployable capital, collateral mix, candidate pools and risk constraints.",
    protocol: "DeFi strategy",
    composableWith: ["Real-Yield Screener", "Protocol Health Audit"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-position-risk-monitor",
    name: "Position Risk Monitor",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Reads liquidation distance, funding drag and margin cushion above the maintenance requirement for a leveraged position, with an alert level.",
    protocol: "Risk monitoring",
    composableWith: ["Liquidation Buffer", "Wallet Tracker"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-liquidation-buffer",
    name: "Liquidation Buffer",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Measures liquidation distance, funding drag and margin buffer for a single position, returning a clear health read.",
    protocol: "Risk monitoring",
    composableWith: ["Position Risk Monitor"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-liquidation-cluster-risk",
    name: "Liquidation Cluster Risk",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Combines retained liquidation history, venue concentration and cluster ladder levels to classify liquidation risk as contained, nearby or dangerous.",
    protocol: "Derivatives data",
    composableWith: ["Liquidation Magnet Levels"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-concentration-mapper",
    name: "Portfolio Concentration Mapper",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Decomposes a portfolio across assets, chains, venues and strategies to show where concentration risk really sits.",
    protocol: "Portfolio risk",
    composableWith: ["Rebalance Planner"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-perp-structure",
    name: "Perp Structure Analysis",
    provider: "CoinMarketCap",
    subcategory: "perps",
    description:
      "Reads perpetual market structure — price/OI relation, CVD, funding and the liquidation map — to tell trend continuation from a crowded squeeze.",
    protocol: "Derivatives data",
    composableWith: ["Liquidation Magnet Levels"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-liquidation-magnet-levels",
    name: "Liquidation Magnet Levels",
    provider: "CoinMarketCap",
    subcategory: "perps",
    description:
      "Ranks nearby liquidation price levels that can act as magnets for a derivatives market, with distance, intensity and side.",
    protocol: "Derivatives data",
    composableWith: ["Perp Structure Analysis", "Liquidation Cluster Risk"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["candidate_set"],
  },
  {
    id: "cmc-onchain-token-scanner",
    name: "Onchain Token Scanner",
    provider: "CoinMarketCap",
    subcategory: "momentum",
    description:
      "Discovery scan of new and active onchain tokens — early liquidity, holder growth and smart-money participation — filtering obvious rug and wash-trading patterns.",
    protocol: "Onchain data",
    composableWith: ["Token Radar"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-protocol-health-audit",
    name: "Protocol Health Audit",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Classifies a protocol as resilient, stable, concentrated or fragile from TVL history, fees and (deep mode) chain, token and treasury breakdown.",
    protocol: "DeFi analytics",
    composableWith: ["Yield Strategy Builder"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-sentiment-shift",
    name: "Sentiment Shift Monitor",
    provider: "CoinMarketCap",
    subcategory: "social-narratives",
    description:
      "Bounded seven-day crypto sentiment read — fear/greed shift, funding crowding and liquidation pressure — as market context, not a signal.",
    protocol: "Sentiment data",
    composableWith: ["Macro Liquidity Monitor"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-macro-liquidity",
    name: "Macro Liquidity Monitor",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Macro liquidity and funding-stress check across reserves, TGA, RRP, front-end spreads and USDJPY before adding or trimming crypto beta.",
    protocol: "Macro data",
    composableWith: ["Sentiment Shift Monitor"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-macro-liquidity-regime",
    name: "Macro Liquidity Regime",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Classifies macro liquidity and carry stress as stable, tightening or deteriorating from net-liquidity change, funding and the carry proxy.",
    protocol: "Macro data",
    composableWith: ["Macro Liquidity Monitor"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-derivatives-risk-memo",
    name: "Derivatives Risk Memo",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Ranks a book of derivatives positions by liquidation stress, funding drag and margin pressure, then turns it into a portfolio risk memo.",
    protocol: "Risk monitoring",
    composableWith: ["Position Risk Monitor", "Liquidation Buffer"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-protocol-risk-memo",
    name: "Protocol Risk Memo",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Assembles a protocol risk memo across smart-contract, oracle, liquidity, economic and centralization dimensions with caller-set controls.",
    protocol: "Risk analysis",
    composableWith: ["Protocol Health Audit"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-portfolio-analysis",
    name: "Portfolio Analysis",
    provider: "CoinMarketCap",
    subcategory: "health",
    description:
      "Reviews a portfolio, separates altcoin from onchain holdings and deep-dives the top-weight holding of each with risk flags and a review queue.",
    protocol: "Portfolio risk",
    composableWith: ["Portfolio Concentration Mapper", "Rebalance Planner"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-liquidation-cascade-risk",
    name: "Liquidation Cascade Risk",
    provider: "CoinMarketCap",
    subcategory: "perps",
    description:
      "Combines retained liquidation and participation data to label cascade risk and the direction of pressure in the current tape.",
    protocol: "Derivatives data",
    composableWith: ["Liquidation Magnet Levels", "Perp Structure Analysis"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-trade-impact-estimator",
    name: "Trade Impact Estimator",
    provider: "CoinMarketCap",
    subcategory: "market-making",
    description:
      "Estimates whether a proposed notional would create excessive execution impact, from retained liquidity and market depth proxies.",
    protocol: "Liquidity data",
    composableWith: ["DEX Volume Quality"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-dex-volume-quality",
    name: "DEX Volume Quality",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Compares chains by DEX volume quality — current daily volume against a recent baseline and short-term spread — to spot real vs inflated flow.",
    protocol: "DeFi analytics",
    composableWith: ["Protocol Health Audit"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["comparison_pack"],
  },
  {
    id: "cmc-protocol-economics",
    name: "Protocol Economics Screen",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Ranks DeFi protocols by revenue-to-TVL and TVL scale to separate protocols that actually earn from those coasting on incentives.",
    protocol: "DeFi analytics",
    composableWith: ["Protocol Health Audit"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-stablecoin-dominance",
    name: "Stablecoin Dominance Shift",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Detects whether a chain's stablecoin structure is shifting — who is gaining or losing share and whether leadership is contested.",
    protocol: "Onchain data",
    composableWith: ["DEX Volume Quality"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-liquidity-decay",
    name: "Liquidity Decay Detector",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Reads a token's retained liquidity history to classify it as stable, moderately decaying or severely decaying over a chosen window.",
    protocol: "Onchain data",
    composableWith: ["Onchain Token Scanner"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-historical-ta",
    name: "Historical TA",
    provider: "CoinMarketCap",
    subcategory: "momentum",
    description:
      "Computes historical technical indicators (RSI, MACD, EMA, Bollinger, ADX and more) for one asset over a bounded candle window.",
    protocol: "Market data",
    composableWith: ["Historical OHLCV"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-historical-ohlcv",
    name: "Historical OHLCV",
    provider: "CoinMarketCap",
    subcategory: "infra-data",
    description:
      "Returns normalized historical candle evidence for one token or DEX pair, with coverage, data-quality gaps and attribution.",
    protocol: "Market data",
    composableWith: ["Historical TA"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-altcoin-deep-analysis",
    name: "Altcoin Deep Analysis",
    provider: "CoinMarketCap",
    subcategory: "momentum",
    description:
      "Resolves one altcoin and returns current quote, completed daily technicals, market depth, content, sector and onchain facts.",
    protocol: "Research",
    composableWith: ["Historical TA"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-defi-trade-thesis",
    name: "DeFi Trade Thesis",
    provider: "CoinMarketCap",
    subcategory: "momentum",
    description:
      "Turns a market view, catalyst evidence and risk controls into a structured trade-thesis memo with an explicit invalidation set.",
    protocol: "Research",
    composableWith: ["Altcoin Deep Analysis"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-memecoin-diligence",
    name: "Memecoin Due Diligence",
    provider: "CoinMarketCap",
    subcategory: "meme-trading",
    description:
      "Onchain diligence on one EVM memecoin — holder concentration, liquidity depth and lock, deployer/contract flags and wash-trading patterns.",
    protocol: "Onchain data",
    composableWith: ["Memecoin Token Profile"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
  {
    id: "cmc-memecoin-profile",
    name: "Memecoin Token Profile",
    provider: "CoinMarketCap",
    subcategory: "meme-trading",
    description:
      "A single memecoin profile — identity, holder distribution, liquidity and trading coverage, security context and bounded narrative signals.",
    protocol: "Onchain data",
    composableWith: ["Memecoin Due Diligence"],
    link: CMC_LINK,
    source: "cmc",
    tags: ["evidence_pack"],
  },
];

/** Curated tier: Altana + IVL + CMC snapshot. Static, always available. */
export const CURATED_SKILLS: Skill[] = [...ALTANA_SKILLS, ...CMC_SKILLS];

/** Back-compat alias (search.json, etc. import `SKILLS`). */
export const SKILLS: Skill[] = CURATED_SKILLS;

/** Finds a skill in the curated tier only. For live skills use skillByIdAsync. */
export function skillById(id: string): Skill | undefined {
  return CURATED_SKILLS.find((s) => s.id === id);
}

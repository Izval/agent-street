/**
 * Layer 2 — curated seed (roadmap §6 · docs/seed-catalog.md).
 *
 * 8004scan (Layer 1, via the proxy) is the real listing that counts. This seed
 * fulfills two honest roles:
 *   (a) FALLBACK — if the proxy is down/rate-limited, the 4 categories never
 *       end up blank in front of the jury.
 *   (b) ENRICHMENT — fills out thin categories to deliver "Agent Diversity".
 *
 * Everything here carries `source:"seed"` → the UI shows a `curated` badge, it
 * never pretends to be live onchain data.
 *
 * Data taken from real projects of the BNB Hack cohort (Jun 2026); metrics are
 * curated placeholders except where the project published a track record.
 */

import type { Agent } from "./agents";
import type { Category } from "./categories";
import { CATEGORY_LABELS } from "./categories";

type SeedInput = Omit<
  Agent,
  "agentId" | "chainId" | "categoryLabel" | "source" | "tokenId"
> & { tokenId?: string };

function seed(a: SeedInput): Agent {
  const tokenId = a.tokenId ?? a.id;
  return {
    agentId: `56:${a.contractAddress ?? "0x0"}:${tokenId}`,
    chainId: 56,
    tokenId,
    categoryLabel: a.category ? CATEGORY_LABELS[a.category] : null,
    source: "seed",
    ...a,
  };
}

export const SEED_AGENTS: Agent[] = [
  // --- Rebalancing ---
  seed({
    id: "ivl-rebalancer",
    name: "IVL Rebalancer",
    description:
      "Reads live range quality from the IVL engine and repositions a concentrated liquidity position on PancakeSwap v3 — optimal range, managed onchain.",
    category: "rebalancing",
    stars: 5,
    score: 96,
    avgScore: 4.8,
    feedbacks: 42,
    healthScore: 92,
    isVerified: true,
    x402Supported: true,
    supportedProtocols: ["PancakeSwap v3", "ERC-8004", "ERC-8183", "x402"],
    tags: ["rebalancing", "clmm", "pancakeswap", "ivl"],
  }),
  // --- Grid ---
  seed({
    id: "gridora-140004",
    tokenId: "140004",
    name: "Gridora",
    description:
      "Non-custodial grid trading with an onchain TradeJournal. Real track record: 38 episodes, 58% win-rate, +18.77% PnL. Signs via Trust Wallet Agent Kit.",
    category: "grid",
    contractAddress: "0x0000000000000000000000000000000000140004",
    stars: 4,
    score: 88,
    avgScore: 4.5,
    feedbacks: 38,
    healthScore: 80,
    isVerified: true,
    x402Supported: false,
    supportedProtocols: ["ERC-8004", "Trust Wallet Agent Kit"],
    tags: ["grid", "non-custodial", "trade-journal"],
  }),
  seed({
    id: "gridsentinel",
    name: "Grid Sentinel",
    description:
      "Volatility-adaptive grid order ladder over liquid BSC pairs; dynamic grid width.",
    category: "grid",
    stars: 3,
    score: 74,
    avgScore: 4.1,
    feedbacks: 19,
    healthScore: 71,
    isVerified: false,
    x402Supported: false,
    tags: ["grid", "ladder", "volatility"],
  }),
  // --- Yield ---
  seed({
    id: "metayieldvault",
    name: "MetaYieldVault",
    description:
      "Routes capital to the best APY across Venus, Aave V3 and Lista on BSC; automated yield rebalancing.",
    category: "yield",
    stars: 4,
    score: 82,
    avgScore: 4.3,
    feedbacks: 27,
    healthScore: 78,
    isVerified: true,
    x402Supported: true,
    supportedProtocols: ["Venus", "Aave V3", "Lista"],
    tags: ["yield", "apy", "vault", "lending"],
  }),
  seed({
    id: "stakepilot",
    name: "StakePilot",
    description:
      "Optimizes liquid staking (Lista slisBNB) and auto-compounds rewards while keeping exit liquidity.",
    category: "yield",
    stars: 3,
    score: 69,
    avgScore: 4.0,
    feedbacks: 14,
    healthScore: 73,
    isVerified: false,
    x402Supported: false,
    supportedProtocols: ["Lista Liquid Staking"],
    tags: ["yield", "staking", "compound"],
  }),
  // --- Health Factor ---
  seed({
    id: "guarded-alpha",
    name: "Guarded Alpha",
    description:
      "Watches the health factor of lending positions and deleverages before liquidation. 24/7 position protection.",
    category: "health",
    stars: 4,
    score: 79,
    avgScore: 4.2,
    feedbacks: 22,
    healthScore: 88,
    isVerified: true,
    x402Supported: false,
    supportedProtocols: ["Venus", "Aave V3"],
    tags: ["health-factor", "liquidation", "risk"],
  }),
  seed({
    id: "safeagent",
    name: "SafeAgent",
    description:
      "Risk monitor with configurable parameters (LTV, collateral) built on WDK/Tether; alerts and acts on solvency drops.",
    category: "health",
    stars: 3,
    score: 72,
    avgScore: 4.1,
    feedbacks: 17,
    healthScore: 84,
    isVerified: false,
    x402Supported: false,
    supportedProtocols: ["WDK", "Venus"],
    tags: ["health-factor", "ltv", "collateral", "monitor"],
  }),
  seed({
    id: "regime-guard",
    name: "Regime Guard",
    description:
      "Detects market regime shifts and adjusts exposure to protect collateral during high volatility.",
    category: "health",
    stars: 3,
    score: 66,
    avgScore: 3.9,
    feedbacks: 11,
    healthScore: 80,
    isVerified: false,
    x402Supported: false,
    tags: ["health-factor", "regime", "risk-monitor"],
  }),
];

export function seedByCategory(cat: Category): Agent[] {
  return SEED_AGENTS.filter((a) => a.category === cat);
}

export function seedAgentById(id: string): Agent | undefined {
  return SEED_AGENTS.find((a) => a.id === id || a.tokenId === id);
}

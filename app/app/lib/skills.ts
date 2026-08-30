/**
 * Curated catalog of composable Skills (Skills tab).
 *
 * Skills do NOT come from 8004scan (those are agents). They are modules an agent
 * plugs in (ERC-8183 / Altana skills). Source: the 10 Altana skills
 * (skills.altana.network) + the IVL range-quality skill, all as ordinary
 * composable listings.
 */

import type { Category } from "./categories";

export type SkillProvider = "IVL" | "Altana";

export interface Skill {
  id: string;
  name: string;
  provider: SkillProvider;
  category: Category;
  description: string;
  /** Protocol/venue the skill touches. */
  protocol: string;
  /** Which other skills/agents it composes well with. */
  composableWith: string[];
  link: string;
}

export const SKILLS: Skill[] = [
  {
    id: "ivl",
    name: "IVL — Range Quality",
    provider: "IVL",
    category: "rebalancing",
    description:
      "Scores the quality of a range for concentrated liquidity and returns tickLower/tickUpper ready for PancakeSwap v3. The brain of rebalancing, pluggable into any agent.",
    protocol: "PancakeSwap v3",
    composableWith: ["PancakeSwap Liquidity", "IVL Rebalancer"],
    link: "https://api.zvlint.com",
  },
  {
    id: "pancakeswap-liquidity",
    name: "PancakeSwap Liquidity",
    provider: "Altana",
    category: "rebalancing",
    description:
      "Opens and manages liquidity positions on PancakeSwap. Composable LP execution for rebalancing agents.",
    protocol: "PancakeSwap",
    composableWith: ["IVL — Range Quality"],
    link: "https://skills.altana.network",
  },
  {
    id: "pancakeswap-trading",
    name: "PancakeSwap Trading",
    provider: "Altana",
    category: "rebalancing",
    description:
      "Swaps and trading on PancakeSwap with best-price routing. Execution layer for onchain strategies.",
    protocol: "PancakeSwap",
    composableWith: ["Token Radar"],
    link: "https://skills.altana.network",
  },
  {
    id: "aave-v3-lending",
    name: "Aave V3 Lending",
    provider: "Altana",
    category: "yield",
    description:
      "Deposit, borrow and manage positions on Aave V3. A yield and collateral-management component.",
    protocol: "Aave V3",
    composableWith: ["Venus Lending"],
    link: "https://skills.altana.network",
  },
  {
    id: "venus-lending",
    name: "Venus Lending",
    provider: "Altana",
    category: "yield",
    description:
      "Supply and borrow on Venus (BSC). A yield engine and a health-factor data source.",
    protocol: "Venus",
    composableWith: ["Aave V3 Lending"],
    link: "https://skills.altana.network",
  },
  {
    id: "lista-liquid-staking",
    name: "Lista Liquid Staking",
    provider: "Altana",
    category: "yield",
    description:
      "Liquid staking of BNB via Lista (slisBNB) with rewards and exit liquidity.",
    protocol: "Lista",
    composableWith: ["Wallet Tracker"],
    link: "https://skills.altana.network",
  },
  {
    id: "copy-trade",
    name: "Copy Trade",
    provider: "Altana",
    category: "grid",
    description:
      "Replicates the trades of target wallets. A following strategy composable with grids and radars.",
    protocol: "BSC",
    composableWith: ["Wallet Tracker", "Token Radar"],
    link: "https://skills.altana.network",
  },
  {
    id: "four-meme-trading",
    name: "Four.meme Trading",
    provider: "Altana",
    category: "grid",
    description:
      "Trading on Four.meme for momentum and ladder strategies over emerging tokens.",
    protocol: "Four.meme",
    composableWith: ["Token Radar"],
    link: "https://skills.altana.network",
  },
  {
    id: "token-radar",
    name: "Token Radar",
    provider: "Altana",
    category: "grid",
    description:
      "Discovers and filters tokens by onchain signals. Feeds candidates to trading and grid strategies.",
    protocol: "BSC",
    composableWith: ["PancakeSwap Trading", "Copy Trade"],
    link: "https://skills.altana.network",
  },
  {
    id: "wallet-tracker",
    name: "Wallet Tracker",
    provider: "Altana",
    category: "health",
    description:
      "Tracks wallet positions and health in real time. A foundation for risk and health-factor monitoring.",
    protocol: "BSC",
    composableWith: ["x402 API Payments"],
    link: "https://skills.altana.network",
  },
  {
    id: "x402-api-payments",
    name: "x402 API Payments",
    provider: "Altana",
    category: "health",
    description:
      "Agent-to-agent payments via x402 (EIP-3009). Enables the hire flow and paid task delegation.",
    protocol: "x402",
    composableWith: ["IVL Rebalancer", "Wallet Tracker"],
    link: "https://docs.altana.network/sdk/x402-server",
  },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

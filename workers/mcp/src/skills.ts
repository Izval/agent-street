// skills.ts — embedded copy of the curated Skills catalog.
//
// Skills are NOT indexed by 8004scan (those are agents); they are a curated,
// static catalog. Cross-package import is impossible in a Workers bundle, so we
// embed a trimmed copy here (same MIRROR pattern the other workers use).
// KEEP IN SYNC with app/app/lib/skills.ts — if a skill is added/renamed there,
// mirror it here. Only the fields an orchestrator needs are kept.

export interface Skill {
  id: string;
  name: string;
  provider: "IVL" | "Altana";
  category: string;
  flagship?: boolean;
  description: string;
  protocol: string;
  composableWith: string[];
  link: string;
}

export const SKILLS: Skill[] = [
  {
    id: "ivl",
    name: "IVL — Range Quality",
    provider: "IVL",
    category: "rebalancing",
    flagship: true,
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

/**
 * Catálogo curado de Skills componibles (tab Skills).
 *
 * Las skills NO vienen de 8004scan (eso son agentes). Son módulos que un agente
 * enchufa (ERC-8183 / skills de Altana). Fuente: las 10 skills de Altana
 * (skills.altana.network) + IVL Skill como flagship (roadmap §6, CLAUDE.md §5).
 *
 * IVL se lista DOS veces en el marketplace: como Agent (lib/seed.ts) y como
 * Skill (aquí) — demuestra la composabilidad.
 */

import type { Category } from "./categories";

export type SkillProvider = "IVL" | "Altana";

export interface Skill {
  id: string;
  name: string;
  provider: SkillProvider;
  category: Category;
  flagship?: boolean;
  description: string;
  /** Protocolo/venue que toca la skill. */
  protocol: string;
  /** Con qué otras skills/agentes compone bien. */
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
      "Puntúa la calidad de un rango para liquidez concentrada y devuelve tickLower/tickUpper listos para PancakeSwap v3. El cerebro del rebalanceo, enchufable a cualquier agente.",
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
      "Abre y gestiona posiciones de liquidez en PancakeSwap. Ejecución LP componible para agentes de rebalanceo.",
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
      "Swaps y trading en PancakeSwap con enrutamiento de mejor precio. Base de ejecución para estrategias onchain.",
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
      "Depósito, préstamo y gestión de posiciones en Aave V3. Componente de yield y de gestión de colateral.",
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
      "Suministro y préstamo en Venus (BSC). Motor de yield y fuente de datos de health factor.",
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
      "Liquid staking de BNB vía Lista (slisBNB) con recompensas y liquidez de salida.",
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
      "Replica las operaciones de wallets objetivo. Estrategia de seguimiento componible con grids y radares.",
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
      "Trading en Four.meme para estrategias de momentum y ladder sobre tokens emergentes.",
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
      "Descubre y filtra tokens por señales onchain. Alimenta estrategias de trading y grid con candidatos.",
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
      "Rastrea posiciones y salud de wallets en tiempo real. Base de monitoreo de riesgo y health factor.",
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
      "Pagos entre agentes vía x402 (EIP-3009). Habilita el hire flow y la delegación de tareas pagada.",
    protocol: "x402",
    composableWith: ["IVL Rebalancer", "Wallet Tracker"],
    link: "https://docs.altana.network/sdk/x402-server",
  },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

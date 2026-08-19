/**
 * Capa 2 — seed curado (roadmap §6 · docs/seed-catalog.md).
 *
 * 8004scan (Capa 1, vía el proxy) es el listado real que cuenta. Este seed
 * cumple dos roles honestos:
 *   (a) FALLBACK — si el proxy está caído/rate-limitado, las 4 categorías nunca
 *       quedan en blanco frente al jurado.
 *   (b) ENRIQUECIMIENTO — rellena categorías flacas para dar "Agent Diversity".
 *
 * Todo aquí lleva `source:"seed"` → la UI muestra badge `curated`, nunca finge
 * ser dato onchain en vivo. El flagship IVL además trae score en vivo de
 * api.zvlint.com (ver routes/home.tsx), no de aquí.
 *
 * Datos tomados de proyectos reales de la cohorte BNB Hack (jun 2026); métricas
 * son placeholders curados salvo donde el proyecto publicó track record.
 */

import type { Agent } from "./agents";
import type { Category } from "./categories";
import { CATEGORY_LABELS } from "./categories";

/** id estable del flagship IVL en el marketplace (Agent + Skill). */
export const FLAGSHIP_ID = "ivl-rebalancer";

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
  // --- Rebalancing (flagship) ---
  seed({
    id: FLAGSHIP_ID,
    name: "IVL Rebalancer",
    description:
      "Lee la calidad de rango en vivo del motor IVL y reposiciona una posición de liquidez concentrada en PancakeSwap v3 — rango óptimo, gestionado onchain.",
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
      "Grid trading non-custodial con TradeJournal onchain. Track record real: 38 episodios, 58% win-rate, +18.77% PnL. Firma vía Trust Wallet Agent Kit.",
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
      "Ladder de órdenes grid adaptativo por volatilidad sobre pares BSC líquidos; ancho de grid dinámico.",
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
      "Enruta capital al mejor APY entre Venus, Aave V3 y Lista en BSC; rebalanceo de yield automatizado.",
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
      "Optimiza liquid staking (Lista slisBNB) y auto-compone recompensas manteniendo liquidez de salida.",
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
      "Vigila el health factor de posiciones de préstamo y desapalanca antes de la liquidación. Protección de posición 24/7.",
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
      "Monitor de riesgo con parámetros configurables (LTV, colateral) construido sobre WDK/Tether; alerta y actúa ante caídas de solvencia.",
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
      "Detecta cambios de régimen de mercado y ajusta la exposición para proteger el colateral en volatilidad alta.",
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

// classify.ts — clasifica agentes ERC-8004 en las 4 categorías del reto.
//
// El track principal exige "Agent Diversity": trato igual a Rebalancing · Grid ·
// Yield · Health Factor (plan.md §1). 8004scan devuelve agentes heterogéneos; los
// mapeamos por keywords en nombre/descripcion/skills/tags. Heurística determinista
// y barata; se afina cuando conozcamos los tags reales de 8004scan.

export type Category = "rebalancing" | "grid" | "yield" | "health";

export const CATEGORIES: readonly Category[] = [
  "rebalancing",
  "grid",
  "yield",
  "health",
] as const;

export const CATEGORY_LABELS: Record<Category, string> = {
  rebalancing: "Rebalancing",
  grid: "Grid Trading",
  yield: "Yield Optimization",
  health: "Health Factor Monitoring",
};

// Keywords por categoría (minúsculas). Orden de evaluación = prioridad.
const RULES: Array<{ category: Category; kw: RegExp }> = [
  {
    category: "rebalancing",
    kw: /\b(rebalanc|liquidity\s*range|concentrated\s*liquidity|\bclmm\b|reposition|\blp\b|tick|ivl|range\s*order)\b/i,
  },
  {
    category: "grid",
    kw: /\b(grid|dca\s*grid|ladder|martingale)\b/i,
  },
  {
    category: "yield",
    kw: /\b(yield|apy|apr|farm|stak|lend|vault|aave|venus|lista|compound|optimi[sz])\b/i,
  },
  {
    category: "health",
    kw: /\b(health\s*factor|liquidation|collateral|risk\s*monitor|guard|safe|solvenc|ltv)\b/i,
  },
];

/** Texto de un agente a considerar para clasificar. */
export interface Classifiable {
  name?: string;
  description?: string;
  skills?: string[];
  tags?: string[];
}

/**
 * Devuelve la categoría del agente, o null si ninguna keyword aplica.
 * Un agente puede exhibir varias señales; devolvemos la primera por prioridad
 * (rebalancing gana a grid, etc.) para mantener el listado determinista.
 */
export function classifyAgent(a: Classifiable): Category | null {
  const hay = [
    a.name ?? "",
    a.description ?? "",
    ...(a.skills ?? []),
    ...(a.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  for (const { category, kw } of RULES) {
    if (kw.test(hay)) return category;
  }
  return null;
}

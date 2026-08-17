/**
 * Las 4 categorías del reto (plan.md §1) — trato igual para "Agent Diversity".
 * Espeja los ids/labels del Worker proxy (workers/8004-proxy/src/classify.ts).
 * Mantener en sync: el proxy clasifica; el front rotula/filtra por estos ids.
 */
export type Category = "rebalancing" | "grid" | "yield" | "health";

export const CATEGORY_LABELS: Record<Category, string> = {
  rebalancing: "Rebalancing",
  grid: "Grid Trading",
  yield: "Yield Optimization",
  health: "Health Factor Monitoring",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

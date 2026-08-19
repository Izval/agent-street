/**
 * Fila de categoría para el home: título + "ver todos →" + grid de AgentCard.
 * Las 4 categorías se renderizan iguales (Agent Diversity visible de un vistazo).
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { CATEGORY_LABELS, type Category } from "../lib/categories";
import { AgentCard } from "./AgentCard";
import { FLAGSHIP_ID } from "../lib/seed";

export function CategoryRow({
  category,
  agents,
}: {
  category: Category;
  agents: Agent[];
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-text">
          {CATEGORY_LABELS[category]}
        </h2>
        <Link
          to={`/category/${category}`}
          className="text-sm font-semibold text-text-2 transition-colors hover:text-brand"
        >
          Ver todos →
        </Link>
      </div>
      {agents.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} featured={a.id === FLAGSHIP_ID} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-text-3">
          Sin agentes en esta categoría ahora mismo.
        </p>
      )}
    </section>
  );
}

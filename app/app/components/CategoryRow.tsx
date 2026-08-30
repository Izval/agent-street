/**
 * Category row for the home page: title + "see all →" + grid of AgentCards.
 * The 4 categories render identically (Agent Diversity visible at a glance).
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { CATEGORY_LABELS, type Category } from "../lib/categories";
import { AgentCard } from "./AgentCard";

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
          See all →
        </Link>
      </div>
      {agents.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-text-3">
          No agents in this category right now.
        </p>
      )}
    </section>
  );
}

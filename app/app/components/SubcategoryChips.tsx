/**
 * Subcategory chips (DESIGN.md §5): pill --surface-2; active state has --bg text over
 * --brand. Link to /subcategory/:id. Equal treatment for the 4 (Agent Diversity).
 */

import { Link } from "react-router";
import { SUBCATEGORIES, SUBCATEGORY_LABELS, type Subcategory } from "../lib/subcategories";

export function SubcategoryChips({ active }: { active?: Subcategory }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUBCATEGORIES.map((id) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            to={`/subcategory/${id}`}
            className={
              "rounded-[999px] px-4 py-1.5 text-sm font-semibold transition-colors " +
              (isActive
                ? "bg-brand text-bg"
                : "bg-surface-2 text-text-2 hover:text-text")
            }
          >
            {SUBCATEGORY_LABELS[id]}
          </Link>
        );
      })}
    </div>
  );
}

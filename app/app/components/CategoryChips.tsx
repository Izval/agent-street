/**
 * Category chips (DESIGN.md §5): pill --surface-2; active state has --bg text over
 * --brand. Link to /category/:id. Equal treatment for the 4 (Agent Diversity).
 */

import { Link } from "react-router";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "../lib/categories";

export function CategoryChips({ active }: { active?: Category }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((id) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            to={`/category/${id}`}
            className={
              "rounded-[999px] px-4 py-1.5 text-sm font-semibold transition-colors " +
              (isActive
                ? "bg-brand text-bg"
                : "bg-surface-2 text-text-2 hover:text-text")
            }
          >
            {CATEGORY_LABELS[id]}
          </Link>
        );
      })}
    </div>
  );
}

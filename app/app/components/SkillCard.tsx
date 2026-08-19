/**
 * Card de skill (DESIGN.md §5). Skills componibles — provider + categoría.
 * IVL flagship con gradiente de marca sutil.
 */

import { Link } from "react-router";
import type { Skill } from "../lib/skills";
import { CATEGORY_LABELS } from "../lib/categories";

export function SkillCard({ skill }: { skill: Skill }) {
  const featured = skill.flagship;
  return (
    <Link
      to={`/skill/${encodeURIComponent(skill.id)}`}
      className={
        "group flex min-w-0 flex-col rounded-lg border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_4px_12px_rgba(0,0,0,0.32)] " +
        (featured ? "border-brand/40" : "border-border")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-text">{skill.name}</h3>
        <span
          className={
            "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-semibold " +
            (skill.provider === "IVL"
              ? "bg-brand text-bg"
              : "bg-surface-2 text-text-2")
          }
        >
          {skill.provider}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-[999px] bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-2">
          {CATEGORY_LABELS[skill.category]}
        </span>
        <span className="text-[11px] text-text-3">{skill.protocol}</span>
      </div>
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-text-2">
        {skill.description}
      </p>
    </Link>
  );
}

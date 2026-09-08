/**
 * Skill card (DESIGN.md §5). Composable skills — provider + subcategory.
 * Steam-style hover: side flyout (portal) with full description + provider +
 * protocol + subcategory.
 */

import { Link } from "react-router";
import type { Skill } from "../lib/skills";
import { subcategoryLabel } from "../lib/taxonomy";
import { Flyout, useHoverFlyout } from "./Flyout";

export function SkillCard({ skill }: { skill: Skill }) {
  const { open, rect, anchorRef, anchorProps } = useHoverFlyout();
  const providerCls = "bg-surface-2 text-text-2";

  return (
    <>
      <Link
        ref={anchorRef as React.Ref<HTMLAnchorElement>}
        {...anchorProps}
        to={`/skill/${encodeURIComponent(skill.id)}`}
        className="group flex min-w-0 flex-col rounded-lg border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_4px_12px_rgba(0,0,0,0.32)]"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-text">{skill.name}</h3>
          <span
            className={
              "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-semibold " +
              providerCls
            }
          >
            {skill.provider}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-[999px] bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-2">
            {subcategoryLabel(skill.subcategory)}
          </span>
          <span className="text-[11px] text-text-3">{skill.protocol}</span>
        </div>
        <p className="mt-3 line-clamp-3 flex-1 text-sm text-text-2">
          {skill.description}
        </p>
      </Link>

      {/* Steam-style flyout: full description + metadata. */}
      <Flyout open={open} rect={rect} {...anchorProps}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 text-base font-semibold text-text">
            {skill.name}
          </h4>
          <span
            className={
              "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-semibold " +
              providerCls
            }
          >
            {skill.provider}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-[999px] bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-2">
            {subcategoryLabel(skill.subcategory)}
          </span>
          <span className="text-[11px] text-text-3">{skill.protocol}</span>
        </div>
        <p className="mt-3 max-h-[9rem] overflow-y-auto text-sm leading-relaxed text-text-2">
          {skill.description}
        </p>
        <div className="mt-3 text-[11px] font-medium text-text-3">
          View skill →
        </div>
      </Flyout>
    </>
  );
}

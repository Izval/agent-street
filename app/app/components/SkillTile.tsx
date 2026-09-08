/**
 * SkillTile — cover-first skill card for the browser grid (DESIGN.md v3).
 *
 * The "portada" is deterministic abstract cover art (coverStyle, seeded by id,
 * tinted by the subcategory accent) — no stock images, SSR-safe, on-brand. The
 * cover carries the visual weight; the footer stays quiet: name + 2-line blurb.
 * A subcategory chip sits on the cover; verified skills get a small check. No
 * provider/source badge (that's provenance, not something the shopper needs on
 * the card).
 */

import { Link } from "react-router";
import type { SkillListItem } from "../lib/skills-live";
import { accentForSubcategory, coverStyle } from "../lib/cover";

export function SkillTile({ skill }: { skill: SkillListItem }) {
  const accent = accentForSubcategory(skill.subcategory);

  return (
    <Link
      to={`/skill/${encodeURIComponent(skill.id)}`}
      aria-label={skill.name}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-border/60 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-1 hover:shadow-[var(--elev-2)]"
    >
      {/* Cover — the protagonist. */}
      <div
        className="relative aspect-[5/3] w-full"
        style={coverStyle(skill.id, accent)}
      >
        {/* Subcategory accent hairline. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-80"
          style={{ background: accent }}
        />
        {/* Bottom vignette so the chip stays legible over any art. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
        />
        <span className="glass-hair absolute bottom-2.5 left-2.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold text-text">
          {skill.subcategoryLabel}
        </span>
        {skill.verified && (
          <span
            title="Security-scanned"
            className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-[12px] font-bold text-up ring-1 ring-white/15 backdrop-blur"
          >
            ✓
          </span>
        )}
      </div>

      {/* Footer — quiet. */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-[15px] font-bold text-text group-hover:text-brand">
          {skill.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-2">
          {skill.blurb}
        </p>
      </div>
    </Link>
  );
}

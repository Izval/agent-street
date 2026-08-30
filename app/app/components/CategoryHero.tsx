/**
 * CategoryHero — editorial banner for a category page (DESIGN.md v3 §12/§20).
 *
 * Full-bleed cover (abstract `coverStyle` art tinted with the aisle accent),
 * legibility gradient and a white text block at the bottom-left: eyebrow
 * (aisle · template), large title, editorial tagline and a row of honest
 * metadata (agent count + data source). Optional CTA for the flagship.
 *
 * SSR-safe: pure component (no `window`, no effects). Yellow is reserved
 * for the CTA/active state; here it only appears as a subtle glow via `.glow-brand`.
 */

import { Link } from "react-router";
import { coverStyle } from "../lib/cover";
import { SourceBadge } from "./Badge";
import type { AgentSource } from "../lib/agents";

export interface CategoryHeroProps {
  label: string;
  /** Eyebrow text (e.g. the parent category of a subcategory). */
  eyebrow: string;
  /** If passed, the eyebrow is a link to the parent category (breadcrumb ‹). */
  parentTo?: string | null;
  tagline: string;
  count: number;
  source: AgentSource;
  templateLabel: string;
  accent?: string | null;
  /** Cover art seed (stable category id). */
  coverSeed: string;
  live?: boolean;
  cta?: { to: string; label: string } | null;
}

export function CategoryHero({
  label,
  eyebrow,
  parentTo,
  tagline,
  count,
  source,
  templateLabel,
  accent,
  coverSeed,
  live,
  cta,
}: CategoryHeroProps) {
  const acc = accent ?? "var(--brand)";

  return (
    <section
      aria-label={parentTo ? `Subcategory ${label}` : `Category ${label}`}
      className="relative isolate overflow-hidden rounded-2xl shadow-[var(--elev-hero)]"
    >
      {/* Abstract cover. */}
      <div
        aria-hidden
        className="kenburns absolute inset-0 -z-10"
        style={coverStyle(coverSeed, acc)}
      />
      {/* Subtle brand glow (sparingly). */}
      {live && (
        <div
          aria-hidden
          className="glow-brand pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72"
        />
      )}
      {/* Legibility gradient. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.4) 42%, rgba(0,0,0,0) 76%), linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 58%)",
        }}
      />

      <div className="flex min-h-[240px] flex-col justify-end p-6 sm:min-h-[300px] sm:p-9 lg:min-h-[340px] lg:p-11">
        <div className="max-w-[56ch]">
          {live && (
            <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
              Live
            </span>
          )}
          {parentTo ? (
            <Link
              to={parentTo}
              className="flex w-fit items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75 transition-colors hover:text-white"
            >
              <span aria-hidden>‹</span> {eyebrow}
            </Link>
          ) : (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-1.5 text-3xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-4xl lg:text-5xl">
            {label}
          </h1>
          <p className="mt-2.5 max-w-[48ch] text-sm text-white/85 md:text-base">
            {tagline}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="tnum rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
              {count.toLocaleString("en-US")} agents
            </span>
            <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white/80 backdrop-blur-md">
              {templateLabel}
            </span>
            <SourceBadge source={source} />
            {cta && (
              <Link
                to={cta.to}
                className="ml-1 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-bg transition-colors hover:bg-brand-bright"
              >
                {cta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

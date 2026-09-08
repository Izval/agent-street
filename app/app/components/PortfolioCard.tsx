/**
 * PortfolioCard — a curated/user SET of agents as a merchandising card.
 *
 * Generative cover (lib/cover.ts) + name + tagline + a member avatar stack +
 * an HONEST aggregate strip (avg 8004scan score, member count, verified, x402).
 * No invented performance — every figure is a real 8004scan aggregate. Links to
 * `/portfolio/:slug`. Mirrors AgentCard's glass-panel language (DESIGN.md v3).
 */

import { Link } from "react-router";
import type { ResolvedPortfolio } from "../lib/portfolios";
import { coverStyle } from "../lib/cover";
import { scoreTone } from "../lib/score";

const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function PortfolioCard({ portfolio }: { portfolio: ResolvedPortfolio }) {
  const { slug, name, tagline, accent, coverKey, agents, aggregate, stats } = portfolio;
  const avgTone = aggregate.avgScore != null ? scoreTone(aggregate.avgScore) : undefined;

  return (
    <Link
      to={`/portfolio/${encodeURIComponent(slug)}`}
      className="group glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-lg transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-0.5 hover:shadow-[var(--elev-2)]"
    >
      {/* Cover with the member avatar stack. */}
      <div
        className="relative h-28 w-full overflow-hidden"
        style={coverStyle(coverKey, accent)}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: accent }}
        />
        <div className="absolute bottom-3 left-4 flex items-center">
          {agents.slice(0, 5).map((a, i) => (
            <span
              key={a.id}
              className="grid h-9 w-9 place-items-center rounded-full border-2 border-bg bg-surface-2 text-[11px] font-bold text-text-2"
              style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}
              title={a.name}
            >
              {initials(a.name)}
            </span>
          ))}
          {agents.length > 5 && (
            <span
              className="ml-1 grid h-9 min-w-9 place-items-center rounded-full border-2 border-bg bg-surface px-1.5 text-[11px] font-semibold text-text-3"
              style={{ marginLeft: -10, zIndex: 4 }}
            >
              +{agents.length - 5}
            </span>
          )}
        </div>
      </div>

      {/* Body. */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3.5 w-1 rounded-[999px]"
            style={{ background: accent }}
          />
          <h3 className="truncate text-base font-semibold text-text">{name}</h3>
          <span className="ml-auto rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-3">
            Portfolio
          </span>
        </div>

        <p className="mt-2 line-clamp-2 flex-1 text-sm text-text-2">{tagline}</p>

        {/* Honest aggregate strip — real 8004scan fields only. */}
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border/60 pt-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-text-3">Agents</div>
            <div className="tnum text-sm font-semibold text-text">{aggregate.count}</div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] text-text-3">Avg score</div>
            <div
              className={`tnum text-sm font-semibold ${avgTone ? TONE_TEXT[avgTone] : "text-text"}`}
            >
              {aggregate.avgScore != null ? aggregate.avgScore.toFixed(1) : "—"}
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] text-text-3">Verified</div>
            <div className="tnum text-sm font-semibold text-text">
              {aggregate.verifiedCount}
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] text-text-3">x402</div>
            <div className="tnum text-sm font-semibold text-text">{aggregate.x402Count}</div>
          </div>
        </div>

        {/* Optional first-party demand (Phase B). Honest: hidden when null. */}
        {stats?.copies != null && (
          <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-text-3">
            <span className="tnum">{stats.copies} copies</span>
            {stats.hireAlls != null && <span className="tnum">{stats.hireAlls} hires</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

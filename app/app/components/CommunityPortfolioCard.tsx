/**
 * CommunityPortfolioCard — compact card for a USER portfolio from the worker.
 *
 * Unlike PortfolioCard it doesn't resolve members through the proxy (that would
 * be N calls per card on a list page) — it shows what the worker already
 * returns: name, tagline, member count, creator, and first-party demand
 * (copies/hires). Members resolve on the detail page when clicked.
 */

import { Link } from "react-router";
import type { UserPortfolio } from "../lib/portfolios-client";
import { coverStyle } from "../lib/cover";

export function CommunityPortfolioCard({ portfolio }: { portfolio: UserPortfolio }) {
  const { slug, name, tagline, members, creator, stats } = portfolio;
  const accent = "var(--brand)";

  return (
    <Link
      to={`/portfolio/${encodeURIComponent(slug)}`}
      className="group glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-lg transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-0.5 hover:shadow-[var(--elev-2)]"
    >
      <div className="relative h-20 w-full overflow-hidden" style={coverStyle(`portfolio-${slug}`, accent)}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: accent }}
        />
        <span className="absolute bottom-2 right-3 rounded-[999px] bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
          Community
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate text-base font-semibold text-text">{name}</h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-text-2">{tagline}</p>

        <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-text-3">
          <span className="tnum">
            <span className="font-semibold text-text">{members.length}</span> agents
          </span>
          <span className="tnum">
            <span className="font-semibold text-text">{stats.copies}</span> copies
          </span>
          <span className="tnum">
            <span className="font-semibold text-text">{stats.hireAlls}</span> hires
          </span>
          {creator?.address && (
            <span className="ml-auto truncate">
              by {creator.label ?? `${creator.address.slice(0, 6)}…`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

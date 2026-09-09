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
import { SavePortfolioButton } from "./SavePortfolioButton";

const VIS_LABEL: Record<"unlisted" | "private", string> = {
  unlisted: "Unlisted",
  private: "Private",
};

export function CommunityPortfolioCard({ portfolio }: { portfolio: UserPortfolio }) {
  const { slug, name, members, creator, stats, visibility } = portfolio;
  const accent = "var(--brand)";
  const creatorLabel =
    creator?.address != null ? (creator.label ?? `${creator.address.slice(0, 6)}…`) : null;
  const nonPublic = visibility === "unlisted" || visibility === "private";

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
        {/* Bookmark — top-right over the cover. */}
        <div className="absolute right-2 top-2 z-10">
          <SavePortfolioButton
            portfolio={{
              slug,
              name,
              creatorLabel,
              memberCount: members.length,
              coverKey: `portfolio-${slug}`,
            }}
          />
        </div>
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="rounded-[999px] bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
            Community
          </span>
          {nonPublic && (
            <span className="rounded-[999px] bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 backdrop-blur-sm">
              {VIS_LABEL[visibility!]}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate text-base font-semibold text-text">{name}</h3>
        <div className="flex-1" />

        <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-text-3">
          <span className="tnum">
            <span className="font-semibold text-text">{members.length}</span> agents
          </span>
          <span className="tnum inline-flex items-center gap-1">
            <span aria-hidden className="text-brand">
              ♥
            </span>
            <span className="font-semibold text-text">{stats.likes ?? 0}</span>
          </span>
          <span className="tnum">
            <span className="font-semibold text-text">{stats.copies}</span> copies
          </span>
          {creatorLabel && <span className="ml-auto truncate">by {creatorLabel}</span>}
        </div>
      </div>
    </Link>
  );
}

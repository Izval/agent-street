/**
 * PortfolioCard — a curated/user SET of agents as a collectible "squad" card.
 *
 * The cover is a prominent TEAM ROSTER of the member agents' real portraits, in
 * one of two layouts:
 *   • ≤3 members → a box-art LINEUP: the top-scored member centered, forward and
 *     larger (the protagonist), the rest fanning out behind it (overlap + a
 *     decreasing-height falloff).
 *   • >3 members → an even GRID of equal columns filling the cover (no height
 *     falloff), capped at ROSTER_MAX with a trailing "+N" column for the rest.
 * Each face reuses AgentCard's image-first technique (a blurred copy of the same
 * image as a color aura + object-cover portrait + deterministic initial
 * fallback), so the card reads as a PACK of agents, not a flat banner. A
 * generative `coverStyle` base (seeded, category-tinted) guarantees on-brand art.
 *
 * Body: name + tagline + a subcategory-diversity chip row (what the set spans).
 * No performance figures — real signals only. Links to `/portfolio/:slug`.
 * Mirrors AgentCard's glass-panel language (DESIGN.md v3).
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import type { ResolvedPortfolio } from "../lib/portfolios";
import { coverStyle } from "../lib/cover";
import { useImageLoad } from "../lib/useImageLoad";

function initial(name: string) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

/** Members shown as portraits before the rest collapse into a "+N" column/tile. */
const ROSTER_MAX = 5;
/** At or below this count the roster fans (protagonist); above it, it grids. */
const FAN_MAX = 3;

/**
 * One member portrait. Image-first like AgentCard: a blurred, scaled copy of the
 * same image gives a color aura, the sharp portrait is revealed only once it
 * genuinely loads, and a seeded initial is the always-present fallback so a 404
 * never shows a broken image. Size/shape/position come from `className` + `style`.
 */
function MemberFace({
  agent,
  accent,
  className = "",
  initialClassName = "text-2xl",
  style,
}: {
  agent: Agent;
  accent: string;
  className?: string;
  initialClassName?: string;
  style?: React.CSSProperties;
}) {
  const { ok: showImg, imgProps } = useImageLoad(agent.imageUrl);
  return (
    <span
      className={
        "relative block overflow-hidden ring-2 ring-bg transition-transform duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] " +
        className
      }
      style={style}
      title={agent.name}
    >
      {/* Color aura from the same image (blurred) over the seeded base. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={coverStyle(agent.id || agent.name, accent)}
      />
      {showImg && (
        <img
          aria-hidden
          src={agent.imageUrl ?? undefined}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-xl"
        />
      )}
      {/* Seeded initial fallback (always mounted, hidden once the image loads). */}
      <span
        aria-hidden
        className={`absolute inset-0 grid place-items-center font-black text-white/90 transition-opacity duration-300 ${initialClassName} ${
          showImg ? "opacity-0" : "opacity-100"
        }`}
      >
        {initial(agent.name)}
      </span>
      {agent.imageUrl && (
        <img
          {...imgProps}
          src={agent.imageUrl}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            showImg ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {/* Bottom vignette so the lineup melts into the cover base. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg/70 to-transparent"
      />
    </span>
  );
}

/** ≤3 members: fanned lineup, protagonist centered/forward. */
function RosterFan({ roster, accent }: { roster: Agent[]; accent: string }) {
  const center = (roster.length - 1) / 2;
  return (
    <div className="absolute inset-0 flex items-center justify-center pb-1">
      {roster.map((a, i) => {
        const dist = Math.abs(i - center);
        const lift = i === Math.round(center) && roster.length > 1;
        return (
          <MemberFace
            key={a.id}
            agent={a}
            accent={accent}
            className="h-[152px] w-[86px] shrink-0 rounded-xl"
            initialClassName="text-4xl"
            style={{
              marginLeft: i === 0 ? 0 : -24,
              zIndex: 20 - Math.round(dist * 2),
              transform: `translateY(${dist * 7}px) scale(${1 - dist * 0.07})`,
              transformOrigin: "bottom center",
              boxShadow: lift ? "0 10px 28px rgba(0,0,0,0.55)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/** >3 members: even grid of equal columns filling the cover, with a "+N" column. */
function RosterGrid({
  roster,
  overflow,
  accent,
}: {
  roster: Agent[];
  overflow: number;
  accent: string;
}) {
  return (
    <div className="absolute inset-0 flex items-stretch gap-1.5 p-2.5">
      {roster.map((a) => (
        <div key={a.id} className="min-w-0 flex-1">
          <MemberFace agent={a} accent={accent} className="h-full w-full rounded-lg" />
        </div>
      ))}
      {overflow > 0 && (
        <div className="min-w-0 flex-1">
          <span
            className="grid h-full w-full place-items-center overflow-hidden rounded-lg bg-surface-2 text-base font-bold text-text-2 ring-2 ring-bg"
            title={`${overflow} more`}
          >
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}

export function PortfolioCard({ portfolio }: { portfolio: ResolvedPortfolio }) {
  const { slug, name, accent, coverKey, agents, aggregate, creator, stats } = portfolio;
  const creatorLabel =
    creator?.address != null
      ? (creator.label ?? `${creator.address.slice(0, 6)}…${creator.address.slice(-4)}`)
      : null;
  const likes = stats?.likes ?? null;

  const roster = agents.slice(0, ROSTER_MAX);
  const overflow = agents.length - roster.length;
  const grid = agents.length > FAN_MAX;

  // Top subcategories the set spans — communicates diversity at a glance.
  const spans = aggregate.subcategories.slice(0, 3);
  const moreSpans = aggregate.subcategories.length - spans.length;

  return (
    <Link
      to={`/portfolio/${encodeURIComponent(slug)}`}
      className="group glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-xl transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-0.5 hover:shadow-[var(--elev-2)]"
    >
      {/* Cover — the prominent team roster over a seeded, category-tinted base. */}
      <div className="relative h-[184px] w-full overflow-hidden" style={coverStyle(coverKey, accent)}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-px opacity-80"
          style={{ background: accent }}
        />

        {/* "Pack" label — top-left, reads as a collection/batch of agents. */}
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-[999px] bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm ring-1 ring-white/10">
          <span aria-hidden className="h-1.5 w-1.5 rounded-[999px]" style={{ background: accent }} />
          {aggregate.count} agents
        </span>

        {grid ? (
          <RosterGrid roster={roster} overflow={overflow} accent={accent} />
        ) : (
          <RosterFan roster={roster} accent={accent} />
        )}

        {/* Scrim so the roster melts into the body below. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-12 bg-gradient-to-t from-bg to-transparent"
        />
      </div>

      {/* Body. */}
      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-3.5 w-1 rounded-[999px]" style={{ background: accent }} />
          <h3 className="truncate text-base font-semibold text-text">{name}</h3>
          <span className="ml-auto rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-3">
            Portfolio
          </span>
        </div>

        <div className="flex-1" />

        {/* Diversity — the subcategories this set spans (real, from members). */}
        {spans.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {spans.map((s) => (
              <span
                key={s.id}
                className="rounded-[999px] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-text-2 ring-1 ring-border/50"
              >
                {s.label}
              </span>
            ))}
            {moreSpans > 0 && (
              <span className="rounded-[999px] px-1.5 py-0.5 text-[10px] font-medium text-text-3">
                +{moreSpans}
              </span>
            )}
          </div>
        )}

        {/* Creator + heart — user portfolios only (curated have neither). */}
        {(creatorLabel || likes != null) && (
          <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-text-3">
            {likes != null && (
              <span className="tnum inline-flex items-center gap-1">
                <span aria-hidden className="text-brand">
                  ♥
                </span>
                <span className="font-semibold text-text">{likes}</span>
              </span>
            )}
            {creatorLabel && <span className="ml-auto truncate">by {creatorLabel}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

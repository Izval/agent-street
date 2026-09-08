/**
 * AgentCard — collectible "FIFA-style" agent card (DESIGN.md v3 §5.7).
 *
 * Portrait, image-first: the agent's image is the protagonist, centered, framed
 * as the "player". A blurred, scaled copy of the SAME image sits behind it, so
 * the card gets a color aura derived from the image itself — no canvas / color
 * extraction, SSR-safe. Under everything, the deterministic `coverStyle` base
 * (seeded by id, tinted by category) guarantees on-brand art when there's no image.
 *
 * Face is minimal: a big rating (score as "OVR", toned), the subcategory as the
 * "position", the name, and a compact `★ stars · N reviews` line. No `Live`,
 * no `x402`, no metrics strip — the identity IS the card.
 *
 * Steam-style hover opens a side flyout (portal, so the carousel doesn't clip it)
 * with the full description + metrics. Keeps `{ agent, featured?, demandSpark? }`.
 */

import type { Agent } from "../lib/agents";
import { agentHref } from "../lib/agents";
import { Link } from "react-router";
import { accentForSubcategory, coverStyle } from "../lib/cover";
import { useImageLoad } from "../lib/useImageLoad";
import { scoreTone } from "../lib/score";
import { SaveButton } from "./SaveButton";
import { CompareToggle } from "./CompareToggle";
import { Flyout, useHoverFlyout } from "./Flyout";

const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

type Tone = "up" | "brand" | "down" | undefined;
interface MetricSpec {
  label: string;
  value: string;
  tone?: Tone;
}

function Metric({ label, value, tone }: MetricSpec) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-text-3">{label}</div>
      <div
        className={`tnum text-sm font-semibold ${tone ? TONE_TEXT[tone] : "text-text"}`}
      >
        {value}
      </div>
    </div>
  );
}

function initial(name: string) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

/** Flyout data strip (detailed view). Real values from 8004scan. */
function flyoutMetrics(agent: Agent): MetricSpec[] {
  const avg = agent.avgScore ? agent.avgScore.toFixed(1) : "—";
  return [
    { label: "Score", value: String(agent.score), tone: scoreTone(agent.score) },
    { label: "Avg", value: avg },
    { label: "Reviews", value: String(agent.feedbacks) },
    { label: "Stars", value: String(agent.stars) },
  ];
}

export function AgentCard({
  agent,
  featured = false,
  // Kept for signature compatibility; the FIFA face intentionally omits it.
  demandSpark: _demandSpark,
}: {
  agent: Agent;
  featured?: boolean;
  demandSpark?: number[];
}) {
  const accent = accentForSubcategory(agent.subcategory);
  const rating = Number.isFinite(agent.score) ? Math.round(agent.score) : null;
  const ratingTone = rating != null ? TONE_TEXT[scoreTone(agent.score)] : "text-text";
  const { open, rect, anchorRef, anchorProps } = useHoverFlyout();
  const { ok: showImg, imgProps } = useImageLoad(agent.imageUrl);

  const snapshot = {
    id: agent.id,
    name: agent.name,
    subcategory: agent.subcategory,
    subcategoryLabel: agent.subcategoryLabel,
    score: agent.score,
    imageUrl: agent.imageUrl,
    source: agent.source,
  };

  return (
    <>
      <div className="relative">
        <div className="absolute right-3 top-3 z-20">
          <SaveButton agent={snapshot} variant="icon" />
        </div>
        <Link
          ref={anchorRef as React.Ref<HTMLAnchorElement>}
          {...anchorProps}
          to={agentHref(agent)}
          aria-label={agent.name}
          className={
            "group relative flex aspect-[3/4] min-w-0 flex-col overflow-hidden rounded-xl ring-1 ring-border/60 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-1 hover:shadow-[var(--elev-2)] " +
            (featured ? "ring-brand/50" : "")
          }
        >
          {/* Layer 0 — deterministic on-brand base (also the no-image art). */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={coverStyle(agent.id || agent.name, accent)}
          />

          {/* Layer 1 — color aura: a blurred, scaled copy of the image itself. */}
          {showImg && (
            <img
              aria-hidden
              src={agent.imageUrl ?? undefined}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
            />
          )}

          {/* Layer 2 — bottom vignette for text legibility. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-transparent"
          />

          {/* Accent top border (brand on featured). */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 z-10 h-px opacity-80"
            style={{ background: featured ? "var(--brand)" : accent }}
          />

          {/* Top-left — rating (OVR) + subcategory (position). */}
          <div className="relative z-10 flex items-start justify-between p-3.5">
            <div className="min-w-0">
              <div
                className={`tnum text-4xl font-extrabold leading-none tracking-tight ${ratingTone}`}
                style={{ textShadow: "0 1px 12px rgba(0,0,0,0.55)" }}
              >
                {rating ?? "—"}
              </div>
              {agent.subcategoryLabel && (
                <div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-text-2">
                  {agent.subcategoryLabel}
                </div>
              )}
            </div>
            {/* Spacer so the SaveButton (absolute) never overlaps the rating. */}
            <span aria-hidden className="h-8 w-8 shrink-0" />
          </div>

          {/* Center — the protagonist. The initial-on-blur fallback is always
              present; the sharp image is mounted (so it can load) and revealed
              only once it genuinely loads — a broken image never appears. */}
          <div className="relative z-10 flex flex-1 items-center justify-center px-4">
            <span
              aria-hidden
              className={`absolute inset-0 m-auto grid h-[56%] w-[56%] place-items-center rounded-2xl text-5xl font-black text-white/90 ring-1 ring-white/10 transition-opacity duration-300 ${
                showImg ? "opacity-0" : "opacity-100"
              }`}
              style={coverStyle(agent.name || agent.id, accent)}
            >
              {initial(agent.name)}
            </span>
            {agent.imageUrl && (
              <img
                {...imgProps}
                src={agent.imageUrl}
                alt=""
                loading="lazy"
                className={`relative h-[58%] w-auto max-w-[78%] rounded-2xl object-cover shadow-[0_10px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-[transform,opacity] duration-300 group-hover:scale-[1.04] ${
                  showImg ? "opacity-100" : "opacity-0"
                }`}
              />
            )}
          </div>

          {/* Bottom — name + compact stats line. */}
          <div className="relative z-10 p-3.5 pt-2">
            <h3 className="truncate text-[15px] font-bold text-text">
              {agent.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-text-2">
              <span className="tnum inline-flex items-center gap-1">
                <span aria-hidden className="text-brand">
                  ★
                </span>
                {agent.stars}
              </span>
              <span aria-hidden className="text-text-3">
                ·
              </span>
              <span className="tnum">
                {agent.feedbacks} {agent.feedbacks === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Steam-style flyout: full description + data (no Live / x402). */}
      <Flyout open={open} rect={rect} {...anchorProps}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: featured ? "var(--brand)" : accent }}
        />
        <h4 className="min-w-0 truncate text-base font-semibold text-text">
          {agent.name}
        </h4>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {agent.subcategoryLabel && (
            <span className="rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-text-2">
              {agent.subcategoryLabel}
            </span>
          )}
        </div>

        <p className="mt-3 max-h-[7.5rem] overflow-y-auto text-sm leading-relaxed text-text-2">
          {agent.description || "ERC-8004 agent on BNB Chain."}
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/60 pt-3">
          {flyoutMetrics(agent).map((m) => (
            <Metric key={m.label} {...m} />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-text-3">
            Open agent dashboard →
          </span>
          <CompareToggle agent={snapshot} />
        </div>
      </Flyout>
    </>
  );
}

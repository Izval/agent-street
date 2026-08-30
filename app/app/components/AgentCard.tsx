/**
 * AgentCard — live agent card, glass + template-driven (DESIGN.md v3 §5.7).
 *
 * `.glass-panel` with header (flagship avatar/gradient, name, category chip,
 * `● Live` when the data is onchain), a **data strip** whose labels change
 * according to `categoryTemplate(agent.category)`, and verified/x402.
 *
 * Steam-style hover: hovering opens a **side flyout** (portal, so the carousel
 * doesn't clip it) with the full description, the metrics strip, tags and
 * badges. Keeps the signature `{ agent, featured?, demandSpark? }`.
 */

import type { Agent } from "../lib/agents";
import { Link } from "react-router";
import { aisleOf, categoryTemplate } from "../lib/taxonomy";
import { AISLES } from "../lib/taxonomy";
import { scoreTone } from "../lib/score";
import { Sparkline } from "./charts/Sparkline";
import { SourceBadge, VerifiedBadge, X402Badge } from "./Badge";
import { SaveButton } from "./SaveButton";
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Data strip driven by the category template. Real values from 8004scan. */
function templateMetrics(agent: Agent): MetricSpec[] {
  const sTone = scoreTone(agent.score);
  const avg = agent.avgScore ? agent.avgScore.toFixed(1) : "—";
  const reviews = String(agent.feedbacks);
  const stars = String(agent.stars);
  const score = String(agent.score);

  switch (categoryTemplate(agent.category)) {
    case "health":
      return [
        {
          label: "Health",
          value: agent.healthScore != null ? String(agent.healthScore) : "—",
          tone:
            agent.healthScore != null ? scoreTone(agent.healthScore) : undefined,
        },
        { label: "Score", value: score, tone: sTone },
        { label: "Reviews", value: reviews },
        { label: "Stars", value: stars },
      ];
    default:
      return [
        { label: "Score", value: score, tone: sTone },
        { label: "Avg", value: avg },
        { label: "Reviews", value: reviews },
        { label: "Stars", value: stars },
      ];
  }
}

function accentOf(agent: Agent): string {
  const aisle = agent.category ? aisleOf(agent.category) : null;
  return AISLES.find((a) => a.id === aisle)?.accent ?? "var(--brand)";
}

export function AgentCard({
  agent,
  featured = false,
  demandSpark,
}: {
  agent: Agent;
  featured?: boolean;
  demandSpark?: number[];
}) {
  const metrics = templateMetrics(agent);
  const accent = accentOf(agent);
  const isLive = agent.source === "8004scan";
  const { open, rect, anchorRef, anchorProps } = useHoverFlyout();

  const snapshot = {
    id: agent.id,
    name: agent.name,
    category: agent.category,
    categoryLabel: agent.categoryLabel,
    score: agent.score,
    imageUrl: agent.imageUrl,
    source: agent.source,
  };

  return (
    <>
      <div className="relative">
        <div className="absolute right-3 top-3 z-10">
          <SaveButton agent={snapshot} variant="icon" />
        </div>
        <Link
          ref={anchorRef as React.Ref<HTMLAnchorElement>}
          {...anchorProps}
          to={`/agent/${encodeURIComponent(agent.id)}`}
          className={
            "group glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-lg p-5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-0.5 hover:shadow-[var(--elev-2)] " +
            (featured ? "ring-1 ring-brand/40" : "")
          }
        >
        {/* Top light border (accent per aisle / brand on flagship). */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: featured ? "var(--brand)" : accent }}
        />

        <div className="flex items-start gap-3">
          <span
            className={
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold " +
              (featured
                ? "bg-gradient-to-br from-brand to-brand-bright text-bg"
                : "bg-surface-2 text-text-2")
            }
          >
            {initials(agent.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-text">
                {agent.name}
              </h3>
              {isLive && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-up">
                  <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
                  Live
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {agent.categoryLabel && (
                <span className="rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-text-2">
                  {agent.categoryLabel}
                </span>
              )}
              <SourceBadge source={agent.source} />
            </div>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 flex-1 text-sm text-text-2">
          {agent.description || "ERC-8004 agent on BNB Chain."}
        </p>

        {/* Template-driven data strip (tabular numerals). */}
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border/60 pt-3">
          {metrics.map((m) => (
            <Metric key={m.label} {...m} />
          ))}
        </div>

        {(agent.isVerified || agent.x402Supported) && (
          <div className="mt-3 flex items-center gap-2">
            {agent.isVerified && <VerifiedBadge />}
            {agent.x402Supported && <X402Badge />}
          </div>
        )}

        {/* Demand sparkline (7d views). */}
        {demandSpark && demandSpark.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <span className="text-[11px] text-text-3">Demand 7d</span>
            <Sparkline values={demandSpark} tone="brand" width={80} height={24} />
          </div>
        )}
        </Link>
      </div>

      {/* Steam-style flyout: full description + data + tags. */}
      <Flyout open={open} rect={rect} {...anchorProps}>
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: featured ? "var(--brand)" : accent }}
        />
        <div className="flex items-center gap-2">
          <h4 className="min-w-0 flex-1 truncate text-base font-semibold text-text">
            {agent.name}
          </h4>
          {isLive && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-up">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
              Live
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {agent.categoryLabel && (
            <span className="rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-text-2">
              {agent.categoryLabel}
            </span>
          )}
          <SourceBadge source={agent.source} />
          {agent.isVerified && <VerifiedBadge />}
          {agent.x402Supported && <X402Badge />}
        </div>

        <p className="mt-3 max-h-[7.5rem] overflow-y-auto text-sm leading-relaxed text-text-2">
          {agent.description || "ERC-8004 agent on BNB Chain."}
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/60 pt-3">
          {metrics.map((m) => (
            <Metric key={m.label} {...m} />
          ))}
        </div>

        <div className="mt-3 text-[11px] font-medium text-text-3">
          Open agent dashboard →
        </div>
      </Flyout>
    </>
  );
}

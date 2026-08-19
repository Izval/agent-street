/**
 * AgentCard — card de agente viva, glass + template-driven (DESIGN.md v3 §5.7).
 *
 * `.glass-panel` con: header (avatar/gradiente flagship, nombre, chip de categoría,
 * `● Live` cuando el dato es onchain, verified/x402), **franja de datos** cuyas
 * etiquetas cambian según `categoryTemplate(agent.category)` (trading→score/PnL·
 * clmm→IVL·yield→APY·health→gauge mini), y un **sparkline de demanda** al pie.
 *
 * Conserva la firma `{ agent, featured? }` (usos actuales home/category) y añade el
 * slot opcional `{ demandSpark? }`. SSR-safe (sin efectos).
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { aisleOf, categoryTemplate } from "../lib/taxonomy";
import { AISLES } from "../lib/taxonomy";
import { ivlScoreTone } from "../lib/ivl";
import { Sparkline } from "./charts/Sparkline";
import { SourceBadge, VerifiedBadge, X402Badge } from "./Badge";

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

/** Franja de datos según la plantilla de la categoría. Todos los valores son
 *  reales de 8004scan; solo cambian la etiqueta líder y el énfasis por template. */
function templateMetrics(agent: Agent): MetricSpec[] {
  const scoreTone = ivlScoreTone(agent.score);
  const avg = agent.avgScore ? agent.avgScore.toFixed(1) : "—";
  const reviews = String(agent.feedbacks);
  const stars = String(agent.stars);
  const score = String(agent.score);

  switch (categoryTemplate(agent.category)) {
    case "clmm":
      return [
        { label: "IVL Score", value: score, tone: scoreTone },
        { label: "Avg", value: avg },
        { label: "Reviews", value: reviews },
        { label: "Stars", value: stars },
      ];
    case "trading":
      return [
        { label: "Score", value: score, tone: scoreTone },
        { label: "Avg", value: avg },
        { label: "Reviews", value: reviews },
        { label: "Stars", value: stars },
      ];
    case "yield":
      return [
        { label: "Score", value: score, tone: scoreTone },
        { label: "Avg", value: avg },
        { label: "Reviews", value: reviews },
        { label: "Stars", value: stars },
      ];
    case "health":
      return [
        {
          label: "Health",
          value: agent.healthScore != null ? String(agent.healthScore) : "—",
          tone:
            agent.healthScore != null ? ivlScoreTone(agent.healthScore) : undefined,
        },
        { label: "Score", value: score, tone: scoreTone },
        { label: "Reviews", value: reviews },
        { label: "Stars", value: stars },
      ];
    default:
      return [
        { label: "Score", value: score, tone: scoreTone },
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

  return (
    <Link
      to={`/agent/${encodeURIComponent(agent.id)}`}
      className={
        "group glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-lg p-5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-0.5 hover:shadow-[var(--elev-2)] " +
        (featured ? "ring-1 ring-brand/40" : "")
      }
    >
      {/* Borde superior de luz (acento por aisle / marca en flagship). */}
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
          {featured ? "IVL" : initials(agent.name)}
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
        {agent.description || "Agente ERC-8004 en BNB Chain."}
      </p>

      {/* Franja de datos template-driven (numerales tabulares). */}
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

      {/* Sparkline de demanda (views 7d). */}
      {demandSpark && demandSpark.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-text-3">Demanda 7d</span>
          <Sparkline values={demandSpark} tone="brand" width={80} height={24} />
        </div>
      )}
    </Link>
  );
}

/**
 * ClmmSpecialty — the signature "Range strategy" block for the Rebalancing
 * (clmm) template. A prominent concentrated-liquidity band is the one visual the
 * page is remembered by: it shows WHERE the agent earns (active band → fees) vs.
 * where capital sits idle (out of range), with a current-price marker.
 *
 * Honesty (DESIGN.md §18): the band is CONCEPTUAL — labelled "Illustrative". The
 * live band (tickLower/tickUpper) is computed by the agent's own endpoint at hire
 * and is never indexed or invented here. No calls to any IVL engine; the pairs /
 * protocols come from the agent's own 8004scan fields.
 */

import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { Card } from "../Card";

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-[999px] bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/** The concentrated-liquidity band. Illustrative fixed geometry (not live data). */
function RangeBand() {
  const lower = 28;
  const upper = 72;
  const price = 50;
  const accent = "var(--accent-liquidity)";
  // Evenly-spaced ticks for CLMM texture (purely decorative).
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);

  return (
    <div>
      <div className="mb-1 flex justify-center">
        <span
          className="tnum rounded-[999px] px-2 py-0.5 text-[10px] font-semibold"
          style={{
            color: "var(--accent-liquidity)",
            background: "color-mix(in srgb, var(--accent-liquidity) 16%, transparent)",
          }}
        >
          Price · in range
        </span>
      </div>
      <svg
        viewBox="0 0 100 34"
        preserveAspectRatio="none"
        role="img"
        aria-label="Illustrative concentrated-liquidity range: capital concentrated in an active band, idle outside it."
        className="h-24 w-full"
      >
        <defs>
          <linearGradient id="clmm-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.42" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Idle track (out of range → no fees). */}
        <rect x="0" y="16" width="100" height="7" rx="1.4" fill="var(--surface-2)" />

        {/* Tick texture along the axis. */}
        {ticks.map((t) => (
          <rect
            key={t}
            x={t - 0.15}
            y="24.5"
            width="0.3"
            height={t % 25 === 0 ? 3 : 1.6}
            fill="var(--border)"
          />
        ))}

        {/* Active band (in range → earning fees). */}
        <rect
          x={lower}
          y="9"
          width={upper - lower}
          height="14"
          rx="1.4"
          fill="url(#clmm-band)"
        />
        <rect x={lower} y="9" width="0.5" height="14" fill={accent} />
        <rect x={upper - 0.5} y="9" width="0.5" height="14" fill={accent} />

        {/* Current price marker. */}
        <rect x={price - 0.3} y="4" width="0.6" height="21" fill="var(--text)" />
        <circle cx={price} cy="4.5" r="1.6" fill="var(--text)" />
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-3">
        <span>Idle</span>
        <span className="text-text-2">Active band · earning fees</span>
        <span>Idle</span>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-3">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-[3px]"
          style={{ background: "var(--accent-liquidity)", opacity: 0.6 }}
        />
        In range → earns fees
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-surface-2" />
        Out of range → idle
      </span>
    </div>
  );
}

export function ClmmSpecialty({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent } = detail;
  const protocols = agent.supportedProtocols ?? [];
  const tags = agent.tags ?? [];

  return (
    <Card accent={meta.accent} className="p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">{meta.specialtyTitle}</h2>
        <span className="rounded-[999px] border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-3">
          Illustrative
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:gap-8">
        {/* Signature: the range band. */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-4 lg:p-5">
          <RangeBand />
          <div className="mt-3">
            <Legend />
          </div>
        </div>

        {/* What you're hiring it for. */}
        <div>
          <p className="text-sm leading-relaxed text-text-2">
            Concentrates liquidity in an active price band and repositions it as
            volatility and price move — staying in range earns swap fees; drifting
            out of range earns nothing.
          </p>

          {protocols.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs text-text-3">Operates on</div>
              <Chips items={protocols} />
            </div>
          )}
          {tags.length > 0 && (
            <div className="mt-3">
              <Chips items={tags} />
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-text-3">
            The live band (tickLower / tickUpper) is computed by the agent's own
            endpoint when you hire — not indexed here, never estimated.
          </p>
        </div>
      </div>
    </Card>
  );
}

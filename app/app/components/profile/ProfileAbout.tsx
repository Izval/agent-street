/**
 * ProfileAbout — the description panel (CENTER of the profile hero).
 *
 * The agent's own description is the protagonist of the hero now: what you're
 * hiring, in the agent's words, up top and prominent — followed by the "what to
 * hire it for" tagline and a compact real-KPI strip (track record). Everything
 * is real (8004scan / onchain) or an honest "—"; nothing is invented.
 */

import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/60 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-text-3">{label}</div>
      <div className="tnum mt-1 text-xl font-bold leading-none text-text">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-text-3">{hint}</div>}
    </div>
  );
}

export function ProfileAbout({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent, reputation } = detail;

  // Always-real headline facts (8004scan) — no empty "—" placeholder tiles.
  const kpis = [
    {
      label: "Total score",
      value:
        reputation?.totalScore != null
          ? reputation.totalScore.toFixed(1)
          : String(agent.score),
      hint: "8004scan",
    },
    {
      label: "Rank",
      value: typeof agent.rank === "number" ? `#${agent.rank}` : "—",
      hint: "network",
    },
    {
      label: "Reviews",
      value: String(reputation?.feedbacks ?? agent.feedbacks),
      hint: "feedbacks",
    },
    {
      label: "Rating",
      value: agent.stars ? `${agent.stars}/5` : "—",
      hint: reputation?.avgScore != null ? "avg" : "no ratings",
    },
  ];

  return (
    <div className="glass-frost metal-frost relative flex h-full flex-col overflow-hidden rounded-xl p-6 md:p-7">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-3">About</div>

      {/* Description — the protagonist. */}
      <p className="text-lg leading-relaxed text-text">
        {agent.description || "ERC-8004 agent on BNB Chain."}
      </p>
      <p className="mt-3 text-sm text-text-3">{meta.tagline}</p>

      {/* Track-record KPIs + identity facts — grouped and pushed to the bottom
          (mt-auto) so the description reads as a spread (words up top, the data
          cluster anchored at the base) that fills the full-height hero panel
          instead of leaving a void in the middle. */}
      <div className="mt-auto pt-8">
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <Kpi key={k.label} label={k.label} value={k.value} hint={k.hint} />
            ))}
          </div>
        )}

        {/* Identity facts — folded in from the side rail. */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-border/60 pt-4">
          <Fact label="Subcategory" value={agent.subcategoryLabel ?? "—"} />
          <Fact label="Standard" value="ERC-8004" />
          <Fact label="Network" value="BSC · testnet" />
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-sm">
      <span className="text-text-3">{label}</span>
      <span className="tnum font-medium text-text-2">{value}</span>
    </span>
  );
}

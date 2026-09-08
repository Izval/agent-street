/**
 * ProfileCard — the hiring-dashboard identity card (right of DashboardChart).
 *
 * Merges the résumé header (avatar · name · role · subcategory · publisher) with a
 * compact real-stats strip and the primary Hire CTA + Save. Category-accent top
 * hairline like the other profile surfaces. Every stat is real (8004scan/agent)
 * or an honest "—" (DESIGN.md §18); the price is quoted live on /hire, not here.
 */

import { Link } from "react-router";

import { hireHref } from "../../lib/agents";
import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { short } from "../../lib/profile";
import { Avatar } from "../Avatar";
import { SaveButton } from "../SaveButton";
import { LiveBadge, TestnetBadge, VerifiedBadge, X402Badge } from "../Badge";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wide text-text-3">{label}</div>
      <div className="tnum mt-1 text-lg font-bold text-text">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-text-3">{label}</span>
      <span className="tnum font-medium text-text-2">{value}</span>
    </div>
  );
}

export function ProfileCard({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent, reputation } = detail;
  const owner =
    agent.ownerUsername ??
    agent.ownerEns ??
    short(agent.agentWallet ?? agent.ownerAddress);

  const score =
    reputation?.totalScore != null
      ? reputation.totalScore.toFixed(1)
      : String(agent.score);
  const reviews = String(reputation?.feedbacks ?? agent.feedbacks);
  const rating = agent.stars ? `${agent.stars}/5` : "—";

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
    <div className="glass-frost relative overflow-hidden rounded-xl p-5">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: meta.accent }}
      />

      {/* Identity */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          {/* Accent halo behind the avatar (prominent, on-brand). */}
          <span
            aria-hidden
            className="absolute -inset-3 rounded-full opacity-60 blur-2xl"
            style={{ background: `color-mix(in srgb, ${meta.accent} 55%, transparent)` }}
          />
          <Avatar
            src={agent.imageUrl}
            name={agent.name}
            seed={agent.id}
            accent={meta.accent}
            size="h-28 w-28"
            rounded="rounded-3xl"
            className="relative ring-1 ring-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.55)]"
          />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-text">{agent.name}</h1>
        <div className="mt-0.5 text-sm font-medium" style={{ color: meta.accent }}>
          {meta.role}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {agent.subcategoryLabel && (
            <span className="rounded-[999px] bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold text-text-2">
              {agent.subcategoryLabel}
            </span>
          )}
          {agent.isVerified && <VerifiedBadge />}
          {agent.x402Supported && <X402Badge />}
        </div>
        {owner && <div className="mt-2 text-xs text-text-3">by {owner}</div>}
      </div>

      {/* Real stat strip */}
      <div className="mt-5 grid grid-cols-3 gap-2 border-y border-border/60 py-4">
        <Stat label="Score" value={score} />
        <Stat label="Rating" value={rating} />
        <Stat label="Reviews" value={reviews} />
      </div>

      {/* Hire CTA (scarce brand yellow) + Save */}
      <Link
        to={hireHref(agent.id, agent.chainId)}
        className="mt-4 flex w-full items-center justify-center rounded-[8px] bg-brand px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
      >
        Hire agent →
      </Link>
      <div className="mt-2">
        <SaveButton agent={snapshot} variant="labeled" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-3">
        Hire via x402 with a session and spend cap. The price is quoted live from
        the agent's endpoint when you continue.
      </p>

      {/* Quick facts */}
      <div className="mt-3 border-t border-border/60 pt-2">
        {typeof agent.rank === "number" && <Fact label="Rank" value={`#${agent.rank}`} />}
        <Fact label="Subcategory" value={agent.subcategoryLabel ?? "—"} />
        <Fact label="Standard" value="ERC-8004" />
        <div className="mt-2 flex items-center justify-between">
          {agent.source === "8004scan" ? <LiveBadge /> : <TestnetBadge />}
          <span className="text-[11px] text-text-3">BSC · testnet</span>
        </div>
      </div>
    </div>
  );
}

/**
 * ClmmHero — the redesigned header for the Rebalancing (clmm) template.
 *
 * Identity (avatar, name, role, chips, publisher) plus a LIVE STAT STRIP: a
 * dense row of real numbers from 8004scan (score · rank · freshness · reviews)
 * and the onchain indexer (LP capital · repositions). This is where the profile
 * reads as "alive with real performance" — every figure is real or an honest "—".
 *
 * Honesty (DESIGN.md §18): onchain figures degrade to "—" with a one-word reason
 * when the wallet isn't indexed. Nothing is invented; no IVL-engine calls.
 */

import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { short, usd } from "../../lib/profile";
import { LiveBadge, TestnetBadge, VerifiedBadge, X402Badge } from "../Badge";
import { Avatar } from "../Avatar";

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="px-4 py-3 first:pl-0">
      <div className="text-[11px] uppercase tracking-wide text-text-3">{label}</div>
      <div
        className="tnum mt-1 text-xl font-bold leading-none text-text"
        style={accent ? { color: "var(--accent-liquidity)" } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[10px] text-text-3">{hint}</div>}
    </div>
  );
}

export function ClmmHero({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent, reputation, metrics, portfolio } = detail;
  const owner =
    agent.ownerUsername ??
    agent.ownerEns ??
    short(agent.agentWallet ?? agent.ownerAddress);
  const tier = agent.ownerPublisherTier ?? agent.ownerCertifiedName;

  const score =
    reputation?.totalScore != null
      ? reputation.totalScore.toFixed(1)
      : String(agent.score);
  const rank = typeof agent.rank === "number" ? `#${agent.rank}` : "—";
  const freshness =
    reputation?.freshness != null ? String(Math.round(reputation.freshness)) : "—";
  const reviews = String(reputation?.feedbacks ?? agent.feedbacks);
  const lpCapital = metrics && metrics.totalUsd > 0 ? usd(metrics.totalUsd) : "—";
  const lpHint = portfolio?.source === "onchain" ? "onchain" : "not indexed";
  const repos = metrics ? String(metrics.tradeCount) : "—";
  const reposHint = metrics?.tradeCount ? "onchain" : "indexer key";

  return (
    <section className="glass-panel relative overflow-hidden rounded-xl">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: meta.accent }}
      />

      {/* Identity row */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar
            src={agent.imageUrl}
            name={agent.name}
            seed={agent.id}
            accent={meta.accent}
            size="h-16 w-16"
            rounded="rounded-2xl"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-text">{agent.name}</h1>
            <div className="mt-0.5 text-sm font-medium" style={{ color: meta.accent }}>
              {meta.role}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {agent.subcategoryLabel && (
                <span className="rounded-[999px] bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold text-text-2">
                  {agent.subcategoryLabel}
                </span>
              )}
              {agent.isVerified && <VerifiedBadge />}
              {agent.x402Supported && <X402Badge />}
            </div>
            {(owner || tier) && (
              <div className="mt-2 text-xs text-text-3">
                {owner ? <>by {owner}</> : null}
                {tier ? <> · {tier}</> : null}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          {agent.source === "8004scan" ? <LiveBadge /> : <TestnetBadge />}
          <div className="mt-1 text-[11px] text-text-3">BSC · testnet</div>
        </div>
      </div>

      {/* Live stat strip — real 8004scan + onchain figures. */}
      <div className="border-t border-border/70 bg-surface/40 px-6">
        <div className="grid grid-cols-2 divide-x divide-border/50 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Score" value={score} hint="8004scan" accent />
          <Stat label="Rank" value={rank} hint="network" />
          <Stat label="Freshness" value={freshness} hint="8004scan" />
          <Stat label="LP capital" value={lpCapital} hint={lpHint} />
          <Stat label="Repositions" value={repos} hint={reposHint} />
          <Stat label="Reviews" value={reviews} hint="feedbacks" />
        </div>
      </div>
    </section>
  );
}

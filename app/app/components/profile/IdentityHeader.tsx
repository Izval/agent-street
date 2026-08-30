/**
 * IdentityHeader — the "résumé header": avatar, name, role headline, category
 * chip (aisle accent), owner/publisher, and status badges. Glass allowed here
 * (DESIGN.md §17.1).
 */

import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { short } from "../../lib/profile";
import {
  LiveBadge,
  SourceBadge,
  TestnetBadge,
  VerifiedBadge,
  X402Badge,
} from "../Badge";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function IdentityHeader({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent } = detail;
  const owner =
    agent.ownerUsername ??
    agent.ownerEns ??
    short(agent.agentWallet ?? agent.ownerAddress);
  const tier = agent.ownerPublisherTier ?? agent.ownerCertifiedName;

  return (
    <div className="glass-panel relative overflow-hidden rounded-xl p-6">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: meta.accent }}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 text-lg font-bold text-text-2">
            {agent.imageUrl ? (
              <img src={agent.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(agent.name)
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-text">{agent.name}</h1>
            <div className="mt-0.5 text-sm font-medium" style={{ color: meta.accent }}>
              {meta.role}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {agent.categoryLabel && (
                <span className="rounded-[999px] bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold text-text-2">
                  {agent.categoryLabel}
                </span>
              )}
              <SourceBadge source={agent.source} />
              {agent.isVerified && <VerifiedBadge />}
              {agent.x402Supported && <X402Badge />}
              {typeof agent.rank === "number" && (
                <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
                  Rank #{agent.rank}
                </span>
              )}
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
        </div>
      </div>
    </div>
  );
}

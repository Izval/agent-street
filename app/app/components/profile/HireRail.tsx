/**
 * HireRail — the headline "hire" surface. Sticky beside the CV content on
 * desktop; also reused inline under the header on mobile (see routes/agent.tsx).
 *
 * Contents: score meter, subcategory/category, an honest x402/quote line, the primary
 * Hire CTA (scarce brand yellow), a Save toggle, and quick facts. No fabricated
 * price — the real quote is read live from the agent's 402 endpoint on /hire.
 */

import { Link } from "react-router";

import { hireHref } from "../../lib/agents";
import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { short } from "../../lib/profile";
import { ScoreMeter } from "../ScoreMeter";
import { SaveButton } from "../SaveButton";
import { LiveBadge, TestnetBadge, VerifiedBadge, X402Badge } from "../Badge";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-text-3">{label}</span>
      <span className="tnum font-medium text-text-2">{value}</span>
    </div>
  );
}

export function HireRail({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent, services, reputation } = detail;
  const owner =
    agent.ownerUsername ??
    agent.ownerEns ??
    short(agent.agentWallet ?? agent.ownerAddress);

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
    <div className="glass-panel relative overflow-hidden rounded-xl p-5">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: meta.accent }}
      />

      <div className="flex items-center justify-between gap-3">
        <ScoreMeter score={agent.score} label="Agent score" size="lg" />
        <div className="text-right">
          {agent.source === "8004scan" ? <LiveBadge /> : <TestnetBadge />}
          <div className="mt-1 text-[11px] text-text-3">BSC · testnet</div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-text-3">
        Hire via x402 with a session and spend cap. The price is quoted live from
        the agent's endpoint when you continue.
      </p>

      <Link
        to={hireHref(agent.id, agent.chainId)}
        className="mt-4 flex w-full items-center justify-center rounded-[8px] bg-brand px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
      >
        Hire agent →
      </Link>

      <div className="mt-2">
        <SaveButton agent={snapshot} variant="labeled" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {services?.x402 || agent.x402Supported ? <X402Badge /> : null}
        {agent.isVerified && <VerifiedBadge />}
        {services?.erc8183 && (
          <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
            ERC-8183
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-border/60 pt-2">
        <Fact label="Subcategory" value={agent.subcategoryLabel ?? "—"} />
        {typeof agent.rank === "number" && (
          <Fact label="Rank" value={`#${agent.rank}`} />
        )}
        {reputation?.feedbacks != null && (
          <Fact label="Reviews" value={reputation.feedbacks} />
        )}
        {owner && <Fact label="Publisher" value={owner} />}
        <Fact label="Standard" value="ERC-8004" />
      </div>
    </div>
  );
}

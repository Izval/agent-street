/**
 * Profile sections — the universal spine of the CV (track record, reputation,
 * allocation, activity, skills). Each labels its data source (Data Quality) and
 * degrades to an honest empty state rather than inventing figures (DESIGN.md §18).
 */

import type { AgentDetail } from "../../lib/contracts";
import { getTrackRecord, short, usd } from "../../lib/profile";
import { Card } from "../Card";
import { KpiTile } from "../KpiTile";
import { LiveBadge, X402Badge } from "../Badge";
import { Donut } from "../charts/Donut";
import { BarCompare } from "../charts/BarCompare";
import { AreaChart } from "../charts/AreaChart";

// ---------------------------------------------------------------- //

export function TrackRecord({ detail }: { detail: AgentDetail }) {
  const kpis = getTrackRecord(detail);
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-3">
        Track record
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <KpiTile key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- //

function RepFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-[11px] text-text-3">{label}</div>
      <div className="tnum mt-0.5 text-lg font-bold text-text">{value}</div>
    </div>
  );
}

export function ReputationSection({ detail }: { detail: AgentDetail }) {
  const { reputation, agent } = detail;
  const bars =
    reputation?.dimensions.map((d) => ({
      label: d.key,
      value: Math.round(d.score),
    })) ?? [];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text">Reputation &amp; references</h2>
        <span className="text-xs text-text-3">· 8004scan</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs text-text-3">Score breakdown</div>
          {bars.length ? (
            <BarCompare bars={bars} unit="" />
          ) : (
            <p className="text-sm text-text-3">
              No reputation dimensions available for this agent yet.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 content-start">
          <RepFact
            label="Total score"
            value={reputation?.totalScore?.toFixed(1) ?? agent.score}
          />
          <RepFact
            label="Reviews"
            value={reputation?.feedbacks ?? agent.feedbacks}
          />
          <RepFact
            label="Avg rating"
            value={(reputation?.avgScore ?? agent.avgScore)?.toFixed(1) ?? "—"}
          />
          <RepFact
            label="Health"
            value={
              reputation?.health != null ? Math.round(reputation.health) : "—"
            }
          />
          {reputation?.freshness != null && (
            <RepFact label="Freshness" value={Math.round(reputation.freshness)} />
          )}
          {typeof agent.networkRank === "number" && (
            <RepFact label="Network rank" value={`#${agent.networkRank}`} />
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-text-3">
        Aggregate score and review count are real (8004scan). Individual reviewer
        identities are not shown — we don't invent authors.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------- //

export function AllocationSection({ detail }: { detail: AgentDetail }) {
  const { portfolio, metrics, agent } = detail;
  const slices =
    portfolio?.holdings
      .filter((h) => h.valueUsd != null && h.valueUsd > 0)
      .map((h) => ({ label: h.symbol, value: h.valueUsd as number })) ?? [];

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-text">Asset allocation</h2>
      {slices.length ? (
        <Donut
          slices={slices}
          centerLabel="Portfolio"
          centerValue={metrics ? usd(metrics.totalUsd) : undefined}
        />
      ) : (
        <p className="text-sm text-text-3">
          No priced holdings in the agent's wallet (
          {short(agent.agentWallet ?? agent.ownerAddress)}).
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- //

export function EquitySection({ detail }: { detail: AgentDetail }) {
  if (!detail.equity || detail.equity.length <= 1) return null;
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-text">Equity curve</h2>
      <AreaChart
        points={detail.equity.map((e) => ({ ts: e.ts, value: e.navUsd }))}
        tone="up"
      />
    </Card>
  );
}

// ---------------------------------------------------------------- //

export function ActivitySection({ detail }: { detail: AgentDetail }) {
  const { trades } = detail;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Recent activity</h2>
        <span className="text-xs text-text-3">onchain</span>
      </div>
      {trades && trades.trades.length ? (
        <ul className="divide-y divide-border">
          {trades.trades.slice(0, 8).map((t) => (
            <li
              key={t.hash}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="font-semibold text-text-2">
                {t.side} {t.tokenIn}→{t.tokenOut}
              </span>
              <a
                href={t.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="tnum font-mono text-xs text-text-3 hover:text-brand"
              >
                {short(t.hash)} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">
          No recent swaps indexed. The onchain trades feed requires an indexer API
          key (BscScan) — without it, this panel stays empty instead of showing
          made-up data.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- //

export function SkillsSection({ detail }: { detail: AgentDetail }) {
  const { services, agent } = detail;
  const stack = [
    ...(agent.supportedProtocols ?? []),
  ];
  const hasSkills = services && services.skills.length > 0;

  if (!services && !stack.length) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text">Skills &amp; credentials</h2>
        {services?.cardLive && <LiveBadge />}
      </div>

      <div className="flex flex-wrap gap-2">
        {services?.x402 && <X402Badge />}
        {services?.erc8183 && (
          <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
            ERC-8183
          </span>
        )}
        {services?.protocolVersion && (
          <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
            A2A v{services.protocolVersion}
          </span>
        )}
      </div>

      {stack.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-text-3">Tech stack</div>
          <div className="flex flex-wrap gap-2">
            {stack.map((p) => (
              <span
                key={p}
                className="rounded-[999px] bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasSkills && (
        <ul className="mt-4 space-y-2">
          {services!.skills.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-border bg-surface-2 p-3"
            >
              <div className="text-sm font-semibold text-text">{s.name}</div>
              {s.description && (
                <div className="mt-1 line-clamp-2 text-xs text-text-3">
                  {s.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

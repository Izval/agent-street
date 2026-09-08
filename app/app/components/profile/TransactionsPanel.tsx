/**
 * TransactionsPanel — "latest transactions" table under the dashboard chart
 * (the hiring-dashboard "history" surface). Unifies two REAL feeds:
 *   • Swaps — onchain DEX trades from the indexer (detail.trades), tx-linked.
 *   • Hires — settled x402 hires of this agent (hire-x402), tx-linked.
 * A type filter switches between them. Honest empty state; no invented rows
 * (DESIGN.md §18). Missing USD value shows "—", never an estimate.
 */

import { useMemo, useState } from "react";

import type { AgentDetail, HireTx } from "../../lib/contracts";
import { short, usd } from "../../lib/profile";
import { Card } from "../Card";

type Kind = "swap" | "hire";
type Filter = "all" | Kind;

interface Row {
  kind: Kind;
  ts: string; // ISO
  detail: string;
  value: string;
  hash: string;
  explorerUrl: string | null;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const KIND_LABEL: Record<Kind, string> = { swap: "Swap", hire: "Hire" };

function KindTag({ kind }: { kind: Kind }) {
  const cls =
    kind === "hire"
      ? "bg-brand/15 text-brand"
      : "bg-surface-2 text-text-2";
  return (
    <span className={`rounded-[999px] px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function TransactionsPanel({
  detail,
  hires,
}: {
  detail: AgentDetail;
  hires: HireTx[] | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo<Row[]>(() => {
    const swaps: Row[] = (detail.trades?.trades ?? []).map((t) => ({
      kind: "swap",
      ts: t.ts,
      detail: `${t.side} ${t.tokenIn}→${t.tokenOut}`,
      value: t.valueUsd != null ? usd(t.valueUsd) : "—",
      hash: t.hash,
      explorerUrl: t.explorerUrl,
    }));
    const hireRows: Row[] = (hires ?? []).map((h) => ({
      kind: "hire",
      ts: h.settledAt,
      detail: h.task || "Hire",
      value:
        h.amount != null ? `${h.amount} ${h.assetSymbol ?? ""}`.trim() : "—",
      hash: h.txHash,
      explorerUrl: h.explorerUrl,
    }));
    return [...swaps, ...hireRows].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [detail, hires]);

  const shown = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "swap", label: "Swaps" },
    { id: "hire", label: "Hires" },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">Latest transactions</h2>
          <span className="text-xs text-text-3">· onchain</span>
        </div>
        <div className="glass-hair inline-flex rounded-[8px] p-0.5 text-xs font-semibold">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={
                "rounded-[6px] px-2.5 py-1 transition-colors " +
                (filter === f.id
                  ? "bg-surface-2 text-text"
                  : "text-text-3 hover:text-text-2")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-3">
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Detail</th>
                <th className="pb-2 text-right font-medium">Value</th>
                <th className="pb-2 text-right font-medium">Time</th>
                <th className="pb-2 text-right font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.slice(0, 20).map((r) => (
                <tr key={`${r.kind}-${r.hash}`} className="text-text-2">
                  <td className="py-2.5">
                    <KindTag kind={r.kind} />
                  </td>
                  <td className="py-2.5 font-medium text-text">{r.detail}</td>
                  <td className="tnum py-2.5 text-right">{r.value}</td>
                  <td className="tnum py-2.5 text-right text-text-3">{fmtTime(r.ts)}</td>
                  <td className="py-2.5 text-right">
                    {r.explorerUrl ? (
                      <a
                        href={r.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="tnum font-mono text-xs text-text-3 hover:text-brand"
                      >
                        {short(r.hash)} ↗
                      </a>
                    ) : (
                      <span className="tnum font-mono text-xs text-text-3">
                        {short(r.hash)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-text-3">
          No transactions yet. Onchain swaps require an indexer API key; hires
          appear here once the agent is hired via x402 — empty instead of
          made-up data.
        </p>
      )}
    </Card>
  );
}

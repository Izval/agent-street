/**
 * TransactionsPanel — "latest transactions" table under the dashboard chart
 * (the hiring-dashboard "history" surface). Unifies two REAL feeds:
 *   • Swaps — onchain DEX trades from the indexer (trades), tx-linked.
 *   • Hires — settled x402 hires of this agent (hire-x402), tx-linked.
 * A type filter switches between them; rows paginate 10 at a time. Honest empty
 * state; no invented rows (DESIGN.md §18). Missing USD value shows "—".
 *
 * The feed is streamed off the critical path (see routes/agent.tsx): this panel
 * renders behind <Suspense> with TransactionsSkeleton as the fallback.
 */

import { useEffect, useMemo, useState } from "react";

import type { HireTx, TradesResponse } from "../../lib/contracts";
import { short, usd } from "../../lib/profile";

const PAGE_SIZE = 10;

type Kind = "swap" | "hire";
type Filter = "all" | Kind;
/** Chip tone: swap · liquidity (v3 mint/burn) · hire. */
type Tone = "swap" | "lp" | "hire";

interface Row {
  kind: Kind; // filter bucket (onchain "swap" covers swaps + liquidity)
  tone: Tone; // chip styling/label
  label: string; // chip text ("Swap" · "Add LP" · "Remove LP" · "Hire")
  ts: string; // ISO
  detail: string;
  value: string;
  hash: string;
  explorerUrl: string | null;
  chainId?: number; // 56 mainnet · 97 testnet
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

const TONE_CLS: Record<Tone, string> = {
  hire: "bg-brand/15 text-brand",
  lp: "", // liquidity accent applied inline (not a Tailwind color token)
  swap: "bg-surface-2 text-text-2",
};

function KindTag({ tone, label }: { tone: Tone; label: string }) {
  // v3 liquidity ops use the Liquidity-Providing category accent (teal) so they
  // read distinctly from plain swaps while staying on-palette.
  const style =
    tone === "lp"
      ? {
          backgroundColor: "color-mix(in srgb, var(--accent-liquidity) 16%, transparent)",
          color: "var(--accent-liquidity)",
        }
      : undefined;
  return (
    <span
      className={`rounded-[999px] px-2 py-0.5 text-[11px] font-semibold ${TONE_CLS[tone]}`}
      style={style}
    >
      {label}
    </span>
  );
}

/** Testnet chip — the flagship rebalancer runs its v3 positions on chain 97. */
function ChainTag({ chainId }: { chainId?: number }) {
  if (chainId !== 97) return null;
  return (
    <span className="rounded-[999px] bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-3">
      Testnet
    </span>
  );
}

export function TransactionsPanel({
  trades,
  hires,
}: {
  trades: TradesResponse | null;
  hires: HireTx[] | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const rows = useMemo<Row[]>(() => {
    const swaps: Row[] = (trades?.trades ?? []).map((t) => {
      const isLp = t.side === "add" || t.side === "remove";
      const label = t.side === "add" ? "Add LP" : t.side === "remove" ? "Remove LP" : "Swap";
      return {
        kind: "swap" as const,
        tone: (isLp ? "lp" : "swap") as Tone,
        label,
        ts: t.ts,
        detail: `${t.side} ${t.tokenIn}→${t.tokenOut}`,
        value: t.valueUsd != null ? usd(t.valueUsd) : "—",
        hash: t.hash,
        explorerUrl: t.explorerUrl,
        chainId: t.chainId,
      };
    });
    const hireRows: Row[] = (hires ?? []).map((h) => ({
      kind: "hire" as const,
      tone: "hire" as Tone,
      label: "Hire",
      ts: h.settledAt,
      detail: h.task || "Hire",
      value:
        h.amount != null ? `${h.amount} ${h.assetSymbol ?? ""}`.trim() : "—",
      hash: h.txHash,
      explorerUrl: h.explorerUrl,
      chainId: h.network === "bsc-testnet" ? 97 : undefined,
    }));
    return [...swaps, ...hireRows].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [trades, hires]);

  const shown = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  // Reset to the first page whenever the filter changes the result set.
  useEffect(() => setPage(0), [filter]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const paged = shown.slice(start, start + PAGE_SIZE);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "swap", label: "Swaps" },
    { id: "hire", label: "Hires" },
  ];

  return (
    <div>
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
              {paged.map((r) => (
                <tr key={`${r.kind}-${r.chainId ?? 56}-${r.hash}`} className="text-text-2">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <KindTag tone={r.tone} label={r.label} />
                      <ChainTag chainId={r.chainId} />
                    </span>
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
          No recent transactions. Onchain swaps show the agent's latest activity
          within the recent block window; hires appear once the agent is hired via
          x402 — empty instead of made-up data.
        </p>
      )}

      {shown.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-3">
          <span className="tnum">
            {start + 1}–{Math.min(start + PAGE_SIZE, shown.length)} of {shown.length}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={current === 0}
                className="rounded-[6px] border border-border px-2.5 py-1 font-semibold text-text-2 transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="tnum px-1 text-text-2">
                {current + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={current >= pageCount - 1}
                className="rounded-[6px] border border-border px-2.5 py-1 font-semibold text-text-2 transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TransactionsSkeleton — Suspense fallback while the streamed feed loads. Uses
 * the shared `.shimmer` class (cf. DashboardChart Empty). `failed` renders a quiet
 * error line instead (the feed worker is down); never fabricates rows.
 */
export function TransactionsSkeleton({ failed = false }: { failed?: boolean }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text">Latest transactions</h2>
        <span className="text-xs text-text-3">· onchain</span>
      </div>
      {failed ? (
        <p className="text-sm text-text-3">Transactions feed unavailable right now.</p>
      ) : (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="shimmer h-9 rounded-[8px] border border-border/60 opacity-25"
            />
          ))}
        </div>
      )}
    </div>
  );
}

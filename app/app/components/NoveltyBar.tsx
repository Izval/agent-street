/**
 * NoveltyBar — persistent "new launches" strip (row 2 of the top header).
 *
 * Left: the `ticker` slot (the `LaunchTicker` marquee); a subtle eyebrow link
 * when a route doesn't supply one, so the bar is never empty. Middle: an
 * optional live network-status cluster (`● Live · BSC · N agents`). Right: the
 * marketplace CTAs — **Build agent** (BNB Agent Studio) and **How to hire** —
 * relocated here from the old Sidebar.
 */

import type { ReactNode } from "react";
import { Link } from "react-router";

export function NoveltyBar({
  ticker,
  agentCount,
  network = "BSC",
}: {
  ticker?: ReactNode;
  /** Number of indexed agents. null/undefined → the status cluster is omitted. */
  agentCount?: number | null;
  /** Network label for the status cluster (e.g. "BSC"). */
  network?: string;
}) {
  return (
    <div className="flex h-11 items-center gap-3 border-b border-border bg-bg px-4 md:px-8">
      <div className="min-w-0 flex-1">
        {ticker ?? (
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs text-text-3 transition-colors hover:text-text-2"
          >
            <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-up" />
            New agents live on BSC
          </Link>
        )}
      </div>

      {agentCount != null && (
        <div
          role="status"
          aria-label="Live network status"
          className="hidden shrink-0 items-center gap-2 text-xs text-text-2 lg:flex"
        >
          <span className="flex items-center gap-1.5 font-semibold text-up">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-up" />
            Live
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span className="text-text-3">{network}</span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span className="flex items-center gap-1">
            <span className="tnum font-semibold text-text">
              {agentCount.toLocaleString("en-US")}
            </span>
            <span className="text-text-3">agents</span>
          </span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/portfolios"
          className="hidden min-h-[32px] items-center rounded-[999px] border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text sm:inline-flex"
        >
          Portfolios
        </Link>
        <Link
          to="/saved"
          aria-label="Saved agents"
          className="hidden min-h-[32px] items-center gap-1.5 rounded-[999px] border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text sm:inline-flex"
        >
          <span aria-hidden className="text-sm leading-none">
            ♥
          </span>
          Saved
        </Link>
        <Link
          to="/docs"
          prefetch="intent"
          className="hidden min-h-[32px] items-center rounded-[999px] border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text sm:inline-flex"
        >
          Docs
        </Link>
        <Link
          to="/create"
          className="inline-flex min-h-[32px] items-center rounded-[999px] bg-brand px-3.5 text-[13px] font-semibold text-bg transition-colors hover:bg-brand-bright"
        >
          Build agent
        </Link>
        <Link
          to="/docs/hiring"
          prefetch="intent"
          className="inline-flex min-h-[32px] items-center rounded-[999px] border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          How to hire
        </Link>
      </div>
    </div>
  );
}

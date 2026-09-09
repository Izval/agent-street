/**
 * PortfolioDraftPill — floating "Portfolio (N) → Build" affordance.
 *
 * Appears bottom-right once 1+ agents are staged via the agent-page "+" button
 * (lib/portfolioDraft.ts) and links to the builder (/portfolio/new), which reads
 * the same draft. Sits above the ComparePill so the two never overlap. Client-only
 * and reactive; renders nothing on the server / when the draft is empty (the
 * store's SSR snapshot is empty, so no hydration mismatch).
 */

import { Link } from "react-router";
import { useDraftMembers, clearDraftMembers } from "../lib/portfolioDraft";

export function PortfolioDraftPill() {
  const list = useDraftMembers();
  if (list.length < 1) return null;

  return (
    <div className="fixed bottom-[4.75rem] right-5 z-40 flex items-center gap-2 rounded-[999px] border border-brand/40 bg-surface-2/95 px-2 py-1.5 shadow-[var(--elev-2)] backdrop-blur">
      <Link
        to="/portfolio/new"
        className="inline-flex items-center gap-1.5 rounded-[999px] bg-brand px-4 py-1.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        <span aria-hidden>＋</span>
        Portfolio ({list.length}) →
      </Link>
      <button
        type="button"
        onClick={() => clearDraftMembers()}
        aria-label="Clear portfolio draft"
        className="grid h-7 w-7 place-items-center rounded-full text-text-3 transition-colors hover:bg-surface hover:text-text"
      >
        <span aria-hidden>✕</span>
      </button>
    </div>
  );
}

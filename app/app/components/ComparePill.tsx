/**
 * ComparePill — floating "Compare (N) →" affordance.
 *
 * Appears bottom-right once 2+ agents are queued for comparison (lib/compare.ts)
 * and links to /compare?ids=…. Client-only and reactive; renders nothing on the
 * server and when fewer than 2 are queued (no hydration mismatch — the store's
 * SSR snapshot is empty).
 */

import { Link } from "react-router";
import { useCompare, clearCompare } from "../lib/compare";

export function ComparePill() {
  const list = useCompare();
  if (list.length < 2) return null;

  const ids = list.map((a) => encodeURIComponent(a.id)).join(",");

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-[999px] border border-brand/40 bg-surface-2/95 px-2 py-1.5 shadow-[var(--elev-2)] backdrop-blur">
      <Link
        to={`/compare?ids=${ids}`}
        className="rounded-[999px] bg-brand px-4 py-1.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        Compare ({list.length}) →
      </Link>
      <button
        type="button"
        onClick={() => clearCompare()}
        aria-label="Clear comparison"
        className="grid h-7 w-7 place-items-center rounded-full text-text-3 transition-colors hover:bg-surface hover:text-text"
      >
        <span aria-hidden>✕</span>
      </button>
    </div>
  );
}

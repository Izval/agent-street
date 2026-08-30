/**
 * Sticky Nav (DESIGN.md §5): brand logo on the left, "Built on BNB Chain",
 * yellow CTA pill on the right. Yellow is scarce and purposeful.
 */

import { Link } from "react-router";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand font-bold text-bg">
            A
          </span>
          <span className="text-lg font-bold tracking-tight">
            Agent<span className="text-brand">-</span>Street
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-text-3 sm:inline">
            Built on BNB Chain
          </span>
          <button className="rounded-[999px] bg-brand px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright">
            Connect
          </button>
        </div>
      </div>
    </header>
  );
}

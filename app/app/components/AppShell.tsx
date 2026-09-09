/**
 * AppShell — top-bar marketplace layout (DESIGN.md v2/v3).
 *
 * Two-row sticky header (no left sidebar):
 *   Row 1 (options): logo · MegaMenu (7 categories → shared mega-panel) · search · wallet.
 *   Row 2 (novelties): persistent NoveltyBar — new-launch ticker + Build / How to hire.
 * Content spans the full width (max 1440px), freed from the old 260px rail.
 *
 * Mobile (<lg): the MegaMenu row collapses into a hamburger that opens a
 * full-screen drawer reusing the existing Sidebar tree (categories → subcategories
 * + CTAs). SSR-safe: the drawer state starts closed; no window access on render.
 */

import { useEffect, useState } from "react";
import { Link, useRouteLoaderData } from "react-router";
import { MegaMenu } from "./MegaMenu";
import { NoveltyBar } from "./NoveltyBar";
import { Footer } from "./Footer";
import { LaunchTicker, type LaunchItem } from "./LaunchTicker";
import { Sidebar } from "./Sidebar";
import { WalletButton } from "./WalletButton";
import { CommandPalette } from "./CommandPalette";
import { openCommandPalette } from "./SearchCommand";
import { ComparePill } from "./ComparePill";
import { PortfolioDraftPill } from "./PortfolioDraftPill";
import type { Category, Subcategory } from "../lib/taxonomy";

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <img
        src="/logo.avif"
        alt="Agent-Street"
        width={32}
        height={32}
        className="h-8 w-8 rounded-lg"
      />
      <span className="hidden font-mono text-base font-bold uppercase tracking-[0.08em] sm:inline">
        Agent<span className="text-brand">-</span>Street
      </span>
    </Link>
  );
}

export function AppShell({
  children,
  activeCategory,
  activeSubcategory,
  ticker,
  agentCount,
  network,
}: {
  children: React.ReactNode;
  activeCategory?: Category;
  activeSubcategory?: Subcategory;
  /** Left slot of the novelties bar (e.g. the new-launches ticker). */
  ticker?: React.ReactNode;
  /** Indexed-agent count for the novelties bar status cluster. */
  agentCount?: number | null;
  /** Network label for the status cluster (e.g. "BSC"). */
  network?: string;
}) {
  const [open, setOpen] = useState(false);

  // The novelties feed + agent count are loaded once by the root loader so the
  // ticker and status cluster persist on every route. A route may still pass
  // its own `ticker`/`agentCount` to override (e.g. the richer home pool).
  const rootData = useRouteLoaderData("root") as
    | { total?: number | null; latest?: LaunchItem[] }
    | undefined;
  const resolvedTicker =
    ticker ??
    (rootData?.latest?.length ? <LaunchTicker items={rootData.latest} /> : undefined);
  const resolvedCount = agentCount ?? rootData?.total ?? null;

  // Close with Escape + lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-screen overflow-x-clip bg-bg text-text">
      {/* Sticky two-row header */}
      <header className="sticky top-0 z-30">
        {/* Row 1 — options */}
        <div className="border-b border-border bg-bg/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            {/* Mobile: hamburger */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              className="-ml-2 grid h-11 w-11 place-items-center rounded text-text-2 transition-colors hover:bg-surface-2 hover:text-text lg:hidden"
            >
              <span aria-hidden className="text-xl leading-none">
                ☰
              </span>
            </button>

            <Logo />

            {/* Desktop: compound megamenu */}
            <div className="hidden min-w-0 flex-1 lg:flex">
              <MegaMenu
                activeCategory={activeCategory}
                activeSubcategory={activeSubcategory}
              />
            </div>
            {/* Mobile: spacer pushes search/wallet to the right */}
            <div className="flex-1 lg:hidden" />

            {/* Search trigger — a button, not an input: it opens the one ⌘K
                palette (same brain as the keyboard shortcut) rather than a
                second, separate search. */}
            <button
              type="button"
              onClick={() => openCommandPalette()}
              aria-label="Search agents and skills"
              className="group hidden min-h-[40px] w-40 items-center gap-2 rounded-[999px] border border-white/10 bg-surface-2/90 pl-3.5 pr-2 text-sm text-white/55 outline-none backdrop-blur-md transition-colors hover:border-white/20 focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand sm:flex md:w-56 lg:w-64"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="shrink-0"
              >
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="m10.5 10.5 3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="flex-1 truncate text-left">Search agents and skills</span>
              <kbd className="hidden shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70 md:inline">
                ⌘K
              </kbd>
            </button>

            <WalletButton />
          </div>
        </div>

        {/* Row 2 — persistent novelties bar */}
        <NoveltyBar
          ticker={resolvedTicker}
          agentCount={resolvedCount}
          network={network}
        />
      </header>

      {/* Mobile drawer (reuses the Sidebar tree) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="glass absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto border-r border-border"
          >
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="grid h-11 w-11 place-items-center rounded text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
              >
                <span aria-hidden className="text-lg leading-none">
                  ✕
                </span>
              </button>
            </div>
            <div onClick={() => setOpen(false)}>
              <Sidebar
                activeCategory={activeCategory}
                activeSubcategory={activeSubcategory}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content — full width, no side rail */}
      <main className="min-w-0">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      <Footer agentCount={resolvedCount} network={network} />

      {/* ⌘K command palette + floating compare / portfolio-draft pills
          (all client-only, SSR-safe). */}
      <CommandPalette />
      <PortfolioDraftPill />
      <ComparePill />
    </div>
  );
}

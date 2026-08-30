/**
 * AppShell — top-bar marketplace layout (DESIGN.md v2/v3).
 *
 * Two-row sticky header (no left sidebar):
 *   Row 1 (options): logo · MegaMenu (7 aisles → shared mega-panel) · search · wallet.
 *   Row 2 (novelties): persistent NoveltyBar — new-launch ticker + Build / How to hire.
 * Content spans the full width (max 1440px), freed from the old 260px rail.
 *
 * Mobile (<lg): the MegaMenu row collapses into a hamburger that opens a
 * full-screen drawer reusing the existing Sidebar tree (aisles → subcategories
 * + CTAs). SSR-safe: the drawer state starts closed; no window access on render.
 */

import { useEffect, useState } from "react";
import { Form, Link } from "react-router";
import { MegaMenu } from "./MegaMenu";
import { NoveltyBar } from "./NoveltyBar";
import { Sidebar } from "./Sidebar";
import { WalletButton } from "./WalletButton";
import type { Aisle, Category } from "../lib/taxonomy";

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand font-bold text-bg">
        A
      </span>
      <span className="hidden text-lg font-bold tracking-tight sm:inline">
        Agent<span className="text-brand">-</span>Street
      </span>
    </Link>
  );
}

export function AppShell({
  children,
  activeAisle,
  activeCategory,
  ticker,
}: {
  children: React.ReactNode;
  activeAisle?: Aisle;
  activeCategory?: Category;
  /** Left slot of the novelties bar (e.g. the new-launches ticker). */
  ticker?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
    <div className="min-h-screen bg-bg text-text">
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
                activeAisle={activeAisle}
                activeCategory={activeCategory}
              />
            </div>
            {/* Mobile: spacer pushes search/wallet to the right */}
            <div className="flex-1 lg:hidden" />

            <Form
              method="get"
              action="/search"
              role="search"
              className="hidden sm:block"
            >
              <input
                type="search"
                name="q"
                placeholder="Search agents and skills"
                aria-label="Search agents and skills"
                className="min-h-[40px] w-40 rounded-[999px] border border-white/10 bg-surface-2/90 px-4 text-sm text-white placeholder:text-white/55 outline-none backdrop-blur-md transition-colors focus:border-brand focus:ring-1 focus:ring-brand md:w-56 lg:w-64"
              />
            </Form>

            <WalletButton />
          </div>
        </div>

        {/* Row 2 — persistent novelties bar */}
        <NoveltyBar ticker={ticker} />
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
                activeAisle={activeAisle}
                activeCategory={activeCategory}
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
    </div>
  );
}

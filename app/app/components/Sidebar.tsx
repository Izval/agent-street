/**
 * Sidebar — primary navigation of the App Store shell (DESIGN.md v2 §11).
 *
 * Real marketplace hierarchy: **Categories** (level 1: Trading, DeFi, …) that
 * expand to show their **Subcategories** (level 2) nested inside. The 4
 * required hackathon subcategories are NOT a separate level: they live inside
 * their subcategory and are marked with ★ (Agent Diversity visible without inventing taxonomy).
 *
 * Active state = --text text + --brand left bar (scarce yellow). The tree
 * auto-expands the subcategory of the active context (current route) and respects what the
 * user opens/closes by hand. SSR-safe: the initial state derives from props (no window).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  CATEGORIES,
  REQUIRED_SUBCATEGORIES,
  subcategoriesInCategory,
  subcategoryLabel,
  categoryOf,
  type Category,
  type Subcategory,
} from "../lib/taxonomy";

const REQUIRED = new Set<Subcategory>(REQUIRED_SUBCATEGORIES);

const ITEM_BASE =
  "relative flex min-h-[44px] items-center gap-3 rounded pl-3 pr-2 text-sm transition-colors";

function ActiveBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-1.5 left-0 w-0.5 rounded-[999px] bg-brand"
    />
  );
}

export function Sidebar({
  activeCategory,
  activeSubcategory,
}: {
  activeCategory?: Category;
  activeSubcategory?: Subcategory;
}) {
  // Subcategory of the active context: the selected one, or the subcategory's parent.
  const activeParent: Category | null =
    activeCategory ?? (activeSubcategory ? categoryOf(activeSubcategory) : null);

  const [expanded, setExpanded] = useState<Set<Category>>(
    () => new Set(activeParent ? [activeParent] : []),
  );

  // On navigation (SPA), open the new context's subcategory without closing the others.
  useEffect(() => {
    if (!activeParent) return;
    setExpanded((prev) => {
      if (prev.has(activeParent)) return prev;
      const next = new Set(prev);
      next.add(activeParent);
      return next;
    });
  }, [activeParent]);

  const toggle = (id: Category) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // don't close the mobile drawer when expanding
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col gap-5 p-4"
    >
      {/* Brand logo (yellow mark on dark, §7) */}
      <Link to="/" className="flex items-center gap-2 px-1">
        <img
          src="/logo.avif"
          alt="Agent-Street"
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg"
        />
        <span className="font-mono text-base font-bold uppercase tracking-[0.08em]">
          Agent<span className="text-brand">-</span>Street
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {/* Categories (level 1) with nested subcategories (level 2) */}
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Categories
        </div>

        {CATEGORIES.map((a) => {
          const active = activeCategory === a.id;
          const isOpen = expanded.has(a.id);
          const subs = subcategoriesInCategory(a.id);
          const panelId = `subcats-${a.id}`;
          return (
            <div key={a.id}>
              {/* Subcategory row: link + chevron to expand. */}
              <div
                className={
                  ITEM_BASE +
                  " pr-1 " +
                  (active
                    ? "font-semibold text-text"
                    : "text-text-2 hover:bg-surface-2 hover:text-text")
                }
              >
                {active && <ActiveBar />}
                <Link
                  to={`/category/${a.id}`}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-1 items-center gap-3"
                >
                  <span
                    aria-hidden
                    className="w-4 text-center text-base"
                    style={{ color: a.accent }}
                  >
                    {a.glyph}
                  </span>
                  {a.label}
                </Link>
                <button
                  type="button"
                  onClick={toggle(a.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${a.label}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded text-text-3 transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <span
                    aria-hidden
                    className={
                      "text-[10px] transition-transform duration-200 " +
                      (isOpen ? "rotate-90" : "")
                    }
                  >
                    ▶
                  </span>
                </button>
              </div>

              {/* Subcategories (level 2). */}
              {isOpen && (
                <div
                  id={panelId}
                  className="mb-1 ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2"
                >
                  {subs.map((c) => {
                    const subActive = activeSubcategory === c.id;
                    return (
                      <Link
                        key={c.id}
                        to={`/subcategory/${c.id}`}
                        aria-current={subActive ? "page" : undefined}
                        className={
                          "relative flex min-h-[40px] items-center gap-2 rounded pl-2.5 pr-2 text-[13px] transition-colors " +
                          (subActive
                            ? "font-semibold text-text"
                            : "text-text-2 hover:bg-surface-2 hover:text-text")
                        }
                      >
                        {subActive && <ActiveBar />}
                        <span className="flex-1 truncate">
                          {subcategoryLabel(c.id)}
                        </span>
                        {REQUIRED.has(c.id) && (
                          <span
                            aria-label="Required hackathon subcategory"
                            title="Required"
                            className="shrink-0 text-[11px] text-brand"
                          >
                            ★
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTAs: hire (marketplace) / build (BNB Agent Studio) */}
      <div className="flex flex-col gap-2 px-1">
        <Link
          to="/skills"
          className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          <span aria-hidden className="text-brand">❖</span> Skills
        </Link>
        <Link
          to="/portfolios"
          className="flex min-h-[40px] items-center justify-center rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          Portfolios
        </Link>
        <Link
          to="/create"
          className="flex min-h-[40px] items-center justify-center rounded-[999px] bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
        >
          Build agent
        </Link>
        <Link
          to="/docs/hiring"
          className="flex min-h-[40px] items-center justify-center rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          How to hire
        </Link>
        <Link
          to="/docs"
          className="flex min-h-[40px] items-center justify-center rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          Docs
        </Link>
        <Link
          to="/for-agents"
          className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          <span aria-hidden className="text-brand">◆</span> For agents
        </Link>
      </div>

      <div className="px-1 text-[11px] text-text-3">Built on BNB Chain</div>
    </nav>
  );
}

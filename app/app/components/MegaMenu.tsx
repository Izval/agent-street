/**
 * MegaMenu — compound top-bar navigation (replaces the left Sidebar on desktop).
 *
 * One row of the 7 category triggers (`CATEGORIES`) + a SINGLE shared mega-panel whose
 * content swaps per category (`openCategory` state) — you navigate *between* categories
 * inside one component, never 7 separate menus. Each trigger is a real
 * `<Link to="/category/:id">` (click navigates) that also opens the panel on
 * hover/focus. The panel shows the category's `subcategoriesInCategory` (with ★ on the
 * mandatory ones) + a featured `CategoryTile`.
 *
 * Interaction mirrors `Flyout.tsx`: hover-intent (120ms open / 90ms close), a
 * body-portalled panel positioned under the trigger strip (full-bleed, correct
 * z-index), close on Escape. A11y: `aria-haspopup`/`aria-expanded`,
 * `role="menu"`/`role="menuitem"`, arrow-key movement between triggers.
 *
 * SSR-safe: the panel only renders after a client interaction (portal is
 * guarded on `document`); the initial state never touches `window`.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import {
  CATEGORIES,
  REQUIRED_SUBCATEGORIES,
  categoryOf,
  subcategoriesInCategory,
  type Category,
  type Subcategory,
} from "../lib/taxonomy";
import { coverStyle } from "../lib/cover";

const REQUIRED = new Set<Subcategory>(REQUIRED_SUBCATEGORIES);
const OPEN_DELAY = 120;
const CLOSE_DELAY = 90;

export function MegaMenu({
  activeCategory,
  activeSubcategory,
}: {
  activeCategory?: Category;
  activeSubcategory?: Subcategory;
}) {
  const activeParent: Category | null =
    activeCategory ?? (activeSubcategory ? categoryOf(activeSubcategory) : null);

  const [open, setOpen] = useState<Category | null>(null);
  const [top, setTop] = useState(64);
  const navRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<(HTMLAnchorElement | null)[]>([]);
  const openT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const measure = () => {
    const r = navRef.current?.getBoundingClientRect();
    if (r) setTop(r.bottom);
  };

  const scheduleOpen = (id: Category) => {
    clearTimeout(closeT.current);
    if (open !== null) {
      measure();
      setOpen(id); // already open → swap instantly
      return;
    }
    clearTimeout(openT.current);
    openT.current = setTimeout(() => {
      measure();
      setOpen(id);
    }, OPEN_DELAY);
  };
  const cancelOpen = () => clearTimeout(openT.current);
  const scheduleClose = () => {
    clearTimeout(openT.current);
    clearTimeout(closeT.current);
    closeT.current = setTimeout(() => setOpen(null), CLOSE_DELAY);
  };
  const cancelClose = () => clearTimeout(closeT.current);

  // While open: keep the panel glued under the strip, and close on Escape.
  useEffect(() => {
    if (open === null) return;
    const onScrollResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("scroll", onScrollResize, { passive: true });
    window.addEventListener("resize", onScrollResize);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScrollResize);
      window.removeEventListener("resize", onScrollResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      clearTimeout(openT.current);
      clearTimeout(closeT.current);
    };
  }, []);

  // Roving arrow-key movement between the category triggers.
  const onNavKeyDown = (e: React.KeyboardEvent) => {
    const idx = triggers.current.findIndex((t) => t === document.activeElement);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % CATEGORIES.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + CATEGORIES.length) % CATEGORIES.length;
    else return;
    e.preventDefault();
    triggers.current[next]?.focus();
  };

  const openCategoryDef = open ? CATEGORIES.find((a) => a.id === open) ?? null : null;
  const subs = open ? subcategoriesInCategory(open) : [];

  return (
    <div
      ref={navRef}
      className="flex min-w-0 items-center"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      <nav
        aria-label="Marketplace subcategories"
        onKeyDown={onNavKeyDown}
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto"
      >
        {CATEGORIES.map((a, i) => {
          const active = activeParent === a.id;
          const isOpen = open === a.id;
          const highlight = active || isOpen;
          return (
            <Link
              key={a.id}
              to={`/category/${a.id}`}
              ref={(el) => {
                triggers.current[i] = el;
              }}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-current={active ? "page" : undefined}
              onMouseEnter={() => scheduleOpen(a.id)}
              onMouseLeave={cancelOpen}
              onFocus={() => {
                measure();
                setOpen(a.id);
              }}
              onClick={() => setOpen(null)}
              className={
                "relative flex shrink-0 items-center gap-1.5 rounded-[6px] px-3 py-2 font-mono text-[13px] font-medium tracking-tight transition-colors " +
                (highlight ? "text-text" : "text-text-2 hover:text-text")
              }
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full transition-opacity duration-200"
                style={{ background: a.accent, opacity: highlight ? 1 : 0.5 }}
              />
              {a.short ?? a.label}
              {/* Active/open underline — the only yellow here (scarce). */}
              <span
                aria-hidden
                className={
                  "absolute inset-x-3 -bottom-px h-0.5 rounded-[999px] bg-brand transition-opacity duration-200 " +
                  (highlight ? "opacity-100" : "opacity-0")
                }
              />
            </Link>
          );
        })}
      </nav>

      {/* Shared mega-panel (body portal, full-bleed under the strip). */}
      {open !== null && openCategoryDef && typeof document !== "undefined"
        ? createPortal(
            <div
              role="menu"
              aria-label={`${openCategoryDef.label} subcategories`}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              style={{
                position: "fixed",
                top,
                left: 0,
                right: 0,
                ...coverStyle(openCategoryDef.id, openCategoryDef.accent),
              }}
              className="flyin z-40 overflow-hidden border-b border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--elev-hero)]"
            >
              {/* Legibility scrim — darker on the left where the links sit,
                  fading right so the subcategory art breathes. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.62) 42%, rgba(11,14,17,0.22) 100%)",
                }}
              />
              {/* Oversized category glyph watermark. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 select-none text-[13rem] leading-none opacity-[0.12]"
                style={{ color: openCategoryDef.accent }}
              >
                {openCategoryDef.glyph}
              </span>

              <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-4 py-7 md:grid-cols-[1fr_300px] md:px-8">
                {/* Sub-subcategories (level 2). */}
                <div>
                  <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: openCategoryDef.accent }}
                    />
                    {openCategoryDef.label}
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {subs.map((c) => (
                      <Link
                        key={c.id}
                        to={`/subcategory/${c.id}`}
                        role="menuitem"
                        aria-current={
                          activeSubcategory === c.id ? "page" : undefined
                        }
                        onClick={() => setOpen(null)}
                        className={
                          "group flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-sm backdrop-blur-sm transition-colors " +
                          (activeSubcategory === c.id
                            ? "bg-white/15 font-semibold text-white"
                            : "text-white/85 hover:bg-white/10 hover:text-white")
                        }
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: openCategoryDef.accent }}
                        />
                        <span className="flex-1 truncate">{c.label}</span>
                        {REQUIRED.has(c.id) && (
                          <span
                            aria-label="Required hackathon subcategory"
                            title="Required"
                            className="shrink-0 text-[11px] text-brand"
                          >
                            ★
                          </span>
                        )}
                        <span
                          aria-hidden
                          className="shrink-0 text-white/70 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                        >
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Immersive category identity + CTA (over the art). */}
                <div className="hidden md:flex md:flex-col md:justify-end">
                  <h3 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                    {openCategoryDef.label}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">
                    <span className="tnum">{subs.length}</span> subcategories ·
                    live on BSC
                  </p>
                  <Link
                    to={`/category/${openCategoryDef.id}`}
                    onClick={() => setOpen(null)}
                    className="group mt-4 inline-flex w-fit items-center gap-1.5 rounded-[999px] border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
                  >
                    Explore {openCategoryDef.label}
                    <span
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * AgentsBrowser — client-side, instant agent catalog for a category page.
 *
 * The agent-side twin of the /skills browser layout (DESIGN.md v3 §22): instead
 * of a stack of per-subcategory sliders, a category is explored as ONE flat,
 * sortable grid with a sticky filter rail.
 *
 * Unlike /skills, filtering/sorting/pagination run ENTIRELY IN THE BROWSER over
 * the pool the loader ships — applying a filter never navigates or reloads the
 * page, it just re-renders the grid. The URL is kept in sync with a silent
 * `history.replaceState` (no router navigation, no loader re-run) so a filtered
 * view stays shareable. On first paint (and without JS) the grid renders the
 * state parsed from the URL by the loader, so it is SSR-correct and crawlable.
 *
 * Cards are the homepage `AgentCard` (the portrait "FIFA" card), so agents look
 * identical wherever they are listed. The Featured rail above is unaffected.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent } from "../lib/agents";
import type { Subcategory } from "../lib/taxonomy";
import { AgentCard } from "./AgentCard";

export type AgentSort = "popular" | "recent";

export const AGENT_SORTS: { value: AgentSort; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "recent", label: "Recently added" },
];

export interface AgentFacet {
  id: Subcategory;
  label: string;
  count: number;
}

/** Everything the browser renders — assembled by the category loader. */
export interface CategoryListing {
  /** The whole browsable pool for the category (already deduped). */
  pool: Agent[];
  facets: AgentFacet[];
  perPage: number;
  /** Initial state parsed from the request URL (SSR + deep-link correctness). */
  selected: {
    subcategories: Subcategory[];
    sort: AgentSort;
    verified: boolean;
  };
}

/** Observable demand on 8004scan: feedbacks weigh most, then stars, then score. */
function popularityKey(a: Agent): number {
  return a.feedbacks * 1000 + a.stars * 10 + a.score;
}

/** "Date added" key: ERC-721 tokenId (higher = minted later). */
function mintKey(a: Agent): number {
  const n = Number(a.tokenId);
  return Number.isFinite(n) ? n : -1;
}

// ---- Pagination window --------------------------------------------------- //

/** Compact page window: 1 … c-1 c c+1 … last. */
function pageWindow(page: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const near = new Set<number>([1, total, page - 1, page, page + 1]);
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!near.has(n)) continue;
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

// ---- Browser ------------------------------------------------------------- //

export function AgentsBrowser({
  listing,
  basePath,
}: {
  listing: CategoryListing;
  basePath: string;
}) {
  const [subs, setSubs] = useState<Set<Subcategory>>(
    () => new Set(listing.selected.subcategories),
  );
  const [verified, setVerified] = useState(listing.selected.verified);
  const [sort, setSort] = useState<AgentSort>(listing.selected.sort);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const activeCount = subs.size + (verified ? 1 : 0);

  // Filter → sort → derive the current page, all in memory (instant, no fetch).
  const filtered = useMemo(() => {
    let list = listing.pool;
    if (subs.size) {
      list = list.filter((a) => a.subcategory && subs.has(a.subcategory));
    }
    if (verified) list = list.filter((a) => a.isVerified);
    const arr = [...list];
    arr.sort((a, b) =>
      sort === "recent"
        ? mintKey(b) - mintKey(a)
        : popularityKey(b) - popularityKey(a),
    );
    return arr;
  }, [listing.pool, subs, verified, sort]);

  const filteredTotal = filtered.length;
  const poolTotal = listing.pool.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / listing.perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * listing.perPage;
  const items = filtered.slice(start, start + listing.perPage);
  const rangeStart = filteredTotal === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(safePage * listing.perPage, filteredTotal);

  // Keep the URL shareable WITHOUT a router navigation (no loader re-run, so the
  // page never reloads). Runs only on the client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    for (const id of subs) sp.append("subcategory", id);
    if (verified) sp.set("verified", "1");
    if (sort !== "popular") sp.set("sort", sort);
    if (safePage > 1) sp.set("page", String(safePage));
    const qs = sp.toString();
    window.history.replaceState(null, "", `${basePath}${qs ? `?${qs}` : ""}`);
  }, [subs, verified, sort, safePage, basePath]);

  const toggleSub = (id: Subcategory) => {
    setSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPage(1);
  };

  const clearAll = () => {
    setSubs(new Set());
    setVerified(false);
    setPage(1);
  };

  const goToPage = (n: number) => {
    setPage(n);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filterPanel = (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text">Filters</h2>
        <button
          type="button"
          onClick={clearAll}
          disabled={activeCount === 0}
          className={
            "text-xs font-semibold transition-colors " +
            (activeCount === 0
              ? "cursor-default text-text-3 opacity-40"
              : "text-text-3 hover:text-brand")
          }
        >
          Clear all
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-wide text-text-3">
          Subcategory
        </legend>
        <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {listing.facets.map((f) => (
            <label
              key={f.id}
              className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-text-2 hover:text-text"
            >
              <input
                type="checkbox"
                checked={subs.has(f.id)}
                onChange={() => toggleSub(f.id)}
                className="h-4 w-4 shrink-0 rounded accent-brand"
              />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              <span className="tnum shrink-0 text-[11px] text-text-3">
                {f.count}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5 border-t border-border pt-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-2 hover:text-text">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => {
              setVerified(e.currentTarget.checked);
              setPage(1);
            }}
            className="h-4 w-4 shrink-0 rounded accent-brand"
          />
          Verified only
        </label>
      </fieldset>
    </div>
  );

  return (
    <div
      ref={topRef}
      className="scroll-mt-28 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8"
    >
      {/* Filter rail — sticky on desktop, collapsible on mobile. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="glass-hair mb-4 flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-semibold text-text lg:hidden"
        >
          <span>Filters{activeCount ? ` · ${activeCount}` : ""}</span>
          <span aria-hidden>{showFilters ? "▲" : "▼"}</span>
        </button>
        <div className={showFilters ? "block" : "hidden lg:block"}>
          {filterPanel}
        </div>
      </aside>

      {/* Main column. */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
          <h2 className="text-2xl font-bold text-text md:text-3xl">
            <span className="tnum">{filteredTotal.toLocaleString()}</span>{" "}
            <span className="text-text-2">
              {filteredTotal === 1 ? "agent" : "agents"}
            </span>
            {filteredTotal !== poolTotal && (
              <span className="ml-2 text-sm font-medium text-text-3">
                of {poolTotal.toLocaleString()}
              </span>
            )}
          </h2>

          <label className="flex items-center gap-2 text-sm text-text-3">
            Sort by
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.currentTarget.value as AgentSort);
                setPage(1);
              }}
              className="glass-hair rounded-lg px-3 py-2 text-sm font-semibold text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {AGENT_SORTS.map((s) => (
                <option
                  key={s.value}
                  value={s.value}
                  className="bg-surface text-text"
                >
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {items.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-text-2">No agents match these filters.</p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-text-3">
              Showing{" "}
              <span className="tnum">
                {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
              </span>{" "}
              of <span className="tnum">{filteredTotal.toLocaleString()}</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((a) => (
                <AgentCard key={a.id} agent={a} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
              >
                {(() => {
                  const base =
                    "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-semibold transition-colors";
                  return (
                    <>
                      {safePage > 1 && (
                        <button
                          type="button"
                          onClick={() => goToPage(safePage - 1)}
                          className={`${base} border border-border text-text hover:border-brand`}
                        >
                          ← Prev
                        </button>
                      )}
                      {pageWindow(safePage, totalPages).map((n, i) =>
                        n === "…" ? (
                          <span key={`gap-${i}`} className={`${base} text-text-3`}>
                            …
                          </span>
                        ) : (
                          <button
                            key={n}
                            type="button"
                            onClick={() => goToPage(n)}
                            aria-current={n === safePage ? "page" : undefined}
                            className={
                              n === safePage
                                ? `${base} bg-brand text-bg`
                                : `${base} border border-border text-text-2 hover:border-brand hover:text-text`
                            }
                          >
                            {n}
                          </button>
                        ),
                      )}
                      {safePage < totalPages && (
                        <button
                          type="button"
                          onClick={() => goToPage(safePage + 1)}
                          className={`${base} border border-border text-text hover:border-brand`}
                        >
                          Next →
                        </button>
                      )}
                    </>
                  );
                })()}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

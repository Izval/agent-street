/**
 * SkillsBrowser — SEO-friendly, URL-driven skill catalog (DESIGN.md v3 §22).
 *
 * Filtering, sorting and pagination all live in the URL and run on the SERVER
 * (route loader → loadSkillPage), so every state is a distinct, crawlable,
 * shareable page rendered in SSR — no client-side "load everything" button.
 *
 *   - Filters + sort: a GET <Form> (auto-submits on change with JS; the visible
 *     "Apply" button keeps it working without JS). Changing a filter drops the
 *     page param, so results return to page 1.
 *   - Pagination: real <Link> anchors (Prev / numbered / Next) with rel prev/next
 *     — the crawlable surface.
 *
 * Layout: a sticky filter rail + a main column with a toolbar (count + sort) over
 * a cover-card grid. The rail collapses behind a toggle on mobile.
 */

import { useState } from "react";
import { Form, Link, useSearchParams, useSubmit } from "react-router";
import type {
  SkillFacet,
  SkillPage,
  SkillSort,
} from "../lib/skills-live";
import { SKILL_SORTS } from "../lib/skills-live";
import type { Subcategory } from "../lib/taxonomy";
import type { SkillProvider } from "../lib/skills";
import { SkillTile } from "./SkillTile";

function FacetRow<T extends string>({
  name,
  facet,
  checked,
}: {
  name: string;
  facet: SkillFacet<T>;
  checked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-text-2 hover:text-text">
      <input
        type="checkbox"
        name={name}
        value={facet.id}
        defaultChecked={checked}
        className="h-4 w-4 shrink-0 rounded accent-brand"
      />
      <span className="min-w-0 flex-1 truncate">{facet.label}</span>
      <span className="tnum shrink-0 text-[11px] text-text-3">{facet.count}</span>
    </label>
  );
}

function FilterForm({ data }: { data: SkillPage }) {
  const submit = useSubmit();
  const { selected } = data;
  const activeCount =
    selected.subcategories.length +
    selected.providers.length +
    (selected.verified ? 1 : 0);

  // Auto-submit on any change (progressive enhancement); the Apply button and
  // Enter-to-submit keep the form usable without JS. Keyed by selection so the
  // uncontrolled inputs reset to match the URL after every navigation.
  return (
    <Form
      method="get"
      key={JSON.stringify(selected)}
      onChange={(e) => submit(e.currentTarget)}
      className="glass-panel rounded-xl p-5"
    >
      {/* Preserve sort across filter changes, but never carry page over. */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text">Filters</h2>
        <Link
          to="/skills"
          aria-disabled={activeCount === 0}
          className={
            "text-xs font-semibold transition-colors " +
            (activeCount === 0
              ? "pointer-events-none text-text-3 opacity-40"
              : "text-text-3 hover:text-brand")
          }
        >
          Clear all
        </Link>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-wide text-text-3">
          Subcategory
        </legend>
        <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {data.subcategories.map((f) => (
            <FacetRow
              key={f.id}
              name="subcategory"
              facet={f}
              checked={selected.subcategories.includes(f.id)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-wide text-text-3">
          Provider
        </legend>
        <div className="mt-2 space-y-0.5">
          {data.providers.map((f) => (
            <FacetRow
              key={f.id}
              name="provider"
              facet={f}
              checked={selected.providers.includes(f.id)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5 border-t border-border pt-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-2 hover:text-text">
          <input
            type="checkbox"
            name="verified"
            value="1"
            defaultChecked={selected.verified}
            className="h-4 w-4 shrink-0 rounded accent-brand"
          />
          Security-scanned only
        </label>
      </fieldset>

      {/* Keeps the current sort when the form submits (filters change). */}
      <input type="hidden" name="sort" value={selected.sort} />

      <button
        type="submit"
        className="mt-5 w-full rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
      >
        Apply filters
      </button>
    </Form>
  );
}

// ---- Pagination (crawlable anchors) -------------------------------------- //

/** Compact page window: 1 … c-1 c c+1 … last. */
function pageWindow(page: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const push = (n: number) => out.push(n);
  const near = new Set<number>([1, total, page - 1, page, page + 1]);
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!near.has(n)) continue;
    if (n - prev > 1) out.push("…");
    push(n);
    prev = n;
  }
  return out;
}

function Pagination({ data }: { data: SkillPage }) {
  const [searchParams] = useSearchParams();
  const { page, totalPages } = data;
  if (totalPages <= 1) return null;

  const hrefFor = (n: number) => {
    const sp = new URLSearchParams(searchParams);
    if (n <= 1) sp.delete("page");
    else sp.set("page", String(n));
    const qs = sp.toString();
    return { pathname: "/skills", search: qs ? `?${qs}` : "" };
  };

  const base =
    "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-semibold transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link
          to={hrefFor(page - 1)}
          rel="prev"
          className={`${base} border border-border text-text hover:border-brand`}
        >
          ← Prev
        </Link>
      )}
      {pageWindow(page, totalPages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className={`${base} text-text-3`}>
            …
          </span>
        ) : (
          <Link
            key={n}
            to={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={
              n === page
                ? `${base} bg-brand text-bg`
                : `${base} border border-border text-text-2 hover:border-brand hover:text-text`
            }
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link
          to={hrefFor(page + 1)}
          rel="next"
          className={`${base} border border-border text-text hover:border-brand`}
        >
          Next →
        </Link>
      )}
    </nav>
  );
}

// ---- Page ---------------------------------------------------------------- //

export function SkillsBrowser({ data }: { data: SkillPage }) {
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const activeCount =
    data.selected.subcategories.length +
    data.selected.providers.length +
    (data.selected.verified ? 1 : 0);

  const rangeStart = (data.page - 1) * data.perPage + 1;
  const rangeEnd = Math.min(data.page * data.perPage, data.filteredTotal);

  // Sort changes via its own tiny GET form so it round-trips through the URL
  // too (and resets to page 1). It carries the active filters as hidden fields.
  const filterFields = (
    <>
      {data.selected.subcategories.map((c) => (
        <input key={`c-${c}`} type="hidden" name="subcategory" value={c} />
      ))}
      {data.selected.providers.map((p) => (
        <input key={`p-${p}`} type="hidden" name="provider" value={p} />
      ))}
      {data.selected.verified && <input type="hidden" name="verified" value="1" />}
    </>
  );

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
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
          <FilterForm data={data} />
        </div>
      </aside>

      {/* Main column. */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
          <h1 className="text-2xl font-bold text-text md:text-3xl">
            <span className="tnum">{data.filteredTotal.toLocaleString()}</span>{" "}
            <span className="text-text-2">
              {data.filteredTotal === 1 ? "skill" : "skills"}
            </span>
            {data.filteredTotal !== data.total && (
              <span className="ml-2 text-sm font-medium text-text-3">
                of {data.total.toLocaleString()}
              </span>
            )}
          </h1>

          <Form method="get" onChange={(e) => submit(e.currentTarget)}>
            {filterFields}
            <label className="flex items-center gap-2 text-sm text-text-3">
              Sort by
              <select
                name="sort"
                defaultValue={data.selected.sort}
                className="glass-hair rounded-lg px-3 py-2 text-sm font-semibold text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {SKILL_SORTS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-surface text-text">
                    {s.label}
                  </option>
                ))}
              </select>
              <noscript>
                <button type="submit" className="ml-2 text-brand">
                  Go
                </button>
              </noscript>
            </label>
          </Form>
        </div>

        {data.items.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-text-2">No skills match these filters.</p>
            <Link
              to="/skills"
              className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Clear all filters
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-text-3">
              Showing{" "}
              <span className="tnum">
                {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
              </span>{" "}
              of <span className="tnum">{data.filteredTotal.toLocaleString()}</span>
            </p>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((s) => (
                <SkillTile key={s.id} skill={s} />
              ))}
            </div>
            <Pagination data={data} />
          </>
        )}
      </div>
    </div>
  );
}

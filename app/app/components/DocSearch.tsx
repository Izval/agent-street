/**
 * DocSearch — client-side search across the documentation.
 *
 * Lazily fetches /docs.search.json on first focus (module-cached, so it loads
 * once per session), then filters titles/descriptions/body text as you type.
 * Keyboard: ↑/↓ to move, Enter to open, Esc to close.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { docHref, type DocSearchEntry } from "../lib/docs";

let CACHE: DocSearchEntry[] | null = null;
let INFLIGHT: Promise<DocSearchEntry[]> | null = null;

function loadIndex(): Promise<DocSearchEntry[]> {
  if (CACHE) return Promise.resolve(CACHE);
  if (!INFLIGHT) {
    INFLIGHT = fetch("/docs.search.json")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<DocSearchEntry[]>)
          : ([] as DocSearchEntry[]),
      )
      .then((d) => {
        CACHE = d;
        return d;
      })
      .catch(() => [] as DocSearchEntry[]);
  }
  return INFLIGHT;
}

function score(e: DocSearchEntry, q: string): number {
  if (e.title.toLowerCase().includes(q)) return 3;
  if (e.description.toLowerCase().includes(q)) return 2;
  if (e.text.toLowerCase().includes(q)) return 1;
  return 0;
}

function snippet(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return text.slice(0, 100);
  const start = Math.max(0, i - 36);
  return (
    (start > 0 ? "…" : "") +
    text.slice(start, i + q.length + 60).trim() +
    "…"
  );
}

export function DocSearch() {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<DocSearchEntry[]>(CACHE ?? []);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return [];
    return index
      .map((e) => ({ e, s: score(e, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((r) => r.e);
  }, [query, index]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const ensureIndex = () => {
    if (index.length === 0) loadIndex().then(setIndex);
  };

  const go = (slug: string) => {
    setOpen(false);
    setQ("");
    navigate(docHref(slug));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r.slug);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          ensureIndex();
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search docs"
        aria-label="Search documentation"
        role="combobox"
        aria-expanded={open && !!query}
        aria-controls="doc-search-results"
        className="min-h-[36px] w-full rounded-[8px] border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 outline-none transition-colors focus:border-brand"
      />
      {open && query && (
        <div
          id="doc-search-results"
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--elev-2)]"
        >
          {results.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-text-3">No matches</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.slug}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.slug)}
                className={
                  "block w-full px-3 py-2 text-left transition-colors " +
                  (i === active ? "bg-surface-2" : "hover:bg-surface-2")
                }
              >
                <div className="text-[13px] font-semibold text-text">
                  {r.title}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-text-3">
                  {r.description || snippet(r.text, query)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

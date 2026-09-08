/**
 * SearchCommand — ⌘K command overlay (plan §5.10). Presentational +
 * keyboard navigation: results are injected by the parent (agents/
 * subcategories/skills); the component only displays and navigates them. `.glass-frost`
 * centered, ↑↓ move the selection, ↵ navigates, Esc / click on overlay close.
 * A11y: modal dialog, basic focus-trap, `aria-activedescendant` (focus lives
 * in the input; items are highlighted via active descendant).
 *
 * SSR-safe: does not access `window`/`document` in render; the global ⌘K
 * listener lives in `useCommandK`, which only runs in effect (client). The
 * `open` state is controlled by the parent.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { agentHref } from "../lib/agents";
import { coverStyle } from "../lib/cover";
import { useImageLoad } from "../lib/useImageLoad";
import type { CSSProperties, KeyboardEvent } from "react";

interface Cover {
  /** Deterministic seed for the gradient art (id or name). */
  seed: string;
  /** Category accent (CSS token) tinting the gradient. */
  accent: string;
  /** Optional remote photo, revealed over the gradient once it loads. */
  imageUrl?: string;
}

interface FlatItem {
  key: string;
  label: string;
  sub?: string;
  to: string;
  group: string;
  cover?: Cover;
}

export interface SearchCommandResults {
  agents: any[];
  subcategories: any[];
  skills: any[];
}

export interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
  results?: SearchCommandResults;
  /** Controlled input value (optional; if omitted, it is uncontrolled). */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** Whether testnet agents are included in results (shown as a toggle). */
  includeTestnet?: boolean;
  onToggleTestnet?: (next: boolean) => void;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Read the `cover` an item carries (agents/subcategories/skills all attach one). */
function cover(v: any): Cover | undefined {
  const c = v?.cover;
  if (!c || typeof c.seed !== "string" || typeof c.accent !== "string") return undefined;
  return {
    seed: c.seed,
    accent: c.accent,
    imageUrl: typeof c.imageUrl === "string" ? c.imageUrl : undefined,
  };
}

function flatten(results?: SearchCommandResults): FlatItem[] {
  if (!results) return [];
  const out: FlatItem[] = [];
  for (const a of results.agents ?? []) {
    const id = str(a?.agentId ?? a?.id ?? a?.tokenId, "");
    out.push({
      key: `agent:${id || out.length}`,
      label: str(a?.name, "Agent"),
      sub: str(a?.subcategoryLabel ?? a?.subcategory),
      to: str(a?.to, id ? agentHref({ id, name: str(a?.name, "") }) : "#"),
      group: "Agents",
      cover: cover(a),
    });
  }
  for (const c of results.subcategories ?? []) {
    const id = str(c?.id, "");
    out.push({
      key: `cat:${id || out.length}`,
      label: str(c?.label ?? c?.name, "Subcategory"),
      sub: str(c?.category),
      to: str(c?.to, id ? `/subcategory/${id}` : "#"),
      group: "Categories",
      cover: cover(c),
    });
  }
  for (const s of results.skills ?? []) {
    const id = str(s?.id, "");
    out.push({
      key: `skill:${id || out.length}`,
      label: str(s?.name ?? s?.label, "Skill"),
      sub: str(s?.tags?.[0]),
      to: str(s?.to, id ? `/skill/${id}` : "#"),
      group: "Skills",
      cover: cover(s),
    });
  }
  return out;
}

/**
 * RowThumb — a small cover thumbnail for a result row. Its own component because
 * it calls `useImageLoad` (a hook, so never inside a `.map`). The deterministic
 * `coverStyle` gradient + the item's initial show instantly; the remote photo
 * reveals over them only once it genuinely loads (never a broken image).
 */
function RowThumb({ cover, label }: { cover: Cover; label: string }) {
  const { ok, imgProps } = useImageLoad(cover.imageUrl);
  const base: CSSProperties = {
    ...coverStyle(cover.seed, cover.accent),
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cover.accent} 40%, transparent)`,
  };
  return (
    <span
      aria-hidden
      className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md text-[11px] font-bold text-text-2"
      style={base}
    >
      {label.slice(0, 1).toUpperCase()}
      {cover.imageUrl && (
        <img
          {...imgProps}
          src={cover.imageUrl}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            ok ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}

export function SearchCommand({
  open,
  onClose,
  results,
  query,
  onQueryChange,
  includeTestnet = true,
  onToggleTestnet,
}: SearchCommandProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const items = useMemo(() => flatten(results), [results]);

  const trimmedQuery = (query ?? "").trim();
  // A persistent "see all" escape hatch to the full-page /search grid. It is the
  // last keyboard-navigable entry, so ↵ on it (or when there are no results)
  // leaves the 6-item palette for the complete results page.
  const seeAll: FlatItem | null = trimmedQuery
    ? {
        key: "see-all",
        label: `See all results for "${trimmedQuery}"`,
        to: `/search?q=${encodeURIComponent(trimmedQuery)}`,
        group: "__seeall__",
      }
    : null;
  const navItems = seeAll ? [...items, seeAll] : items;

  // Focus on open + reset the active index.
  useEffect(() => {
    if (!open) return;
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Keep the active index within range when the results change.
  useEffect(() => {
    setActive((i) => (navItems.length === 0 ? 0 : Math.min(i, navItems.length - 1)));
  }, [navItems.length]);

  if (!open) return null;

  const groups = groupBy(items);

  function go(item: FlatItem) {
    onClose();
    if (item.to && item.to !== "#") navigate(item.to);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (navItems.length ? (i + 1) % navItems.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (navItems.length ? (i - 1 + navItems.length) % navItems.length : 0));
      return;
    }
    if (e.key === "Enter") {
      const item = navItems[active];
      if (item) {
        e.preventDefault();
        go(item);
      }
      return;
    }
    if (e.key === "Tab") {
      // Basic focus-trap: keep focus inside the dialog.
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const activeId = navItems[active]?.key;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search Agent-Street"
        onKeyDown={onKeyDown}
        className="glass-frost search-frost w-full max-w-xl overflow-hidden rounded-lg"
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="shrink-0 text-text-3"
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
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={activeId ? `cmdk-${activeId}` : undefined}
            aria-autocomplete="list"
            placeholder="Search agents, subcategories, skills…"
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            className="tnum flex-1 bg-transparent text-sm text-text placeholder:text-text-3 outline-none"
          />
          <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-3">
            Esc
          </kbd>
        </div>

        {/* Options bar — testnet include/exclude toggle. */}
        {onToggleTestnet && (
          <div className="flex items-center justify-end border-b border-border px-4 py-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={includeTestnet}
              onClick={() => onToggleTestnet(!includeTestnet)}
              className="flex items-center gap-2 text-[11px] font-medium text-text-3 transition-colors hover:text-text-2"
            >
              <span>Include testnet</span>
              <span
                aria-hidden
                className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${
                  includeTestnet ? "bg-brand" : "bg-surface-2"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                    includeTestnet ? "translate-x-[11px]" : "translate-x-[3px]"
                  }`}
                />
              </span>
            </button>
          </div>
        )}

        {/* Results */}
        <ul
          id="cmdk-list"
          role="listbox"
          aria-label="Results"
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {navItems.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-text-3">
              Type to search agents, subcategories and skills.
            </li>
          ) : (
            <>
              {groups.map((g) => (
                <li key={g.group} role="presentation">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-text-3">
                    {g.group}
                  </div>
                  <ul role="presentation">
                    {g.items.map((item) => {
                      const isActive = item.key === activeId;
                      return (
                        <li
                          key={item.key}
                          id={`cmdk-${item.key}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() =>
                            setActive(navItems.findIndex((x) => x.key === item.key))
                          }
                          onMouseDown={(e) => {
                            e.preventDefault();
                            go(item);
                          }}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                            isActive ? "bg-surface-2 text-text" : "text-text-2"
                          }`}
                        >
                          {item.cover && (
                            <RowThumb cover={item.cover} label={item.label} />
                          )}
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.sub && (
                            <span className="truncate text-xs text-text-3">
                              {item.sub}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}

              {seeAll && (
                <li
                  id={`cmdk-${seeAll.key}`}
                  role="option"
                  aria-selected={seeAll.key === activeId}
                  onMouseEnter={() =>
                    setActive(navItems.findIndex((x) => x.key === seeAll.key))
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(seeAll);
                  }}
                  className={`mt-1 flex cursor-pointer items-center gap-2 rounded-md border-t border-border px-3 py-2.5 text-sm ${
                    seeAll.key === activeId ? "bg-surface-2 text-text" : "text-text-2"
                  }`}
                >
                  <span className="flex-1 truncate">{seeAll.label}</span>
                  <span aria-hidden className="shrink-0 text-xs text-text-3">
                    ↵
                  </span>
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

function groupBy(items: FlatItem[]): { group: string; items: FlatItem[] }[] {
  const order: string[] = [];
  const map = new Map<string, FlatItem[]>();
  for (const it of items) {
    if (!map.has(it.group)) {
      map.set(it.group, []);
      order.push(it.group);
    }
    map.get(it.group)!.push(it);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}

/** Custom DOM event that opens the palette — the single entry point shared by the
 *  ⌘K shortcut and the header search button. */
const OPEN_EVENT = "agentstreet:open-search";

/**
 * Open the ⌘K palette from anywhere (e.g. the header search button). SSR-safe.
 * The optional `query` pre-fills the input so a click can carry typed intent.
 */
export function openCommandPalette(query?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { query: query ?? "" } }));
}

/**
 * useCommandK — opens the palette on ⌘K / Ctrl-K and on the shared open event
 * (so the header search button and the keyboard shortcut drive one palette).
 * SSR-safe: listeners are installed in effect (client). The parent holds `open`.
 */
export function useCommandK(onOpen: (query?: string) => void) {
  const ref = useRef(onOpen);
  ref.current = onOpen;
  useEffect(() => {
    function key(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        ref.current();
      }
    }
    function open(e: Event) {
      ref.current((e as CustomEvent).detail?.query);
    }
    window.addEventListener("keydown", key);
    window.addEventListener(OPEN_EVENT, open as EventListener);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener(OPEN_EVENT, open as EventListener);
    };
  }, []);
}

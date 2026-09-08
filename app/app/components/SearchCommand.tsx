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
import type { KeyboardEvent } from "react";

interface FlatItem {
  key: string;
  label: string;
  sub?: string;
  to: string;
  group: string;
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
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
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
    });
  }
  return out;
}

export function SearchCommand({
  open,
  onClose,
  results,
  query,
  onQueryChange,
}: SearchCommandProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const items = useMemo(() => flatten(results), [results]);

  // Focus on open + reset the active index.
  useEffect(() => {
    if (!open) return;
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Keep the active index within range when the results change.
  useEffect(() => {
    setActive((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)));
  }, [items.length]);

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
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      return;
    }
    if (e.key === "Enter") {
      const item = items[active];
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

  const activeId = items[active]?.key;

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
        className="glass-frost w-full max-w-xl overflow-hidden rounded-lg"
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span aria-hidden className="text-text-3">
            ⌕
          </span>
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

        {/* Results */}
        <ul
          id="cmdk-list"
          role="listbox"
          aria-label="Results"
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-text-3">
              Type to search agents, subcategories and skills.
            </li>
          ) : (
            groups.map((g) => (
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
                          setActive(items.findIndex((x) => x.key === item.key))
                        }
                        onMouseDown={(e) => {
                          e.preventDefault();
                          go(item);
                        }}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm ${
                          isActive ? "bg-surface-2 text-text" : "text-text-2"
                        }`}
                      >
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
            ))
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

/**
 * useCommandK — registers the ⌘K / Ctrl-K shortcut and calls `onOpen`. SSR-safe: the
 * listener is installed in effect (client). The parent holds the `open` state.
 */
export function useCommandK(onOpen: () => void) {
  const ref = useRef(onOpen);
  ref.current = onOpen;
  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        ref.current();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

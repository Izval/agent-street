/**
 * CommandPalette — mounts the ⌘K search (components/SearchCommand.tsx) and owns
 * its state: open/close, the query, and the debounced fetch to /search.json.
 *
 * Self-contained so AppShell only has to render <CommandPalette /> once. Client
 * behavior lives in effects (SSR-safe); the palette renders nothing while closed,
 * so there is no hydration mismatch. Stale responses are ignored via a request id.
 */

import { useEffect, useRef, useState } from "react";
import {
  SearchCommand,
  useCommandK,
  type SearchCommandResults,
} from "./SearchCommand";

const EMPTY: SearchCommandResults = { agents: [], subcategories: [], skills: [] };
const DEBOUNCE_MS = 160;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchCommandResults>(EMPTY);
  const reqId = useRef(0);

  useCommandK(() => setOpen(true));

  // Debounced fetch on query change while open. A monotonic request id guards
  // against out-of-order responses (a slow early query resolving after a later one).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults(EMPTY);
      return;
    }
    const id = ++reqId.current;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/search.json?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchCommandResults;
        if (id === reqId.current) setResults(data);
      } catch {
        /* aborted or network error — keep the last results */
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  // Reset the query when the palette closes so it opens fresh next time.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <SearchCommand
      open={open}
      onClose={() => setOpen(false)}
      results={results}
      query={query}
      onQueryChange={setQuery}
    />
  );
}

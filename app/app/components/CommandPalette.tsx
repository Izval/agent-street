/**
 * CommandPalette — mounts the ⌘K search (components/SearchCommand.tsx) and owns
 * its state: open/close, the query, and the results.
 *
 * All search is CLIENT-SIDE and instant: the full agent index (≤~1500) is
 * prefetched ONCE per session (lib/agentsIndex.ts), and subcategories/skills are
 * bundled modules — so each keystroke filters in memory with the typo-tolerant
 * `rankByQuery` (lib/fuzzy.ts), with zero network. Covers render from the
 * deterministic `coverStyle` seed (+ the optional remote imageUrl).
 *
 * Self-contained so AppShell only renders <CommandPalette /> once. Client behavior
 * lives in effects (SSR-safe); the palette renders nothing while closed.
 */

import { useEffect, useMemo, useState } from "react";
import {
  SearchCommand,
  useCommandK,
  type SearchCommandResults,
} from "./SearchCommand";
import { agentHref, type IndexAgent } from "../lib/agents";
import { rankByQuery } from "../lib/fuzzy";
import { SUBCATEGORY_DEFS, CATEGORIES } from "../lib/taxonomy";
import { SKILLS } from "../lib/skills";
import { accentForCategory, accentForSubcategory } from "../lib/cover";
import { loadAgentIndex, peekAgentIndex } from "../lib/agentsIndex";

const EMPTY: SearchCommandResults = { agents: [], subcategories: [], skills: [] };
const LIMIT = 6;
const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

function compute(query: string, index: IndexAgent[]): SearchCommandResults {
  const q = query.trim();
  if (!q) return EMPTY;

  const agents = rankByQuery(
    q,
    index,
    (a) => [
      { text: a.name, weight: 1 },
      { text: a.subcategoryLabel ?? "", weight: 0.5 },
    ],
    LIMIT,
  ).map((a) => ({
    id: a.id,
    name: a.name,
    subcategoryLabel: a.subcategoryLabel,
    to: agentHref({ id: a.id, name: a.name, chainId: a.chainId }),
    cover: {
      seed: a.id || a.name,
      accent: accentForSubcategory(a.subcategory),
      imageUrl: a.imageUrl,
    },
  }));

  const subcategories = rankByQuery(
    q,
    SUBCATEGORY_DEFS,
    (c) => [
      { text: c.label, weight: 1 },
      { text: CATEGORY_LABEL.get(c.category) ?? c.category, weight: 0.5 },
      { text: c.id, weight: 0.4 },
    ],
    LIMIT,
  ).map((c) => ({
    id: c.id,
    label: c.label,
    category: c.category,
    to: `/subcategory/${c.id}`,
    cover: { seed: c.id, accent: accentForCategory(c.category) },
  }));

  const skills = rankByQuery(
    q,
    SKILLS,
    (s) => [
      { text: s.name, weight: 1 },
      { text: s.protocol, weight: 0.7 },
      { text: s.description, weight: 0.3 },
    ],
    LIMIT,
  ).map((s) => ({
    id: s.id,
    name: s.name,
    tags: [s.protocol],
    to: `/skill/${s.id}`,
    cover: { seed: s.id, accent: accentForSubcategory(s.subcategory) },
  }));

  return { agents, subcategories, skills };
}

const TESTNET_PREF_KEY = "agentstreet:search:include-testnet";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<IndexAgent[]>(() => peekAgentIndex() ?? []);
  const [includeTestnet, setIncludeTestnet] = useState(true);

  useCommandK((initial) => {
    if (initial) setQuery(initial);
    setOpen(true);
  });

  // Warm the index eagerly on mount so the first keystroke is already instant.
  useEffect(() => {
    let alive = true;
    loadAgentIndex().then((d) => {
      if (alive) setIndex(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Restore the testnet preference (client-only; falls back to the default).
  useEffect(() => {
    try {
      const v = localStorage.getItem(TESTNET_PREF_KEY);
      if (v === "0") setIncludeTestnet(false);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  function toggleTestnet(next: boolean) {
    setIncludeTestnet(next);
    try {
      localStorage.setItem(TESTNET_PREF_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }

  // Filter by network first (cheap), then rank. Both synchronous, no network.
  const results = useMemo(() => {
    const pool = includeTestnet
      ? index
      : index.filter((a) => a.network !== "testnet");
    return compute(query, pool);
  }, [query, index, includeTestnet]);

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
      includeTestnet={includeTestnet}
      onToggleTestnet={toggleTestnet}
    />
  );
}

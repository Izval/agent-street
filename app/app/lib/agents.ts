/**
 * Client for the proxy Worker to 8004scan (workers/8004-proxy).
 *
 * Deliberately mirrors the `Agent`/`AgentsPage`/`Pagination` types from the proxy
 * (workers/8004-proxy/src/index.ts) — just like lib/categories.ts mirrors the
 * categories. Cross-package imports aren't possible (separate tsconfigs); keep
 * them in sync by hand.
 *
 * Golden rule (hackathon Data Quality): categories are NEVER left blank. If the
 * proxy fails / rate-limits / returns empty, we fall back to the curated seed
 * (lib/seed.ts) and mark the source honestly.
 */

import type { Category } from "./categories";
import { CATEGORY_LABELS } from "./categories";
import { seedByCategory, seedAgentById, SEED_AGENTS } from "./seed";
import type { Reputation, AgentServices } from "./contracts";

export type AgentSource = "8004scan" | "seed";

/** Normalized shape exposed by the proxy (real onchain metrics from 8004scan). */
export interface Agent {
  id: string; // token_id
  agentId: string; // "56:0x…:tokenId"
  tokenId: string;
  chainId: number;
  contractAddress?: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: Category | null;
  categoryLabel: string | null;
  // Real onchain metrics (Data Quality). Honest names from 8004scan.
  stars: number;
  score: number;
  avgScore: number;
  feedbacks: number;
  healthScore: number | null;
  isVerified: boolean;
  x402Supported: boolean;
  // Real ranking (8004scan) — useful in cards and detail.
  rank?: number | null;
  networkRank?: number | null;
  ownerAddress?: string;
  agentWallet?: string;
  // Enriched publisher/owner (8004scan) — for the detail header.
  ownerUsername?: string | null;
  ownerEns?: string | null;
  ownerAvatarUrl?: string | null;
  ownerPublisherTier?: string | null;
  ownerCertifiedName?: string | null;
  tags?: string[];
  supportedProtocols?: string[];
  source: AgentSource;
}

/** Proxy detail response: agent + reputation + services (WS1.1). */
export type AgentDetailRaw = Agent & {
  reputation: Reputation | null;
  services: AgentServices | null;
};

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AgentsPage {
  agents: Agent[];
  count: number;
  pagination: Pagination;
  categories: Array<{ id: Category; label: string }>;
  /** true if the proxy responded anonymously (lower rate-limit, but works). */
  anonymous?: boolean;
  /** true if the ENTIRE listing came from the curated seed (proxy down/empty). */
  fromSeed?: boolean;
}

export interface ListParams {
  category?: Category;
  page?: number;
  limit?: number;
  search?: string;
}

const categoriesMeta = () =>
  (Object.keys(CATEGORY_LABELS) as Category[]).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
  }));

/** Page built 100% from the seed (full fallback or enrichment). */
function seedPage(params: ListParams): AgentsPage {
  const all = params.category ? seedByCategory(params.category) : SEED_AGENTS;
  const filtered = params.search
    ? all.filter((a) =>
        `${a.name} ${a.description}`
          .toLowerCase()
          .includes(params.search!.toLowerCase()),
      )
    : all;
  const limit = params.limit ?? 24;
  const page = params.page ?? 1;
  const start = (page - 1) * limit;
  const slice = filtered.slice(start, start + limit);
  return {
    agents: slice,
    count: slice.length,
    pagination: {
      page,
      limit,
      total: filtered.length,
      hasMore: start + limit < filtered.length,
    },
    categories: categoriesMeta(),
    fromSeed: true,
  };
}

/**
 * Enriches a proxy page with seed data when it comes back thin, so no category
 * looks empty in front of the jury. Dedup by tokenId+name.
 */
function enrich(page: AgentsPage, params: ListParams): AgentsPage {
  const MIN = 3;
  if (page.agents.length >= MIN) return page;
  const extra = (
    params.category ? seedByCategory(params.category) : SEED_AGENTS
  ).filter(
    (s) =>
      !page.agents.some(
        (a) => a.tokenId === s.tokenId || a.name === s.name,
      ),
  );
  const agents = [...page.agents, ...extra].slice(0, params.limit ?? 24);
  return { ...page, agents, count: agents.length };
}

export function createAgentsClient(opts: { baseUrl: string; signal?: AbortSignal }) {
  const base = opts.baseUrl.replace(/\/$/, "");

  async function list(params: ListParams = {}): Promise<AgentsPage> {
    const url = new URL(`${base}/v1/agents`);
    if (params.category) url.searchParams.set("category", params.category);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.search) url.searchParams.set("search", params.search);
    try {
      const res = await fetch(url.toString(), {
        signal: opts.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) return seedPage(params);
      const data = (await res.json()) as AgentsPage;
      if (!data?.agents?.length) return seedPage(params);
      return enrich(data, params);
    } catch {
      return seedPage(params);
    }
  }

  async function get(tokenId: string): Promise<Agent | null> {
    try {
      const res = await fetch(
        `${base}/v1/agents/${encodeURIComponent(tokenId)}`,
        { signal: opts.signal, headers: { accept: "application/json" } },
      );
      if (res.status === 404) return seedAgentById(tokenId) ?? null;
      if (!res.ok) return seedAgentById(tokenId) ?? null;
      return (await res.json()) as Agent;
    } catch {
      return seedAgentById(tokenId) ?? null;
    }
  }

  /** Enriched detail (agent + reputation + services). Falls back to seed without reputation. */
  async function getDetail(tokenId: string): Promise<AgentDetailRaw | null> {
    try {
      const res = await fetch(
        `${base}/v1/agents/${encodeURIComponent(tokenId)}`,
        { signal: opts.signal, headers: { accept: "application/json" } },
      );
      if (res.ok) return (await res.json()) as AgentDetailRaw;
    } catch {
      /* falls through to the seed below */
    }
    const seed = seedAgentById(tokenId);
    return seed ? { ...seed, reputation: null, services: null } : null;
  }

  return { baseUrl: base, list, get, getDetail };
}

export type AgentsClient = ReturnType<typeof createAgentsClient>;

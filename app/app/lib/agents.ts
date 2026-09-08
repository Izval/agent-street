/**
 * Client for the proxy Worker to 8004scan (workers/8004-proxy).
 *
 * Deliberately mirrors the `Agent`/`AgentsPage`/`Pagination` types from the proxy
 * (workers/8004-proxy/src/index.ts) — just like lib/subcategories.ts mirrors the
 * subcategories. Cross-package imports aren't possible (separate tsconfigs); keep
 * them in sync by hand.
 *
 * Real data only: everything shown comes straight from 8004scan via the proxy.
 * There is no mock/seed fallback — if the proxy fails or returns nothing, the UI
 * shows an honest empty state rather than placeholder agents.
 */

import type { Subcategory } from "./subcategories";
import { SUBCATEGORY_LABELS } from "./subcategories";
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
  subcategory: Subcategory | null;
  subcategoryLabel: string | null;
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

/**
 * Compact agent shape served by the proxy's GET /v1/index. The whole corpus
 * (≤~1500) in one payload, display/search fields only — the ⌘K palette downloads
 * it once and filters client-side (see lib/agentsIndex.ts). Mirrors the worker's
 * `IndexAgent` in workers/8004-proxy/src/index.ts.
 */
export interface IndexAgent {
  id: string;
  name: string;
  subcategory: Subcategory | null;
  subcategoryLabel: string | null;
  imageUrl?: string;
  score: number;
  network: "testnet" | "mainnet";
  chainId: number;
  agentId: string;
}

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
  subcategories: Array<{ id: Subcategory; label: string }>;
  /** true if the proxy responded anonymously (lower rate-limit, but works). */
  anonymous?: boolean;
}

export interface ListParams {
  subcategory?: Subcategory;
  page?: number;
  limit?: number;
  search?: string;
  /** BSC chain to query: 56 (mainnet, default) or 97 (testnet). */
  chain?: number;
}

/** Only 56 (mainnet) and 97 (testnet) are supported; anything else → default 56. */
function normalizeChain(chain?: number): 56 | 97 | undefined {
  return chain === 97 || chain === 56 ? chain : undefined;
}

/** "Topaz Agent (v3)!" → "topaz-agent-v3". URL-safe, collapsed, trimmed. */
export function kebab(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Reduce an agent slug to its bare token id. The id is the last numeric group
 * (`topaz-agent-113284` → `113284`); a bare id passes through unchanged. When
 * there are no trailing digits (malformed slug) the input is returned as-is so
 * the loader resolves it to a 404 honestly.
 */
export function slugToId(slug: string): string {
  return slug.match(/(\d+)$/)?.[1] ?? slug;
}

/**
 * Internal href to an agent's detail page. Builds a readable `name-id` slug
 * (`/agent/topaz-agent-113284`) so URLs are human-friendly; the id still lives
 * at the tail so the loader can resolve it. Carries `?chain=97` for testnet
 * agents. When no name is available it degrades to `/agent/${id}` (still valid).
 */
export function agentHref(agent: {
  id: string;
  name?: string | null;
  chainId?: number;
}): string {
  const q = agent.chainId === 97 ? "?chain=97" : "";
  const slugName = agent.name ? kebab(agent.name) : "";
  const slug = slugName ? `${slugName}-${agent.id}` : agent.id;
  return `/agent/${encodeURIComponent(slug)}${q}`;
}

/** Internal href to the hire page, threading `&chain=97` for testnet agents. */
export function hireHref(id: string, chainId?: number): string {
  const q = chainId === 97 ? "&chain=97" : "";
  return `/hire?agent=${encodeURIComponent(id)}${q}`;
}

const subcategoriesMeta = () =>
  (Object.keys(SUBCATEGORY_LABELS) as Subcategory[]).map((id) => ({
    id,
    label: SUBCATEGORY_LABELS[id],
  }));

/** Honest empty page (proxy unreachable / returned nothing). No placeholders. */
function emptyPage(params: ListParams): AgentsPage {
  return {
    agents: [],
    count: 0,
    pagination: {
      page: params.page ?? 1,
      limit: params.limit ?? 24,
      total: 0,
      hasMore: false,
    },
    subcategories: subcategoriesMeta(),
  };
}

export function createAgentsClient(opts: {
  baseUrl: string;
  signal?: AbortSignal;
  /** Service binding to the 8004-proxy worker. Same-account worker-to-worker calls
   * over *.workers.dev loop back and 404, so in production we route through this
   * binding; absent in local dev, where the plain fetch on baseUrl works. */
  fetcher?: Fetcher;
}) {
  const base = opts.baseUrl.replace(/\/$/, "");

  /**
   * Fetch the proxy, resilient to environment:
   *  - Production: the service binding is the only path that works (a direct fetch
   *    to *.workers.dev loops back to THIS worker and 404s), so we use it first.
   *  - Local dev (`react-router dev`): the binding to the deployed proxy can't be
   *    reached, so we fall back to a plain external fetch on the URL (which works).
   * Falling back on a thrown error OR a non-ok response covers both cases without
   * changing production behaviour (there, the binding returns ok and we never fall
   * back; a real upstream error just 404s on the loopback and the caller handles it).
   */
  async function doFetch(url: string): Promise<Response> {
    const init: RequestInit = {
      signal: opts.signal,
      headers: { accept: "application/json" },
    };
    if (opts.fetcher) {
      try {
        const res = await opts.fetcher.fetch(url, init);
        if (res.ok) return res;
      } catch {
        /* binding unusable (e.g. dev) → direct fetch below */
      }
    }
    return fetch(url, init);
  }

  async function list(params: ListParams = {}): Promise<AgentsPage> {
    const url = new URL(`${base}/v1/agents`);
    if (params.subcategory) url.searchParams.set("subcategory", params.subcategory);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.search) url.searchParams.set("search", params.search);
    const chain = normalizeChain(params.chain);
    if (chain) url.searchParams.set("chain", String(chain));
    try {
      const res = await doFetch(url.toString());
      if (!res.ok) return emptyPage(params);
      return (await res.json()) as AgentsPage;
    } catch {
      return emptyPage(params);
    }
  }

  /** Build the /v1/agents/:id URL, threading ?chain when a valid one is given. */
  function detailUrl(tokenId: string, chain?: number): string {
    const url = new URL(`${base}/v1/agents/${encodeURIComponent(tokenId)}`);
    const c = normalizeChain(chain);
    if (c) url.searchParams.set("chain", String(c));
    return url.toString();
  }

  async function get(tokenId: string, chain?: number): Promise<Agent | null> {
    try {
      const res = await doFetch(detailUrl(tokenId, chain));
      if (!res.ok) return null;
      return (await res.json()) as Agent;
    } catch {
      return null;
    }
  }

  /** Enriched detail (agent + reputation + services). null if the proxy has none. */
  async function getDetail(
    tokenId: string,
    chain?: number,
  ): Promise<AgentDetailRaw | null> {
    try {
      const res = await doFetch(detailUrl(tokenId, chain));
      if (res.ok) return (await res.json()) as AgentDetailRaw;
    } catch {
      /* fall through to null */
    }
    return null;
  }

  /** The full compact agent index (corpus ∪ submitted) in one payload. [] on failure. */
  async function index(): Promise<IndexAgent[]> {
    try {
      const res = await doFetch(`${base}/v1/index`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? (data as IndexAgent[]) : [];
    } catch {
      return [];
    }
  }

  return { baseUrl: base, list, get, getDetail, index };
}

export type AgentsClient = ReturnType<typeof createAgentsClient>;

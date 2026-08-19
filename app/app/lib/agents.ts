/**
 * Cliente del Worker proxy a 8004scan (workers/8004-proxy).
 *
 * Espeja deliberadamente los tipos `Agent`/`AgentsPage`/`Pagination` del proxy
 * (workers/8004-proxy/src/index.ts) — igual que lib/categories.ts espeja las
 * categorías. No se puede importar cross-package (tsconfig separados); mantener
 * en sync a mano.
 *
 * Regla de oro (Data Quality del hackathon): las categorías NUNCA quedan en
 * blanco. Si el proxy falla / rate-limita / devuelve vacío, caemos al seed
 * curado (lib/seed.ts) y marcamos la fuente honestamente.
 */

import type { Category } from "./categories";
import { CATEGORY_LABELS } from "./categories";
import { seedByCategory, seedAgentById, SEED_AGENTS } from "./seed";
import type { Reputation, AgentServices } from "./contracts";

export type AgentSource = "8004scan" | "seed";

/** Forma normalizada que expone el proxy (métricas onchain reales de 8004scan). */
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
  // Métricas onchain reales (Data Quality). Nombres honestos de 8004scan.
  stars: number;
  score: number;
  avgScore: number;
  feedbacks: number;
  healthScore: number | null;
  isVerified: boolean;
  x402Supported: boolean;
  // Ranking real (8004scan) — útil en cards y detalle.
  rank?: number | null;
  networkRank?: number | null;
  ownerAddress?: string;
  agentWallet?: string;
  // Publisher/owner enriquecido (8004scan) — para el header del detalle.
  ownerUsername?: string | null;
  ownerEns?: string | null;
  ownerAvatarUrl?: string | null;
  ownerPublisherTier?: string | null;
  ownerCertifiedName?: string | null;
  tags?: string[];
  supportedProtocols?: string[];
  source: AgentSource;
}

/** Respuesta del detalle del proxy: agente + reputación + services (WS1.1). */
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
  /** true si el proxy respondió anónimo (rate-limit más bajo, pero funciona). */
  anonymous?: boolean;
  /** true si TODO el listado vino del seed curado (proxy caído/vacío). */
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

/** Página armada 100% desde el seed (fallback total o enriquecimiento). */
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
 * Enriquece una página del proxy con seed cuando viene flaca, para que ninguna
 * categoría se vea vacía frente al jurado. Dedup por tokenId+name.
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

  /** Detalle enriquecido (agent + reputation + services). Fallback a seed sin reputación. */
  async function getDetail(tokenId: string): Promise<AgentDetailRaw | null> {
    try {
      const res = await fetch(
        `${base}/v1/agents/${encodeURIComponent(tokenId)}`,
        { signal: opts.signal, headers: { accept: "application/json" } },
      );
      if (res.ok) return (await res.json()) as AgentDetailRaw;
    } catch {
      /* cae al seed abajo */
    }
    const seed = seedAgentById(tokenId);
    return seed ? { ...seed, reputation: null, services: null } : null;
  }

  return { baseUrl: base, list, get, getDetail };
}

export type AgentsClient = ReturnType<typeof createAgentsClient>;

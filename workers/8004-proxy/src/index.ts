// index.ts — Worker proxy + cache a la 8004scan Public API (agent-street).
//
// Rol (plan.md §4.5, roadmap §5.2): fuente de datos del marketplace. Consulta
// 8004scan (reputación/scores onchain reales → "Data Quality"), cachea en KV
// para esquivar CORS y rate-limit, y clasifica cada agente en las 4 categorías.
// Patrón reutilizado del Worker IVL (third_city/worker): CORS + KV + rate-limit.
//
// API 8004scan verificada EN VIVO (17-ago-2026): funciona ANÓNIMA (~10 req/min);
// la API key Pro solo sube el límite. Base: https://8004scan.io/api/v1/public
//   GET /agents?chainId=56&page=&limit=&search=&sortBy=&sortOrder=
//   GET /agents/{chainId}/{tokenId}
//   Envelope: { success, data, meta:{ pagination:{ page, limit, total, hasMore } } }
//   Auth opcional: header `X-API-Key`.  Total agentes BSC: ~257k.
//
// Endpoints propios (forma estable, desacoplada de 8004scan):
//   GET /health
//   GET /v1/agents?category=rebalancing|grid|yield|health&page=&limit=&search=
//   GET /v1/agents/:tokenId

import {
  classifyAgent,
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_SEARCH,
  type Category,
} from "./classify";

export interface Env {
  AGENTS_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  // Base de la 8004scan Public API.
  SCAN_8004_BASE: string;
  // Secret opcional: `wrangler secret put SCAN_8004_API_KEY`. Sube el rate-limit.
  SCAN_8004_API_KEY?: string;
}

const CHAIN_ID = 56; // BSC mainnet (donde viven los agentes ERC-8004 indexados).

// --- Forma normalizada que consume el marketplace (métricas reales de 8004scan) ---
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
  stars: number; // star_count
  score: number; // total_score
  avgScore: number; // average_score
  feedbacks: number; // total_feedbacks
  healthScore: number | null;
  isVerified: boolean;
  x402Supported: boolean; // relevante para el hire flow
  ownerAddress?: string;
  agentWallet?: string;
  tags?: string[];
  supportedProtocols?: string[];
  source: "8004scan";
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
  categories: Array<{ id: Category; label: string }>;
  /** true si respondimos sin API key (rate-limit anónimo más bajo, pero funciona). */
  anonymous?: boolean;
}

// --- Cache & rate-limit (patrón del Worker IVL) ---
const LIST_CACHE_SEC = 120; // KV TTL para páginas de listado
const AGENT_CACHE_SEC = 300;
const RL_LIMIT = 120;
const RL_WINDOW_SEC = 60;

async function underRateLimit(request: Request): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") || "anon";
  const origin = new URL(request.url).origin;
  const window = Math.floor(Date.now() / 1000 / RL_WINDOW_SEC);
  const key = new Request(`${origin}/__rl/${encodeURIComponent(ip)}/${window}`);
  const cache = caches.default;
  let count = 0;
  const hit = await cache.match(key);
  if (hit) count = parseInt(await hit.text(), 10) || 0;
  count++;
  if (count > RL_LIMIT) return false;
  await cache.put(
    key,
    new Response(String(count), {
      headers: { "Cache-Control": `max-age=${RL_WINDOW_SEC}` },
    }),
  );
  return true;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data: unknown, env: Env, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(env),
  };
  if (cacheSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

const categoriesMeta = () =>
  CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] }));

// ------------------------------------------------------------------ //
// Capa 8004scan — endpoints/campos verificados en vivo.
// ------------------------------------------------------------------ //

function upstreamHeaders(env: Env): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json" };
  if (env.SCAN_8004_API_KEY) h["X-API-Key"] = env.SCAN_8004_API_KEY;
  return h;
}

const num = (v: unknown, dflt = 0) =>
  typeof v === "number" ? v : v == null ? dflt : Number(v) || dflt;

/** Convierte un registro crudo de 8004scan a nuestra forma normalizada. */
function normalize(raw: Record<string, unknown>): Agent {
  const name = String(raw.name ?? "Unknown");
  const description = String(raw.description ?? "");
  const tags = Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : undefined;
  const categories = Array.isArray(raw.categories)
    ? (raw.categories as unknown[]).map(String)
    : undefined;
  const supportedProtocols = Array.isArray(raw.supported_protocols)
    ? (raw.supported_protocols as unknown[]).map(String)
    : undefined;
  const category = classifyAgent({ name, description, tags, categories });
  return {
    id: String(raw.token_id ?? raw.id ?? name),
    agentId: String(raw.agent_id ?? ""),
    tokenId: String(raw.token_id ?? ""),
    chainId: num(raw.chain_id, CHAIN_ID),
    contractAddress: raw.contract_address ? String(raw.contract_address) : undefined,
    name,
    description,
    imageUrl: raw.image_url ? String(raw.image_url) : undefined,
    category,
    categoryLabel: category ? CATEGORY_LABELS[category] : null,
    stars: num(raw.star_count),
    score: num(raw.total_score),
    avgScore: num(raw.average_score),
    feedbacks: num(raw.total_feedbacks),
    healthScore: raw.health_score == null ? null : num(raw.health_score),
    isVerified: Boolean(raw.is_verified),
    x402Supported: Boolean(raw.x402_supported),
    ownerAddress: raw.owner_address ? String(raw.owner_address) : undefined,
    agentWallet: raw.agent_wallet ? String(raw.agent_wallet) : undefined,
    tags,
    supportedProtocols,
    source: "8004scan",
  };
}

async function fetch8004List(
  env: Env,
  params: { page: number; limit: number; search?: string },
): Promise<{ rows: Record<string, unknown>[]; pagination: Pagination }> {
  const url = new URL(`${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents`);
  url.searchParams.set("chainId", String(CHAIN_ID));
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("sortBy", "total_score");
  url.searchParams.set("sortOrder", "desc");
  if (params.search) url.searchParams.set("search", params.search);

  const res = await fetch(url.toString(), { headers: upstreamHeaders(env) });
  if (!res.ok) throw new Error(`8004scan ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  const rows = (Array.isArray(body.data) ? body.data : []) as Record<
    string,
    unknown
  >[];
  const p = (body.meta as Record<string, unknown> | undefined)?.pagination as
    | Record<string, unknown>
    | undefined;
  const pagination: Pagination = {
    page: num(p?.page, params.page),
    limit: num(p?.limit, params.limit),
    total: num(p?.total, rows.length),
    hasMore: Boolean(p?.hasMore),
  };
  return { rows, pagination };
}

async function listAgents(
  env: Env,
  params: { category?: Category; page: number; limit: number; search?: string },
): Promise<AgentsPage> {
  const search = params.search ?? (params.category ? CATEGORY_SEARCH[params.category] : undefined);
  const cacheKey = `agents:v2:${params.category ?? "all"}:${search ?? ""}:${params.page}:${params.limit}`;
  const cached = await env.AGENTS_KV.get(cacheKey, "json");
  if (cached) return cached as AgentsPage;

  const { rows, pagination } = await fetch8004List(env, {
    page: params.page,
    limit: params.limit,
    search,
  });
  let agents = rows.map(normalize);
  // Si pidieron categoría, además asignamos el label por clasificación (el search
  // acota; classifyAgent etiqueta). No filtramos duro para no vaciar la página.
  if (params.category) {
    agents = agents.map((a) => ({
      ...a,
      category: a.category ?? params.category!,
      categoryLabel: a.categoryLabel ?? CATEGORY_LABELS[params.category!],
    }));
  }
  const page: AgentsPage = {
    agents,
    count: agents.length,
    pagination,
    categories: categoriesMeta(),
    anonymous: !env.SCAN_8004_API_KEY,
  };
  await env.AGENTS_KV.put(cacheKey, JSON.stringify(page), {
    expirationTtl: LIST_CACHE_SEC,
  });
  return page;
}

async function getAgent(env: Env, tokenId: string): Promise<Agent | null> {
  const cacheKey = `agent:v2:${CHAIN_ID}:${tokenId}`;
  const cached = await env.AGENTS_KV.get(cacheKey, "json");
  if (cached) return cached as Agent;

  const url = `${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents/${CHAIN_ID}/${encodeURIComponent(tokenId)}`;
  const res = await fetch(url, { headers: upstreamHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`8004scan ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  const agent = normalize(data);
  await env.AGENTS_KV.put(cacheKey, JSON.stringify(agent), {
    expirationTtl: AGENT_CACHE_SEC,
  });
  return agent;
}

// ------------------------------------------------------------------ //
// Router
// ------------------------------------------------------------------ //

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, env, 405);
    }
    if (!(await underRateLimit(request))) {
      return json({ error: "rate_limited" }, env, 429);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/health" || path === "/") {
        return json(
          { ok: true, service: "8004-proxy", categories: categoriesMeta() },
          env,
          200,
          30,
        );
      }

      if (path === "/v1/agents") {
        const cat = url.searchParams.get("category") as Category | null;
        const category =
          cat && (CATEGORIES as readonly string[]).includes(cat)
            ? (cat as Category)
            : undefined;
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit")) || 24),
        );
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const search = url.searchParams.get("search") || undefined;
        const result = await listAgents(env, { category, page, limit, search });
        return json(result, env, 200, LIST_CACHE_SEC);
      }

      const m = path.match(/^\/v1\/agents\/(.+)$/);
      if (m) {
        const agent = await getAgent(env, decodeURIComponent(m[1]));
        if (!agent) return json({ error: "not_found" }, env, 404);
        return json(agent, env, 200, AGENT_CACHE_SEC);
      }

      return json({ error: "not_found" }, env, 404);
    } catch (err) {
      return json(
        { error: "upstream_error", detail: String((err as Error).message) },
        env,
        502,
      );
    }
  },
} satisfies ExportedHandler<Env>;

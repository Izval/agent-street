// index.ts — Worker proxy + cache a la 8004scan Developer API (agent-street).
//
// Rol (plan.md §4.5, roadmap §5.2): fuente de datos del marketplace. Consulta
// 8004scan (reputación/performance onchain reales → "Data Quality"), cachea en KV
// para esquivar CORS y rate-limit, y clasifica cada agente en las 4 categorías.
// Patrón reutilizado del Worker IVL (third_city/worker): CORS + KV + rate-limit
// por Cache API.
//
// Endpoints:
//   GET /health
//   GET /v1/agents?category=rebalancing|grid|yield|health&limit=&cursor=
//   GET /v1/agents/:id
//
// ⚠ La forma exacta de la respuesta de 8004scan se finaliza cuando tengamos la
// API key Pro (Fase 0). Hasta entonces, `fetch8004*` está aislado y el Worker
// degrada limpio (200 con lista vacía + nota) si SCAN_8004_API_KEY no está.

import {
  classifyAgent,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
} from "./classify";

export interface Env {
  AGENTS_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  // Base de la 8004scan Developer API. Ajustar al endpoint real.
  SCAN_8004_BASE: string;
  // Secret: `wrangler secret put SCAN_8004_API_KEY`. Si falta, el Worker degrada.
  SCAN_8004_API_KEY?: string;
}

// --- Forma normalizada que consume el marketplace (estable, desacoplada de 8004scan) ---
export interface Agent {
  id: string;
  name: string;
  description: string;
  category: Category | null;
  categoryLabel: string | null;
  // Métricas onchain reales (Data Quality). Opcionales: 8004scan puede no traer todas.
  reputation?: number;
  txCount?: number;
  pnlPct?: number;
  winRatePct?: number;
  address?: string;
  chain?: string;
  skills?: string[];
  source: "8004scan";
}

export interface AgentsPage {
  agents: Agent[];
  count: number;
  cursor?: string;
  categories: Array<{ id: Category; label: string }>;
  degraded?: boolean; // true si respondimos sin API key (skeleton)
}

// --- Cache & rate-limit (patrón del Worker IVL) ---
const LIST_CACHE_SEC = 120; // KV TTL para páginas de listado
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

function json(
  data: unknown,
  env: Env,
  status = 200,
  cacheSeconds = 0,
): Response {
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
// Capa 8004scan — AISLADA. Aquí va el mapeo real cuando tengamos la key.
// ------------------------------------------------------------------ //

/** Convierte un registro crudo de 8004scan a nuestra forma normalizada. */
function normalize(raw: Record<string, unknown>): Agent {
  const name = String(raw.name ?? raw.agentName ?? raw.id ?? "Unknown");
  const description = String(raw.description ?? raw.bio ?? "");
  const skills = Array.isArray(raw.skills)
    ? (raw.skills as unknown[]).map(String)
    : undefined;
  const tags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[]).map(String)
    : undefined;
  const category = classifyAgent({ name, description, skills, tags });
  const num = (v: unknown) =>
    typeof v === "number" ? v : v == null ? undefined : Number(v) || undefined;
  return {
    id: String(raw.id ?? raw.agentId ?? raw.address ?? name),
    name,
    description,
    category,
    categoryLabel: category ? CATEGORY_LABELS[category] : null,
    reputation: num(raw.reputation ?? raw.reputationScore),
    txCount: num(raw.txCount ?? raw.transactions),
    pnlPct: num(raw.pnlPct ?? raw.pnl),
    winRatePct: num(raw.winRatePct ?? raw.winRate),
    address: raw.address ? String(raw.address) : undefined,
    chain: raw.chain ? String(raw.chain) : "bsc",
    skills,
    source: "8004scan",
  };
}

/** Llama a 8004scan y devuelve registros crudos. TODO: endpoint/paginación reales. */
async function fetch8004Agents(
  env: Env,
  params: { limit: number; cursor?: string },
): Promise<{ rows: Record<string, unknown>[]; cursor?: string }> {
  const url = new URL(`${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents`);
  url.searchParams.set("chain", "bsc");
  url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      // TODO: confirmar esquema de auth (header vs query) con la doc de 8004scan.
      authorization: `Bearer ${env.SCAN_8004_API_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`8004scan ${res.status}`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const rows = (Array.isArray(body.data) ? body.data : body.agents ?? []) as Record<
    string,
    unknown
  >[];
  const cursor =
    typeof body.cursor === "string" ? body.cursor : undefined;
  return { rows, cursor };
}

async function listAgents(
  env: Env,
  params: { category?: Category; limit: number; cursor?: string },
): Promise<AgentsPage> {
  const meta = categoriesMeta();

  // Degradación limpia: sin API key devolvemos esqueleto vacío (no rompemos el front).
  if (!env.SCAN_8004_API_KEY) {
    return {
      agents: [],
      count: 0,
      categories: meta,
      degraded: true,
    };
  }

  const cacheKey = `agents:v1:${params.category ?? "all"}:${params.limit}:${
    params.cursor ?? "0"
  }`;
  const cached = await env.AGENTS_KV.get(cacheKey, "json");
  if (cached) return cached as AgentsPage;

  const { rows, cursor } = await fetch8004Agents(env, params);
  let agents = rows.map(normalize);
  if (params.category) {
    agents = agents.filter((a) => a.category === params.category);
  }
  const page: AgentsPage = {
    agents,
    count: agents.length,
    cursor,
    categories: meta,
  };
  await env.AGENTS_KV.put(cacheKey, JSON.stringify(page), {
    expirationTtl: LIST_CACHE_SEC,
  });
  return page;
}

async function getAgent(env: Env, id: string): Promise<Agent | null> {
  if (!env.SCAN_8004_API_KEY) return null;
  const cacheKey = `agent:v1:${id}`;
  const cached = await env.AGENTS_KV.get(cacheKey, "json");
  if (cached) return cached as Agent;

  const url = `${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.SCAN_8004_API_KEY}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`8004scan ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  const agent = normalize(raw.data ? (raw.data as Record<string, unknown>) : raw);
  await env.AGENTS_KV.put(cacheKey, JSON.stringify(agent), {
    expirationTtl: LIST_CACHE_SEC,
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
          Math.max(1, Number(url.searchParams.get("limit")) || 30),
        );
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const page = await listAgents(env, { category, limit, cursor });
        return json(page, env, 200, page.degraded ? 0 : LIST_CACHE_SEC);
      }

      const m = path.match(/^\/v1\/agents\/(.+)$/);
      if (m) {
        const agent = await getAgent(env, decodeURIComponent(m[1]));
        if (!agent) return json({ error: "not_found" }, env, 404);
        return json(agent, env, 200, LIST_CACHE_SEC);
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

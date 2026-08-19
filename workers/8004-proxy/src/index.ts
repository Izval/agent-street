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
  // Secret opcional: `wrangler secret put SUBMIT_TOKEN`. Si está seteado, protege el
  // POST /v1/submitted (el registrar/front debe mandar `x-submit-token`). Ausente ⇒ abierto.
  SUBMIT_TOKEN?: string;
}

const CHAIN_ID = 56; // BSC mainnet (donde viven los agentes ERC-8004 indexados).
const TESTNET_CHAIN_ID = 97; // BSC testnet (agentes creados en "Crea tu propio agente").

/** Red del badge a partir del chainId. */
const networkOf = (chainId: number): "testnet" | "mainnet" =>
  chainId === TESTNET_CHAIN_ID ? "testnet" : "mainnet";

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
  // Ranking global/de-red (raw rank / network_rank). Nullable: 8004scan no
  // siempre los expone (agentes sin evidencia suficiente).
  rank: number | null;
  networkRank: number | null;
  ownerAddress?: string;
  agentWallet?: string;
  // Metadatos del owner (raw owner_*). Nullable.
  ownerUsername: string | null;
  ownerEns: string | null;
  ownerAvatarUrl: string | null;
  ownerPublisherTier: string | null;
  ownerCertifiedName: string | null;
  tags?: string[];
  supportedProtocols?: string[];
  // "8004scan" = feed indexado (mainnet); "submitted" = creado en el marketplace
  // ("Crea tu propio agente"), vive en el registro KV propio (testnet por defecto).
  source: "8004scan" | "submitted";
  // Red del agente para el badge del marketplace. 8004scan = mainnet; creados = testnet.
  network: "testnet" | "mainnet";
  /** Estado del alta onchain de un agente creado: "registered" | "pending". */
  status?: "registered" | "pending";
  /** tx de registro/fondeo (agentes creados). */
  txHash?: string;
}

// --- Reputación (espeja `Reputation` de app/app/lib/contracts.ts) ---
export interface ReputationDimension {
  key: string; // "service" | "momentum" | "publisher" | ...
  score: number; // 0–100
  weight: number; // 0–1
}

export interface Reputation {
  totalScore: number;
  rank: number | null;
  networkRank: number | null;
  health: number | null;
  freshness: number | null;
  activity: number | null;
  popularity: number | null;
  metadataCompleteness: number | null;
  dimensions: ReputationDimension[];
  feedbacks: number;
  avgScore: number;
  source: "8004scan";
}

// --- Services & skills (espeja `AgentServices`/`AgentSkill` de contracts.ts) ---
export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface AgentServices {
  a2aEndpoint: string | null;
  mcpEndpoint: string | null;
  protocolVersion: string | null;
  skills: AgentSkill[];
  x402: boolean;
  erc8183: boolean;
  /** true si el agent-card A2A se pudo leer en vivo. */
  cardLive: boolean;
}

/** Detalle enriquecido que devuelve `getAgent` (Agent + reputación + services). */
export type AgentDetail = Agent & {
  reputation: Reputation;
  services: AgentServices;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-submit-token",
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
  const category = classifyAgent({
    name,
    description,
    tags,
    categories,
    protocols: supportedProtocols,
  });
  const strOrNull = (v: unknown) => (v == null || v === "" ? null : String(v));
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
    rank: raw.rank == null ? null : num(raw.rank),
    networkRank: raw.network_rank == null ? null : num(raw.network_rank),
    ownerAddress: raw.owner_address ? String(raw.owner_address) : undefined,
    agentWallet: raw.agent_wallet ? String(raw.agent_wallet) : undefined,
    ownerUsername: strOrNull(raw.owner_username),
    ownerEns: strOrNull(raw.owner_ens),
    ownerAvatarUrl: strOrNull(raw.owner_avatar_url),
    ownerPublisherTier: strOrNull(raw.owner_publisher_tier),
    ownerCertifiedName: strOrNull(raw.owner_certified_name),
    tags,
    supportedProtocols,
    source: "8004scan",
    network: networkOf(num(raw.chain_id, CHAIN_ID)),
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

  // 1) Porción 8004scan (cacheada). Solo cacheamos el feed upstream; los agentes
  //    creados se fusionan EN VIVO abajo para que aparezcan al instante.
  let base = (await env.AGENTS_KV.get(cacheKey, "json")) as AgentsPage | null;
  if (!base) {
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
    base = {
      agents,
      count: agents.length,
      pagination,
      categories: categoriesMeta(),
      anonymous: !env.SCAN_8004_API_KEY,
    };
    await env.AGENTS_KV.put(cacheKey, JSON.stringify(base), {
      expirationTtl: LIST_CACHE_SEC,
    });
  }

  // 2) Fusiona los agentes creados (testnet, badge propio) al FRENTE de la página 1.
  //    No se hace con `search` libre (para no descolocar la búsqueda por texto).
  if (params.page === 1 && !params.search) {
    const submitted = await listSubmitted(env, params.category);
    if (submitted.length) {
      const merged = [...submitted, ...base.agents];
      return { ...base, agents: merged, count: merged.length };
    }
  }
  return base;
}

/** Convierte una lista cruda de skills (8004scan services.a2a.skills o agent-card) a AgentSkill[]. */
function toSkills(v: unknown): AgentSkill[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const skill: AgentSkill = {
        id: String(o.id ?? o.name ?? ""),
        name: String(o.name ?? o.id ?? ""),
      };
      if (o.description != null && o.description !== "")
        skill.description = String(o.description);
      if (Array.isArray(o.tags)) skill.tags = (o.tags as unknown[]).map(String);
      return skill;
    })
    .filter((s) => s.id || s.name);
}

/** Reputación real desde raw `scores` + `scores.breakdown.dimensions`. */
function buildReputation(raw: Record<string, unknown>): Reputation {
  const scores = (raw.scores as Record<string, unknown> | undefined) ?? {};
  const breakdown =
    (scores.breakdown as Record<string, unknown> | undefined) ?? {};
  const dims =
    (breakdown.dimensions as Record<string, unknown> | undefined) ?? {};
  const dimensions: ReputationDimension[] = Object.entries(dims).map(
    ([key, v]) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return { key, score: num(o.score), weight: num(o.weight) };
    },
  );
  const orNull = (v: unknown) => (v == null ? null : num(v));
  return {
    totalScore: num(raw.total_score),
    rank: raw.rank == null ? null : num(raw.rank),
    networkRank: raw.network_rank == null ? null : num(raw.network_rank),
    health: orNull(scores.health_score),
    freshness: orNull(scores.freshness),
    activity: orNull(scores.activity),
    popularity: orNull(scores.popularity),
    metadataCompleteness: orNull(scores.metadata_completeness),
    dimensions,
    feedbacks: num(raw.total_feedbacks),
    avgScore: num(raw.average_score),
    source: "8004scan",
  };
}

/** Lee el agent-card A2A en vivo (timeout corto). null si falla/timeout. */
async function fetchAgentCard(
  endpoint: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Detección conservadora de ERC-8183 (job/seller agent). */
const ERC8183_RE = /8183|seller|createjob|notify_funded/i;

/** Services + skills desde raw `services`, con fallback a agent-card en vivo. */
async function buildServices(
  raw: Record<string, unknown>,
): Promise<AgentServices> {
  const services = (raw.services as Record<string, unknown> | undefined) ?? {};
  const a2a = (services.a2a as Record<string, unknown> | undefined) ?? {};
  const mcp = (services.mcp as Record<string, unknown> | undefined) ?? {};
  const a2aEndpoint = a2a.endpoint ? String(a2a.endpoint) : null;
  const mcpEndpoint = mcp.endpoint ? String(mcp.endpoint) : null;
  let protocolVersion = a2a.version ? String(a2a.version) : null;

  const supported = Array.isArray(raw.supported_protocols)
    ? (raw.supported_protocols as unknown[]).map(String)
    : [];
  let erc8183 = supported.some((p) => ERC8183_RE.test(p));

  let skills = toSkills(a2a.skills);
  let cardLive = false;

  // Si 8004scan no trajo skills pero hay endpoint, intenta el card en vivo.
  if (skills.length === 0 && a2aEndpoint) {
    const card = await fetchAgentCard(a2aEndpoint);
    if (card) {
      cardLive = true;
      skills = toSkills(card.skills);
      if (!protocolVersion && card.protocolVersion != null)
        protocolVersion = String(card.protocolVersion);
      if (!erc8183) erc8183 = ERC8183_RE.test(JSON.stringify(card));
    }
  }

  return {
    a2aEndpoint,
    mcpEndpoint,
    protocolVersion,
    skills,
    x402: Boolean(raw.x402_supported),
    erc8183,
    cardLive,
  };
}

async function getAgent(
  env: Env,
  tokenId: string,
): Promise<AgentDetail | null> {
  // Agente creado en el marketplace (id "t<chain>-<agentId>") → registro KV propio.
  if (tokenId.startsWith("t")) {
    const sub = await getSubmitted(env, tokenId);
    if (sub) return sub;
  }

  const cacheKey = `agent:v3:${CHAIN_ID}:${tokenId}`;
  const cached = await env.AGENTS_KV.get(cacheKey, "json");
  if (cached) return cached as AgentDetail;

  const url = `${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents/${CHAIN_ID}/${encodeURIComponent(tokenId)}`;
  const res = await fetch(url, { headers: upstreamHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`8004scan ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;

  const agent = normalize(data);
  const reputation = buildReputation(data);
  const services = await buildServices(data);
  const detail: AgentDetail = { ...agent, reputation, services };

  await env.AGENTS_KV.put(cacheKey, JSON.stringify(detail), {
    expirationTtl: AGENT_CACHE_SEC,
  });
  return detail;
}

// ------------------------------------------------------------------ //
// Registro propio de agentes creados ("Crea tu propio agente").
// El proxy 8004scan solo indexa mainnet (chain 56); los agentes creados en el
// marketplace son testnet (97) → los guardamos en KV y los fusionamos en el listado
// con badge de red. El alta onchain la hace el servicio `registrar` (Python).
// ------------------------------------------------------------------ //

const SUBMITTED_PREFIX = "submitted:";
const submittedKey = (chainId: number, agentId: string) =>
  `${SUBMITTED_PREFIX}${chainId}:${agentId}`;
/** id de marketplace para un agente creado: distinguible de los tokenIds de 8004scan. */
const submittedId = (chainId: number, agentId: string) => `t${chainId}-${agentId}`;
const SUBMITTED_ID_RE = /^t(\d+)-(.+)$/;

interface SubmittedInput {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  agentId?: unknown;
  ownerAddress?: unknown;
  endpoint?: unknown;
  txHash?: unknown;
  chainId?: unknown;
  status?: unknown;
  x402Supported?: unknown;
}

/** Construye un AgentDetail a partir de la entrada de un agente recién creado. */
function submittedToDetail(input: SubmittedInput): AgentDetail {
  const chainId = num(input.chainId, TESTNET_CHAIN_ID);
  const name = String(input.name ?? "Untitled agent").slice(0, 64);
  const description = String(input.description ?? "").slice(0, 600);
  const catIn = typeof input.category === "string" ? input.category : "";
  const category =
    (CATEGORIES as readonly string[]).includes(catIn)
      ? (catIn as Category)
      : classifyAgent({ name, description });
  const owner = input.ownerAddress ? String(input.ownerAddress) : undefined;
  const status = input.status === "registered" ? "registered" : "pending";
  // agentId onchain si existe; si no (dry-run/pending), id estable derivado del owner.
  const rawAgentId =
    input.agentId != null && String(input.agentId) !== ""
      ? String(input.agentId)
      : `pending-${(owner ?? "0x0").slice(2, 10)}`;
  const endpoint = input.endpoint ? String(input.endpoint) : null;
  const x402 = Boolean(input.x402Supported);

  const agent: Agent = {
    id: submittedId(chainId, rawAgentId),
    agentId: `${chainId}:submitted:${rawAgentId}`,
    tokenId: rawAgentId,
    chainId,
    name,
    description,
    category,
    categoryLabel: category ? CATEGORY_LABELS[category] : null,
    stars: 0,
    score: 0,
    avgScore: 0,
    feedbacks: 0,
    healthScore: null,
    isVerified: false,
    x402Supported: x402,
    rank: null,
    networkRank: null,
    ownerAddress: owner,
    ownerUsername: null,
    ownerEns: null,
    ownerAvatarUrl: null,
    ownerPublisherTier: null,
    ownerCertifiedName: null,
    source: "submitted",
    network: networkOf(chainId),
    status,
    txHash: input.txHash ? String(input.txHash) : undefined,
  };
  const reputation: Reputation = {
    totalScore: 0,
    rank: null,
    networkRank: null,
    health: null,
    freshness: null,
    activity: null,
    popularity: null,
    metadataCompleteness: null,
    dimensions: [],
    feedbacks: 0,
    avgScore: 0,
    source: "8004scan",
  };
  const services: AgentServices = {
    a2aEndpoint: endpoint,
    mcpEndpoint: null,
    protocolVersion: endpoint ? "0.3.0" : null,
    skills: [],
    x402,
    erc8183: true, // el seller studio expone negotiate/notify_funded (ERC-8183)
    cardLive: false,
  };
  return { ...agent, reputation, services };
}

/** Persiste un agente creado. Devuelve el detalle almacenado. */
async function putSubmitted(env: Env, detail: AgentDetail): Promise<void> {
  await env.AGENTS_KV.put(
    submittedKey(detail.chainId, detail.tokenId),
    JSON.stringify(detail),
  );
}

/** Lee todos los agentes creados (opcionalmente filtrados por categoría). */
async function listSubmitted(env: Env, category?: Category): Promise<Agent[]> {
  const out: Agent[] = [];
  const listing = await env.AGENTS_KV.list({ prefix: SUBMITTED_PREFIX });
  for (const k of listing.keys) {
    const rec = (await env.AGENTS_KV.get(k.name, "json")) as AgentDetail | null;
    if (!rec) continue;
    if (category && rec.category !== category) continue;
    out.push(rec);
  }
  return out;
}

/** Busca un agente creado por su id de marketplace (`t<chain>-<agentId>`). */
async function getSubmitted(
  env: Env,
  marketplaceId: string,
): Promise<AgentDetail | null> {
  const m = SUBMITTED_ID_RE.exec(marketplaceId);
  if (!m) return null;
  const rec = await env.AGENTS_KV.get(submittedKey(Number(m[1]), m[2]), "json");
  return (rec as AgentDetail | null) ?? null;
}

/** POST /v1/submitted — alta de un agente creado en el registro KV. */
async function handleSubmit(request: Request, env: Env): Promise<Response> {
  if (env.SUBMIT_TOKEN) {
    const tok = request.headers.get("x-submit-token");
    if (tok !== env.SUBMIT_TOKEN)
      return json({ error: "unauthorized" }, env, 401);
  }
  let input: SubmittedInput;
  try {
    input = (await request.json()) as SubmittedInput;
  } catch {
    return json({ error: "invalid_json" }, env, 400);
  }
  if (!input || typeof input.name !== "string" || !input.name.trim())
    return json({ error: "name_required" }, env, 422);

  const detail = submittedToDetail(input);
  await putSubmitted(env, detail);
  return json(detail, env, 201);
}

// ------------------------------------------------------------------ //
// Router
// ------------------------------------------------------------------ //

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (!(await underRateLimit(request))) {
      return json({ error: "rate_limited" }, env, 429);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Alta de agentes creados ("Crea tu propio agente") — el único endpoint de escritura.
    if (request.method === "POST") {
      try {
        if (path === "/v1/submitted") return await handleSubmit(request, env);
        return json({ error: "not_found" }, env, 404);
      } catch (err) {
        return json(
          { error: "submit_error", detail: String((err as Error).message) },
          env,
          500,
        );
      }
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, env, 405);
    }

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

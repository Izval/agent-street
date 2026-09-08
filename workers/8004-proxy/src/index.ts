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
//   GET /v1/agents?subcategory=rebalancing|grid|yield|health&page=&limit=&search=
//   GET /v1/agents/:tokenId

import {
  classifyAgent,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  SUBCATEGORY_SEARCH,
  REQUIRED_SUBCATEGORIES,
  type Subcategory,
} from "./classify";
import { qualityGate, dedupeAgents } from "./quality";

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
  // --- Corpus propio (self-fetch) + filtro onchain de base ---
  // Indexer onchain: service binding (preferido) o URL. Enriquecemos el corpus con
  // { totalUsd, txCount } por agente para poder filtrar sin actividad real onchain.
  ONCHAIN_INDEXER?: Fetcher;
  ONCHAIN_INDEXER_URL?: string;
  // Umbrales del filtro duro (vars, tuneables sin redeploy de código). Se CALIBRAN con
  // /v1/corpus/stats: arrancan conservadores, se suben viendo la distribución real.
  MIN_CAPITAL_USD?: string; // default 1  → capital mínimo en USD
  MIN_TX_COUNT?: string; // default 1  → nonce mínimo (tx salientes)
  // "1" ⇒ descarta también agentes NO medibles (sin wallet resoluble / sin enrich).
  // Default "0" (conservador): los no medibles pasan, para no vaciar categorías delgadas.
  DROP_UNMEASURED?: string;
  // Construcción del corpus (cron): páginas globales top-score + presupuesto de enrich.
  CORPUS_PAGES?: string; // default 8   → páginas globales (limit=100) en el ciclo
  CORPUS_FETCH_PER_TICK?: string; // default 4 → jobs de fetch a 8004scan por tick (bajo el límite anónimo)
  ENRICH_BUDGET?: string; // default 60  → agentes a enriquecer por corrida (incremental)
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
  subcategory: Subcategory | null;
  subcategoryLabel: string | null;
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
  // Actividad onchain real (BSC), enriquecida en el corpus vía el onchain-indexer.
  // Se usa SOLO para el filtro de base y el orden — no se renderiza como badge nuevo.
  // Ausente ⇒ agente no medido aún (o sin wallet resoluble).
  onchain?: { totalUsd: number; txCount: number; at: string } | null;
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
  subcategories: Array<{ id: Subcategory; label: string }>;
  /** true si respondimos sin API key (rate-limit anónimo más bajo, pero funciona). */
  anonymous?: boolean;
}

// --- Cache & rate-limit (patrón del Worker IVL) ---
const LIST_CACHE_SEC = 120; // KV TTL para páginas de listado
const AGENT_CACHE_SEC = 300;
// Multiplicador de over-fetch upstream para absorber lo que descartan el anti-spam gate
// y el dedup (quality.ts) sin devolver páginas cortas. Junk ~10% + dupes agrupados;
// 4× (rawLimit tope 100) da margen para el limit=24 por defecto.
const OVERFETCH = 4;
const RL_LIMIT = 120;
const RL_WINDOW_SEC = 60;

// --- Corpus propio (self-fetch) ---
// Snapshot del top de 8004scan en NUESTRO KV, refrescado por cron. Servimos listados
// desde aquí (rate-limit anónimo deja de importar) y aplicamos el filtro onchain.
const CORPUS_KEY = "corpus:v1";
const CORPUS_BUILT_KEY = "corpus:v1:built_at";
const CORPUS_CURSOR_KEY = "corpus:v1:cursor"; // rotación de jobs entre ticks del cron.
const CORPUS_TTL_SEC = 60 * 60; // 1h; el cron (cada 5 min) lo refresca mucho antes.
// TTL largo para servir una copia "stale" cuando 8004scan rate-limitea, en vez de 502.
const STALE_TTL_SEC = 24 * 60 * 60;
// Frescura del enriquecimiento onchain por agente; más viejo ⇒ se re-enriquece.
const ENRICH_STALE_MS = 60 * 60 * 1000;
const num0 = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

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

const subcategoriesMeta = () =>
  SUBCATEGORIES.map((id) => ({ id, label: SUBCATEGORY_LABELS[id] }));

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
  const subcategories = Array.isArray(raw.subcategories)
    ? (raw.subcategories as unknown[]).map(String)
    : undefined;
  const supportedProtocols = Array.isArray(raw.supported_protocols)
    ? (raw.supported_protocols as unknown[]).map(String)
    : undefined;
  const subcategory = classifyAgent({
    name,
    description,
    tags,
    subcategories,
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
    subcategory,
    subcategoryLabel: subcategory ? SUBCATEGORY_LABELS[subcategory] : null,
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
  params: { page: number; limit: number; search?: string; chain?: number },
): Promise<{ rows: Record<string, unknown>[]; pagination: Pagination }> {
  const url = new URL(`${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents`);
  url.searchParams.set("chainId", String(params.chain ?? CHAIN_ID));
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch8004List con reintentos+backoff — absorbe el rate-limit anónimo (429/5xx)
 *  transitorio en vez de burbujearlo como 502 al primer fallo. */
async function fetch8004ListResilient(
  env: Env,
  params: { page: number; limit: number; search?: string; chain?: number },
): Promise<{ rows: Record<string, unknown>[]; pagination: Pagination }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch8004List(env, params);
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr;
}

type ListParams = { subcategory?: Subcategory; page: number; limit: number; search?: string; chain?: number };

/** Fusiona los agentes creados (testnet, badge propio) al FRENTE de la página 1.
 *  No se hace con `search` libre (para no descolocar la búsqueda por texto). Los
 *  creados NO pasan por el filtro onchain (recién nacidos, 0 capital esperado). */
async function mergeSubmittedFront(
  env: Env,
  params: ListParams,
  base: AgentsPage,
): Promise<AgentsPage> {
  if (params.page !== 1 || params.search) return base;
  const submitted = await listSubmitted(env, params.subcategory);
  if (!submitted.length) return base;
  const merged = [...submitted, ...base.agents];
  return { ...base, agents: merged, count: merged.length };
}

// --- Filtro onchain de base (duro, sin badges) ---
const minCapitalUsd = (env: Env) => num0(env.MIN_CAPITAL_USD, 1);
const minTxCount = (env: Env) => num0(env.MIN_TX_COUNT, 1);
const dropUnmeasured = (env: Env) => env.DROP_UNMEASURED === "1";

/**
 * ¿El agente supera el filtro onchain? Semántica Y/O (lo que pidió el usuario):
 * pasa si tiene min de transacciones O min de capital. La data real (BSC) mostró que
 * la wallet resoluble (owner/agent, casi siempre un EOA) rara vez tiene el capital
 * operativo — ~95% con <$1 — así que exigir capital Y tx (AND) vaciaría los listados.
 * OR usa txCount (señal completa y fiable) como principal y el capital como escape.
 * Un umbral <=0 desactiva ese lado; ambos <=0 ⇒ filtro apagado. Sin medición ⇒ pasa
 * salvo DROP_UNMEASURED. Todo tuneable por env var (calibrar con /v1/corpus/stats).
 */
function passesOnchainGate(a: Agent, env: Env): boolean {
  const oc = a.onchain;
  if (!oc) return !dropUnmeasured(env);
  const txMin = minTxCount(env);
  const usdMin = minCapitalUsd(env);
  if (txMin <= 0 && usdMin <= 0) return true; // filtro apagado
  const txOk = txMin > 0 && oc.txCount >= txMin;
  const usdOk = usdMin > 0 && oc.totalUsd >= usdMin;
  return txOk || usdOk;
}

async function readCorpus(env: Env): Promise<Agent[] | null> {
  const c = await env.AGENTS_KV.get(CORPUS_KEY, "json");
  return Array.isArray(c) ? (c as Agent[]) : null;
}

/**
 * Sirve un listado. Preferimos NUESTRO corpus (self-fetch, cacheado por el cron):
 * filtramos por categoría, aplicamos el filtro onchain duro, ordenamos por score y
 * paginamos en memoria. Si el corpus está frío/vacío, o una búsqueda libre no tiene
 * hits en el corpus, caemos al camino en vivo (con retry + stale, nunca 502 seco).
 */
async function listAgents(env: Env, params: ListParams): Promise<AgentsPage> {
  // The cron-built corpus is chain-56 only. A non-default chain (e.g. testnet 97)
  // goes straight to the live path so its agents are found on 8004scan.
  if (params.chain && params.chain !== CHAIN_ID) return liveListAgents(env, params);
  const corpus = await readCorpus(env);
  if (corpus && corpus.length) {
    let items = corpus;
    if (params.subcategory) items = items.filter((a) => a.subcategory === params.subcategory);
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(q));
    }
    items = items.filter((a) => passesOnchainGate(a, env));
    // Una búsqueda libre sin hits en el corpus ⇒ el agente vive fuera del top-N:
    // vale la pena consultar en vivo. El browse por categoría NO cae (0 es honesto).
    if (params.search && items.length === 0) return liveListAgents(env, params);
    items = items.slice().sort((a, b) => b.score - a.score);
    const total = items.length;
    const start = (params.page - 1) * params.limit;
    const pageItems = items.slice(start, start + params.limit);
    const base: AgentsPage = {
      agents: pageItems,
      count: pageItems.length,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        hasMore: start + params.limit < total,
      },
      subcategories: subcategoriesMeta(),
      anonymous: !env.SCAN_8004_API_KEY,
    };
    return mergeSubmittedFront(env, params, base);
  }
  return liveListAgents(env, params);
}

/** Camino en vivo (fallback): 8004scan por request, con retry + stale-serve. Es el
 *  comportamiento previo endurecido — solo se usa si el corpus no está disponible. */
async function liveListAgents(env: Env, params: ListParams): Promise<AgentsPage> {
  const search = params.search ?? (params.subcategory ? SUBCATEGORY_SEARCH[params.subcategory] : undefined);
  const chain = params.chain ?? CHAIN_ID;
  const suffix = `${chain}:${params.subcategory ?? "all"}:${search ?? ""}:${params.page}:${params.limit}`;
  const cacheKey = `agents:v2:${suffix}`;
  const staleKey = `agents:stale:${suffix}`;

  let base = (await env.AGENTS_KV.get(cacheKey, "json")) as AgentsPage | null;
  if (!base) {
    try {
      // Over-fetch so the anti-spam gate can drop junk without shrinking the page.
      const rawLimit = Math.min(100, params.limit * OVERFETCH);
      const { rows, pagination } = await fetch8004ListResilient(env, {
        page: params.page,
        limit: rawLimit,
        search,
        chain,
      });
      let agents = dedupeAgents(rows.map(normalize).filter(qualityGate));
      if (params.subcategory) {
        agents = agents.map((a) => ({
          ...a,
          subcategory: a.subcategory ?? params.subcategory!,
          subcategoryLabel: a.subcategoryLabel ?? SUBCATEGORY_LABELS[params.subcategory!],
        }));
      }
      const sliced = agents.slice(0, params.limit);
      base = {
        agents: sliced,
        count: sliced.length,
        pagination: {
          page: pagination.page,
          limit: params.limit,
          total: pagination.total,
          hasMore: pagination.hasMore || agents.length > params.limit,
        },
        subcategories: subcategoriesMeta(),
        anonymous: !env.SCAN_8004_API_KEY,
      };
      await env.AGENTS_KV.put(cacheKey, JSON.stringify(base), { expirationTtl: LIST_CACHE_SEC });
      await env.AGENTS_KV.put(staleKey, JSON.stringify(base), { expirationTtl: STALE_TTL_SEC });
    } catch (err) {
      // Upstream rate-limiteó/cayó: servir la última página buena en vez de 502.
      const stale = (await env.AGENTS_KV.get(staleKey, "json")) as AgentsPage | null;
      if (stale) return mergeSubmittedFront(env, params, stale);
      throw err;
    }
  }
  return mergeSubmittedFront(env, params, base);
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

/** El transporte A2A (message/send) es la `url` del agent-card, NO la ubicación del
 *  card. 8004scan suele guardar `services.a2a.endpoint` como la ruta del card
 *  (`…/.well-known/agent-card.json`); postear message/send ahí falla. Quita ese
 *  sufijo para dejar el origen como fallback cuando el card no responde. */
function normalizeA2A(endpoint: string | null): string | null {
  if (!endpoint) return endpoint;
  return endpoint.replace(/\/\.well-known\/agent(-card)?\.json$/i, "") || endpoint;
}

/** Services + skills desde raw `services`, con fallback a agent-card en vivo. */
async function buildServices(
  raw: Record<string, unknown>,
): Promise<AgentServices> {
  const services = (raw.services as Record<string, unknown> | undefined) ?? {};
  const a2a = (services.a2a as Record<string, unknown> | undefined) ?? {};
  const mcp = (services.mcp as Record<string, unknown> | undefined) ?? {};
  // Card location (where 8004scan says the card lives) — used to FETCH the card.
  const cardLocation = a2a.endpoint ? String(a2a.endpoint) : null;
  let a2aEndpoint = cardLocation;
  const mcpEndpoint = mcp.endpoint ? String(mcp.endpoint) : null;
  let protocolVersion = a2a.version ? String(a2a.version) : null;

  const supported = Array.isArray(raw.supported_protocols)
    ? (raw.supported_protocols as unknown[]).map(String)
    : [];
  let erc8183 = supported.some((p) => ERC8183_RE.test(p));

  let skills = toSkills(a2a.skills);
  let cardLive = false;

  // Siempre sondea el endpoint A2A (si existe) para que `cardLive` sea una señal real
  // de liveness para el badge "Endpoint live" — no solo un fallback de skills. Además,
  // si 8004scan no trajo skills, las completa desde el card en vivo.
  if (cardLocation) {
    const card = await fetchAgentCard(cardLocation);
    if (card) {
      cardLive = true;
      if (skills.length === 0) skills = toSkills(card.skills);
      if (!protocolVersion && card.protocolVersion != null)
        protocolVersion = String(card.protocolVersion);
      if (!erc8183) erc8183 = ERC8183_RE.test(JSON.stringify(card));
      // The card's `url` IS the JSON-RPC transport for message/send — prefer it.
      if (card.url) a2aEndpoint = String(card.url);
    }
  }
  // Card unreachable → best-effort: strip a `/.well-known/…` suffix so message/send
  // targets the service origin instead of the card path.
  a2aEndpoint = normalizeA2A(a2aEndpoint);

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
  chain: number = CHAIN_ID,
): Promise<AgentDetail | null> {
  // Agente creado en el marketplace (id "t<chain>-<agentId>") → registro KV propio.
  if (tokenId.startsWith("t")) {
    const sub = await getSubmitted(env, tokenId);
    if (sub) return sub;
  }

  // chain in the cache key so mainnet #N and testnet #N (distinct NFTs) never collide.
  const cacheKey = `agent:v3:${chain}:${tokenId}`;
  const cached = await env.AGENTS_KV.get(cacheKey, "json");
  if (cached) return cached as AgentDetail;

  const url = `${env.SCAN_8004_BASE.replace(/\/$/, "")}/agents/${chain}/${encodeURIComponent(tokenId)}`;
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
  subcategory?: unknown;
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
  const catIn = typeof input.subcategory === "string" ? input.subcategory : "";
  const subcategory =
    (SUBCATEGORIES as readonly string[]).includes(catIn)
      ? (catIn as Subcategory)
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
    subcategory,
    subcategoryLabel: subcategory ? SUBCATEGORY_LABELS[subcategory] : null,
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
async function listSubmitted(env: Env, subcategory?: Subcategory): Promise<Agent[]> {
  const out: Agent[] = [];
  const listing = await env.AGENTS_KV.list({ prefix: SUBMITTED_PREFIX });
  for (const k of listing.keys) {
    const rec = (await env.AGENTS_KV.get(k.name, "json")) as AgentDetail | null;
    if (!rec) continue;
    if (subcategory && rec.subcategory !== subcategory) continue;
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
// Corpus builder (cron) — self-fetch de 8004scan + enriquecimiento onchain
// ------------------------------------------------------------------ //

/** Fetch al onchain-indexer: service binding preferido, si no la URL. */
async function indexerFetch(env: Env, path: string, init: RequestInit): Promise<Response> {
  if (env.ONCHAIN_INDEXER) {
    return env.ONCHAIN_INDEXER.fetch(new Request(`https://onchain-indexer${path}`, init));
  }
  if (env.ONCHAIN_INDEXER_URL) {
    return fetch(`${env.ONCHAIN_INDEXER_URL.replace(/\/$/, "")}${path}`, init);
  }
  throw new Error("no onchain indexer configured");
}

/** Pide resúmenes { totalUsd, txCount } al indexer, troceado. Mapa addr→summary. */
async function fetchSummaries(
  env: Env,
  addresses: string[],
): Promise<Map<string, { totalUsd: number; txCount: number }>> {
  const out = new Map<string, { totalUsd: number; txCount: number }>();
  const CHUNK = 50;
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const chunk = addresses.slice(i, i + CHUNK);
    try {
      const res = await indexerFetch(env, "/v1/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addresses: chunk }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        summaries?: Array<{ address: string; totalUsd: number; txCount: number }>;
      };
      for (const s of body.summaries ?? []) {
        out.set(s.address.toLowerCase(), { totalUsd: s.totalUsd, txCount: s.txCount });
      }
    } catch {
      // chunk falla → se omite; esos agentes quedan sin medir (pasan por defecto).
    }
  }
  return out;
}

/** Address onchain-medible del agente (misma precedencia que el detalle). */
const agentAddr = (a: Agent): string | null => {
  const addr = (a.agentWallet ?? a.ownerAddress ?? "").toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(addr) ? addr : null;
};

/** Enriquece hasta ENRICH_BUDGET agentes que lo necesiten (sin onchain o stale). */
async function enrichOnchain(env: Env, agents: Agent[]): Promise<Agent[]> {
  if (!env.ONCHAIN_INDEXER && !env.ONCHAIN_INDEXER_URL) return agents;
  const budget = num0(env.ENRICH_BUDGET, 60);
  if (budget <= 0) return agents;
  const now = Date.now();

  const need: Array<{ id: string; addr: string }> = [];
  for (const a of agents) {
    const addr = agentAddr(a);
    if (!addr) continue;
    const oc = a.onchain;
    if (oc && oc.at && now - Date.parse(oc.at) < ENRICH_STALE_MS) continue;
    need.push({ id: a.id, addr });
    if (need.length >= budget) break;
  }
  if (!need.length) return agents;

  const summaries = await fetchSummaries(env, [...new Set(need.map((n) => n.addr))]);
  const at = new Date().toISOString();
  const addrById = new Map(need.map((n) => [n.id, n.addr]));
  return agents.map((a) => {
    const addr = addrById.get(a.id);
    if (!addr) return a;
    const s = summaries.get(addr);
    if (!s) return a;
    return { ...a, onchain: { totalUsd: s.totalUsd, txCount: s.txCount, at } };
  });
}

/** Un "job" de fetch a 8004scan (una página, global o de una categoría). */
type CorpusJob = { page: number; search?: string; cat?: Subcategory };

/** Lista determinista de jobs: páginas globales top-score + páginas por cada
 *  categoría OBLIGATORIA (garantiza igual profundidad para las 4 juzgadas). */
function corpusJobs(env: Env): CorpusJob[] {
  const jobs: CorpusJob[] = [];
  const globalPages = num0(env.CORPUS_PAGES, 8);
  for (let p = 1; p <= globalPages; p++) jobs.push({ page: p });
  for (const cat of REQUIRED_SUBCATEGORIES) {
    for (let p = 1; p <= 2; p++) jobs.push({ page: p, search: SUBCATEGORY_SEARCH[cat], cat });
  }
  return jobs;
}

/**
 * Construye/actualiza el corpus. Merge SOBRE el existente (robusto a corridas
 *  parciales por rate-limit) + enriquecimiento incremental. Idempotente.
 *
 * Como el feed anónimo de 8004scan tiene rate-limit bajo (~10 req/min), NO hacemos
 * todos los jobs por tick: un cursor rotatorio en KV procesa `FETCH_PER_TICK` jobs por
 * corrida del cron; en unas pocas corridas cubre todo y se mantiene fresco. `full`
 * (rebuild manual) recorre todos los jobs de una para warm-up.
 */
async function buildCorpus(
  env: Env,
  full = false,
): Promise<{ count: number; enriched: number; fetched: number }> {
  const byId = new Map<string, Agent>();
  const prev = await readCorpus(env);
  if (prev) for (const a of prev) byId.set(a.id, a);

  const ingest = (rows: Record<string, unknown>[], cat?: Subcategory) => {
    for (const raw of rows) {
      const a = normalize(raw);
      if (!qualityGate(a)) continue;
      // Conserva el enrich onchain previo del mismo id; refresca los demás campos.
      const existing = byId.get(a.id);
      const merged: Agent = existing?.onchain ? { ...a, onchain: existing.onchain } : a;
      if (cat) {
        merged.subcategory = merged.subcategory ?? cat;
        merged.subcategoryLabel = merged.subcategoryLabel ?? SUBCATEGORY_LABELS[cat];
      }
      byId.set(a.id, merged);
    }
  };

  const jobs = corpusJobs(env);
  const perTick = full ? jobs.length : num0(env.CORPUS_FETCH_PER_TICK, 4);
  const cursor = full ? 0 : num0((await env.AGENTS_KV.get(CORPUS_CURSOR_KEY)) ?? undefined, 0);
  let fetched = 0;
  for (let k = 0; k < perTick && k < jobs.length; k++) {
    const job = jobs[(cursor + k) % jobs.length];
    try {
      const { rows } = await fetch8004ListResilient(env, {
        page: job.page,
        limit: 100,
        search: job.search,
      });
      ingest(rows, job.cat);
      fetched++;
    } catch {
      // rate-limit/caída transitoria: se omite este job; el próximo tick lo reintenta.
    }
  }
  if (!full) {
    await env.AGENTS_KV.put(
      CORPUS_CURSOR_KEY,
      String((cursor + perTick) % jobs.length),
    );
  }

  let agents = dedupeAgents([...byId.values()]);
  agents = await enrichOnchain(env, agents);
  const enriched = agents.filter((a) => a.onchain).length;

  await env.AGENTS_KV.put(CORPUS_KEY, JSON.stringify(agents), { expirationTtl: CORPUS_TTL_SEC });
  await env.AGENTS_KV.put(CORPUS_BUILT_KEY, new Date().toISOString());
  return { count: agents.length, enriched, fetched };
}

/** Distribución de txCount/totalUsd sobre el corpus, para CALIBRAR los umbrales
 *  con datos reales antes de fijar el filtro duro (GET /v1/corpus/stats). */
function corpusStats(corpus: Agent[] | null, env: Env): Record<string, unknown> {
  const rows = corpus ?? [];
  // Y/O (mismo criterio que passesOnchainGate): tx O capital sobre los YA medidos.
  const survivors = (txMin: number, usdMin: number) =>
    rows.filter((a) => a.onchain && (a.onchain.txCount >= txMin || a.onchain.totalUsd >= usdMin))
      .length;

  const perSubcategory: Record<string, { total: number; enriched: number; survives: number }> = {};
  for (const cat of SUBCATEGORIES) {
    const inCat = rows.filter((a) => a.subcategory === cat);
    perSubcategory[cat] = {
      total: inCat.length,
      enriched: inCat.filter((a) => a.onchain).length,
      survives: inCat.filter((a) => passesOnchainGate(a, env)).length,
    };
  }

  const hist = (buckets: number[], val: (a: Agent) => number | null) => {
    const counts = buckets.map(() => 0);
    let unmeasured = 0;
    for (const a of rows) {
      const v = val(a);
      if (v == null) {
        unmeasured++;
        continue;
      }
      let idx = 0;
      for (let i = 0; i < buckets.length; i++) if (v >= buckets[i]) idx = i;
      counts[idx]++;
    }
    return { buckets, counts, unmeasured };
  };

  return {
    total: rows.length,
    enriched: rows.filter((a) => a.onchain).length,
    thresholds: {
      minCapitalUsd: minCapitalUsd(env),
      minTxCount: minTxCount(env),
      dropUnmeasured: dropUnmeasured(env),
    },
    // survivors = medidos que pasan bajo Y/O (tx O usd) para cada umbral candidato.
    survivorsAt: {
      "tx>=1 OR usd>=1": survivors(1, 1),
      "tx>=10 OR usd>=1": survivors(10, 1),
      "tx>=100 OR usd>=1": survivors(100, 1),
      "tx>=10 OR usd>=10": survivors(10, 10),
    },
    txCountHistogram: hist([0, 1, 10, 100, 1000], (a) => (a.onchain ? a.onchain.txCount : null)),
    totalUsdHistogram: hist([0, 1, 10, 100, 1000], (a) => (a.onchain ? a.onchain.totalUsd : null)),
    perSubcategory,
  };
}

// ------------------------------------------------------------------ //
// Router
// ------------------------------------------------------------------ //

export default {
  /** Cron: refresca NUESTRO corpus (self-fetch + enrich) para no depender del
   *  rate-limit anónimo de 8004scan por request. Configurado en wrangler.toml. */
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      buildCorpus(env)
        .then((r) => console.log(`[corpus] built count=${r.count} enriched=${r.enriched}`))
        .catch((e) => console.log(`[corpus] fail ${String((e as Error)?.message || e)}`)),
    );
  },

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
        // Rebuild manual del corpus (warm-up / tuning). Protegido por SUBMIT_TOKEN si existe.
        if (path === "/v1/corpus/rebuild") {
          if (env.SUBMIT_TOKEN && request.headers.get("x-submit-token") !== env.SUBMIT_TOKEN)
            return json({ error: "unauthorized" }, env, 401);
          const r = await buildCorpus(env, true); // full: recorre todos los jobs (warm-up).
          return json({ ok: true, ...r }, env, 200);
        }
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
          { ok: true, service: "8004-proxy", subcategories: subcategoriesMeta() },
          env,
          200,
          30,
        );
      }

      // Distribución onchain del corpus — para calibrar los umbrales del filtro.
      if (path === "/v1/corpus/stats") {
        const corpus = await readCorpus(env);
        const builtAt = await env.AGENTS_KV.get(CORPUS_BUILT_KEY);
        return json({ builtAt, ...corpusStats(corpus, env) }, env, 200, 15);
      }

      // Chain param (default mainnet 56; only 56/97 supported). Generic multi-chain —
      // no per-agent special-casing.
      const parseChain = (): number => {
        const raw = Number(
          url.searchParams.get("chain") || url.searchParams.get("chainId"),
        );
        return raw === TESTNET_CHAIN_ID ? TESTNET_CHAIN_ID : CHAIN_ID;
      };

      if (path === "/v1/agents") {
        const cat = url.searchParams.get("subcategory") as Subcategory | null;
        const subcategory =
          cat && (SUBCATEGORIES as readonly string[]).includes(cat)
            ? (cat as Subcategory)
            : undefined;
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit")) || 24),
        );
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const search = url.searchParams.get("search") || undefined;
        const chain = parseChain();
        const result = await listAgents(env, { subcategory, page, limit, search, chain });
        return json(result, env, 200, LIST_CACHE_SEC);
      }

      const m = path.match(/^\/v1\/agents\/(.+)$/);
      if (m) {
        const agent = await getAgent(env, decodeURIComponent(m[1]), parseChain());
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

// index.ts — Worker de analítica de demanda (agent-street).
//
// Rol: "trending HONESTO". A diferencia de rankings inventados, aquí el % de
// cambio y el movimiento de rank son de PRIMERA MANO: contamos nuestros propios
// eventos (views + hires) por hora en KV y los agregamos por ventana. Nada
// estimado se presenta como exacto; si no hay base para comparar → null ("nuevo").
//
// Patrón reutilizado del Worker 8004-proxy (workers/8004-proxy): CORS + KV +
// rate-limit + router. NO importa código cross-package (repos/workers separados).
//
// Endpoints propios:
//   GET  /health                      → { ok:true, service:"analytics" }
//   POST /v1/event  { agentId, type } → incrementa contadores (best-effort, 200)
//   GET  /v1/trending?metric=&window=&category=&limit=  → TrendingResponse EXACTO
//   GET  /v1/series/:agentId?window=  → SeriesResponse (demand over time, 1 agent)
//
// Contrato de salida: ESPEJO de app/app/lib/contracts.ts (TrendingResponse /
// TrendingRow / TrendingMetric / TrendingWindow). camelCase. Mantener en sync.

export interface Env {
  ANALYTICS_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  // Base del Worker 8004-proxy para enriquecer los top N (name/imageUrl/category).
  PROXY_8004_URL: string;
}

// --- Contrato de salida (espeja contracts.ts) --------------------------------
type TrendingMetric = "views" | "hires";
type TrendingWindow = "1h" | "24h" | "7d";

interface TrendingRow {
  agentId: string;
  name: string;
  imageUrl?: string | null;
  category: string | null;
  categoryLabel: string | null;
  count: number;
  deltaPct: number | null;
  rankDelta: number | null;
  spark: number[];
}

interface TrendingResponse {
  window: TrendingWindow;
  metric: TrendingMetric;
  rows: TrendingRow[];
  updatedAt: string;
  source: "demand";
}

/** Per-agent demand over time (usage chart on the agent profile). One point per
 *  hourly bucket in the window; views/hires are our own first-party counts. */
interface SeriesPoint {
  ts: string; // ISO of the bucket hour (UTC)
  views: number;
  hires: number;
}
interface SeriesResponse {
  agentId: string;
  window: TrendingWindow;
  points: SeriesPoint[];
  updatedAt: string;
  source: "demand";
}

// --- Constantes ---------------------------------------------------------------
const EVENT_TYPES = ["view", "hire"] as const;
type EventType = (typeof EVENT_TYPES)[number];

// metric (plural, cara pública) ↔ tipo de evento (singular, cómo se almacena).
const METRIC_TYPE: Record<TrendingMetric, EventType> = { views: "view", hires: "hire" };

const WINDOW_HOURS: Record<TrendingWindow, number> = { "1h": 1, "24h": 24, "7d": 168 };

const COUNTER_TTL = 60 * 60 * 24 * 30; // ~30 días — retención de buckets horarios.
const IDX_TTL = 60 * 60 * 24 * 30; // índice de agentes activos (mismo horizonte).
const DEDUP_TTL = 3900; // ~65 min: cubre la hora del bucket (mín. KV = 60s).
const META_TTL = 300; // cache del enriquecimiento del 8004-proxy.

const RL_LIMIT = 300; // eventos+lecturas por IP y ventana (demanda puede ser alta).
const RL_WINDOW_SEC = 60;

const SPARK_SLOTS = 7; // sub-buckets de la serie para el sparkline.
const ENRICH_CAP = 50; // máximo de agentes a enriquecer cuando hay filtro de categoría.
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

// --- CORS / JSON (patrón 8004-proxy) -----------------------------------------
function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data: unknown, env: Env, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(env),
  };
  if (cacheSeconds > 0) headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  return new Response(JSON.stringify(data), { status, headers });
}

// --- Rate-limit por IP (patrón 8004-proxy, sobre caches.default) --------------
async function underRateLimit(request: Request): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") || "anon";
  const origin = new URL(request.url).origin;
  const win = Math.floor(Date.now() / 1000 / RL_WINDOW_SEC);
  const key = new Request(`${origin}/__rl/${encodeURIComponent(ip)}/${win}`);
  const cache = caches.default;
  let count = 0;
  const hit = await cache.match(key);
  if (hit) count = parseInt(await hit.text(), 10) || 0;
  count++;
  if (count > RL_LIMIT) return false;
  await cache.put(
    key,
    new Response(String(count), { headers: { "Cache-Control": `max-age=${RL_WINDOW_SEC}` } }),
  );
  return true;
}

// --- Buckets de tiempo (horarios, UTC) ---------------------------------------
const HOUR_MS = 3600_000;

/** yyyymmddHH en UTC para un instante dado. */
function fmtBucket(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}` +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours())
  );
}

/** Inversa de fmtBucket: yyyymmddHH (UTC) → ms del inicio de esa hora. */
function parseBucket(b: string): number {
  const y = Number(b.slice(0, 4));
  const mo = Number(b.slice(4, 6));
  const d = Number(b.slice(6, 8));
  const h = Number(b.slice(8, 10));
  return Date.UTC(y, mo - 1, d, h);
}

/**
 * Devuelve los `hours` buckets horarios más recientes (ascendente cronológico),
 * terminando en la hora `endMs`. Ej: hours=24, endMs=ahora → 24 buckets.
 */
function bucketsEndingAt(endMs: number, hours: number): string[] {
  const out: string[] = [];
  for (let i = hours - 1; i >= 0; i--) out.push(fmtBucket(endMs - i * HOUR_MS));
  return out;
}

// --- Claves KV ----------------------------------------------------------------
//   ev:{type}:{agentId}:{yyyymmddHH}      contador horario (TTL ~30d)
//   idx:agent:{agentId}                   índice de agentes activos (TTL ~30d)
//   dedup:{ip}:{agentId}:{type}:{bucket}  anti doble-conteo por hora (TTL ~65m)
//   meta:{agentId}                        cache del enriquecimiento 8004-proxy (TTL 5m)
const evKey = (t: EventType, agentId: string, bucket: string) => `ev:${t}:${agentId}:${bucket}`;
const evPrefix = (t: EventType) => `ev:${t}:`;
const idxKey = (agentId: string) => `idx:agent:${agentId}`;
const dedupKey = (ip: string, agentId: string, t: EventType, bucket: string) =>
  `dedup:${ip}:${agentId}:${t}:${bucket}`;
const metaKey = (agentId: string) => `meta:${agentId}`;

/** Parsea `ev:{type}:{agentId}:{bucket}` → {agentId, bucket}. agentId puede
 *  contener ':' (token compuesto), por eso el bucket es el ÚLTIMO segmento. */
function parseEvKey(key: string, t: EventType): { agentId: string; bucket: string } | null {
  const head = `ev:${t}:`;
  if (!key.startsWith(head)) return null;
  const rest = key.slice(head.length);
  const at = rest.lastIndexOf(":");
  if (at <= 0) return null;
  return { agentId: rest.slice(0, at), bucket: rest.slice(at + 1) };
}

// --- Helpers KV ---------------------------------------------------------------
/** Lista TODAS las claves de un prefijo (pagina el cursor de KV). */
async function listAllKeys(kv: KVNamespace, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await kv.list({ prefix, cursor, limit: 1000 });
    for (const k of res.keys) keys.push(k.name);
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return keys;
}

// ------------------------------------------------------------------ //
// POST /v1/event — registra demanda (best-effort, nunca 5xx)
// ------------------------------------------------------------------ //
async function handleEvent(request: Request, env: Env): Promise<Response> {
  let body: { agentId?: unknown; type?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "bad_json" }, env, 400);
  }
  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  const type = body.type as EventType;
  if (!agentId || !EVENT_TYPES.includes(type)) {
    return json({ ok: false, error: "invalid_event" }, env, 400);
  }

  try {
    const now = Date.now();
    const bucket = fmtBucket(now);
    const ip = request.headers.get("CF-Connecting-IP") || "anon";

    // Dedup simple anti-abuso: una IP no cuenta dos veces el mismo evento/hora.
    const dk = dedupKey(ip, agentId, type, bucket);
    const seen = await env.ANALYTICS_KV.get(dk);
    if (seen) return json({ ok: true, deduped: true }, env, 200);
    await env.ANALYTICS_KV.put(dk, "1", { expirationTtl: DEDUP_TTL });

    // Incremento del contador horario.
    const ek = evKey(type, agentId, bucket);
    const cur = parseInt((await env.ANALYTICS_KV.get(ek)) || "0", 10) || 0;
    await env.ANALYTICS_KV.put(ek, String(cur + 1), { expirationTtl: COUNTER_TTL });

    // Índice del set de agentes activos (refresca el horizonte de retención).
    await env.ANALYTICS_KV.put(idxKey(agentId), String(now), { expirationTtl: IDX_TTL });

    return json({ ok: true }, env, 200);
  } catch {
    // Best-effort: nunca 5xx por un evento. Reportamos ok:false pero 200.
    return json({ ok: false, error: "store_failed" }, env, 200);
  }
}

// ------------------------------------------------------------------ //
// Enriquecimiento vía 8004-proxy (name/imageUrl/category), cacheado en KV
// ------------------------------------------------------------------ //
interface AgentMeta {
  name: string;
  imageUrl: string | null;
  category: string | null;
  categoryLabel: string | null;
}

async function enrich(env: Env, agentId: string): Promise<AgentMeta> {
  const fallback: AgentMeta = { name: agentId, imageUrl: null, category: null, categoryLabel: null };

  const cached = await env.ANALYTICS_KV.get(metaKey(agentId), "json");
  if (cached) return cached as AgentMeta;

  try {
    const base = env.PROXY_8004_URL.replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${base}/v1/agents/${encodeURIComponent(agentId)}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return fallback; // no cacheamos el fallback (el proxy puede revivir).
    const a = (await res.json()) as Record<string, unknown>;
    const meta: AgentMeta = {
      name: typeof a.name === "string" && a.name ? a.name : agentId,
      imageUrl: typeof a.imageUrl === "string" ? a.imageUrl : null,
      category: typeof a.category === "string" ? a.category : null,
      categoryLabel: typeof a.categoryLabel === "string" ? a.categoryLabel : null,
    };
    await env.ANALYTICS_KV.put(metaKey(agentId), JSON.stringify(meta), { expirationTtl: META_TTL });
    return meta;
  } catch {
    return fallback; // proxy caído/timeout → name=agentId, category=null.
  }
}

// ------------------------------------------------------------------ //
// Agregación por bucket (números por agente en un conjunto de buckets)
// ------------------------------------------------------------------ //
/** Divide una serie por-bucket (cronológica) en ~SPARK_SLOTS segmentos sumados. */
function toSpark(perBucket: number[]): number[] {
  if (perBucket.length <= SPARK_SLOTS) return perBucket.slice();
  const out = new Array(SPARK_SLOTS).fill(0) as number[];
  for (let i = 0; i < perBucket.length; i++) {
    const slot = Math.min(SPARK_SLOTS - 1, Math.floor((i * SPARK_SLOTS) / perBucket.length));
    out[slot] += perBucket[i];
  }
  return out;
}

// ------------------------------------------------------------------ //
// GET /v1/trending
// ------------------------------------------------------------------ //
async function handleTrending(url: URL, env: Env): Promise<Response> {
  const metricRaw = url.searchParams.get("metric");
  const metric: TrendingMetric = metricRaw === "hires" ? "hires" : "views";
  const windowRaw = url.searchParams.get("window") as TrendingWindow | null;
  const window: TrendingWindow =
    windowRaw && windowRaw in WINDOW_HOURS ? windowRaw : "24h";
  const category = url.searchParams.get("category") || undefined;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );

  const type = METRIC_TYPE[metric];
  const hours = WINDOW_HOURS[window];
  const now = Date.now();

  // Ventana actual (últimas `hours` h) y ventana previa equivalente (las `hours`
  // h anteriores). Sets de buckets para clasificar cada clave rápidamente.
  const curBuckets = bucketsEndingAt(now, hours);
  const prevBuckets = bucketsEndingAt(now - hours * HOUR_MS, hours);
  const curSet = new Set(curBuckets);
  const prevSet = new Set(prevBuckets);
  const curIndex = new Map(curBuckets.map((b, i) => [b, i])); // bucket → posición cronológica

  // Enumera claves de evento del tipo pedido; quédate solo con las de la ventana
  // actual o previa (evita GETs de buckets viejos que igual expiran).
  const allKeys = await listAllKeys(env.ANALYTICS_KV, evPrefix(type));
  const relevant: Array<{ key: string; agentId: string; bucket: string; scope: "cur" | "prev" }> = [];
  for (const key of allKeys) {
    const parsed = parseEvKey(key, type);
    if (!parsed) continue;
    if (curSet.has(parsed.bucket)) relevant.push({ key, ...parsed, scope: "cur" });
    else if (prevSet.has(parsed.bucket)) relevant.push({ key, ...parsed, scope: "prev" });
  }

  // Trae los valores de las claves relevantes en paralelo.
  const values = await Promise.all(
    relevant.map((r) => env.ANALYTICS_KV.get(r.key).then((v) => parseInt(v || "0", 10) || 0)),
  );

  // Agrega por agente.
  interface Agg {
    cur: number;
    prev: number;
    perBucket: number[]; // longitud = hours, cronológico ascendente
  }
  const agg = new Map<string, Agg>();
  const ensure = (id: string): Agg => {
    let a = agg.get(id);
    if (!a) {
      a = { cur: 0, prev: 0, perBucket: new Array(hours).fill(0) };
      agg.set(id, a);
    }
    return a;
  };
  for (let i = 0; i < relevant.length; i++) {
    const r = relevant[i];
    const v = values[i];
    if (v <= 0) continue;
    const a = ensure(r.agentId);
    if (r.scope === "cur") {
      a.cur += v;
      const pos = curIndex.get(r.bucket);
      if (pos !== undefined) a.perBucket[pos] += v;
    } else {
      a.prev += v;
    }
  }

  // Estado vacío honesto: sin demanda todavía.
  const withDemand = [...agg.entries()].filter(([, a]) => a.cur > 0);
  if (withDemand.length === 0) {
    const empty: TrendingResponse = {
      window,
      metric,
      rows: [],
      updatedAt: new Date(now).toISOString(),
      source: "demand",
    };
    return json(empty, env, 200, 15);
  }

  // Ranking actual (desc por count; desempate por agentId estable).
  const sortedCur = withDemand
    .map(([agentId, a]) => ({ agentId, a }))
    .sort((x, y) => y.a.cur - x.a.cur || (x.agentId < y.agentId ? -1 : 1));
  const rankCur = new Map(sortedCur.map((e, i) => [e.agentId, i + 1]));

  // Ranking previo (desc por count previo; solo agentes que existían entonces).
  const rankPrev = new Map<string, number>();
  [...agg.entries()]
    .filter(([, a]) => a.prev > 0)
    .map(([agentId, a]) => ({ agentId, prev: a.prev }))
    .sort((x, y) => y.prev - x.prev || (x.agentId < y.agentId ? -1 : 1))
    .forEach((e, i) => rankPrev.set(e.agentId, i + 1));

  // ¿Cuántos enriquecer? Con filtro de categoría hay que enriquecer más y luego
  // filtrar (la categoría vive en el 8004-proxy, no en nuestros contadores).
  const candidates = sortedCur.slice(0, category ? ENRICH_CAP : limit);
  const metas = await Promise.all(candidates.map((c) => enrich(env, c.agentId)));

  let rows: TrendingRow[] = candidates.map((c, i) => {
    const meta = metas[i];
    const prev = c.a.prev;
    // deltaPct: % vs ventana previa. null si no hay base (nuevo → sin comparación).
    const deltaPct = prev > 0 ? Math.round(((c.a.cur - prev) / prev) * 1000) / 10 : null;
    // rankDelta: rankPrev - rankCur (positivo = subió). null si no estaba antes.
    const rc = rankCur.get(c.agentId)!;
    const rp = rankPrev.get(c.agentId);
    const rankDelta = rp === undefined ? null : rp - rc;
    return {
      agentId: c.agentId,
      name: meta.name,
      imageUrl: meta.imageUrl,
      category: meta.category,
      categoryLabel: meta.categoryLabel,
      count: c.a.cur,
      deltaPct,
      rankDelta,
      spark: toSpark(c.a.perBucket),
    };
  });

  // Filtro de categoría (post-enriquecimiento) y recorte al límite.
  if (category) rows = rows.filter((r) => r.category === category);
  rows = rows.slice(0, limit);

  const out: TrendingResponse = {
    window,
    metric,
    rows,
    updatedAt: new Date(now).toISOString(),
    source: "demand",
  };
  return json(out, env, 200, 15);
}

// ------------------------------------------------------------------ //
// GET /v1/series/:agentId — demanda de UN agente a lo largo del tiempo
// ------------------------------------------------------------------ //
async function handleSeries(agentId: string, url: URL, env: Env): Promise<Response> {
  const windowRaw = url.searchParams.get("window") as TrendingWindow | null;
  const window: TrendingWindow =
    windowRaw && windowRaw in WINDOW_HOURS ? windowRaw : "7d";
  const hours = WINDOW_HOURS[window];
  const now = Date.now();

  const buckets = bucketsEndingAt(now, hours);
  const index = new Map(buckets.map((b, i) => [b, i]));

  // Lee, por tipo, solo los buckets que EXISTEN (prefijo disperso → pocas claves)
  // y colócalos en el array cronológico de la ventana. El prefijo termina en ':'
  // (tras el agentId) para no colisionar con ids que comparten prefijo.
  async function fill(type: EventType): Promise<number[]> {
    const arr = new Array(hours).fill(0) as number[];
    const keys = await listAllKeys(env.ANALYTICS_KV, `${evKey(type, agentId, "")}`);
    const relevant = keys.filter((k) => {
      const p = parseEvKey(k, type);
      return p && p.agentId === agentId && index.has(p.bucket);
    });
    const values = await Promise.all(
      relevant.map((k) => env.ANALYTICS_KV.get(k).then((v) => parseInt(v || "0", 10) || 0)),
    );
    relevant.forEach((k, i) => {
      const p = parseEvKey(k, type)!;
      const pos = index.get(p.bucket);
      if (pos !== undefined) arr[pos] += values[i];
    });
    return arr;
  }

  const [views, hires] = await Promise.all([fill("view"), fill("hire")]);
  const points: SeriesPoint[] = buckets.map((b, i) => ({
    ts: new Date(parseBucket(b)).toISOString(),
    views: views[i],
    hires: hires[i],
  }));

  const out: SeriesResponse = {
    agentId,
    window,
    points,
    updatedAt: new Date(now).toISOString(),
    source: "demand",
  };
  return json(out, env, 200, 15);
}

// ------------------------------------------------------------------ //
// Router
// ------------------------------------------------------------------ //
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (!(await underRateLimit(request))) {
      return json({ error: "rate_limited" }, env, 429);
    }

    if (path === "/health" || path === "/") {
      return json({ ok: true, service: "analytics" }, env, 200, 30);
    }

    if (path === "/v1/event") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, env, 405);
      return handleEvent(request, env);
    }

    if (path === "/v1/trending") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, env, 405);
      try {
        return await handleTrending(url, env);
      } catch (err) {
        return json({ error: "internal", detail: String((err as Error).message) }, env, 500);
      }
    }

    if (path.startsWith("/v1/series/")) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, env, 405);
      const agentId = decodeURIComponent(path.slice("/v1/series/".length));
      if (!agentId) return json({ error: "not_found" }, env, 404);
      try {
        return await handleSeries(agentId, url, env);
      } catch (err) {
        return json({ error: "internal", detail: String((err as Error).message) }, env, 500);
      }
    }

    return json({ error: "not_found" }, env, 404);
  },
} satisfies ExportedHandler<Env>;

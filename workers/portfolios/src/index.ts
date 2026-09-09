// index.ts — Worker de agent portfolios (agent-street).
//
// Rol: la capa social/gamificación del marketplace. Guarda SETS de agentes
// user-made ("frequently hired together" + copy-trading), cuenta eventos de
// primera mano (view/copy/hire_all/follow/like) para un leaderboard real, y sirve
// la afinidad "frequently hired together" REAL (co-hires) leída del worker
// hire-x402 (que posee los hires y no filtra wallets).
//
// Patrón reutilizado de workers/analytics y workers/8004-proxy: CORS + KV +
// rate-limit + router. Tipos de salida ESPEJO de app/app/lib/portfolios-client.ts
// (camelCase). Mantener en sync a mano (paquetes separados, sin cross-import).
//
// Data rule (DESIGN.md §18): counters are real (we count them ourselves); no
// invented ROI. The app works WITHOUT this worker (curated sets resolve app-side;
// only user-made sets + gamification live here).
//
// Endpoints:
//   GET    /health
//   POST   /v1/portfolios                      → { slug, ownerSecret }
//   GET    /v1/portfolios?scope=&owner=&limit=  → { portfolios: UserPortfolio[] }
//   GET    /v1/portfolios/leaderboard?metric=&limit= → { rows: LeaderboardRow[] }
//   GET    /v1/portfolios/:slug                 → UserPortfolio (+ stats)
//   PATCH  /v1/portfolios/:slug   (x-owner-secret)
//   DELETE /v1/portfolios/:slug   (x-owner-secret)
//   POST   /v1/portfolios/:slug/event { type }  → { ok }
//   GET    /v1/affinity/:agentId                → AffinityResponse

export interface Env {
  PORTFOLIOS_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  PROXY_8004_URL: string;
  HIRE_X402_URL: string;
  PROXY_8004?: Fetcher;
  HIRE_X402?: Fetcher;
}

// --- Contrato de salida (espeja portfolios-client.ts) ------------------------
type PortfolioEvent = "view" | "copy" | "hire_all" | "follow";
type Counter = "views" | "copies" | "hireAlls" | "followers" | "likes";
/** Discoverability: public (listed), unlisted (link-only), private (owner-only). */
type Visibility = "public" | "unlisted" | "private";

interface Member {
  agentId: string;
  note?: string;
}
interface Creator {
  address: string;
  label?: string;
}
interface StoredPortfolio {
  slug: string;
  name: string;
  tagline: string;
  members: Member[];
  creator: Creator | null;
  createdAt: string;
  source: "user";
  /** Optional on legacy records; absent ⇒ treated as "public" (see visibilityOf). */
  visibility?: Visibility;
}
interface Stats {
  views: number;
  copies: number;
  hireAlls: number;
  followers: number;
  likes: number;
}
type UserPortfolio = StoredPortfolio & { stats: Stats };

const EVENT_COUNTER: Record<PortfolioEvent, Counter> = {
  view: "views",
  copy: "copies",
  hire_all: "hireAlls",
  follow: "followers",
};
const COUNTERS: Counter[] = ["views", "copies", "hireAlls", "followers", "likes"];

/** Legacy records have no `visibility` field — treat them as public. */
function visibilityOf(pf: StoredPortfolio): Visibility {
  return pf.visibility ?? "public";
}
function parseVisibility(v: unknown): Visibility {
  return v === "unlisted" || v === "private" ? v : "public";
}

// --- Límites ------------------------------------------------------------------
const NAME_MAX = 80;
const TAGLINE_MAX = 160;
const MIN_MEMBERS = 2;
const MAX_MEMBERS = 50;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const DEDUP_TTL = 3900; // ~65 min anti doble-conteo por IP+slug+evento+hora.
const BUCKET_TTL = 60 * 60 * 24 * 40; // ~40 días — buckets diarios para el leaderboard con ventana.
const META_TTL = 300; // cache del enriquecimiento 8004-proxy.
const WINDOW_DAYS: Record<string, number> = { "7d": 7, "30d": 30 };
const RL_LIMIT = 200;
const RL_WINDOW_SEC = 60;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

// --- Claves KV ----------------------------------------------------------------
const kPf = (slug: string) => `pf:${slug}`;
const kSecret = (slug: string) => `pfsecret:${slug}`;
const kOwn = (addr: string, slug: string) => `pfown:${addr.toLowerCase()}:${slug}`;
const kOwnPrefix = (addr: string) => `pfown:${addr.toLowerCase()}:`;
const kIdx = (slug: string) => `pfidx:${slug}`;
const IDX_PREFIX = "pfidx:";
const kTotal = (c: Counter, slug: string) => `pftot:${c}:${slug}`;
const kBucket = (c: Counter, slug: string, day: string) => `pfb:${c}:${slug}:${day}`;
const kMeta = (agentId: string) => `meta:${agentId}`;
const kDedup = (ip: string, slug: string, t: PortfolioEvent, bucket: string) =>
  `pfdedup:${ip}:${slug}:${t}:${bucket}`;

// --- CORS / JSON --------------------------------------------------------------
function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-owner-secret",
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

// --- Rate-limit por IP (patrón analytics, sobre caches.default) ---------------
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

// --- Crypto helpers -----------------------------------------------------------
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Constant-time-ish compare over equal-length hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "portfolio"}-${randomHex(3)}`;
}

// --- Time buckets: hourly for dedup, daily for windowed leaderboard ----------
function fmtBucket(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;
}
function fmtDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}
/** The last `days` daily bucket keys (UTC), most recent first. */
function recentDays(days: number): string[] {
  const out: string[] = [];
  const DAY = 86_400_000;
  const now = Date.now();
  for (let i = 0; i < days; i++) out.push(fmtDay(now - i * DAY));
  return out;
}

// --- Contadores ---------------------------------------------------------------
async function readStats(env: Env, slug: string): Promise<Stats> {
  const vals = await Promise.all(
    COUNTERS.map((c) => env.PORTFOLIOS_KV.get(kTotal(c, slug)).then((v) => parseInt(v || "0", 10) || 0)),
  );
  return {
    views: vals[0],
    copies: vals[1],
    hireAlls: vals[2],
    followers: vals[3],
    likes: vals[4],
  };
}
async function bumpCounter(env: Env, c: Counter, slug: string, delta = 1): Promise<void> {
  const cur = parseInt((await env.PORTFOLIOS_KV.get(kTotal(c, slug))) || "0", 10) || 0;
  await env.PORTFOLIOS_KV.put(kTotal(c, slug), String(Math.max(0, cur + delta)));
}
/** Increment today's daily bucket for a counter (windowed leaderboard). */
async function bumpBucket(env: Env, c: Counter, slug: string): Promise<void> {
  const day = fmtDay(Date.now());
  const key = kBucket(c, slug, day);
  const cur = parseInt((await env.PORTFOLIOS_KV.get(key)) || "0", 10) || 0;
  await env.PORTFOLIOS_KV.put(key, String(cur + 1), { expirationTtl: BUCKET_TTL });
}
/** Sum a counter's daily buckets over the last `days` (windowed leaderboard). */
async function sumWindow(env: Env, c: Counter, slug: string, days: number): Promise<number> {
  const keys = recentDays(days).map((d) => kBucket(c, slug, d));
  const vals = await Promise.all(
    keys.map((k) => env.PORTFOLIOS_KV.get(k).then((v) => parseInt(v || "0", 10) || 0)),
  );
  return vals.reduce((s, v) => s + v, 0);
}

// --- Enriquecimiento vía 8004-proxy ------------------------------------------
interface AgentMeta {
  name: string;
  imageUrl: string | null;
  category: string | null;
  categoryLabel: string | null;
}
async function enrich(env: Env, agentId: string): Promise<AgentMeta> {
  const fallback: AgentMeta = { name: agentId, imageUrl: null, category: null, categoryLabel: null };
  const cached = await env.PORTFOLIOS_KV.get(kMeta(agentId), "json");
  if (cached) return cached as AgentMeta;
  try {
    const base = env.PROXY_8004_URL.replace(/\/$/, "");
    const url = `${base}/v1/agents/${encodeURIComponent(agentId)}`;
    const res = env.PROXY_8004
      ? await env.PROXY_8004.fetch(url, { headers: { accept: "application/json" } })
      : await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return fallback;
    const a = (await res.json()) as Record<string, unknown>;
    const meta: AgentMeta = {
      name: typeof a.name === "string" && a.name ? a.name : agentId,
      imageUrl: typeof a.imageUrl === "string" ? a.imageUrl : null,
      category: typeof a.category === "string" ? a.category : null,
      categoryLabel: typeof a.categoryLabel === "string" ? a.categoryLabel : null,
    };
    await env.PORTFOLIOS_KV.put(kMeta(agentId), JSON.stringify(meta), { expirationTtl: META_TTL });
    return meta;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------ //
// POST /v1/portfolios — crear
// ------------------------------------------------------------------ //
async function handleCreate(request: Request, env: Env): Promise<Response> {
  let body: {
    name?: unknown;
    tagline?: unknown;
    members?: unknown;
    creator?: unknown;
    visibility?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_json" }, env, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX) : "";
  const tagline = typeof body.tagline === "string" ? body.tagline.trim().slice(0, TAGLINE_MAX) : "";
  const rawMembers = Array.isArray(body.members) ? body.members : [];
  const members: Member[] = [];
  const seen = new Set<string>();
  for (const m of rawMembers) {
    const agentId =
      typeof m === "string" ? m : m && typeof (m as Member).agentId === "string" ? (m as Member).agentId : "";
    if (!agentId || seen.has(agentId)) continue;
    seen.add(agentId);
    const note =
      m && typeof (m as Member).note === "string" ? (m as Member).note!.slice(0, 120) : undefined;
    members.push(note ? { agentId, note } : { agentId });
    if (members.length >= MAX_MEMBERS) break;
  }

  if (!name || members.length < MIN_MEMBERS) {
    return json({ error: "invalid_portfolio", detail: "name + at least 2 members required" }, env, 422);
  }

  let creator: Creator | null = null;
  const c = body.creator as Creator | undefined;
  if (c && typeof c.address === "string" && ADDR_RE.test(c.address)) {
    creator = { address: c.address.toLowerCase() };
    if (typeof c.label === "string" && c.label.trim()) creator.label = c.label.trim().slice(0, 40);
  }

  // Slug único (reintenta una vez ante colisión improbable).
  let slug = slugify(name);
  if (await env.PORTFOLIOS_KV.get(kPf(slug))) slug = slugify(name);

  const ownerSecret = randomHex(24);
  const record: StoredPortfolio = {
    slug,
    name,
    tagline,
    members,
    creator,
    createdAt: new Date().toISOString(),
    source: "user",
    visibility: parseVisibility(body.visibility),
  };

  await env.PORTFOLIOS_KV.put(kPf(slug), JSON.stringify(record));
  await env.PORTFOLIOS_KV.put(kSecret(slug), await sha256Hex(ownerSecret));
  await env.PORTFOLIOS_KV.put(kIdx(slug), record.createdAt);
  if (creator) await env.PORTFOLIOS_KV.put(kOwn(creator.address, slug), "1");

  return json({ slug, ownerSecret }, env, 201);
}

// ------------------------------------------------------------------ //
// GET /v1/portfolios/:slug — leer (+ stats)
// ------------------------------------------------------------------ //
async function loadPortfolio(env: Env, slug: string): Promise<StoredPortfolio | null> {
  return (await env.PORTFOLIOS_KV.get(kPf(slug), "json")) as StoredPortfolio | null;
}
async function handleGet(request: Request, env: Env, slug: string): Promise<Response> {
  const pf = await loadPortfolio(env, slug);
  if (!pf) return json({ error: "not_found" }, env, 404);
  // Private sets are gated by the device-held owner secret (no wallet auth
  // exists) — a soft privacy: undiscoverable and only fetchable by the owner
  // device. Public/unlisted are open so links can be shared.
  const isPrivate = visibilityOf(pf) === "private";
  if (isPrivate && !(await authOwner(request, env, slug))) {
    return json({ error: "not_found" }, env, 404);
  }
  const stats = await readStats(env, slug);
  return json({ ...pf, stats } satisfies UserPortfolio, env, 200, isPrivate ? 0 : 15);
}

// ------------------------------------------------------------------ //
// GET /v1/portfolios — listar (scope=user|trending, owner, limit)
// ------------------------------------------------------------------ //
async function listAllSlugs(env: Env): Promise<string[]> {
  const slugs: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await env.PORTFOLIOS_KV.list({ prefix: IDX_PREFIX, cursor, limit: 1000 });
    for (const k of res.keys) slugs.push(k.name.slice(IDX_PREFIX.length));
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return slugs;
}
async function handleList(url: URL, env: Env): Promise<Response> {
  const scope = url.searchParams.get("scope") || "user";
  const owner = url.searchParams.get("owner");
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));

  const ownerScoped = !!(owner && ADDR_RE.test(owner));
  let slugs: string[];
  if (ownerScoped) {
    const listing = await env.PORTFOLIOS_KV.list({ prefix: kOwnPrefix(owner!) });
    slugs = listing.keys.map((k) => k.name.slice(kOwnPrefix(owner!).length));
  } else {
    slugs = await listAllSlugs(env);
  }

  const loaded = await Promise.all(
    slugs.map(async (slug) => {
      const pf = await loadPortfolio(env, slug);
      if (!pf) return null;
      const stats = await readStats(env, slug);
      return { ...pf, stats } as UserPortfolio;
    }),
  );
  let portfolios = loaded.filter((p): p is UserPortfolio => p !== null);

  // Public discovery only shows public sets; an owner sees all of their own.
  if (!ownerScoped) portfolios = portfolios.filter((p) => visibilityOf(p) === "public");

  if (scope === "trending") {
    const demand = (p: UserPortfolio) => p.stats.copies * 3 + p.stats.hireAlls * 5 + p.stats.views;
    portfolios.sort((a, b) => demand(b) - demand(a) || (a.createdAt < b.createdAt ? 1 : -1));
  } else {
    portfolios.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
  }

  return json({ portfolios: portfolios.slice(0, limit) }, env, 200, 15);
}

// ------------------------------------------------------------------ //
// GET /v1/portfolios/leaderboard?metric=copies|hires|views
// ------------------------------------------------------------------ //
async function handleLeaderboard(url: URL, env: Env): Promise<Response> {
  const metricRaw = url.searchParams.get("metric") || "copies";
  const counter: Counter =
    metricRaw === "hires" ? "hireAlls" : metricRaw === "views" ? "views" : "copies";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || 12));
  const windowRaw = url.searchParams.get("window") || "all";
  const days = WINDOW_DAYS[windowRaw]; // undefined ⇒ all-time (totals)

  const slugs = await listAllSlugs(env);
  const rows = await Promise.all(
    slugs.map(async (slug) => {
      const pf = await loadPortfolio(env, slug);
      if (!pf) return null;
      if (visibilityOf(pf) !== "public") return null; // only public sets rank
      // Windowed: sum the daily buckets over the range; all-time: read totals.
      const [copies, hireAlls, views] = days
        ? await Promise.all([
            sumWindow(env, "copies", slug, days),
            sumWindow(env, "hireAlls", slug, days),
            sumWindow(env, "views", slug, days),
          ])
        : await readStats(env, slug).then((s) => [s.copies, s.hireAlls, s.views]);
      return { slug, name: pf.name, tagline: pf.tagline, copies, hireAlls, views, creator: pf.creator };
    }),
  );

  const cleaned = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  cleaned.sort((a, b) => (b[counter] as number) - (a[counter] as number));
  // Empty state: no demand in the window → only rows that have some data.
  const withData = cleaned.filter((r) => r.copies + r.hireAlls + r.views > 0);
  return json({ rows: withData.slice(0, limit), window: windowRaw, metric: metricRaw }, env, 200, 30);
}

// ------------------------------------------------------------------ //
// POST /v1/portfolios/:slug/event { type }
// ------------------------------------------------------------------ //
async function handleEvent(request: Request, env: Env, slug: string): Promise<Response> {
  const pf = await loadPortfolio(env, slug);
  if (!pf) return json({ error: "not_found" }, env, 404);

  let body: { type?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_json" }, env, 400);
  }
  const type = body.type as PortfolioEvent | "unfollow" | "like" | "unlike";

  try {
    // Follow/like are per-viewer toggles (client owns idempotency via
    // localStorage) → no server dedup, and can go down as well as up.
    if (type === "follow" || type === "unfollow") {
      await bumpCounter(env, "followers", slug, type === "follow" ? 1 : -1);
      return json({ ok: true }, env, 200);
    }
    if (type === "like" || type === "unlike") {
      await bumpCounter(env, "likes", slug, type === "like" ? 1 : -1);
      return json({ ok: true }, env, 200);
    }

    if (!type || !(type in EVENT_COUNTER)) return json({ error: "invalid_event" }, env, 400);

    // view/copy/hire_all: dedup per IP+hour, then bump the total + today's bucket.
    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const bucket = fmtBucket(Date.now());
    const dk = kDedup(ip, slug, type, bucket);
    if (await env.PORTFOLIOS_KV.get(dk)) return json({ ok: true, deduped: true }, env, 200);
    await env.PORTFOLIOS_KV.put(dk, "1", { expirationTtl: DEDUP_TTL });
    const counter = EVENT_COUNTER[type];
    await Promise.all([bumpCounter(env, counter, slug), bumpBucket(env, counter, slug)]);
    return json({ ok: true }, env, 200);
  } catch {
    return json({ ok: false, error: "store_failed" }, env, 200);
  }
}

// ------------------------------------------------------------------ //
// PATCH / DELETE /v1/portfolios/:slug  (x-owner-secret)
// ------------------------------------------------------------------ //
async function authOwner(request: Request, env: Env, slug: string): Promise<boolean> {
  const secret = request.headers.get("x-owner-secret");
  if (!secret) return false;
  const stored = await env.PORTFOLIOS_KV.get(kSecret(slug));
  if (!stored) return false;
  return timingSafeEqual(await sha256Hex(secret), stored);
}
async function handleUpdate(request: Request, env: Env, slug: string): Promise<Response> {
  const pf = await loadPortfolio(env, slug);
  if (!pf) return json({ error: "not_found" }, env, 404);
  if (!(await authOwner(request, env, slug))) return json({ error: "forbidden" }, env, 403);

  let body: { name?: unknown; tagline?: unknown; members?: unknown; visibility?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_json" }, env, 400);
  }
  if (typeof body.name === "string" && body.name.trim()) pf.name = body.name.trim().slice(0, NAME_MAX);
  if (typeof body.tagline === "string") pf.tagline = body.tagline.trim().slice(0, TAGLINE_MAX);
  if (body.visibility === "public" || body.visibility === "unlisted" || body.visibility === "private") {
    pf.visibility = body.visibility;
  }
  if (Array.isArray(body.members)) {
    const members: Member[] = [];
    const seen = new Set<string>();
    for (const m of body.members) {
      const agentId =
        typeof m === "string" ? m : m && typeof (m as Member).agentId === "string" ? (m as Member).agentId : "";
      if (!agentId || seen.has(agentId)) continue;
      seen.add(agentId);
      members.push({ agentId });
      if (members.length >= MAX_MEMBERS) break;
    }
    if (members.length >= MIN_MEMBERS) pf.members = members;
  }
  await env.PORTFOLIOS_KV.put(kPf(slug), JSON.stringify(pf));
  return json({ ok: true, slug }, env, 200);
}
async function handleDelete(request: Request, env: Env, slug: string): Promise<Response> {
  const pf = await loadPortfolio(env, slug);
  if (!pf) return json({ error: "not_found" }, env, 404);
  if (!(await authOwner(request, env, slug))) return json({ error: "forbidden" }, env, 403);
  await Promise.all([
    env.PORTFOLIOS_KV.delete(kPf(slug)),
    env.PORTFOLIOS_KV.delete(kSecret(slug)),
    env.PORTFOLIOS_KV.delete(kIdx(slug)),
    ...COUNTERS.map((c) => env.PORTFOLIOS_KV.delete(kTotal(c, slug))),
    pf.creator ? env.PORTFOLIOS_KV.delete(kOwn(pf.creator.address, slug)) : Promise.resolve(),
  ]);
  return json({ ok: true }, env, 200);
}

// ------------------------------------------------------------------ //
// GET /v1/affinity/:agentId — "frequently hired together" (real co-hires)
// ------------------------------------------------------------------ //
interface CoHiresResponse {
  agentId: string;
  partners: Array<{ agentId: string; coHires: number }>;
  wallets: number;
  source: string;
}
async function handleAffinity(env: Env, agentId: string): Promise<Response> {
  let partners: Array<{ agentId: string; coHires: number }> = [];
  try {
    const base = env.HIRE_X402_URL.replace(/\/$/, "");
    const url = `${base}/v1/cohires?agent=${encodeURIComponent(agentId)}&limit=8`;
    const res = env.HIRE_X402
      ? await env.HIRE_X402.fetch(url, { headers: { accept: "application/json" } })
      : await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) {
      const body = (await res.json()) as CoHiresResponse;
      if (Array.isArray(body.partners)) partners = body.partners;
    }
  } catch {
    /* hire-x402 down → real empty */
  }

  const metas = await Promise.all(partners.map((p) => enrich(env, p.agentId)));
  const rows = partners.map((p, i) => ({
    agentId: p.agentId,
    name: metas[i].name,
    imageUrl: metas[i].imageUrl,
    category: metas[i].category,
    categoryLabel: metas[i].categoryLabel,
    coHires: p.coHires,
  }));

  return json(
    { agentId, rows, updatedAt: new Date().toISOString(), source: "demand" },
    env,
    200,
    30,
  );
}

// ------------------------------------------------------------------ //
// Router
// ------------------------------------------------------------------ //
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (!(await underRateLimit(request))) return json({ error: "rate_limited" }, env, 429);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    try {
      if (path === "/health" || path === "/") {
        return json({ ok: true, service: "portfolios" }, env, 200, 30);
      }

      // Affinity: /v1/affinity/:agentId
      if (path.startsWith("/v1/affinity/")) {
        if (method !== "GET") return json({ error: "method_not_allowed" }, env, 405);
        const agentId = decodeURIComponent(path.slice("/v1/affinity/".length));
        if (!agentId) return json({ error: "agent_required" }, env, 400);
        return await handleAffinity(env, agentId);
      }

      // Collection: /v1/portfolios [ /leaderboard | /:slug | /:slug/event ]
      if (path === "/v1/portfolios") {
        if (method === "POST") return await handleCreate(request, env);
        if (method === "GET") return await handleList(url, env);
        return json({ error: "method_not_allowed" }, env, 405);
      }
      if (path === "/v1/portfolios/leaderboard") {
        if (method !== "GET") return json({ error: "method_not_allowed" }, env, 405);
        return await handleLeaderboard(url, env);
      }
      if (path.startsWith("/v1/portfolios/")) {
        const rest = path.slice("/v1/portfolios/".length);
        if (rest.endsWith("/event")) {
          const slug = decodeURIComponent(rest.slice(0, -"/event".length));
          if (method !== "POST") return json({ error: "method_not_allowed" }, env, 405);
          return await handleEvent(request, env, slug);
        }
        const slug = decodeURIComponent(rest);
        if (!slug) return json({ error: "not_found" }, env, 404);
        if (method === "GET") return await handleGet(request, env, slug);
        if (method === "PATCH") return await handleUpdate(request, env, slug);
        if (method === "DELETE") return await handleDelete(request, env, slug);
        return json({ error: "method_not_allowed" }, env, 405);
      }

      return json({ error: "not_found" }, env, 404);
    } catch (err) {
      return json({ error: "internal", detail: String((err as Error).message) }, env, 500);
    }
  },
} satisfies ExportedHandler<Env>;

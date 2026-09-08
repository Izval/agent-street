// index.ts — Worker seam de contratación x402 (agent-street · hire-x402).
//
// Rol (roadmap Fase 3): el backend detrás de `HIRE_X402_URL`. Modelo = client-pays
// (Opción 3): el USUARIO firma y envía la transferencia real a `payTo` desde su
// propia wallet (viem/wagmi en el browser). Este worker:
//   1) publica el quote como respuesta HTTP 402 (`GET /v1/quote?agent=…`) cuando el
//      endpoint del agente no habla x402 — pricing honesto del listing del marketplace,
//   2) VERIFICA onchain la tx de pago del usuario (`POST /v1/hire`) y devuelve el
//      `HireReceipt` canónico con la tx real (BscScan testnet). NO firma nada, no
//      custodia claves: cero secretos de firma.
//
// Regla de honestidad (DESIGN.md v2 §18): nada de txHash inventado; si no se puede
// verificar, receipt "pending"/"failed" honesto. Patrón CORS/rate-limit/router
// reutilizado de workers/8004-proxy y workers/onchain-indexer.
//
// Endpoints:
//   GET  /health
//   GET  /v1/quote?agent=:id         → 402 { accepts: [X402Accept] } (o 404/409)
//   POST /v1/hire                     → HireReceipt (verificación onchain)
//   GET  /v1/hires?address=           → historial de hires de una wallet
//   GET  /v1/hires?agent=:id          → hires recientes de un agente (perfil)
//   GET  /v1/cohires?agent=:id        → afinidad "frequently hired together"
//   POST /v1/sessions                 → registra una sesión gestionada (manage flow)
//   GET  /v1/sessions?address=        → sesiones de una identidad (+ used/remaining)
//   POST /v1/sessions/revoke          → marca una sesión revocada (verifica revoke tx)

import {
  ADDR_RE,
  TXHASH_RE,
  buildAccept,
  scaleDown,
  verifyPayment,
  verifyTxSuccess,
  type HireReceipt,
  type X402Accept,
} from "./x402";
import { fetchDeliverable } from "./deliverable";

export interface Env {
  ALLOWED_ORIGIN: string;
  // Historial de contrataciones por wallet (para "Mis agentes"). Cada hire liquidado
  // se persiste bajo la address del pagador. Opcional: sin KV, el hire igual funciona.
  HIRES_KV?: KVNamespace;
  // RPC público BSC testnet (chainId 97).
  BSC_TESTNET_RPC: string;
  // Token de settlement del marketplace (ERC-20) o "native" para BNB.
  PAYMENT_TOKEN: string;
  PAYMENT_TOKEN_SYMBOL: string;
  PAYMENT_TOKEN_DECIMALS: string;
  // Precio del listing en unidades base del token (string). Ej: 0.1 USDT (18 dec).
  HIRE_PRICE_BASE: string;
  // Base del explorer para los links del recibo.
  EXPLORER_BASE: string;
  // URL del 8004-proxy para resolver la wallet del agente (payTo del quote).
  PROXY_8004_URL: string;
  // Service binding al 8004-proxy. Un fetch worker-a-worker por *.workers.dev hace
  // loopback y 404ea en la misma cuenta; en prod resolvemos vía este binding. Ausente
  // en dev local, donde el fetch a PROXY_8004_URL (request externo real) sí funciona.
  PROXY_8004?: Fetcher;
  // Dirección pública del contrato KeyStore de Altana en chain 97 (para el link
  // "ver en el keystore explorer" de una sesión). Opcional; no es una llave.
  ALTANA_KEYSTORE?: string;
}

const NETWORK = "bsc-testnet";
const QUOTE_TTL_SEC = 900; // validez del quote (espeja studio.toml quote_ttl_seconds)
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

function tokenMeta(env: Env): { symbol: string; decimals: number } {
  const decimals = Number(env.PAYMENT_TOKEN_DECIMALS) || 18;
  return { symbol: env.PAYMENT_TOKEN_SYMBOL || "USDT", decimals };
}

// ------------------------------------------------------------------ //
// Quote — resuelve la wallet del agente (payTo) y publica un 402.
// ------------------------------------------------------------------ //

/**
 * Reads the agent's payout wallet from the 8004-proxy. null if it can't resolve.
 * Fully generic per CLAUDE.md §2: no FLAGSHIP override, no per-agent special-casing —
 * every listing (IVL included) resolves its payTo the same way, from its on-chain
 * 8004scan record. An agent that doesn't expose a wallet simply can't be hired yet.
 */
async function resolveAgentPayTo(env: Env, agentId: string): Promise<string | null> {
  try {
    const url = `${env.PROXY_8004_URL.replace(/\/$/, "")}/v1/agents/${encodeURIComponent(agentId)}`;
    const res = env.PROXY_8004
      ? await env.PROXY_8004.fetch(url, { headers: { accept: "application/json" } })
      : await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const a = (await res.json()) as Record<string, unknown>;
    const wallet =
      (typeof a.agentWallet === "string" && a.agentWallet) ||
      (typeof a.ownerAddress === "string" && a.ownerAddress) ||
      null;
    return wallet && ADDR_RE.test(wallet) ? wallet : null;
  } catch {
    return null;
  }
}

async function handleQuote(url: URL, env: Env): Promise<Response> {
  const agentId = url.searchParams.get("agent");
  if (!agentId) return json({ error: "agent_required" }, env, 400);

  const payTo = await resolveAgentPayTo(env, agentId);
  // Sin wallet on-chain del agente no hay a quién pagar → 409 honesto (no inventamos payTo).
  if (!payTo) {
    return json(
      { error: "no_pay_to", detail: "El agente no expone una wallet de cobro onchain." },
      env,
      409,
    );
  }

  const { symbol, decimals } = tokenMeta(env);
  const accept: X402Accept = buildAccept({
    network: NETWORK,
    asset: env.PAYMENT_TOKEN,
    assetSymbol: symbol,
    assetDecimals: decimals,
    payTo,
    amountBase: env.HIRE_PRICE_BASE,
    resource: `${url.origin}/v1/hire?agent=${encodeURIComponent(agentId)}`,
    description: "Rebalance LP (BNB-USDT)",
    maxTimeoutSeconds: QUOTE_TTL_SEC,
  });

  // Respuesta x402 estándar: HTTP 402 con { accepts: [...] }.
  return new Response(
    JSON.stringify({ x402Version: 2, accepts: [accept] }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders(env),
      },
    },
  );
}

// ------------------------------------------------------------------ //
// Hire — verifica onchain la tx de pago del usuario.
// ------------------------------------------------------------------ //

interface HireBody {
  agentId?: unknown;
  agentName?: unknown;
  endpoint?: unknown;
  task?: unknown;
  accept?: unknown;
  txHash?: unknown;
  from?: unknown;
  sessionId?: unknown;
}

/** Registro de una contratación liquidada (para "Mis agentes"). */
export interface HireRecord {
  agentId: string;
  agentName: string | null;
  task: string | null;
  amount: number | null;
  assetSymbol: string | null;
  network: string;
  txHash: string;
  explorerUrl: string | null;
  payTo: string;
  settledAt: string;
  /** id de la sesión gestionada bajo la que se contrató (manage flow). null = pago directo. */
  sessionId: string | null;
}

const hireKey = (addr: string, txHash: string) =>
  `hire:${addr.toLowerCase()}:${txHash.toLowerCase()}`;
const HIRE_PREFIX = (addr: string) => `hire:${addr.toLowerCase()}:`;

/** Persiste un hire liquidado bajo la wallet del pagador (best-effort). */
async function recordHire(
  env: Env,
  from: string,
  rec: HireRecord,
): Promise<void> {
  if (!env.HIRES_KV) return;
  try {
    await env.HIRES_KV.put(hireKey(from, rec.txHash), JSON.stringify(rec));
  } catch {
    /* best-effort: no romper el recibo por un fallo de persistencia */
  }
}

/**
 * GET /v1/cohires?agent=:id&limit= — afinidad "frequently hired together".
 *
 * Agrega los hires liquidados por wallet y devuelve, para el agente ancla, los
 * OTROS agentes que las mismas wallets también contrataron (conteo real de
 * co-hires). NO expone direcciones — solo pares de agentIds + un total de
 * wallets. Es el dato honesto detrás del rail del marketplace; el worker de
 * portfolios lo consume vía binding y lo enriquece con nombres/categorías.
 */
async function handleCohires(url: URL, env: Env): Promise<Response> {
  const agentId = url.searchParams.get("agent");
  if (!agentId) return json({ error: "agent_required" }, env, 400);
  const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit")) || 8));

  if (!env.HIRES_KV) {
    return json({ agentId, partners: [], wallets: 0, source: "unavailable" }, env, 200);
  }

  // Grupo de agentes contratados por cada wallet (address → set de agentIds).
  const byWallet = new Map<string, Set<string>>();
  let cursor: string | undefined;
  do {
    const res = await env.HIRES_KV.list({ prefix: "hire:", cursor, limit: 1000 });
    for (const k of res.keys) {
      // key = hire:{addr}:{txHash} — addr es el 2º segmento (hex sin ':').
      const parts = k.name.split(":");
      if (parts.length < 3) continue;
      const addr = parts[1];
      const rec = (await env.HIRES_KV.get(k.name, "json")) as HireRecord | null;
      if (!rec || !rec.agentId) continue;
      let set = byWallet.get(addr);
      if (!set) {
        set = new Set<string>();
        byWallet.set(addr, set);
      }
      set.add(rec.agentId);
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);

  // Cuenta co-hires: por cada wallet que contrató al ancla, tallar sus otros agentes.
  const tally = new Map<string, number>();
  let wallets = 0;
  for (const set of byWallet.values()) {
    if (!set.has(agentId)) continue;
    wallets++;
    for (const other of set) {
      if (other === agentId) continue;
      tally.set(other, (tally.get(other) ?? 0) + 1);
    }
  }

  const partners = [...tally.entries()]
    .map(([id, coHires]) => ({ agentId: id, coHires }))
    .sort((a, b) => b.coHires - a.coHires || (a.agentId < b.agentId ? -1 : 1))
    .slice(0, limit);

  return json({ agentId, partners, wallets, source: "kv" }, env, 200, 30);
}

/**
 * GET /v1/hires?address=  — historial de contrataciones de una wallet.
 * GET /v1/hires?agent=:id — hires recientes DE un agente (feed del perfil).
 *
 * El modo `agent` escanea todos los `hire:` y filtra por agentId (igual que
 * cohires). No expone wallets: solo el registro del hire (tx, monto, cuándo).
 */
async function handleHires(url: URL, env: Env): Promise<Response> {
  const agentId = url.searchParams.get("agent");
  if (agentId) return handleAgentHires(agentId, url, env);

  const address = url.searchParams.get("address");
  if (!address || !ADDR_RE.test(address)) {
    return json({ error: "invalid_address" }, env, 400);
  }
  if (!env.HIRES_KV) {
    return json({ address, hires: [], source: "unavailable" }, env, 200);
  }
  const out: HireRecord[] = [];
  const listing = await env.HIRES_KV.list({ prefix: HIRE_PREFIX(address) });
  for (const k of listing.keys) {
    const rec = (await env.HIRES_KV.get(k.name, "json")) as HireRecord | null;
    if (rec) out.push(rec);
  }
  out.sort((a, b) => (a.settledAt < b.settledAt ? 1 : -1));
  return json({ address: address.toLowerCase(), hires: out, source: "kv" }, env, 200);
}

/** Hires liquidados de UN agente (recientes primero). Escaneo de `hire:` +
 *  filtro por agentId; sin direcciones en la salida (solo el registro). */
async function handleAgentHires(agentId: string, url: URL, env: Env): Promise<Response> {
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 12));
  if (!env.HIRES_KV) {
    return json({ agentId, hires: [], source: "unavailable" }, env, 200);
  }
  const out: HireRecord[] = [];
  let cursor: string | undefined;
  do {
    const res = await env.HIRES_KV.list({ prefix: "hire:", cursor, limit: 1000 });
    for (const k of res.keys) {
      const rec = (await env.HIRES_KV.get(k.name, "json")) as HireRecord | null;
      if (rec && rec.agentId === agentId) out.push(rec);
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  out.sort((a, b) => (a.settledAt < b.settledAt ? 1 : -1));
  return json({ agentId, hires: out.slice(0, limit), source: "kv" }, env, 200, 30);
}

// ------------------------------------------------------------------ //
// Managed sessions (manage flow · Altana account sessions).
//
// A session = scoped delegation with a per-token spend cap + expiry, granted
// on-chain via the Altana account/keystore (chain 97) and revocable in one tx.
// The CLIENT signs the grant/revoke through the Altana SDK + relay; this worker
// stays KEYLESS — it only (a) verifies the grant/revoke tx succeeded on-chain
// when a hash is available and (b) persists the session record so /manage and
// /me can render it. The keystore contract itself is the on-chain source of
// truth; we never fabricate a tx hash (DESIGN.md §18).
// ------------------------------------------------------------------ //

interface StoredSpendCap {
  token: string | null;
  limitBase: string;
  period: string;
  symbol: string | null;
  decimals: number | null;
}

/** Sesión persistida bajo la identidad del owner (manage flow). */
interface SessionRecord {
  id: string; // session key public key — id único + handle de revocación
  walletAddress: string; // Altana smart-account sobre la que actúa la sesión
  spend: StoredSpendCap[];
  allowlist: string[]; // agentIds permitidos (vacío = cualquiera)
  expiry: number; // unix seconds
  network: string;
  grantTxHash: string | null;
  grantExplorerUrl: string | null;
  /** true una vez revocada (persiste el estado aunque el relay no dé tx hash). */
  revoked: boolean;
  revokeTxHash: string | null;
  revokeExplorerUrl: string | null;
  createdAt: string;
}

type SessionStatus = "active" | "expired" | "revoked";

const sessionKey = (owner: string, id: string) =>
  `session:${owner.toLowerCase()}:${id.toLowerCase()}`;
const SESSION_PREFIX = (owner: string) => `session:${owner.toLowerCase()}:`;

function sessionStatus(rec: SessionRecord, nowSec: number): SessionStatus {
  if (rec.revoked || rec.revokeTxHash) return "revoked";
  if (rec.expiry && nowSec >= rec.expiry) return "expired";
  return "active";
}

/** Suma el gasto (de-scaled) de los hires liquidados bajo una sesión. */
async function sumSessionSpend(
  env: Env,
  owner: string,
  sessionId: string,
): Promise<number> {
  if (!env.HIRES_KV) return 0;
  let used = 0;
  const listing = await env.HIRES_KV.list({ prefix: HIRE_PREFIX(owner) });
  for (const k of listing.keys) {
    const rec = (await env.HIRES_KV.get(k.name, "json")) as HireRecord | null;
    if (rec && rec.sessionId === sessionId && typeof rec.amount === "number") {
      used += rec.amount;
    }
  }
  return used;
}

/** Serializa un SessionRecord a la forma pública `Session` (con status + used/remaining). */
function toSessionView(rec: SessionRecord, nowSec: number, used: number) {
  const cap = rec.spend[0];
  let remaining: number | null = null;
  if (cap && /^\d+$/.test(cap.limitBase)) {
    const limit = scaleDown(BigInt(cap.limitBase), cap.decimals ?? 18);
    remaining = Math.max(0, limit - used);
  }
  return {
    id: rec.id,
    walletAddress: rec.walletAddress,
    spend: rec.spend,
    allowlist: rec.allowlist,
    expiry: rec.expiry,
    network: rec.network,
    status: sessionStatus(rec, nowSec),
    grantTxHash: rec.grantTxHash,
    grantExplorerUrl: rec.grantExplorerUrl,
    revokeTxHash: rec.revokeTxHash,
    revokeExplorerUrl: rec.revokeExplorerUrl,
    createdAt: rec.createdAt,
    usedAmount: used,
    remainingAmount: remaining,
  };
}

interface CreateSessionBody {
  owner?: unknown;
  walletAddress?: unknown;
  id?: unknown; // session publicKey
  spend?: unknown;
  allowlist?: unknown;
  expiry?: unknown;
  grantTxHash?: unknown;
  network?: unknown;
}

const VALID_PERIODS = new Set([
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
]);

function normalizeSpend(v: unknown): StoredSpendCap[] {
  if (!Array.isArray(v)) return [];
  const out: StoredSpendCap[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const limitBase = typeof o.limitBase === "string" ? o.limitBase : "";
    const period = typeof o.period === "string" ? o.period : "";
    if (!/^\d+$/.test(limitBase) || !VALID_PERIODS.has(period)) continue;
    out.push({
      token:
        typeof o.token === "string" && ADDR_RE.test(o.token) ? o.token : null,
      limitBase,
      period,
      symbol: typeof o.symbol === "string" ? o.symbol : null,
      decimals: typeof o.decimals === "number" ? o.decimals : null,
    });
  }
  return out;
}

/** POST /v1/sessions — registra una sesión concedida (verifica el grant tx si lo hay). */
async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  let body: CreateSessionBody;
  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    return json({ error: "invalid_json" }, env, 400);
  }

  const owner = typeof body.owner === "string" ? body.owner : "";
  const walletAddress =
    typeof body.walletAddress === "string" ? body.walletAddress : "";
  const id = typeof body.id === "string" ? body.id : "";
  const expiry = typeof body.expiry === "number" ? body.expiry : 0;
  const spend = normalizeSpend(body.spend);
  const allowlist = Array.isArray(body.allowlist)
    ? body.allowlist.filter((a): a is string => typeof a === "string")
    : [];
  const grantTxHash =
    typeof body.grantTxHash === "string" && TXHASH_RE.test(body.grantTxHash)
      ? body.grantTxHash
      : null;

  if (!ADDR_RE.test(owner)) return json({ error: "invalid_owner" }, env, 422);
  if (!ADDR_RE.test(walletAddress))
    return json({ error: "invalid_wallet" }, env, 422);
  if (!/^0x[0-9a-fA-F]{2,}$/.test(id)) return json({ error: "invalid_id" }, env, 422);
  if (!Number.isFinite(expiry) || expiry <= 0)
    return json({ error: "invalid_expiry" }, env, 422);
  if (spend.length === 0) return json({ error: "invalid_spend" }, env, 422);

  // Si el cliente aportó el tx del grant, lo verificamos onchain (honesto). El
  // relay de Altana puede confirmar sin surfacear un hash → grantTxHash null.
  if (grantTxHash) {
    const v = await verifyTxSuccess(env.BSC_TESTNET_RPC, grantTxHash);
    if (v.status === "pending") {
      return json({ status: "pending", detail: v.detail }, env, 202);
    }
    if (v.status === "failed") {
      return json({ error: "grant_tx_failed", detail: v.detail }, env, 422);
    }
  }

  const explorer = env.EXPLORER_BASE.replace(/\/$/, "");
  const rec: SessionRecord = {
    id,
    walletAddress,
    spend,
    allowlist,
    expiry,
    network: NETWORK,
    grantTxHash,
    grantExplorerUrl: grantTxHash ? `${explorer}/tx/${grantTxHash}` : null,
    revoked: false,
    revokeTxHash: null,
    revokeExplorerUrl: null,
    createdAt: new Date().toISOString(),
  };

  if (env.HIRES_KV) {
    try {
      await env.HIRES_KV.put(sessionKey(owner, id), JSON.stringify(rec));
    } catch {
      /* best-effort */
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  return json(toSessionView(rec, nowSec, 0), env, 200);
}

/** GET /v1/sessions?address= — sesiones de una identidad, con status + used/remaining. */
async function handleSessions(url: URL, env: Env): Promise<Response> {
  const address = url.searchParams.get("address");
  if (!address || !ADDR_RE.test(address)) {
    return json({ error: "invalid_address" }, env, 400);
  }
  if (!env.HIRES_KV) {
    return json({ address, sessions: [], source: "unavailable" }, env, 200);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const listing = await env.HIRES_KV.list({ prefix: SESSION_PREFIX(address) });
  const sessions = [];
  for (const k of listing.keys) {
    const rec = (await env.HIRES_KV.get(k.name, "json")) as SessionRecord | null;
    if (!rec) continue;
    const used = await sumSessionSpend(env, address, rec.id);
    sessions.push(toSessionView(rec, nowSec, used));
  }
  sessions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ address: address.toLowerCase(), sessions, source: "kv" }, env, 200);
}

interface RevokeSessionBody {
  owner?: unknown;
  id?: unknown;
  revokeTxHash?: unknown;
}

/** POST /v1/sessions/revoke — marca una sesión revocada (verifica el revoke tx si lo hay). */
async function handleRevokeSession(request: Request, env: Env): Promise<Response> {
  let body: RevokeSessionBody;
  try {
    body = (await request.json()) as RevokeSessionBody;
  } catch {
    return json({ error: "invalid_json" }, env, 400);
  }
  const owner = typeof body.owner === "string" ? body.owner : "";
  const id = typeof body.id === "string" ? body.id : "";
  const revokeTxHash =
    typeof body.revokeTxHash === "string" && TXHASH_RE.test(body.revokeTxHash)
      ? body.revokeTxHash
      : null;

  if (!ADDR_RE.test(owner)) return json({ error: "invalid_owner" }, env, 422);
  if (!/^0x[0-9a-fA-F]{2,}$/.test(id)) return json({ error: "invalid_id" }, env, 422);
  if (!env.HIRES_KV) return json({ error: "kv_unavailable" }, env, 503);

  const rec = (await env.HIRES_KV.get(sessionKey(owner, id), "json")) as
    | SessionRecord
    | null;
  if (!rec) return json({ error: "session_not_found" }, env, 404);

  if (revokeTxHash) {
    const v = await verifyTxSuccess(env.BSC_TESTNET_RPC, revokeTxHash);
    if (v.status === "pending") {
      return json({ status: "pending", detail: v.detail }, env, 202);
    }
    if (v.status === "failed") {
      return json({ error: "revoke_tx_failed", detail: v.detail }, env, 422);
    }
  }

  const explorer = env.EXPLORER_BASE.replace(/\/$/, "");
  rec.revoked = true;
  rec.revokeTxHash = revokeTxHash;
  rec.revokeExplorerUrl = revokeTxHash ? `${explorer}/tx/${revokeTxHash}` : null;
  try {
    await env.HIRES_KV.put(sessionKey(owner, id), JSON.stringify(rec));
  } catch {
    /* best-effort */
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const used = await sumSessionSpend(env, owner, id);
  return json(toSessionView(rec, nowSec, used), env, 200);
}

function isAccept(v: unknown): v is X402Accept {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.asset === "string" &&
    typeof o.payTo === "string" &&
    typeof o.maxAmountRequired === "string"
  );
}

async function handleHire(request: Request, env: Env): Promise<Response> {
  let body: HireBody;
  try {
    body = (await request.json()) as HireBody;
  } catch {
    return json({ error: "invalid_json" }, env, 400);
  }

  const txHash = typeof body.txHash === "string" ? body.txHash : "";
  const accept = body.accept;
  const from = typeof body.from === "string" ? body.from : null;

  if (!isAccept(accept)) return json({ error: "invalid_accept" }, env, 422);
  if (!TXHASH_RE.test(txHash)) {
    // Sin tx no hay settlement: recibo pending honesto (nunca inventamos txHash).
    const receipt: HireReceipt = {
      status: "pending",
      txHash: null,
      explorerUrl: null,
      amount: null,
      assetSymbol: null,
      settledAt: null,
      detail: "No se recibió una transacción de pago para verificar.",
    };
    return json(receipt, env, 200);
  }
  if (from && !ADDR_RE.test(from)) return json({ error: "invalid_from" }, env, 422);
  if (!ADDR_RE.test(accept.payTo)) return json({ error: "invalid_pay_to" }, env, 422);

  const { symbol, decimals } = tokenMeta(env);
  const result = await verifyPayment({
    rpcUrl: env.BSC_TESTNET_RPC,
    txHash,
    accept,
    from,
    // El símbolo/decimales del asset del quote (extra) con fallback al token del worker.
    assetSymbol:
      (accept.extra && typeof accept.extra.symbol === "string" && accept.extra.symbol) ||
      symbol,
    assetDecimals:
      (accept.extra && typeof accept.extra.decimals === "number" && accept.extra.decimals) ||
      decimals,
    explorerBase: env.EXPLORER_BASE,
  });

  if (result.ok) {
    // Payment settled. Now dispatch the task to the agent's OWN published endpoint
    // (generic marketplace seam) and attach whatever work-product it returns. This
    // is best-effort: on no endpoint / timeout / non-conforming reply the receipt
    // stays payment-only. Never fabricated, never conditional on which agent it is.
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const task = typeof body.task === "string" ? body.task : "";
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const deliverable = endpoint ? await fetchDeliverable(endpoint, task, from, agentId) : null;
    const receipt: HireReceipt = deliverable
      ? { ...result.receipt, deliverable }
      : result.receipt;

    // Persistir el hire liquidado bajo la wallet del pagador (para "Mis agentes").
    if (from) {
      const r = result.receipt;
      await recordHire(env, from, {
        agentId,
        agentName: typeof body.agentName === "string" ? body.agentName : null,
        task: task || null,
        amount: r.amount,
        assetSymbol: r.assetSymbol,
        network: NETWORK,
        txHash: r.txHash!,
        explorerUrl: r.explorerUrl,
        payTo: accept.payTo,
        settledAt: r.settledAt ?? new Date().toISOString(),
        sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      });
    }
    return json(receipt, env, 200);
  }

  const receipt: HireReceipt = {
    status: result.status,
    txHash: result.status === "failed" ? txHash : null,
    explorerUrl:
      result.status === "failed"
        ? `${env.EXPLORER_BASE.replace(/\/$/, "")}/tx/${txHash}`
        : null,
    amount: null,
    assetSymbol: null,
    settledAt: null,
    detail: result.detail,
  };
  return json(receipt, env, 200);
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

    try {
      if (request.method === "POST") {
        if (path === "/v1/hire") return await handleHire(request, env);
        if (path === "/v1/sessions/revoke")
          return await handleRevokeSession(request, env);
        if (path === "/v1/sessions")
          return await handleCreateSession(request, env);
        return json({ error: "not_found" }, env, 404);
      }
      if (request.method !== "GET") {
        return json({ error: "method_not_allowed" }, env, 405);
      }

      if (path === "/health" || path === "/") {
        return json(
          { ok: true, service: "hire-x402", network: NETWORK, token: env.PAYMENT_TOKEN_SYMBOL },
          env,
          200,
          30,
        );
      }
      if (path === "/v1/quote") return await handleQuote(url, env);
      if (path === "/v1/hires") return await handleHires(url, env);
      if (path === "/v1/sessions") return await handleSessions(url, env);
      if (path === "/v1/cohires") return await handleCohires(url, env);

      return json({ error: "not_found" }, env, 404);
    } catch (err) {
      return json(
        { error: "worker_error", detail: String((err as Error).message) },
        env,
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;

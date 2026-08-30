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
//   GET  /v1/quote?agent=:id        → 402 { accepts: [X402Accept] } (o 404/409)
//   POST /v1/hire                    → HireReceipt (verificación onchain)

import {
  ADDR_RE,
  TXHASH_RE,
  buildAccept,
  verifyPayment,
  type HireReceipt,
  type X402Accept,
} from "./x402";

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
  // Override de payTo para el flagship IVL (seed curado, no vive en 8004scan).
  // Es una DIRECCIÓN PÚBLICA de cobro — nunca una llave. Opcional.
  FLAGSHIP_AGENT_ID?: string;
  FLAGSHIP_PAYTO?: string;
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

/** Lee la wallet de cobro del agente desde el 8004-proxy. null si no se resuelve. */
async function resolveAgentPayTo(env: Env, agentId: string): Promise<string | null> {
  // Flagship IVL: seed curado (no está en 8004scan) → payTo por override de env.
  if (
    env.FLAGSHIP_AGENT_ID &&
    env.FLAGSHIP_PAYTO &&
    agentId === env.FLAGSHIP_AGENT_ID &&
    ADDR_RE.test(env.FLAGSHIP_PAYTO)
  ) {
    return env.FLAGSHIP_PAYTO;
  }
  try {
    const url = `${env.PROXY_8004_URL.replace(/\/$/, "")}/v1/agents/${encodeURIComponent(agentId)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
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

/** GET /v1/hires?address= — historial de contrataciones de una wallet. */
async function handleHires(url: URL, env: Env): Promise<Response> {
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
    // Persistir el hire liquidado bajo la wallet del pagador (para "Mis agentes").
    if (from) {
      const r = result.receipt;
      await recordHire(env, from, {
        agentId: typeof body.agentId === "string" ? body.agentId : "",
        agentName: typeof body.agentName === "string" ? body.agentName : null,
        task: typeof body.task === "string" ? body.task : null,
        amount: r.amount,
        assetSymbol: r.assetSymbol,
        network: NETWORK,
        txHash: r.txHash!,
        explorerUrl: r.explorerUrl,
        payTo: accept.payTo,
        settledAt: r.settledAt ?? new Date().toISOString(),
      });
    }
    return json(result.receipt, env, 200);
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

// index.ts — Worker indexer onchain BSC (agent-street · WS1.2).
//
// Rol: leer datos REALES de un agent_wallet en BSC mainnet (chainId 56) y servirlos
// con las formas del contrato `app/app/lib/contracts.ts` (PortfolioResponse / TradesResponse).
// NO inventa datos. Fuentes:
//   - Balances: RPC público BSC (eth_getBalance + eth_call balanceOf) — keyless.
//   - Precios USD: DexScreener /latest/dex/tokens/{addrs} (pairs[].priceUsd) — keyless.
//   - Trades: BscScan tokentx (API key opcional via env.BSCSCAN_API_KEY).
// Patrón reutilizado del Worker 8004-proxy: CORS + KV cache + rate-limit + router por path.
//
// Endpoints:
//   GET /health                 → { ok:true, service:"onchain-indexer" }
//   GET /v1/portfolio/:address  → PortfolioResponse
//   GET /v1/trades/:address     → TradesResponse

import { TOKENS, WBNB_ADDRESS, type TokenMeta } from "./tokens";

export interface Env {
  INDEXER_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  // RPC público BSC mainnet.
  BSC_RPC_URL: string;
  // Secret opcional: `wrangler secret put BSCSCAN_API_KEY`. Sube el rate-limit de trades.
  BSCSCAN_API_KEY?: string;
}

const CHAIN_ID = 56; // BSC mainnet.

// --- Formas del contrato (espejo de app/app/lib/contracts.ts) ---
interface Holding {
  symbol: string;
  name: string;
  tokenAddress: string; // "native" para BNB
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  pct: number | null;
}
interface PortfolioResponse {
  address: string;
  chainId: number;
  totalUsd: number;
  fullyPriced: boolean;
  holdings: Holding[];
  updatedAt: string;
  source: "onchain";
}
type TradeSide = "buy" | "sell" | "swap";
interface Trade {
  hash: string;
  ts: string;
  side: TradeSide;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  valueUsd: number | null;
  dex: string | null;
  explorerUrl: string;
}
interface TradesResponse {
  address: string;
  chainId: number;
  count: number;
  trades: Trade[];
  updatedAt: string;
  source: "onchain";
}

// --- Cache TTLs (KV) & rate-limit (patrón 8004-proxy) ---
const PORTFOLIO_CACHE_SEC = 120;
const TRADES_CACHE_SEC = 180;
const PRICE_CACHE_SEC = 300;
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
  if (cacheSeconds > 0) headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  return new Response(JSON.stringify(data), { status, headers });
}

// ------------------------------------------------------------------ //
// Utilidades onchain
// ------------------------------------------------------------------ //

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

/** BigInt escalado a número decimal humano, sin overflow para saldos grandes. */
function scaleDown(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0;
  const neg = raw < 0n;
  const s = (neg ? -raw : raw).toString().padStart(decimals + 1, "0");
  const cut = s.length - decimals;
  const intPart = s.slice(0, cut) || "0";
  const fracPart = s.slice(cut).replace(/0+$/, "");
  const numStr = fracPart ? `${intPart}.${fracPart}` : intPart;
  const n = Number(numStr);
  return neg ? -n : n;
}

/** Ejecuta un batch JSON-RPC contra el RPC público. Devuelve resultados por id. */
async function rpcBatch(
  env: Env,
  calls: Array<{ method: string; params: unknown[] }>,
): Promise<Array<unknown>> {
  const payload = calls.map((c, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: c.method,
    params: c.params,
  }));
  const res = await fetch(env.BSC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const body = (await res.json()) as
    | Array<{ id: number; result?: unknown; error?: unknown }>
    | { id: number; result?: unknown; error?: unknown };
  const arr = Array.isArray(body) ? body : [body];
  const out: unknown[] = new Array(calls.length).fill(undefined);
  for (const item of arr) {
    if (item && typeof item.id === "number") out[item.id] = item.result;
  }
  return out;
}

/** calldata balanceOf(address) = selector 0x70a08231 + address left-padded a 32 bytes. */
function balanceOfData(address: string): string {
  return "0x70a08231" + "0".repeat(24) + address.toLowerCase().replace(/^0x/, "");
}

function hexToBigInt(v: unknown): bigint {
  if (typeof v !== "string" || !v.startsWith("0x") || v === "0x") return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

// ------------------------------------------------------------------ //
// Precios USD — DexScreener (keyless). Cache del mapa en KV.
// ------------------------------------------------------------------ //

interface DexPair {
  chainId?: string;
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd?: number };
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
}

/**
 * Mapa lowercase(address) → priceUsd. DexScreener /tokens/{addrs} devuelve como
 * mucho ~30 pares TOTALES por respuesta, así que un solo batch de 25 tokens deja
 * fuera a los menos líquidos. Se trocea en grupos pequeños (paralelos) y se fusiona.
 * WBNB casi nunca es token base: su precio se deriva de pares donde es quote
 * (wbnbUsd = priceUsd(base) / priceNative(base en WBNB)). Cache del mapa en KV.
 */
async function fetchPrices(
  env: Env,
  addresses: string[],
): Promise<Record<string, number>> {
  const cacheKey = "prices:v3:bsc:curated";
  const cached = await env.INDEXER_KV.get(cacheKey, "json");
  if (cached) return cached as Record<string, number>;

  const map: Record<string, number> = {};
  const bestLiq: Record<string, number> = {}; // liquidez del par base elegido
  let wbnbLiq = -1; // liquidez del par quote elegido para derivar WBNB

  const ingest = (pairs: DexPair[]) => {
    for (const p of pairs) {
      if (p.chainId && p.chainId !== "bsc") continue;
      const liq = p.liquidity?.usd ?? 0;
      const price = p.priceUsd ? Number(p.priceUsd) : NaN;
      if (!isFinite(price) || price <= 0) continue;

      const baseAddr = p.baseToken?.address?.toLowerCase();
      if (baseAddr && (map[baseAddr] === undefined || liq > (bestLiq[baseAddr] ?? -1))) {
        map[baseAddr] = price;
        bestLiq[baseAddr] = liq;
      }

      // Derivar WBNB cuando actúa como quote.
      const quoteAddr = p.quoteToken?.address?.toLowerCase();
      const pNative = p.priceNative ? Number(p.priceNative) : NaN;
      if (quoteAddr === WBNB_ADDRESS && isFinite(pNative) && pNative > 0 && liq > wbnbLiq) {
        map[WBNB_ADDRESS] = price / pNative;
        wbnbLiq = liq;
      }
    }
  };

  // Trocear en grupos de 5 para respetar el cap de ~30 pares por respuesta.
  const CHUNK = 5;
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += CHUNK) chunks.push(addresses.slice(i, i + CHUNK));

  const results = await Promise.all(
    chunks.map(async (group) => {
      try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${group.join(",")}`;
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) return [] as DexPair[];
        const body = (await res.json()) as { pairs?: DexPair[] };
        return body.pairs ?? [];
      } catch {
        return [] as DexPair[];
      }
    }),
  );
  for (const pairs of results) ingest(pairs);

  await env.INDEXER_KV.put(cacheKey, JSON.stringify(map), {
    expirationTtl: PRICE_CACHE_SEC,
  });
  return map;
}

// ------------------------------------------------------------------ //
// Portfolio
// ------------------------------------------------------------------ //

async function getPortfolio(env: Env, address: string): Promise<PortfolioResponse> {
  const addr = address.toLowerCase();
  const cacheKey = `portfolio:v1:${addr}`;
  const cached = await env.INDEXER_KV.get(cacheKey, "json");
  if (cached) return cached as PortfolioResponse;

  // 1) Balances onchain: eth_getBalance (nativo) + balanceOf por token, en un batch.
  const calls: Array<{ method: string; params: unknown[] }> = [
    { method: "eth_getBalance", params: [addr, "latest"] },
    ...TOKENS.map((t) => ({
      method: "eth_call",
      params: [{ to: t.address, data: balanceOfData(addr) }, "latest"],
    })),
  ];
  const results = await rpcBatch(env, calls);

  const nativeRaw = hexToBigInt(results[0]);
  const tokenRaws: Array<{ token: TokenMeta; raw: bigint }> = TOKENS.map((t, i) => ({
    token: t,
    raw: hexToBigInt(results[i + 1]),
  }));

  // 2) Precios (DexScreener, keyless, cacheado). BNB nativo usa el precio de WBNB.
  const prices = await fetchPrices(env, TOKENS.map((t) => t.address));

  // 3) Construir holdings (excluir amount 0).
  const holdings: Holding[] = [];

  const bnbAmount = scaleDown(nativeRaw, 18);
  if (bnbAmount > 0) {
    const bnbPrice = prices[WBNB_ADDRESS] ?? null;
    holdings.push({
      symbol: "BNB",
      name: "BNB (native)",
      tokenAddress: "native",
      amount: bnbAmount,
      priceUsd: bnbPrice,
      valueUsd: bnbPrice != null ? bnbAmount * bnbPrice : null,
      pct: null,
    });
  }

  for (const { token, raw } of tokenRaws) {
    const amount = scaleDown(raw, token.decimals);
    if (amount <= 0) continue;
    const price = prices[token.address] ?? null;
    holdings.push({
      symbol: token.symbol,
      name: token.name,
      tokenAddress: token.address,
      amount,
      priceUsd: price,
      valueUsd: price != null ? amount * price : null,
      pct: null,
    });
  }

  // 4) Totales + pct + fullyPriced.
  const totalUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  for (const h of holdings) {
    if (h.valueUsd != null && totalUsd > 0) h.pct = (h.valueUsd / totalUsd) * 100;
  }
  const fullyPriced = holdings.every((h) => h.priceUsd != null);

  // Orden: por valor conocido desc, luego los sin precio.
  holdings.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));

  const out: PortfolioResponse = {
    address: addr,
    chainId: CHAIN_ID,
    totalUsd,
    fullyPriced,
    holdings,
    updatedAt: new Date().toISOString(),
    source: "onchain",
  };
  await env.INDEXER_KV.put(cacheKey, JSON.stringify(out), {
    expirationTtl: PORTFOLIO_CACHE_SEC,
  });
  return out;
}

// ------------------------------------------------------------------ //
// Trades — BscScan tokentx (API key opcional)
// ------------------------------------------------------------------ //

const STABLE_OR_BASE = new Set([
  "USDT", "USDC", "BUSD", "FDUSD", "DAI", "TUSD", "WBNB", "BNB",
]);

interface TokenTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

async function getTrades(env: Env, address: string): Promise<TradesResponse> {
  const addr = address.toLowerCase();
  const cacheKey = `trades:v1:${addr}`;
  const cached = await env.INDEXER_KV.get(cacheKey, "json");
  if (cached) return cached as TradesResponse;

  const empty: TradesResponse = {
    address: addr,
    chainId: CHAIN_ID,
    count: 0,
    trades: [],
    updatedAt: new Date().toISOString(),
    source: "onchain",
  };

  let rows: TokenTx[] = [];
  try {
    // Etherscan API V2 multichain (chainid=56 = BSC). El endpoint clásico
    // api.bscscan.com V1 quedó DEPRECADO (responde NOTOK). La misma API key de
    // Etherscan/BscScan (env.BSCSCAN_API_KEY) sirve aquí. Sin key → NOTOK →
    // result no-array → estado vacío honesto (abajo).
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", String(CHAIN_ID));
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", addr);
    url.searchParams.set("sort", "desc");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "200");
    if (env.BSCSCAN_API_KEY) url.searchParams.set("apikey", env.BSCSCAN_API_KEY);

    const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (res.ok) {
      const body = (await res.json()) as { status?: string; result?: unknown };
      if (Array.isArray(body.result)) rows = body.result as TokenTx[];
    }
  } catch {
    // Estado vacío honesto (200) si BscScan falla / no hay key.
  }

  if (rows.length === 0) {
    // No cacheamos el vacío para reintentar pronto una vez haya key/disponibilidad.
    return empty;
  }

  // Agrupar transferencias por hash: una tx de swap tiene salida (from=wallet) y
  // entrada (to=wallet). Derivar side/tokenIn/tokenOut/amount de esas dos ramas.
  const byHash = new Map<string, TokenTx[]>();
  for (const r of rows) {
    if (!byHash.has(r.hash)) byHash.set(r.hash, []);
    byHash.get(r.hash)!.push(r);
  }

  const trades: Trade[] = [];
  for (const [hash, legs] of byHash) {
    const outLeg = legs.find((l) => l.from.toLowerCase() === addr); // token que sale
    const inLeg = legs.find((l) => l.to.toLowerCase() === addr); // token que entra
    if (!outLeg || !inLeg) continue; // sin par → no es swap identificable
    if (outLeg.contractAddress.toLowerCase() === inLeg.contractAddress.toLowerCase())
      continue;

    const amountIn = scaleDown(hexToBigIntFromDec(outLeg.value), Number(outLeg.tokenDecimal) || 18);
    const amountOut = scaleDown(hexToBigIntFromDec(inLeg.value), Number(inLeg.tokenDecimal) || 18);
    const tokenIn = outLeg.tokenSymbol || "?";
    const tokenOut = inLeg.tokenSymbol || "?";

    // side: gastar stable/base → "buy"; recibir stable/base → "sell"; si no, "swap".
    let side: TradeSide = "swap";
    if (STABLE_OR_BASE.has(tokenIn.toUpperCase())) side = "buy";
    else if (STABLE_OR_BASE.has(tokenOut.toUpperCase())) side = "sell";

    trades.push({
      hash,
      ts: new Date(Number(outLeg.timeStamp) * 1000).toISOString(),
      side,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      valueUsd: null, // el front/derivador estima valor; aquí no inventamos precio histórico
      dex: null,
      explorerUrl: `https://bscscan.com/tx/${hash}`,
    });
  }

  trades.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const capped = trades.slice(0, 50);

  const out: TradesResponse = {
    address: addr,
    chainId: CHAIN_ID,
    count: capped.length,
    trades: capped,
    updatedAt: new Date().toISOString(),
    source: "onchain",
  };
  await env.INDEXER_KV.put(cacheKey, JSON.stringify(out), {
    expirationTtl: TRADES_CACHE_SEC,
  });
  return out;
}

/** BscScan `value` viene en decimal (base units), no hex. */
function hexToBigIntFromDec(v: string): bigint {
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
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
        return json({ ok: true, service: "onchain-indexer" }, env, 200, 30);
      }

      const pm = path.match(/^\/v1\/portfolio\/(.+)$/);
      if (pm) {
        const address = decodeURIComponent(pm[1]).trim();
        if (!ADDR_RE.test(address)) {
          return json({ error: "invalid_address" }, env, 400);
        }
        const result = await getPortfolio(env, address);
        return json(result, env, 200, PORTFOLIO_CACHE_SEC);
      }

      const tm = path.match(/^\/v1\/trades\/(.+)$/);
      if (tm) {
        const address = decodeURIComponent(tm[1]).trim();
        if (!ADDR_RE.test(address)) {
          return json({ error: "invalid_address" }, env, 400);
        }
        const result = await getTrades(env, address);
        return json(result, env, 200, TRADES_CACHE_SEC);
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

// index.ts — Worker indexer onchain BSC (agent-street · WS1.2).
//
// Rol: leer datos REALES de un agent_wallet en BSC mainnet (chainId 56) y servirlos
// con las formas del contrato `app/app/lib/contracts.ts` (PortfolioResponse / TradesResponse).
// NO inventa datos. Fuentes:
//   - Balances: RPC público BSC (eth_getBalance + eth_call balanceOf) — keyless.
//   - Precios USD: DexScreener /latest/dex/tokens/{addrs} (pairs[].priceUsd) — keyless.
//   - Trades: NodeReal/MegaNode nr_getAssetTransfers (BSCTrace) via env.NODEREAL_API_KEY.
//     (BscScan/Etherscan V2 no tiene free tier para BSC; NodeReal sí — reemplazo total.)
// Patrón reutilizado del Worker 8004-proxy: CORS + KV cache + rate-limit + router por path.
//
// Endpoints:
//   GET  /health                 → { ok:true, service:"onchain-indexer" }
//   GET  /v1/portfolio/:address  → PortfolioResponse
//   GET  /v1/trades/:address     → TradesResponse
//   POST /v1/summary             → { summaries:[{ address, totalUsd, txCount }] }
//     Batch lean para el filtro onchain del marketplace (corpus del 8004-proxy).
//     `txCount` = nonce (eth_getTransactionCount) → tx salientes reales, KEYLESS
//     (no depende de BSCSCAN_API_KEY). `totalUsd` reusa getPortfolio (cacheado).

import { TOKENS, WBNB_ADDRESS, type TokenMeta } from "./tokens";

export interface Env {
  INDEXER_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  // RPC público BSC mainnet (balances, eth_blockNumber). Keyless.
  BSC_RPC_URL: string;
  // Secret: `wrangler secret put NODEREAL_API_KEY`. Habilita el feed de trades vía
  // NodeReal/MegaNode (nr_getAssetTransfers). Sin key → /v1/trades vacío honesto.
  NODEREAL_API_KEY?: string;
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
const SUMMARY_CACHE_SEC = 600; // resumen (totalUsd + txCount) para el filtro del corpus.
/** Direcciones que procesa /v1/summary en paralelo por tanda (acota carga al RPC). */
const SUMMARY_CONCURRENCY = 6;
/** Tope de direcciones por request a /v1/summary (el cron trocea por encima). */
const SUMMARY_MAX_ADDRS = 200;
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
// Summary — { totalUsd, txCount } lean para el filtro onchain del corpus
// ------------------------------------------------------------------ //

interface AgentSummary {
  address: string;
  totalUsd: number;
  /** nonce = nº de tx salientes confirmadas. Señal anti-spam KEYLESS (vía RPC). */
  txCount: number;
}

/** Resumen de una address: capital en USD (reusa getPortfolio, cacheado) + nonce. */
async function getSummary(env: Env, address: string): Promise<AgentSummary> {
  const addr = address.toLowerCase();
  const cacheKey = `summary:v1:${addr}`;
  const cached = await env.INDEXER_KV.get(cacheKey, "json");
  if (cached) return cached as AgentSummary;

  const [pf, nonceRes] = await Promise.all([
    getPortfolio(env, addr),
    rpcBatch(env, [{ method: "eth_getTransactionCount", params: [addr, "latest"] }]),
  ]);
  const txCount = Number(hexToBigInt(nonceRes[0]));
  const out: AgentSummary = { address: addr, totalUsd: pf.totalUsd, txCount };
  await env.INDEXER_KV.put(cacheKey, JSON.stringify(out), {
    expirationTtl: SUMMARY_CACHE_SEC,
  });
  return out;
}

/** Batch de resúmenes con concurrencia acotada. Direcciones inválidas se ignoran;
 *  una address que falla degrada a { totalUsd:0, txCount:0 } (no rompe la tanda). */
async function getSummaries(env: Env, addresses: string[]): Promise<AgentSummary[]> {
  const uniq = [
    ...new Set(addresses.map((a) => a.trim().toLowerCase()).filter((a) => ADDR_RE.test(a))),
  ];
  const out: AgentSummary[] = [];
  for (let i = 0; i < uniq.length; i += SUMMARY_CONCURRENCY) {
    const batch = uniq.slice(i, i + SUMMARY_CONCURRENCY);
    const res = await Promise.all(
      batch.map((a) =>
        getSummary(env, a).catch(() => ({ address: a, totalUsd: 0, txCount: 0 })),
      ),
    );
    out.push(...res);
  }
  return out;
}

async function handleSummary(request: Request, env: Env): Promise<Response> {
  let body: { addresses?: unknown };
  try {
    body = (await request.json()) as { addresses?: unknown };
  } catch {
    return json({ error: "invalid_json" }, env, 400);
  }
  const addresses = Array.isArray(body.addresses)
    ? (body.addresses as unknown[]).map(String).slice(0, SUMMARY_MAX_ADDRS)
    : [];
  const summaries = await getSummaries(env, addresses);
  return json({ summaries, chainId: CHAIN_ID, updatedAt: new Date().toISOString() }, env, 200);
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

/** Un item de nr_getAssetTransfers (NodeReal/MegaNode, estilo Alchemy). */
interface NrTransfer {
  hash: string;
  from: string;
  to: string;
  value: string; // hex (0x…)
  asset: string | null; // símbolo
  contractAddress: string | null;
  decimal: string | null; // hex (ej. "0x12" = 18)
  blockTimeStamp: number; // unix segundos
  category: string;
}

/** POST JSON-RPC (single o batch) al endpoint NodeReal; devuelve los `result`. */
async function nodeRealRpc(
  endpoint: string,
  calls: Array<{ method: string; params: unknown[] }>,
): Promise<unknown[]> {
  const payload = calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: c.method, params: c.params }));
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`nodereal ${res.status}`);
  const body = (await res.json()) as
    | Array<{ id: number; result?: unknown }>
    | { id: number; result?: unknown };
  const arr = Array.isArray(body) ? body : [body];
  const out: unknown[] = new Array(calls.length).fill(undefined);
  for (const item of arr) {
    if (item && typeof item.id === "number") out[item.id] = item.result;
  }
  return out;
}

/**
 * nr_getAssetTransfers en BSC vía NodeReal. Filtra por UNA dirección, así que
 * lanzamos dos llamadas en un batch JSON-RPC (fromAddress + toAddress) y mergeamos
 * sus `transfers` para tener ambas piernas del swap. Solo ERC-20 (category "20"),
 * misma semántica que el antiguo tokentx. Sin key → []. TTL del cache lo aporta getTrades.
 *
 * Nota: NodeReal exige `toBlock` numérico (no acepta "latest") y `fromBlock < toBlock`;
 * el método topa a 100k bloques por rango. Anclamos a los ~90k bloques más recientes
 * (~3-4 días en BSC) leyendo el head del PROPIO NodeReal (misma altura que los transfers).
 */
async function fetchAssetTransfers(env: Env, addr: string): Promise<NrTransfer[]> {
  const key = env.NODEREAL_API_KEY;
  if (!key) return [];
  const endpoint = `https://bsc-mainnet.nodereal.io/v1/${key}`;

  const [headHex] = await nodeRealRpc(endpoint, [{ method: "eth_blockNumber", params: [] }]);
  const latest = hexToBigInt(headHex);
  if (latest === 0n) throw new Error("nodereal head 0");
  const toBlock = "0x" + latest.toString(16);
  const fromBlock = "0x" + (latest > 90000n ? latest - 90000n : 0n).toString(16);

  const base = {
    category: ["20"],
    order: "desc",
    maxCount: "0x64", // 100 por pierna; el front muestra ≤20, cap a 50.
    excludeZeroValue: true,
    fromBlock,
    toBlock,
  };
  const [outLegs, inLegs] = await nodeRealRpc(endpoint, [
    { method: "nr_getAssetTransfers", params: [{ ...base, fromAddress: addr }] },
    { method: "nr_getAssetTransfers", params: [{ ...base, toAddress: addr }] },
  ]);
  const merged: NrTransfer[] = [];
  for (const leg of [outLegs, inLegs]) {
    const t = (leg as { transfers?: NrTransfer[] } | undefined)?.transfers;
    if (Array.isArray(t)) merged.push(...t);
  }
  return merged;
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

  // Sin key de NodeReal el feed no puede traer datos → vacío honesto (el worker
  // sigue vivo para balances/summary, que son keyless). No cacheamos el vacío.
  if (!env.NODEREAL_API_KEY) return empty;

  let rows: TokenTx[] = [];
  try {
    const transfers = await fetchAssetTransfers(env, addr);
    rows = transfers.map((t) => ({
      hash: t.hash,
      timeStamp: String(t.blockTimeStamp ?? 0),
      from: t.from,
      to: t.to,
      value: t.value, // hex; BigInt() lo parsea abajo
      tokenSymbol: t.asset ?? "?",
      tokenDecimal: t.decimal ?? "18", // hex "0x12"; Number() lo parsea
      contractAddress: t.contractAddress ?? "",
    }));
  } catch {
    // Estado vacío honesto (200) si NodeReal falla.
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

/** Parsea `value` a BigInt. BigInt() acepta hex ("0x…", de NodeReal) y decimal. */
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
    if (!(await underRateLimit(request))) {
      return json({ error: "rate_limited" }, env, 429);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Único endpoint de escritura: batch de resúmenes para el filtro del corpus.
    if (request.method === "POST") {
      try {
        if (path === "/v1/summary") return await handleSummary(request, env);
        return json({ error: "not_found" }, env, 404);
      } catch (err) {
        return json(
          { error: "upstream_error", detail: String((err as Error).message) },
          env,
          502,
        );
      }
    }
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, env, 405);
    }

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

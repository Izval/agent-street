// upstream.ts — typed fetch wrappers to the other Agent-Street workers.
//
// The MCP worker owns NO data of its own: it is a read-through/relay that
// composes the existing workers (8004-proxy, hire-x402) into MCP tools. Every
// type here MIRRORS the source contract of the worker it talks to — cross-package
// imports are impossible in a Workers bundle, so we re-declare (same pattern the
// other workers already use: see workers/8004-proxy/src/classify.ts header).
// Keep in sync with:
//   - workers/8004-proxy/src/index.ts   (Agent / AgentDetail / AgentServices / AgentsPage)
//   - workers/hire-x402/src/x402.ts      (X402Accept / HireReceipt)
//   - workers/hire-x402/src/index.ts     (HireRecord)

export interface Env {
  ALLOWED_ORIGIN: string;
  // Public base URLs of the workers we compose. No secrets: the MCP server never
  // signs or custodies keys (money is client-signed, verified by hire-x402).
  PROXY_8004_URL: string;
  HIRE_X402_URL: string;
  ANALYTICS_URL?: string;
  INDEXER_URL?: string;
  MCP_SERVER_NAME?: string;
  // Service bindings to the same-account workers. Worker-to-worker calls over
  // *.workers.dev loop back and 404 on the same account, so in production we route
  // through these bindings; they are absent in local dev, where the plain fetch on
  // the *_URL vars (a real external request) works fine.
  PROXY_8004?: Fetcher;
  HIRE_X402?: Fetcher;
}

/**
 * Fetch an upstream worker via its service binding when present, else a plain
 * fetch on the given URL. The binding ignores the URL host and routes to the bound
 * service; we keep passing the full *_URL so local dev (no binding) still works.
 */
function svc(binding: Fetcher | undefined, url: string, init?: RequestInit): Promise<Response> {
  return binding ? binding.fetch(url, init) : fetch(url, init);
}

// --- 8004-proxy shapes (mirror) --------------------------------------------- //

export interface Agent {
  id: string;
  agentId: string;
  tokenId: string;
  chainId: number;
  contractAddress?: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: string | null;
  categoryLabel: string | null;
  stars: number;
  score: number;
  avgScore: number;
  feedbacks: number;
  healthScore: number | null;
  isVerified: boolean;
  x402Supported: boolean;
  rank: number | null;
  networkRank: number | null;
  ownerAddress?: string;
  agentWallet?: string;
  ownerUsername?: string | null;
  ownerEns?: string | null;
  ownerAvatarUrl?: string | null;
  ownerPublisherTier?: string | null;
  ownerCertifiedName?: string | null;
  tags?: string[];
  supportedProtocols?: string[];
  source: "8004scan" | "submitted";
  network: "testnet" | "mainnet";
  status?: "registered" | "pending";
  txHash?: string;
}

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
  cardLive: boolean;
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
  dimensions: Array<{ key: string; score: number; weight: number }>;
  feedbacks: number;
  avgScore: number;
  source: "8004scan";
}

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
  categories: Array<{ id: string; label: string }>;
  anonymous?: boolean;
}

// --- hire-x402 shapes (mirror) ---------------------------------------------- //

export interface X402Accept {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  resource: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown> | null;
}

export interface HireReceipt {
  status: "settled" | "pending" | "failed";
  txHash: string | null;
  explorerUrl: string | null;
  amount: number | null;
  assetSymbol: string | null;
  settledAt: string | null;
  detail?: string | null;
}

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

// --- fetch helpers ---------------------------------------------------------- //

const trim = (u: string) => u.replace(/\/+$/, "");

/** Thrown by upstream wrappers; dispatch() maps it to an isError tool result. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly service: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchAgents(
  env: Env,
  q: { category?: string; search?: string; page?: number; limit?: number },
): Promise<AgentsPage> {
  const params = new URLSearchParams();
  if (q.category) params.set("category", q.category);
  if (q.search) params.set("search", q.search);
  if (q.page) params.set("page", String(q.page));
  if (q.limit) params.set("limit", String(q.limit));
  const url = `${trim(env.PROXY_8004_URL)}/v1/agents?${params.toString()}`;
  const res = await svc(env.PROXY_8004, url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new UpstreamError(`8004-proxy ${res.status}`, "8004-proxy", res.status);
  }
  return (await res.json()) as AgentsPage;
}

/** Returns null on 404 (agent not found) — a normal, non-error outcome. */
export async function fetchAgent(env: Env, id: string): Promise<AgentDetail | null> {
  const url = `${trim(env.PROXY_8004_URL)}/v1/agents/${encodeURIComponent(id)}`;
  const res = await svc(env.PROXY_8004, url, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new UpstreamError(`8004-proxy ${res.status}`, "8004-proxy", res.status);
  }
  return (await res.json()) as AgentDetail;
}

/** The marketplace category list, read from the 8004-proxy /health payload. */
export async function fetchCategories(
  env: Env,
): Promise<Array<{ id: string; label: string }>> {
  const url = `${trim(env.PROXY_8004_URL)}/health`;
  const res = await svc(env.PROXY_8004, url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new UpstreamError(`8004-proxy ${res.status}`, "8004-proxy", res.status);
  }
  const body = (await res.json()) as { categories?: Array<{ id: string; label: string }> };
  return Array.isArray(body.categories) ? body.categories : [];
}

export type QuoteResult =
  | { ok: true; x402Version: number; accepts: X402Accept[] }
  | { ok: false; error: string; detail?: string };

/**
 * IMPORTANT: /v1/quote returns HTTP 402 on the HAPPY path (the x402 challenge),
 * so res.ok is false even on success. We treat 402 as success and read the body;
 * 409 (no on-chain pay-to wallet) / 400 map to a structured, honest tool error.
 */
export async function fetchQuote(env: Env, agentId: string): Promise<QuoteResult> {
  const url = `${trim(env.HIRE_X402_URL)}/v1/quote?agent=${encodeURIComponent(agentId)}`;
  const res = await svc(env.HIRE_X402, url, { headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 402) {
    return {
      ok: true,
      x402Version: typeof body.x402Version === "number" ? body.x402Version : 2,
      accepts: Array.isArray(body.accepts) ? (body.accepts as X402Accept[]) : [],
    };
  }
  return {
    ok: false,
    error: typeof body.error === "string" ? body.error : `quote_${res.status}`,
    detail: typeof body.detail === "string" ? body.detail : undefined,
  };
}

export async function postHire(
  env: Env,
  body: Record<string, unknown>,
): Promise<HireReceipt> {
  const url = `${trim(env.HIRE_X402_URL)}/v1/hire`;
  const res = await svc(env.HIRE_X402, url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new UpstreamError(`hire-x402 ${res.status}`, "hire-x402", res.status);
  }
  return (await res.json()) as HireReceipt;
}

export async function fetchHires(
  env: Env,
  address: string,
): Promise<{ address: string; hires: HireRecord[] }> {
  const url = `${trim(env.HIRE_X402_URL)}/v1/hires?address=${encodeURIComponent(address)}`;
  const res = await svc(env.HIRE_X402, url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new UpstreamError(`hire-x402 ${res.status}`, "hire-x402", res.status);
  }
  const body = (await res.json()) as { address?: string; hires?: HireRecord[] };
  return { address: body.address ?? address, hires: body.hires ?? [] };
}

/** Best-effort live read of an agent's A2A card (3s timeout). null on any failure. */
export async function fetchAgentCardLive(
  endpoint: string,
): Promise<Record<string, unknown> | null> {
  const base = trim(endpoint);
  const candidates = /\.well-known\//.test(base)
    ? [base]
    : [`${base}/.well-known/agent-card.json`, base];
  for (const url of candidates) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) return (await res.json()) as Record<string, unknown>;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

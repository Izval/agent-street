/**
 * Registrar client — the "Create your own agent" publish seam.
 *
 * Two server-side hops, both run from the `/create` route action (never the
 * browser), mirroring the factory style of `x402.ts` / `trending.ts`:
 *   1. REGISTER (onchain) → `POST {registrarUrl}/v1/register` mints an ERC-8004
 *      identity on BSC testnet via the BNB Agent Studio SDK seam. A treasury-
 *      funded ephemeral wallet holds the identity (ERC-8004 = 1 identity per
 *      address). Without a treasury key the service replies in DRY_RUN (pending).
 *   2. LIST → `POST {proxyUrl}/v1/submitted` persists the created agent to the
 *      proxy's KV so it shows up in the marketplace with id `t<chain>-<agentId>`.
 *
 * Honesty (DESIGN.md v2 §18): if the registrar fails or replies `pending`, we
 * still list the agent as `pending` — never a fabricated agentId or tx hash.
 */

import type { Category } from "./taxonomy";

/** Fields the wizard collects (maps 1:1 to the registrar `RegisterRequest`). */
export interface AgentSpec {
  name: string;
  description: string;
  category: Category | "";
  /** Optional A2A endpoint; the registrar fills a placeholder when omitted. */
  endpoint?: string;
  /** Transport protocol advertised by the agent card. */
  protocol?: string;
}

/** Registrar `POST /v1/register` response. */
export interface RegisterResult {
  status: "registered" | "pending";
  mode: "onchain" | "dry_run";
  agentId: string | null;
  ownerAddress: string;
  txHash: string | null;
  network: string;
  chainId: number;
  endpoint: string;
  detail?: string | null;
}

/** What the wizard shows on the success step. */
export interface PublishReceipt {
  /** Marketplace id (`t<chain>-<agentId>`) → links to `/agent/:id`. */
  marketplaceId: string;
  agentId: string | null;
  txHash: string | null;
  ownerAddress: string;
  status: "registered" | "pending";
  mode: "onchain" | "dry_run";
  chainId: number;
  endpoint: string;
  detail?: string | null;
}

export interface RegistrarClientOptions {
  /** Registrar service base URL (env.REGISTRAR_URL). */
  registrarUrl: string;
  /** 8004scan proxy base URL (env.PROXY_8004_URL) — where the listing is persisted. */
  proxyUrl: string;
  /** Optional shared secret for the proxy's `POST /v1/submitted` (env.SUBMIT_TOKEN). */
  submitToken?: string;
  signal?: AbortSignal;
}

const BSC_TESTNET_CHAIN_ID = 97;

export function createRegistrarClient(opts: RegistrarClientOptions) {
  const registrarBase = opts.registrarUrl.replace(/\/$/, "");
  const proxyBase = opts.proxyUrl.replace(/\/$/, "");

  /** Mints (or, in DRY_RUN, simulates) an ERC-8004 identity for a new agent. */
  async function register(spec: AgentSpec): Promise<RegisterResult> {
    const res = await fetch(`${registrarBase}/v1/register`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        name: spec.name,
        description: spec.description,
        category: spec.category || "",
        endpoint: spec.endpoint || undefined,
        protocol: spec.protocol || "A2A",
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`registrar ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as RegisterResult;
  }

  /** Persists the created agent to the marketplace (proxy KV). Returns its id. */
  async function list(
    spec: AgentSpec,
    reg: RegisterResult,
    creator: string | null,
    x402Supported: boolean,
  ): Promise<string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (opts.submitToken) headers["x-submit-token"] = opts.submitToken;

    const res = await fetch(`${proxyBase}/v1/submitted`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: spec.name,
        description: spec.description,
        category: spec.category || undefined,
        agentId: reg.agentId ?? undefined,
        // The connected wallet is recorded as the listing's creator/owner; the
        // ERC-8004 token itself is held by the registrar's ephemeral wallet.
        ownerAddress: creator ?? reg.ownerAddress,
        endpoint: reg.endpoint,
        txHash: reg.txHash ?? undefined,
        chainId: reg.chainId ?? BSC_TESTNET_CHAIN_ID,
        status: reg.status,
        x402Supported,
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`proxy submit ${res.status}: ${text.slice(0, 200)}`);
    }
    const detail = (await res.json()) as { id?: string };
    if (!detail.id) throw new Error("proxy submit: missing id");
    return detail.id;
  }

  /** Full publish: register onchain, then list in the marketplace. */
  async function publish(
    spec: AgentSpec,
    creator: string | null,
    x402Supported: boolean,
  ): Promise<PublishReceipt> {
    const reg = await register(spec);
    const marketplaceId = await list(spec, reg, creator, x402Supported);
    return {
      marketplaceId,
      agentId: reg.agentId,
      txHash: reg.txHash,
      ownerAddress: creator ?? reg.ownerAddress,
      status: reg.status,
      mode: reg.mode,
      chainId: reg.chainId ?? BSC_TESTNET_CHAIN_ID,
      endpoint: reg.endpoint,
      detail: reg.detail ?? null,
    };
  }

  return { register, list, publish };
}

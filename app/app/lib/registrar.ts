/**
 * Marketplace listing seam for the "Create your own agent" flow.
 *
 * Since `/create` moved to **client-pays** (the user's wallet mints the ERC-8004
 * identity on-chain directly — see `erc8004.ts` + the wizard's `publish()`), the
 * server no longer registers anything. All that remains server-side is LISTING:
 * persisting the freshly-minted agent to the proxy's KV so it shows up in the
 * marketplace with id `t<chain>-<agentId>`.
 *
 * Honesty (DESIGN.md v2 §18): we only ever list what the user actually minted —
 * the real `agentId` + `txHash` from their own transaction, owned by their own
 * wallet. No fabricated ids or hashes.
 *
 * (The legacy sponsored registrar — `services/registrar/`, treasury-funded — is
 * kept in the repo as an optional fallback but is no longer on this path.)
 */

import type { Subcategory } from "./taxonomy";

const BSC_TESTNET_CHAIN_ID = 97;

/** Fields the wizard collects. */
export interface AgentSpec {
  name: string;
  description: string;
  subcategory: Subcategory | "";
  /** Optional A2A endpoint; a placeholder card URL is used when omitted. */
  endpoint?: string;
  /** Transport protocol advertised by the agent card. */
  protocol?: string;
}

/** Result of the client-side on-chain mint, handed to the listing seam. */
export interface MintResult {
  /** ERC-8004 token id parsed from the `Registered` event. */
  agentId: string;
  /** The user's `register(...)` transaction hash. */
  txHash: string;
  /** Owner of the identity = the connected wallet that signed + paid. */
  ownerAddress: string;
  chainId: number;
}

/** What the wizard shows on the success step. */
export interface PublishReceipt {
  /** Marketplace id (`t<chain>-<agentId>`) → links to `/agent/:id`. */
  marketplaceId: string;
  agentId: string;
  txHash: string;
  ownerAddress: string;
  chainId: number;
}

export interface ListingClientOptions {
  /** 8004scan proxy base URL (env.PROXY_8004_URL) — where the listing is persisted. */
  proxyUrl: string;
  /** Same-account service binding (env.PROXY_8004). In prod a plain fetch to the
   * proxy's *.workers.dev loops back to THIS worker and 404s, so route through the
   * binding when present; absent in local dev, where the plain fetch works. */
  fetcher?: Fetcher;
  /** Optional shared secret for the proxy's `POST /v1/submitted` (env.SUBMIT_TOKEN). */
  submitToken?: string;
  signal?: AbortSignal;
}

export function createListingClient(opts: ListingClientOptions) {
  const proxyBase = opts.proxyUrl.replace(/\/$/, "");
  const doFetch: typeof fetch = opts.fetcher
    ? (opts.fetcher.fetch.bind(opts.fetcher) as typeof fetch)
    : fetch;

  /** Persists a minted agent to the marketplace (proxy KV). Returns its id. */
  async function listCreatedAgent(
    spec: AgentSpec,
    mint: MintResult,
    x402Supported: boolean,
  ): Promise<PublishReceipt> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (opts.submitToken) headers["x-submit-token"] = opts.submitToken;

    const res = await doFetch(`${proxyBase}/v1/submitted`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: spec.name,
        description: spec.description,
        subcategory: spec.subcategory || undefined,
        agentId: mint.agentId,
        ownerAddress: mint.ownerAddress,
        endpoint: spec.endpoint || undefined,
        txHash: mint.txHash,
        chainId: mint.chainId ?? BSC_TESTNET_CHAIN_ID,
        status: "registered",
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

    return {
      marketplaceId: detail.id,
      agentId: mint.agentId,
      txHash: mint.txHash,
      ownerAddress: mint.ownerAddress,
      chainId: mint.chainId ?? BSC_TESTNET_CHAIN_ID,
    };
  }

  return { listCreatedAgent };
}

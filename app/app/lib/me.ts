/**
 * "My agents" client (/me) — aggregates two REAL sources per wallet:
 *   - HIRED: history of settled hires from the hire-x402 worker (KV by address).
 *   - LAUNCHED: agents whose onchain owner is the wallet, read from the 8004scan
 *     Public API (chainId 56 = mainnet, chainId 97 = testnet). Real `ownerAddress` filter.
 *
 * All server-side (/me loader), degrades to an honest empty if a source doesn't respond.
 */

import { agentHref } from "./agents";

// 8004scan Public API (same base the 8004-proxy worker uses). Public read.
const SCAN_8004_BASE = "https://8004scan.io/api/v1/public";

// --- Hired (mirrors HireRecord from the hire-x402 worker) ---
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
  /** Set when this hire settled under a managed session (manage flow). */
  sessionId?: string | null;
}

// --- Launched ---
export interface OwnedAgent {
  id: string; // token_id
  name: string;
  imageUrl: string | null;
  chainId: number;
  network: "mainnet" | "testnet";
  score: number | null;
  /** Internal detail link; testnet agents carry `?chain=97` so the route resolves them. */
  href: string;
  /** Always false now that the proxy resolves testnet too; kept for the /me renderer. */
  external: boolean;
}

export interface MyAgents {
  address: string | null;
  hires: HireRecord[];
  launchedMainnet: OwnedAgent[];
  launchedTestnet: OwnedAgent[];
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

async function fetchHires(
  hireBaseUrl: string,
  address: string,
  signal?: AbortSignal,
  fetcher?: Fetcher,
): Promise<HireRecord[]> {
  try {
    const url = `${hireBaseUrl.replace(/\/$/, "")}/v1/hires?address=${encodeURIComponent(address)}`;
    const doFetch: typeof fetch = fetcher
      ? (fetcher.fetch.bind(fetcher) as typeof fetch)
      : fetch;
    const res = await doFetch(url, { headers: { accept: "application/json" }, signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { hires?: HireRecord[] };
    return Array.isArray(body.hires) ? body.hires : [];
  } catch {
    return [];
  }
}

/** Agents whose owner is `address`, from 8004scan for a given chainId. */
async function fetchOwned(
  address: string,
  chainId: 56 | 97,
  signal?: AbortSignal,
): Promise<OwnedAgent[]> {
  try {
    const url = new URL(`${SCAN_8004_BASE}/agents`);
    url.searchParams.set("chainId", String(chainId));
    url.searchParams.set("ownerAddress", address);
    url.searchParams.set("limit", "50");
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(body.data) ? body.data : [];
    const network = chainId === 97 ? "testnet" : "mainnet";
    return (
      rows
        // Defense: in case the API ignores the filter, keep only the owner's.
        .filter(
          (r) =>
            String(r.owner_address ?? "").toLowerCase() === address.toLowerCase(),
        )
        .map((r): OwnedAgent => {
          const id = String(r.token_id ?? r.id ?? "");
          return {
            id,
            name: String(r.name ?? "Unknown"),
            imageUrl: r.image_url ? String(r.image_url) : null,
            chainId,
            network,
            score: r.total_score == null ? null : Number(r.total_score),
            // The proxy resolves both mainnet (56) and testnet (97); testnet agents
            // link to the internal detail page with ?chain=97 so it loads correctly.
            href: agentHref({ id, name: String(r.name ?? "Unknown"), chainId }),
            external: false,
          };
        })
    );
  } catch {
    return [];
  }
}

export async function loadMyAgents(
  env: { hireUrl: string; signal?: AbortSignal; hireFetcher?: Fetcher },
  address: string | null,
): Promise<MyAgents> {
  if (!address || !ADDR_RE.test(address)) {
    return { address: null, hires: [], launchedMainnet: [], launchedTestnet: [] };
  }
  const [hires, launchedMainnet, launchedTestnet] = await Promise.all([
    fetchHires(env.hireUrl, address, env.signal, env.hireFetcher),
    fetchOwned(address, 56, env.signal),
    fetchOwned(address, 97, env.signal),
  ]);
  return { address, hires, launchedMainnet, launchedTestnet };
}

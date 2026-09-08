/**
 * Managed sessions client (manage flow) — the server-side seam to the
 * hire-x402 worker's `/v1/sessions*` endpoints. Mirrors `createHireClient`
 * in `x402.ts`: runs in loaders/actions, routed through the service binding.
 *
 * The on-chain grant/revoke are signed in the browser by the Altana SDK
 * (`lib/altana.ts`); this client only READS the persisted sessions and RECORDS
 * a grant/revoke (the worker verifies the tx on-chain). Keyless throughout.
 */

import type { Session, SpendCap } from "./contracts";

export interface SessionsClientOptions {
  /** hire-x402 worker base (env.HIRE_X402_URL). */
  baseUrl: string;
  /** Service binding (same-account worker-to-worker loops back over *.workers.dev). */
  fetcher?: Fetcher;
  signal?: AbortSignal;
}

export interface RecordSessionInput {
  owner: string;
  walletAddress: string;
  id: string; // session public key
  spend: SpendCap[];
  allowlist: string[];
  expiry: number;
  grantTxHash?: string | null;
}

export interface RevokeSessionInput {
  owner: string;
  id: string;
  revokeTxHash?: string | null;
}

export function createSessionsClient(opts: SessionsClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, "");
  const doFetch: typeof fetch = opts.fetcher
    ? (opts.fetcher.fetch.bind(opts.fetcher) as typeof fetch)
    : fetch;

  /** All sessions for an identity (with computed status + used/remaining). */
  async function list(address: string): Promise<Session[]> {
    try {
      const res = await doFetch(
        `${base}/v1/sessions?address=${encodeURIComponent(address)}`,
        { headers: { accept: "application/json" }, signal: opts.signal },
      );
      if (!res.ok) return [];
      const body = (await res.json()) as { sessions?: Session[] };
      return Array.isArray(body.sessions) ? body.sessions : [];
    } catch {
      return [];
    }
  }

  /** Record a granted session (worker verifies the grant tx). null if it couldn't. */
  async function record(input: RecordSessionInput): Promise<Session | null> {
    try {
      const res = await doFetch(`${base}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input),
        signal: opts.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as Session;
    } catch {
      return null;
    }
  }

  /** Record a revocation (worker verifies the revoke tx). null if it couldn't. */
  async function revoke(input: RevokeSessionInput): Promise<Session | null> {
    try {
      const res = await doFetch(`${base}/v1/sessions/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input),
        signal: opts.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as Session;
    } catch {
      return null;
    }
  }

  return { list, record, revoke };
}

export type SessionsClient = ReturnType<typeof createSessionsClient>;

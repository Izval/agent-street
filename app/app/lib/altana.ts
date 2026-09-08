/**
 * Altana account sessions — the "manage" seam (client-only).
 *
 * The managed-hire path of the marketplace: instead of signing every hire from
 * the connected EOA, the user grants ONE scoped session (spend cap + expiry) to
 * an Altana smart-account, then hires execute via the session key within the cap
 * — no per-hire prompt. Granting and revoking are on-chain, keystore-registered,
 * and visible in the explorer.
 *
 * Architecture (Altana's recommended browser pattern — see the SDK's
 * "Onboard users from browser wallets" guide):
 *   - The connected injected wallet (MetaMask/Binance) is NOT a valid Altana
 *     signer; it stays the marketplace IDENTITY + funding source.
 *   - The Altana smart-account is controlled by a **passkey** (WebAuthn): the
 *     admin authority. Only the grant and the revoke prompt for biometrics.
 *   - The SESSION key is a generated secp256k1 key persisted client-side; it
 *     signs the hires (execute) with no biometric prompt, bounded by the cap.
 *
 * TWO-PHASE GRANT (the funding gate is real): creating the passkey wallet is
 * counterfactual (no tx, no funds), but `grantSession` pays a keystore
 * registration fee + gas from the smart-account, which must therefore hold
 * testnet BNB first. The smart-account address is derived from the passkey, so
 * it cannot be funded before the passkey exists. We split the flow:
 *   1. `beginSession` — create the passkey wallet, persist a DRAFT, return the
 *      address so the user can fund it (faucet).
 *   2. `finalizeSession` — once funded, grant on-chain reusing the SAME draft
 *      (same passkey, same session key), then persist the granted session.
 * This also makes a failed/abandoned grant recoverable: the draft (address +
 * passkey) survives, so funding + retry reuses it instead of orphaning funds.
 *
 * This is a GENERIC marketplace feature (works for any listing) — it is not
 * coupled to any specific agent (CLAUDE.md §2). Honesty (DESIGN.md §18): tx
 * hashes are surfaced only when the relay reports one.
 *
 * CLIENT-ONLY: WebAuthn + the Altana relay live in the browser. The SDK is
 * dynamically imported inside each function so it never enters the server
 * bundle; only `import type` (erased) is top-level.
 */

import { encodeFunctionData, formatUnits } from "viem";
import type { Address, Hex } from "viem";
import type {
  Session,
  PasskeyCredential,
  Call,
} from "@altananetwork/sdk";
import type { SpendCap } from "./contracts";

const STORE_VERSION = 2;
const lsKey = (owner: string) =>
  `altana.session.v${STORE_VERSION}.${owner.toLowerCase()}`;

/** JSON-safe half persisted in localStorage, keyed by the connected EOA. */
export interface StoredAltanaSession {
  /** The Altana smart-account the session acts on. */
  walletAddress: Address;
  /** Passkey handle (JSON-safe) → rebuilds the admin signer for grant/revoke. */
  passkeyCredential: PasskeyCredential;
  /** Generated session private key (signs hires). */
  sessionKey: Hex;
  /** false while a DRAFT (passkey created, not yet granted on-chain). */
  granted: boolean;
  /** JSON-safe serialized session (no key material). null while a draft. */
  serializedSession: unknown | null;
  /** Session public key = the on-chain id / revocation handle. null while a draft. */
  sessionPublicKey: string | null;
  /** Spend caps (limitBase in the token's base units). */
  caps: SpendCap[];
  /** Agent ids this session may hire (empty = any). */
  allowlist: string[];
  /** Intended lifetime in hours; the absolute expiry is stamped at grant time. */
  expiryHours: number;
  /** Absolute expiry (unix seconds). 0 while a draft (not yet granted). */
  expiry: number;
  network: string;
}

/** A CreateSessionResult is what the grant (`finalizeSession`) returns. */
export interface CreateSessionResult {
  walletAddress: Address;
  sessionPublicKey: string;
  /** null if the relay confirmed the grant without surfacing a receipt. */
  grantTxHash: string | null;
  expiry: number;
}

// --- Local persistence (guarded for SSR) --------------------------------- //

function readStore(owner: string): StoredAltanaSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lsKey(owner));
    return raw ? (JSON.parse(raw) as StoredAltanaSession) : null;
  } catch {
    return null;
  }
}

function writeStore(owner: string, v: StoredAltanaSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(owner), JSON.stringify(v));
  } catch {
    /* quota / private mode: best-effort */
  }
}

function clearStore(owner: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lsKey(owner));
  } catch {
    /* best-effort */
  }
}

/** The stored session for an owner if it exists, GRANTED, and unexpired, else null. */
export function getActiveSession(owner: string): StoredAltanaSession | null {
  const s = readStore(owner);
  if (!s || !s.granted) return null;
  if (s.expiry && Math.floor(Date.now() / 1000) >= s.expiry) return null;
  return s;
}

/** A DRAFT (passkey created, not yet granted) awaiting funding + grant, else null. */
export function getDraftSession(owner: string): StoredAltanaSession | null {
  const s = readStore(owner);
  return s && !s.granted ? s : null;
}

/** Whether this hire is covered by the active session's allowlist. */
export function sessionCoversAgent(
  s: StoredAltanaSession,
  agentId: string,
): boolean {
  return s.allowlist.length === 0 || s.allowlist.includes(agentId);
}

// --- SDK (dynamic import; client-only) ----------------------------------- //

type Sdk = typeof import("@altananetwork/sdk");
let _sdk: Promise<Sdk> | null = null;
function sdk(): Promise<Sdk> {
  if (!_sdk) _sdk = import("@altananetwork/sdk");
  return _sdk;
}

let _client: Awaited<ReturnType<Sdk["createClient"]>> | null = null;
async function client() {
  const s = await sdk();
  if (!_client) _client = s.createClient({ chains: [s.BNB_TESTNET] });
  return _client;
}

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const isNativeAsset = (asset: string) =>
  asset === "native" || /^0x0{40}$/i.test(asset);

// --- Public operations --------------------------------------------------- //

export interface BeginSessionInput {
  /** Connected EOA — the marketplace identity these records key under. */
  owner: string;
  /** Spend caps (limitBase in the token's base units). */
  caps: SpendCap[];
  /** Agent ids the session may hire (empty = any listing). */
  allowlist: string[];
  /** Session lifetime in hours (absolute expiry is stamped at grant time). */
  expiryHours: number;
  /** Passkey display name. */
  appName?: string;
}

/**
 * Phase 1 — create the passkey-controlled Altana smart-account (biometric
 * prompt) and generate a session key, then persist a DRAFT. NO on-chain tx and
 * NO funds needed: the address is counterfactual. Returns the address so the
 * caller can fund it (faucet) before `finalizeSession` grants on-chain.
 */
export async function beginSession(
  input: BeginSessionInput,
): Promise<{ walletAddress: Address }> {
  const s = await sdk();
  const c = await client();

  // Passkey-controlled smart wallet (biometric prompt). Counterfactual: no tx.
  const wallet = await c.createPasskeyWallet({
    name: input.appName ?? "Agent-Street",
  });

  // Session signer: a generated key we own and persist (so hires don't re-prompt).
  const sessionSigner = s.createPrivateKeySigner();

  writeStore(input.owner, {
    walletAddress: wallet.address,
    passkeyCredential: wallet.signer.credential,
    sessionKey: (sessionSigner as { _privateKey: Hex })._privateKey,
    granted: false,
    serializedSession: null,
    sessionPublicKey: null,
    caps: input.caps,
    allowlist: input.allowlist,
    expiryHours: input.expiryHours,
    expiry: 0,
    network: "bsc-testnet",
  });

  return { walletAddress: wallet.address };
}

/**
 * Native (tBNB) balance of the draft/active smart-account, in wei + formatted.
 * Null if there is no stored wallet for this owner. Used by the UI to tell the
 * user whether the account is funded enough to grant.
 */
export async function walletBalance(
  owner: string,
): Promise<{ wei: string; formatted: string; address: Address } | null> {
  const stored = readStore(owner);
  if (!stored) return null;
  const c = await client();
  const res = await c.balances({ wallet: { address: stored.walletAddress } });
  return {
    wei: res.native.toString(),
    formatted: formatUnits(res.native, 18),
    address: stored.walletAddress,
  };
}

/**
 * Phase 2 — grant the scoped session on-chain, reusing the draft's passkey +
 * session key (biometric prompt to sign the grant). The smart-account must be
 * funded first (see `walletBalance`). Persists the granted session locally.
 */
export async function finalizeSession(
  owner: string,
): Promise<CreateSessionResult> {
  const s = await sdk();
  const c = await client();
  const draft = readStore(owner);
  if (!draft) throw new Error("no_draft_session");
  if (draft.granted) {
    // Already granted (double-submit): return the recorded result.
    return {
      walletAddress: draft.walletAddress,
      sessionPublicKey: draft.sessionPublicKey ?? "",
      grantTxHash: null,
      expiry: draft.expiry,
    };
  }

  const adminSigner = s.signerFromPasskey(draft.passkeyCredential);
  const sessionSigner = s.signerFromPrivateKey(draft.sessionKey);

  const permissions = {
    spend: draft.caps.map((cap) => ({
      limit: BigInt(cap.limitBase),
      period: cap.period,
      ...(cap.token ? { token: cap.token as Address } : {}),
    })),
  };

  const expirySec =
    Math.floor(Date.now() / 1000) + Math.max(1, draft.expiryHours) * 3600;

  const granted = await c.grantSession({
    wallet: { address: draft.walletAddress },
    signer: adminSigner,
    permissions,
    expiry: expirySec,
    sessionSigner,
    register: true, // keystore-registered → verifiable on-chain (explorer-visible)
  });

  writeStore(owner, {
    ...draft,
    granted: true,
    serializedSession: s.serializeSession(granted),
    sessionPublicKey: granted.publicKey,
    expiry: expirySec,
  });

  return {
    walletAddress: draft.walletAddress,
    sessionPublicKey: granted.publicKey,
    grantTxHash: granted.transactionHash ?? null,
    expiry: expirySec,
  };
}

export interface ExecuteHireInput {
  owner: string;
  /** The x402 accept of the quote: asset, payTo, amount (base units). */
  asset: string;
  payTo: string;
  amountBase: string;
}

/**
 * Hire under the active session: the session key sends the SAME transfer the
 * Direct path would (to `payTo`), so the marketplace worker verifies it with the
 * exact same on-chain check — only the signer differs (session key via relay).
 */
export async function executeHire(
  input: ExecuteHireInput,
): Promise<{ txHash: string | null }> {
  const s = await sdk();
  const c = await client();
  const stored = getActiveSession(input.owner);
  if (!stored || !stored.serializedSession)
    throw new Error("no_active_session");

  const sessionSigner = s.signerFromPrivateKey(stored.sessionKey);
  const session: Session = s.deserializeSession(
    stored.serializedSession as never,
    sessionSigner,
  );

  const amount = BigInt(input.amountBase);
  const calls: Call[] = isNativeAsset(input.asset)
    ? [{ to: input.payTo as Address, value: amount, data: "0x" }]
    : [
        {
          to: input.asset as Address,
          value: 0n,
          data: encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [input.payTo as Address, amount],
          }),
        },
      ];

  const res = await c.execute({ session, calls });
  return { txHash: res.transactionHash ?? null };
}

/**
 * Revoke the active session on-chain (passkey admin — biometric prompt) and
 * clear local state. After confirmation the session's next execute reverts.
 */
export async function revokeActiveSession(
  owner: string,
): Promise<{ sessionPublicKey: string; revokeTxHash: string | null }> {
  const s = await sdk();
  const c = await client();
  const stored = readStore(owner);
  if (!stored || !stored.granted || !stored.sessionPublicKey)
    throw new Error("no_session");

  const adminSigner = s.signerFromPasskey(stored.passkeyCredential);
  const res = await c.revokeSession({
    wallet: { address: stored.walletAddress },
    signer: adminSigner,
    session: stored.sessionPublicKey as Hex,
  });

  clearStore(owner);
  return {
    sessionPublicKey: stored.sessionPublicKey,
    revokeTxHash: res.transactionHash ?? null,
  };
}

/** Discard a draft (passkey created but never granted) for this owner. */
export function discardDraft(owner: string): void {
  const s = readStore(owner);
  if (s && !s.granted) clearStore(owner);
}

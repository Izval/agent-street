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
 * This is a GENERIC marketplace feature (works for any listing) — it is not
 * coupled to any specific agent (CLAUDE.md §2). Honesty (DESIGN.md §18): tx
 * hashes are surfaced only when the relay reports one.
 *
 * CLIENT-ONLY: WebAuthn + the Altana relay live in the browser. The SDK is
 * dynamically imported inside each function so it never enters the server
 * bundle; only `import type` (erased) is top-level.
 */

import { encodeFunctionData } from "viem";
import type { Address, Hex } from "viem";
import type {
  Session,
  PasskeyCredential,
  Call,
} from "@altananetwork/sdk";
import type { SpendCap } from "./contracts";

const STORE_VERSION = 1;
const lsKey = (owner: string) =>
  `altana.session.v${STORE_VERSION}.${owner.toLowerCase()}`;

/** JSON-safe half persisted in localStorage, keyed by the connected EOA. */
export interface StoredAltanaSession {
  /** The Altana smart-account the session acts on. */
  walletAddress: Address;
  /** Passkey handle (JSON-safe) → rebuilds the admin signer for revoke. */
  passkeyCredential: PasskeyCredential;
  /** Generated session private key (signs hires). */
  sessionKey: Hex;
  /** JSON-safe serialized session (no key material). */
  serializedSession: unknown;
  /** Session public key = the on-chain id / revocation handle. */
  sessionPublicKey: string;
  /** Unix epoch seconds. */
  expiry: number;
  /** Agent ids this session may hire (empty = any). */
  allowlist: string[];
  network: string;
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

/** The stored session for an owner if it exists and hasn't expired, else null. */
export function getActiveSession(owner: string): StoredAltanaSession | null {
  const s = readStore(owner);
  if (!s) return null;
  if (s.expiry && Math.floor(Date.now() / 1000) >= s.expiry) return null;
  return s;
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

export interface CreateSessionInput {
  /** Connected EOA — the marketplace identity these records key under. */
  owner: string;
  /** Spend caps (limitBase in the token's base units). */
  caps: SpendCap[];
  /** Agent ids the session may hire (empty = any listing). */
  allowlist: string[];
  /** Unix epoch seconds when the session expires. */
  expirySec: number;
  /** Passkey display name. */
  appName?: string;
}

export interface CreateSessionResult {
  walletAddress: Address;
  sessionPublicKey: string;
  /** null if the relay confirmed the grant without surfacing a receipt. */
  grantTxHash: string | null;
  expiry: number;
}

/**
 * Create the Altana smart-account (passkey — biometric prompt), generate a
 * session key, grant the scoped session on-chain, and persist it locally.
 */
export async function createSession(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const s = await sdk();
  const c = await client();

  // Passkey-controlled smart wallet (biometric prompt).
  const wallet = await c.createPasskeyWallet({
    name: input.appName ?? "Agent-Street",
  });

  // Session signer: a generated key we own and persist (so hires don't re-prompt).
  const sessionSigner = s.createPrivateKeySigner();

  const permissions = {
    spend: input.caps.map((cap) => ({
      limit: BigInt(cap.limitBase),
      period: cap.period,
      ...(cap.token ? { token: cap.token as Address } : {}),
    })),
  };

  const granted = await c.grantSession({
    wallet,
    signer: wallet.signer,
    permissions,
    expiry: input.expirySec,
    sessionSigner,
    register: true, // keystore-registered → verifiable on-chain (explorer-visible)
  });

  writeStore(input.owner, {
    walletAddress: wallet.address,
    passkeyCredential: wallet.signer.credential,
    sessionKey: (sessionSigner as { _privateKey: Hex })._privateKey,
    serializedSession: s.serializeSession(granted),
    sessionPublicKey: granted.publicKey,
    expiry: input.expirySec,
    allowlist: input.allowlist,
    network: "bsc-testnet",
  });

  return {
    walletAddress: wallet.address,
    sessionPublicKey: granted.publicKey,
    grantTxHash: granted.transactionHash ?? null,
    expiry: input.expirySec,
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
  if (!stored) throw new Error("no_active_session");

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
  if (!stored) throw new Error("no_session");

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

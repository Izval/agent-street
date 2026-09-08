import { env } from "cloudflare:workers";
import { useEffect, useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";

import type { Route } from "./+types/manage";
import type { Session, SpendCap, SpendPeriod } from "../lib/contracts";
import { createSessionsClient } from "../lib/sessions-client";
import {
  createSession,
  revokeActiveSession,
  type CreateSessionResult,
} from "../lib/altana";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { WalletButton } from "../components/WalletButton";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Manage sessions — Agent-Street" }];
}

// Altana KeyStore on BSC testnet (chain 97) — public contract address for the
// "view in the keystore explorer" link. Not a key.
const KEYSTORE = "0x6b8361C29d05D498b1a12B54A37310f94171E94A";
const EXPLORER = "https://testnet.bscscan.com";

// Tokens offered for the spend cap on testnet (USDT is the marketplace settle token).
const TOKENS = {
  USDT: {
    address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
    decimals: 18,
    symbol: "USDT",
  },
  BNB: { address: null as string | null, decimals: 18, symbol: "BNB" },
} as const;
type TokenKey = keyof typeof TOKENS;

const PERIODS: SpendPeriod[] = ["hour", "day", "week", "month"];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  const agent = url.searchParams.get("agent"); // optional: allowlist prefill from /hire
  const sessions = address
    ? await createSessionsClient({
        baseUrl: env.HIRE_X402_URL,
        fetcher: env.HIRE_X402,
      }).list(address)
    : [];
  return { address, agent, sessions };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const client = createSessionsClient({
    baseUrl: env.HIRE_X402_URL,
    fetcher: env.HIRE_X402,
  });

  if (intent === "record") {
    let spend: SpendCap[] = [];
    let allowlist: string[] = [];
    try {
      spend = JSON.parse(String(form.get("spend") ?? "[]"));
      allowlist = JSON.parse(String(form.get("allowlist") ?? "[]"));
    } catch {
      return { session: null, error: "Invalid session data." };
    }
    const session = await client.record({
      owner: String(form.get("owner") ?? ""),
      walletAddress: String(form.get("walletAddress") ?? ""),
      id: String(form.get("id") ?? ""),
      spend,
      allowlist,
      expiry: Number(form.get("expiry") ?? 0),
      grantTxHash: String(form.get("grantTxHash") ?? "") || null,
    });
    return {
      session,
      error: session ? null : "The session was granted but could not be recorded.",
    };
  }

  if (intent === "revoke") {
    const session = await client.revoke({
      owner: String(form.get("owner") ?? ""),
      id: String(form.get("id") ?? ""),
      revokeTxHash: String(form.get("revokeTxHash") ?? "") || null,
    });
    return {
      session,
      error: session ? null : "The revocation could not be recorded.",
    };
  }

  return { session: null, error: "Unknown action." };
}

function humanizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/no_active_session|no_session/.test(msg)) return "No active session found.";
  if (/NotAllowed|denied|abort|cancel/i.test(msg))
    return "The passkey prompt was cancelled.";
  if (/insufficient|funds|balance/i.test(msg))
    return "The Altana wallet needs testnet BNB before it can grant a session.";
  return "Could not complete the operation. Check your wallet and try again.";
}

function capLabel(cap: SpendCap): string {
  const human = Number(formatUnits(BigInt(cap.limitBase), cap.decimals ?? 18));
  return `${human} ${cap.symbol ?? ""}/${cap.period}`.trim();
}

function statusTone(status: Session["status"]) {
  if (status === "active") return { text: "text-up", border: "border-up/40", label: "Active" };
  if (status === "expired")
    return { text: "text-text-3", border: "border-border", label: "Expired" };
  return { text: "text-down", border: "border-down/40", label: "Revoked" };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-text-3">{label}</span>
      <span className="tnum text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

function SessionCard({
  s,
  owner,
  onRevoke,
  revoking,
}: {
  s: Session;
  owner: string;
  onRevoke: (s: Session) => void;
  revoking: boolean;
}) {
  const tone = statusTone(s.status);
  const cap = s.spend[0];
  const nowSec = Math.floor(Date.now() / 1000);
  const secsLeft = s.expiry - nowSec;
  const expiryLabel =
    s.status !== "active"
      ? "—"
      : secsLeft > 86400
        ? `${Math.floor(secsLeft / 86400)}d`
        : secsLeft > 3600
          ? `${Math.floor(secsLeft / 3600)}h`
          : `${Math.max(0, Math.floor(secsLeft / 60))}m`;

  return (
    <Card className={`border p-6 ${tone.border}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
          Session · {cap ? capLabel(cap) : "no cap"}
        </h2>
        <span className={`text-xs font-bold uppercase ${tone.text}`}>{tone.label}</span>
      </div>

      <div className="mt-3">
        <Row
          label="Spend cap"
          value={cap ? capLabel(cap) : "—"}
        />
        <Row
          label="Used"
          value={
            s.usedAmount != null
              ? `${s.usedAmount} ${cap?.symbol ?? ""}`.trim()
              : "—"
          }
        />
        <Row
          label="Remaining"
          value={
            s.remainingAmount != null
              ? `${s.remainingAmount} ${cap?.symbol ?? ""}`.trim()
              : "—"
          }
        />
        <Row label="Expires in" value={expiryLabel} />
        <Row
          label="Allowlist"
          value={s.allowlist.length === 0 ? "Any listing" : `${s.allowlist.length} agent(s)`}
        />
        <Row
          label="Smart wallet"
          value={`${s.walletAddress.slice(0, 6)}…${s.walletAddress.slice(-4)}`}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {s.grantExplorerUrl && (
          <a
            href={s.grantExplorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[8px] border border-border px-4 py-2 text-xs font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
          >
            Grant tx ↗
          </a>
        )}
        <a
          href={`${EXPLORER}/address/${KEYSTORE}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-[8px] border border-border px-4 py-2 text-xs font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          Keystore explorer ↗
        </a>
        {s.revokeExplorerUrl && (
          <a
            href={s.revokeExplorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[8px] border border-down/40 px-4 py-2 text-xs font-semibold text-down transition-colors hover:border-down"
          >
            Revoke tx ↗
          </a>
        )}
        {s.status === "active" && (
          <button
            type="button"
            onClick={() => onRevoke(s)}
            disabled={revoking}
            className="ml-auto rounded-[8px] border border-down/40 px-4 py-2 text-xs font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-60"
          >
            {revoking ? "Revoking…" : "Revoke session"}
          </button>
        )}
      </div>
    </Card>
  );
}

export default function Manage({ loaderData }: Route.ComponentProps) {
  const { sessions, agent } = loaderData;
  const { address, isConnected } = useAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramAddr = searchParams.get("address");
  const fetcher = useFetcher<typeof action>();

  // Grant form state.
  const [amount, setAmount] = useState("5");
  const [token, setToken] = useState<TokenKey>("USDT");
  const [period, setPeriod] = useState<SpendPeriod>("day");
  const [expiryHours, setExpiryHours] = useState("24");
  const [phase, setPhase] = useState<
    "idle" | "passkey" | "granting" | "recording"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // Sync the connected wallet with ?address= so the loader lists this identity's sessions.
  useEffect(() => {
    if (isConnected && address && paramAddr !== address) {
      const next = new URLSearchParams(searchParams);
      next.set("address", address);
      setSearchParams(next, { replace: true });
    } else if (!isConnected && paramAddr) {
      const next = new URLSearchParams(searchParams);
      next.delete("address");
      setSearchParams(next, { replace: true });
    }
  }, [isConnected, address, paramAddr, searchParams, setSearchParams]);

  const busy = phase !== "idle" || fetcher.state !== "idle";
  const actionError = fetcher.data?.error ?? null;

  async function onGrant() {
    if (!address) return;
    setError(null);
    const meta = TOKENS[token];
    let limitBase: string;
    try {
      limitBase = parseUnits(amount || "0", meta.decimals).toString();
    } catch {
      setError("Enter a valid cap amount.");
      return;
    }
    if (limitBase === "0") {
      setError("The spend cap must be greater than zero.");
      return;
    }
    const caps: SpendCap[] = [
      {
        token: meta.address,
        limitBase,
        period,
        symbol: meta.symbol,
        decimals: meta.decimals,
      },
    ];
    const hours = Math.max(1, Number(expiryHours) || 24);
    const expirySec = Math.floor(Date.now() / 1000) + hours * 3600;
    const allowlist = agent ? [agent] : [];

    try {
      setPhase("passkey");
      let res: CreateSessionResult;
      try {
        res = await createSession({ owner: address, caps, allowlist, expirySec });
      } finally {
        setPhase("idle");
      }
      setPhase("recording");
      fetcher.submit(
        {
          intent: "record",
          owner: address,
          walletAddress: res.walletAddress,
          id: res.sessionPublicKey,
          spend: JSON.stringify(caps),
          allowlist: JSON.stringify(allowlist),
          expiry: String(res.expiry),
          grantTxHash: res.grantTxHash ?? "",
        },
        { method: "post" },
      );
      setPhase("idle");
    } catch (e) {
      setError(humanizeError(e));
      setPhase("idle");
    }
  }

  async function onRevoke(s: Session) {
    if (!address) return;
    setError(null);
    try {
      const res = await revokeActiveSession(address);
      fetcher.submit(
        {
          intent: "revoke",
          owner: address,
          id: s.id,
          revokeTxHash: res.revokeTxHash ?? "",
        },
        { method: "post" },
      );
    } catch (e) {
      setError(humanizeError(e));
    }
  }

  const grantLabel =
    phase === "passkey"
      ? "Confirm with your passkey…"
      : phase === "recording" || fetcher.state !== "idle"
        ? "Recording session…"
        : "Grant session";

  const active = sessions.filter((s) => s.status === "active");
  const past = sessions.filter((s) => s.status !== "active");

  return (
    <AppShell>
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-end justify-between py-2">
          <div>
            <h1 className="text-3xl font-bold">Manage sessions</h1>
            <p className="mt-1 text-sm text-text-3">
              Grant a spend-capped session once, then hire within the cap — no per-hire
              signature. Revocable on-chain anytime.
            </p>
          </div>
          <Link to="/me" className="text-sm text-text-3 transition-colors hover:text-text">
            ← My agents
          </Link>
        </div>

        {!isConnected ? (
          <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-sm text-text-2">
              Connect your wallet to grant and manage sessions.
            </p>
            <WalletButton />
          </Card>
        ) : (
          <>
            {/* Grant a new session */}
            <Card className="mt-6 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
                New session
              </h2>
              {agent && (
                <p className="mt-2 text-xs text-brand">
                  This session will be allowlisted to hire <span className="font-semibold">{agent}</span>.
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="col-span-2 text-xs text-text-3 sm:col-span-1">
                  Cap amount
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="tnum mt-1 w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                  />
                </label>
                <label className="text-xs text-text-3">
                  Token
                  <select
                    value={token}
                    onChange={(e) => setToken(e.target.value as TokenKey)}
                    className="mt-1 w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                  >
                    <option value="USDT">USDT</option>
                    <option value="BNB">BNB</option>
                  </select>
                </label>
                <label className="text-xs text-text-3">
                  Per
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as SpendPeriod)}
                    className="mt-1 w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-text-3">
                  Expiry (h)
                  <input
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(e.target.value)}
                    inputMode="numeric"
                    className="tnum mt-1 w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={onGrant}
                disabled={busy}
                className="mt-5 w-full rounded-[8px] bg-brand px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
              >
                {grantLabel}
              </button>
              <p className="mt-3 text-center text-xs text-text-3">
                Signed by a passkey on an Altana smart-account (not your extension wallet).
                The account must hold testnet BNB before its first on-chain action.
              </p>
              {(error || actionError) && (
                <p className="mt-3 text-center text-xs text-down">{error ?? actionError}</p>
              )}
            </Card>

            {/* Active sessions */}
            <div className="mt-8 flex flex-col gap-3">
              {active.length === 0 ? (
                <Card className="p-6 text-center text-sm text-text-3">
                  No active session yet. Grant one above to hire within a spend cap.
                </Card>
              ) : (
                active.map((s) => (
                  <SessionCard
                    key={s.id}
                    s={s}
                    owner={address!}
                    onRevoke={onRevoke}
                    revoking={busy}
                  />
                ))
              )}
            </div>

            {/* Past sessions */}
            {past.length > 0 && (
              <>
                <div className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-3">
                  Past sessions
                </div>
                <div className="flex flex-col gap-3">
                  {past.map((s) => (
                    <SessionCard
                      key={s.id}
                      s={s}
                      owner={address!}
                      onRevoke={onRevoke}
                      revoking={busy}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

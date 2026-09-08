import { env } from "cloudflare:workers";
import { useEffect, useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { agentHref } from "../lib/agents";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import type { Route } from "./+types/hire";
import { loadAgentDetail } from "../lib/detail";
import { createHireClient } from "../lib/x402";
import { executeHire, getActiveSession, sessionCoversAgent } from "../lib/altana";
import { createTrendingClient } from "../lib/trending";
import type { HireReceipt } from "../lib/contracts";
import { PAYMENT_CHAIN } from "../lib/wallet/config";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { X402Badge } from "../components/Badge";
import { WalletButton } from "../components/WalletButton";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Hire — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agent");
  if (!agentId) return { detail: null, quote: null };

  // BSC chain to resolve against: 56 (mainnet, default) or 97 (testnet); clamp others → 56.
  const chain = url.searchParams.get("chain") === "97" ? 97 : 56;
  const detail = await loadAgentDetail(
    {
      proxyUrl: env.PROXY_8004_URL,
      indexerUrl: env.ONCHAIN_INDEXER_URL,
      proxyFetcher: env.PROXY_8004,
      indexerFetcher: env.ONCHAIN_INDEXER,
    },
    agentId,
    chain,
  );
  if (!detail) return { detail, quote: null };

  const client = createHireClient({ payUrl: env.HIRE_X402_URL, fetcher: env.HIRE_X402 });
  // REAL quote: first we probe the agent's own 402; if it doesn't speak x402, we fall
  // back to the marketplace facilitator's quote (listing pricing, honest).
  const endpoint = detail.services?.a2aEndpoint ?? null;
  let quote =
    detail.services?.x402 && endpoint ? await client.probeQuote(endpoint) : null;
  if (!quote) quote = await client.facilitatorQuote(agentId);

  return { detail, quote };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const agentId = String(form.get("agentId") ?? "");
  const agentName = String(form.get("agentName") ?? "") || null;
  const endpoint = String(form.get("endpoint") ?? "");
  const task = String(form.get("task") ?? "");
  const acceptRaw = String(form.get("accept") ?? "");
  const txHash = String(form.get("txHash") ?? "");
  const from = String(form.get("from") ?? "") || null;
  const sessionId = String(form.get("sessionId") ?? "") || null;

  if (!agentId || !acceptRaw || !txHash) {
    return { receipt: null as HireReceipt | null, error: "Payment data is missing." };
  }

  let accept;
  try {
    accept = JSON.parse(acceptRaw);
  } catch {
    return { receipt: null as HireReceipt | null, error: "Invalid quote." };
  }

  const hire = createHireClient({ payUrl: env.HIRE_X402_URL, fetcher: env.HIRE_X402 });
  const paid = await hire.pay({ agentId, agentName, endpoint, accept, task, txHash, from, sessionId });

  // Verification seam unavailable → honest PENDING receipt (no made-up tx).
  const receipt: HireReceipt = paid ?? {
    status: "pending",
    txHash: null,
    explorerUrl: null,
    amount: null,
    assetSymbol: null,
    settledAt: null,
    detail:
      "The transaction was sent, but the onchain verifier did not respond. " +
      "The settlement will appear here once the seam is available again.",
  };

  // A real "hire" = a payment settled onchain. Only then does it count as demand.
  if (receipt.status === "settled") {
    await createTrendingClient({ baseUrl: env.ANALYTICS_URL, fetcher: env.ANALYTICS }).event(agentId, "hire");
  }

  return { receipt, error: null as string | null };
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

/** Human-friendly message for the most common wallet errors. */
function humanizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|4001/i.test(msg)) return "Signature cancelled in the wallet.";
  if (/insufficient funds/i.test(msg))
    return "Insufficient balance for the payment or gas.";
  if (/chain|network/i.test(msg) && /switch/i.test(msg))
    return "Could not switch to BSC testnet.";
  return "The payment could not be completed. Check your wallet and try again.";
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <span className="text-sm text-text-3">{label}</span>
      <span className="tnum text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

function Receipt({ receipt }: { receipt: HireReceipt }) {
  const tone =
    receipt.status === "settled"
      ? { border: "border-up/40", text: "text-up", label: "Settled" }
      : receipt.status === "pending"
        ? { border: "border-brand/40", text: "text-brand", label: "Pending" }
        : { border: "border-down/40", text: "text-down", label: "Failed" };
  const amount =
    receipt.amount != null
      ? `${receipt.amount} ${receipt.assetSymbol ?? ""}`.trim()
      : "—";
  return (
    <Card className={`mt-6 border p-6 ${tone.border}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
          Receipt · x402
        </h2>
        <span className={`text-xs font-bold uppercase ${tone.text}`}>{tone.label}</span>
      </div>
      <div className="mt-3">
        <Line label="Amount" value={amount} />
        <Line
          label="Tx"
          value={receipt.txHash ? `${receipt.txHash.slice(0, 10)}…` : "—"}
        />
        <Line
          label="Settled at"
          value={
            receipt.settledAt ? new Date(receipt.settledAt).toLocaleString() : "—"
          }
        />
      </div>
      {receipt.explorerUrl && (
        <a
          href={receipt.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block rounded-[8px] border border-border px-5 py-3 text-center text-sm font-semibold text-text transition-colors hover:border-brand"
        >
          View on BscScan ↗
        </a>
      )}
      {receipt.detail && (
        <p className="mt-3 text-center text-xs text-text-3">{receipt.detail}</p>
      )}
      {receipt.deliverable && <Deliverable deliverable={receipt.deliverable} />}
    </Card>
  );
}

// The work-product the hired agent returned. Rendered only when the agent's own
// endpoint replied with one — otherwise the receipt stays payment-only (honest).
function Deliverable({
  deliverable,
}: {
  deliverable: NonNullable<HireReceipt["deliverable"]>;
}) {
  return (
    <div className="mt-5 rounded-[8px] border border-up/40 bg-up/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-3">
          Deliverable
        </h3>
        <span className="text-[10px] font-bold uppercase text-up">from agent</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-text">{deliverable.title}</p>
      {deliverable.body && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-text-2">{deliverable.body}</p>
      )}
      {deliverable.links && deliverable.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {deliverable.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:border-brand"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Hire({ loaderData }: Route.ComponentProps) {
  const { detail, quote } = loaderData;
  const agent = detail?.agent ?? null;

  const fetcher = useFetcher<typeof action>();
  const receipt = fetcher.data?.receipt ?? null;
  const actionError = fetcher.data?.error ?? null;

  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<
    "idle" | "switching" | "paying" | "confirming" | "session"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  // Payment method: the single decision at hire — Direct (client-pays) or an
  // Altana spend-capped session. Defaults to Direct.
  const [method, setMethod] = useState<"direct" | "altana">("direct");
  // Whether an active session already covers this agent (client-only; localStorage).
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    if (isConnected && address && agent) {
      const s = getActiveSession(address);
      setHasSession(Boolean(s && sessionCoversAgent(s, agent.id)));
    } else {
      setHasSession(false);
    }
  }, [isConnected, address, agent]);

  const submitting = fetcher.state !== "idle";
  const busy = phase !== "idle" || submitting;

  const canHire = Boolean(agent && quote);
  const priceLabel =
    quote?.amount != null
      ? `${quote.amount} ${quote.assetSymbol ?? ""}`.trim()
      : "— USDT";

  const wrongChain = isConnected && chainId !== PAYMENT_CHAIN.id;

  async function onPayAndHire() {
    if (!agent || !quote) return;
    setError(null);

    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }

    try {
      if (chainId !== PAYMENT_CHAIN.id) {
        setPhase("switching");
        await switchChainAsync({ chainId: PAYMENT_CHAIN.id });
      }

      const accept = quote.accept;
      const value = BigInt(accept.maxAmountRequired);
      const payTo = accept.payTo as `0x${string}`;

      setPhase("paying");
      let hash: `0x${string}`;
      if (isNativeAsset(accept.asset)) {
        hash = await sendTransactionAsync({
          to: payTo,
          value,
          chainId: PAYMENT_CHAIN.id,
        });
      } else {
        hash = await writeContractAsync({
          address: accept.asset as `0x${string}`,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [payTo, value],
          chainId: PAYMENT_CHAIN.id,
        });
      }

      // Wait for onchain confirmation before sending the txHash to be verified.
      setPhase("confirming");
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setPhase("idle");
      fetcher.submit(
        {
          agentId: agent.id,
          agentName: agent.name,
          endpoint: detail?.services?.a2aEndpoint ?? "",
          task: quote.task,
          accept: JSON.stringify(quote.accept),
          txHash: hash,
          from: address,
        },
        { method: "post" },
      );
    } catch (e) {
      setError(humanizeError(e));
      setPhase("idle");
    }
  }

  // Altana path: hire under an active spend-capped session (no per-hire prompt).
  // If none covers this agent, route to /manage to grant one first.
  async function onHireWithSession() {
    if (!agent || !quote) return;
    setError(null);
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    const stored = getActiveSession(address);
    if (!stored || !sessionCoversAgent(stored, agent.id)) {
      navigate(`/manage?agent=${encodeURIComponent(agent.id)}`);
      return;
    }
    try {
      setPhase("session");
      const { txHash } = await executeHire({
        owner: address,
        asset: quote.accept.asset,
        payTo: quote.accept.payTo,
        amountBase: quote.accept.maxAmountRequired,
      });
      setPhase("idle");
      if (!txHash) {
        setError("The session executed but no tx hash was returned.");
        return;
      }
      fetcher.submit(
        {
          agentId: agent.id,
          agentName: agent.name,
          endpoint: detail?.services?.a2aEndpoint ?? "",
          task: quote.task,
          accept: JSON.stringify(quote.accept),
          txHash,
          from: address,
          sessionId: stored.sessionPublicKey,
        },
        { method: "post" },
      );
    } catch (e) {
      setError(humanizeError(e));
      setPhase("idle");
    }
  }

  const buttonLabel =
    phase === "switching"
      ? "Switching to BSC testnet…"
      : phase === "paying"
        ? "Confirm the payment in your wallet…"
        : phase === "confirming"
          ? "Confirming onchain…"
          : submitting
            ? "Verifying payment…"
            : !isConnected
              ? "Connect your wallet to hire"
              : `Pay & hire · ${priceLabel}`;

  return (
    <AppShell activeSubcategory={agent?.subcategory ?? undefined}>
      <div className="mx-auto max-w-[720px]">
        <div className="py-2">
          <Link
            to={agent ? agentHref(agent) : "/"}
            className="text-sm text-text-3 transition-colors hover:text-text"
          >
            ← {agent ? agent.name : "Marketplace"}
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Hire agent</h1>
        </div>

        {agent ? (
          <>
            {/* Agent summary */}
            <Card className="mt-4 flex items-center gap-3 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 font-bold text-text-2">
                {agent.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{agent.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {agent.subcategoryLabel && (
                    <span className="text-xs text-text-3">{agent.subcategoryLabel}</span>
                  )}
                  {quote && <X402Badge />}
                </div>
              </div>
            </Card>

            {/* Receipt (after paying) or quote + payment */}
            {receipt ? (
              <>
                <Receipt receipt={receipt} />
                <div className="mt-3 text-center">
                  <Link
                    to="/manage"
                    className="text-sm font-semibold text-brand hover:underline"
                  >
                    Manage sessions →
                  </Link>
                </div>
              </>
            ) : (
              <Card className="mt-6 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
                  Payment · x402
                </h2>
                <div className="mt-3">
                  <Line label="Task" value={quote?.task ?? "Rebalance LP (BNB-USDT)"} />
                  <Line label="Price" value={priceLabel} />
                  <Line label="Network" value={quote?.network ?? "—"} />
                  <Line
                    label="x402 supported"
                    value={
                      agent.x402Supported || detail?.services?.x402 ? "Yes" : "Unknown"
                    }
                  />
                  <Line
                    label="Pay to"
                    value={
                      quote?.payTo
                        ? `${quote.payTo.slice(0, 6)}…${quote.payTo.slice(-4)}`
                        : "—"
                    }
                  />
                  <Line
                    label="Quote expiry"
                    value={
                      quote?.expirySeconds != null ? `${quote.expirySeconds}s` : "—"
                    }
                  />
                </div>

                {canHire ? (
                  <>
                    {/* The one decision at hire: pay directly, or via an Altana session. */}
                    <div className="mt-6 grid grid-cols-2 gap-2 rounded-[10px] border border-border p-1">
                      <button
                        type="button"
                        onClick={() => setMethod("direct")}
                        className={`rounded-[8px] px-4 py-2 text-sm font-semibold transition-colors ${
                          method === "direct"
                            ? "bg-surface-2 text-text"
                            : "text-text-3 hover:text-text"
                        }`}
                      >
                        Pay directly
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("altana")}
                        className={`rounded-[8px] px-4 py-2 text-sm font-semibold transition-colors ${
                          method === "altana"
                            ? "bg-surface-2 text-text"
                            : "text-text-3 hover:text-text"
                        }`}
                      >
                        Altana session
                      </button>
                    </div>

                    {method === "direct" ? (
                      <>
                        <button
                          type="button"
                          onClick={onPayAndHire}
                          disabled={busy}
                          className="mt-4 w-full rounded-[8px] bg-brand px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {buttonLabel}
                        </button>
                        {wrongChain && (
                          <p className="mt-3 text-center text-xs text-brand">
                            Your wallet is on another network; we'll switch to BSC testnet when you pay.
                          </p>
                        )}
                        <p className="mt-3 text-center text-xs text-text-3">
                          You pay, from your own wallet, the real transfer to the agent's
                          wallet on BSC testnet. The marketplace verifies the tx onchain and
                          issues the receipt — a hash is never made up.
                        </p>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={onHireWithSession}
                          disabled={busy}
                          className="mt-4 w-full rounded-[8px] bg-brand px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {phase === "session"
                            ? "Hiring via session…"
                            : submitting
                              ? "Verifying payment…"
                              : !isConnected
                                ? "Connect your wallet to hire"
                                : hasSession
                                  ? `Hire with session · ${priceLabel}`
                                  : "Set up an Altana session →"}
                        </button>
                        <p className="mt-3 text-center text-xs text-text-3">
                          {hasSession
                            ? "Settled by your active session key within its spend cap — no new signature. "
                            : "Grant a spend-capped session once (passkey), then hire within the cap without signing each time. "}
                          <Link to="/manage" className="text-brand hover:underline">
                            Manage sessions
                          </Link>
                          .
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      disabled
                      className="mt-6 w-full cursor-not-allowed rounded-[8px] bg-surface-2 px-5 py-3 text-sm font-semibold text-text-disabled"
                      title="This agent doesn't expose a payout wallet / quote yet."
                    >
                      Quote unavailable
                    </button>
                    <p className="mt-3 text-center text-xs text-text-3">
                      The agent hasn't published an x402 endpoint or an onchain payout
                      wallet. No made-up price is shown; payment is enabled once there's
                      a real recipient and price.
                    </p>
                  </>
                )}

                {(error || actionError) && (
                  <p className="mt-3 text-center text-xs text-down">
                    {error ?? actionError}
                  </p>
                )}

                {!isConnected && (
                  <div className="mt-4 flex justify-center">
                    <WalletButton />
                  </div>
                )}
              </Card>
            )}
          </>
        ) : (
          <Card className="mt-4 p-6 text-sm text-text-2">
            No agent selected.{" "}
            <Link to="/" className="text-brand hover:underline">
              Back to the marketplace
            </Link>
            .
          </Card>
        )}
      </div>
    </AppShell>
  );
}

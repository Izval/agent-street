/**
 * /create — "Create your own agent" wizard (client-pays ERC-8004 mint).
 *
 * A 3-step wizard (Basics → Config → Review). On publish, the USER'S wallet mints
 * the ERC-8004 identity on-chain directly — `register(agentURI)` on the
 * IdentityRegistry (see `lib/erc8004.ts`) — so the user owns the identity and pays
 * their own gas (no treasury, no server-side signing). Once the mint confirms, the
 * route `action()` only LISTS the agent in the marketplace (proxy `/v1/submitted`)
 * with the real agentId + txHash. Wallet connection + a little tBNB are required.
 */

import { env } from "cloudflare:workers";
import { useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import { agentHref } from "../lib/agents";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { decodeEventLog } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import type { Route } from "./+types/create";
import type { Subcategory } from "../lib/taxonomy";
import {
  SUBCATEGORY_DEFS,
  SUBCATEGORY_BY_ID,
  SUBCATEGORIES,
  REQUIRED_SUBCATEGORIES,
  subcategoryLabel,
} from "../lib/taxonomy";
import { createListingClient } from "../lib/registrar";
import type { MintResult, PublishReceipt } from "../lib/registrar";
import { PAYMENT_CHAIN } from "../lib/wallet/config";
import { REGISTRY_BY_CHAIN, REGISTRY_ABI, buildAgentUri } from "../lib/erc8004";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { Select } from "../components/Select";
import { WalletButton } from "../components/WalletButton";

const EXPLORER = "https://testnet.bscscan.com";
const FAUCET = "https://testnet.bnbchain.org/faucet-smart";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Create agent — Agent-Street" }];
}

/**
 * List a freshly-minted agent in the marketplace. The on-chain mint already
 * happened in the browser (client-pays); this only persists the listing with the
 * real agentId + txHash the user's transaction produced.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const subcategory = String(form.get("subcategory") ?? "").trim();
  const endpoint = String(form.get("endpoint") ?? "").trim();
  const protocol = String(form.get("protocol") ?? "A2A").trim() || "A2A";
  const x402 = String(form.get("x402") ?? "") === "true";
  const agentId = String(form.get("agentId") ?? "").trim();
  const txHash = String(form.get("txHash") ?? "").trim();
  const ownerAddress = String(form.get("ownerAddress") ?? "").trim();
  const chainId = Number(form.get("chainId") ?? PAYMENT_CHAIN.id) || PAYMENT_CHAIN.id;

  if (!name || !description) {
    return { receipt: null as PublishReceipt | null, error: "Name and description are required." };
  }
  if (!subcategory || !(SUBCATEGORIES as readonly string[]).includes(subcategory)) {
    return { receipt: null as PublishReceipt | null, error: "Pick a subcategory for your agent." };
  }
  if (!agentId || !txHash || !ownerAddress) {
    return {
      receipt: null as PublishReceipt | null,
      error: "Missing on-chain mint result — the agent was not minted. Try publishing again.",
    };
  }

  const listing = createListingClient({
    proxyUrl: env.PROXY_8004_URL,
    fetcher: env.PROXY_8004,
  });

  try {
    const receipt = await listing.listCreatedAgent(
      { name, description, subcategory: subcategory as Subcategory, endpoint, protocol },
      { agentId, txHash, ownerAddress, chainId } satisfies MintResult,
      x402,
    );
    return { receipt, error: null as string | null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The mint already succeeded on-chain; only the marketplace listing failed.
    return {
      receipt: null as PublishReceipt | null,
      error: `Your agent was minted on-chain (tx ${txHash.slice(0, 12)}…) but listing it failed: ${msg}. It will still resolve on 8004scan; retry to list it here.`,
    };
  }
}

// ---- Client-side mint helpers ------------------------------------------ //

/** Base for the placeholder agent-card URL when the user leaves the endpoint blank. */
const PLACEHOLDER_BASE = "https://agent-street.pages.dev/agent/pending";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

/** Parse the `Registered(agentId, agentURI, owner)` event out of the receipt logs. */
function extractAgentId(
  logs: readonly { address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }[],
  registry: string,
): string | null {
  const reg = registry.toLowerCase();
  for (const log of logs) {
    if (log.address.toLowerCase() !== reg) continue;
    try {
      const decoded = decodeEventLog({
        abi: REGISTRY_ABI,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName === "Registered") {
        return String((decoded.args as { agentId: bigint }).agentId);
      }
    } catch {
      // Not the Registered event — keep scanning.
    }
  }
  return null;
}

/** Turn wallet/provider errors into a short, honest message for the wizard. */
function mintErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|rejected the request/i.test(msg)) {
    return "You rejected the signature — nothing was minted.";
  }
  if (/insufficient funds|exceeds the balance|gas required/i.test(msg)) {
    return "Not enough tBNB for gas. Top up from the faucet and retry.";
  }
  if (/reverted/i.test(msg)) {
    return "The register transaction reverted on-chain. Nothing was minted.";
  }
  return `Mint failed: ${msg.slice(0, 160)}`;
}

// ---- Small UI primitives (local to the wizard) ------------------------- //

const STEPS = ["Basics", "Config", "Review"] as const;

function Stepper({ step }: { step: number }) {
  return (
    <nav className="flex gap-6 border-b border-border">
      {STEPS.map((label, i) => (
        <span
          key={label}
          className={
            "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors " +
            (i === step
              ? "border-brand text-text"
              : i < step
                ? "border-transparent text-text-2"
                : "border-transparent text-text-3")
          }
        >
          <span className="tnum mr-2 text-text-3">{i + 1}</span>
          {label}
        </span>
      ))}
    </nav>
  );
}

const inputCls =
  "w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text placeholder:text-text-3 outline-none transition-colors focus:border-brand";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">{label}</span>
        {hint && <span className="text-xs text-text-3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SubcategoryPicker({
  value,
  onChange,
}: {
  value: Subcategory | "";
  onChange: (c: Subcategory) => void;
}) {
  const otherCats = SUBCATEGORY_DEFS.filter((c) => !c.required);
  const isRequired = value ? REQUIRED_SUBCATEGORIES.includes(value) : false;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REQUIRED_SUBCATEGORIES.map((id) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={
                "rounded-[8px] border px-3 py-3 text-left text-sm font-semibold transition-colors " +
                (active
                  ? "border-brand bg-brand/10 text-text"
                  : "border-border bg-surface-2 text-text-2 hover:border-brand/60")
              }
            >
              {subcategoryLabel(id)}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-xs text-text-3">or another subcategory</span>
        <Select
          className="flex-1"
          ariaLabel="Other subcategory"
          value={isRequired ? "" : value}
          onChange={(v) => onChange(v as Subcategory)}
          options={otherCats.map((c) => ({ value: c.id, label: c.label }))}
        />
      </div>
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-text-3">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

// ---- Success step ------------------------------------------------------- //

function Success({ receipt }: { receipt: PublishReceipt }) {
  return (
    <Card className="mt-6 border border-up/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
          Agent published
        </h2>
        <span className="text-xs font-bold uppercase text-up">Registered on-chain</span>
      </div>
      <div className="mt-3">
        <ReviewLine label="Agent ID" value={receipt.agentId} />
        <ReviewLine label="Tx" value={`${receipt.txHash.slice(0, 12)}…`} />
        <ReviewLine label="Network" value={`BSC testnet · ${receipt.chainId}`} />
        <ReviewLine
          label="Owner"
          value={`${receipt.ownerAddress.slice(0, 6)}…${receipt.ownerAddress.slice(-4)}`}
        />
      </div>

      <Link
        to={agentHref({ id: receipt.agentId, chainId: receipt.chainId })}
        className="mt-5 block rounded-[8px] bg-brand px-5 py-3 text-center text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
      >
        View your agent →
      </Link>
      <a
        href={`${EXPLORER}/tx/${receipt.txHash}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block rounded-[8px] border border-border px-5 py-3 text-center text-sm font-semibold text-text transition-colors hover:border-brand"
      >
        View transaction on BscScan ↗
      </a>
      <p className="mt-3 text-center text-xs text-text-3">
        You own this ERC-8004 identity — it was minted from your wallet, which
        paid the gas.
      </p>
    </Card>
  );
}

// ---- Wizard ------------------------------------------------------------- //

export default function Create() {
  const fetcher = useFetcher<typeof action>();
  const receipt = fetcher.data?.receipt ?? null;
  const actionError = fetcher.data?.error ?? null;
  const submitting = fetcher.state !== "idle";

  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: PAYMENT_CHAIN.id });
  const { data: balance } = useBalance({
    address,
    chainId: PAYMENT_CHAIN.id,
    query: { enabled: Boolean(address) },
  });

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subcategory, setSubcategory] = useState<Subcategory | "">("");
  const [endpoint, setEndpoint] = useState("");
  const [protocol, setProtocol] = useState("A2A");
  const [x402, setX402] = useState(false);
  const [touched, setTouched] = useState(false);
  // Client-side mint lifecycle (distinct from the fetcher's listing phase).
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  // tBNB needed: the user pays their own gas. Zero balance → block + faucet nudge.
  const hasFunds = balance ? balance.value > 0n : undefined;
  // Busy = signing/confirming the mint (minting) or persisting the listing (submitting).
  const busy = minting || submitting;

  const basicsValid = name.trim().length > 0 && description.trim().length > 0 && subcategory !== "";
  const catLabel = subcategory ? subcategoryLabel(subcategory) : "—";
  const template = subcategory ? SUBCATEGORY_BY_ID[subcategory]?.template : null;

  const stepError = useMemo(() => {
    if (!touched) return null;
    if (step === 0) {
      if (!name.trim()) return "Give your agent a name.";
      if (!description.trim()) return "Add a short description.";
      if (!subcategory) return "Pick a subcategory.";
    }
    return null;
  }, [touched, step, name, description, subcategory]);

  function next() {
    setTouched(true);
    if (step === 0 && !basicsValid) return;
    setTouched(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setTouched(false);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function publish() {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    setMintError(null);
    const registry = REGISTRY_BY_CHAIN[PAYMENT_CHAIN.id];
    if (!registry || !publicClient) {
      setMintError("Unsupported network — switch to BSC testnet and retry.");
      return;
    }

    setMinting(true);
    try {
      // 1. Make sure the wallet is on BSC testnet before signing.
      if (chainId !== PAYMENT_CHAIN.id) {
        await switchChainAsync({ chainId: PAYMENT_CHAIN.id });
      }

      // 2. Build the self-contained ERC-8004 agent URI (no off-chain hosting).
      const agentUri = buildAgentUri({
        name: name.trim(),
        description: description.trim(),
        endpoint: endpoint.trim() || `${PLACEHOLDER_BASE}/${slugify(name)}`,
        protocol: protocol.trim() || "A2A",
      });

      // 3. User signs + pays: register(agentURI) on the IdentityRegistry.
      const txHash = await writeContractAsync({
        address: registry,
        abi: REGISTRY_ABI,
        functionName: "register",
        args: [agentUri],
        chainId: PAYMENT_CHAIN.id,
      });

      // 4. Wait for the receipt and pull the new agentId from the Registered event.
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("The register transaction reverted on-chain.");
      }
      const agentId = extractAgentId(receipt.logs, registry);
      if (!agentId) {
        throw new Error("Minted, but could not read the agent id from the receipt.");
      }

      // 5. Hand the mint result to the action, which lists it in the marketplace.
      fetcher.submit(
        {
          name: name.trim(),
          description: description.trim(),
          subcategory,
          endpoint: endpoint.trim(),
          protocol: protocol.trim() || "A2A",
          x402: x402 ? "true" : "false",
          agentId,
          txHash,
          ownerAddress: address,
          chainId: String(PAYMENT_CHAIN.id),
        },
        { method: "post" },
      );
    } catch (e) {
      setMintError(mintErrorMessage(e));
    } finally {
      setMinting(false);
    }
  }

  return (
    <AppShell activeSubcategory={subcategory || undefined}>
      <div className="mx-auto max-w-[720px]">
        <div className="py-2">
          <Link
            to="/"
            className="text-sm text-text-3 transition-colors hover:text-text"
          >
            ← Marketplace
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Create your agent</h1>
          <p className="mt-1 text-sm text-text-2">
            Publish an ERC-8004 agent live on BSC testnet — discoverable in the
            marketplace in a few steps.
          </p>
        </div>

        {receipt ? (
          <Success receipt={receipt} />
        ) : (
          <Card className="mt-4 p-6">
            <Stepper step={step} />

            {/* Step 1 — Basics */}
            {step === 0 && (
              <div className="mt-5 flex flex-col gap-4">
                <Field label="Name" hint={`${name.length}/64`}>
                  <input
                    className={inputCls}
                    value={name}
                    maxLength={64}
                    placeholder="e.g. Yield Guardian"
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Description" hint={`${description.length}/600`}>
                  <textarea
                    className={inputCls + " min-h-[96px] resize-y"}
                    value={description}
                    maxLength={600}
                    placeholder="What does your agent do, and for which pair/protocol?"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <Field label="Subcategory">
                  <SubcategoryPicker value={subcategory} onChange={setSubcategory} />
                </Field>
              </div>
            )}

            {/* Step 2 — Config */}
            {step === 1 && (
              <div className="mt-5 flex flex-col gap-4">
                <Field label="A2A endpoint" hint="optional">
                  <input
                    className={inputCls}
                    value={endpoint}
                    maxLength={300}
                    placeholder="https://my-agent.example.com/.well-known/agent-card.json"
                    onChange={(e) => setEndpoint(e.target.value)}
                  />
                </Field>
                <p className="-mt-2 text-xs text-text-3">
                  Leave blank and a placeholder agent-card URL is recorded on-chain;
                  you can point it at your live agent later.
                </p>
                <Field label="Protocol">
                  <Select
                    ariaLabel="Protocol"
                    value={protocol}
                    onChange={setProtocol}
                    options={[
                      { value: "A2A", label: "A2A" },
                      { value: "MCP", label: "MCP" },
                    ]}
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-[8px] border border-border bg-surface-2 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={x402}
                    onChange={(e) => setX402(e.target.checked)}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  <span className="text-sm text-text">
                    Supports x402 payments
                    <span className="ml-2 text-xs text-text-3">
                      (pay-per-call via the ERC-8183 seller)
                    </span>
                  </span>
                </label>
              </div>
            )}

            {/* Step 3 — Review */}
            {step === 2 && (
              <div className="mt-5">
                <div className="rounded-[8px] border border-border p-4">
                  <ReviewLine label="Name" value={name.trim() || "—"} />
                  <ReviewLine label="Subcategory" value={catLabel} />
                  {template && <ReviewLine label="Template" value={template} />}
                  <ReviewLine label="Endpoint" value={endpoint.trim() || "placeholder (auto)"} />
                  <ReviewLine label="Protocol" value={protocol} />
                  <ReviewLine label="x402" value={x402 ? "Yes" : "No"} />
                  <ReviewLine label="Network" value="BSC testnet · 97" />
                </div>
                <p className="mt-3 text-sm text-text-2">{description.trim()}</p>

                {!isConnected ? (
                  <div className="mt-5 rounded-[8px] border border-brand/40 bg-brand/5 p-4">
                    <p className="text-sm text-text">
                      Connect your wallet to publish. You mint the ERC-8004 identity
                      yourself on BSC testnet — you own it, and your wallet pays the
                      gas (a fraction of a cent in tBNB).
                    </p>
                    <div className="mt-3 flex justify-center">
                      <WalletButton />
                    </div>
                  </div>
                ) : hasFunds === false ? (
                  <div className="mt-5 rounded-[8px] border border-down/40 bg-down/5 p-4">
                    <p className="text-sm text-text">
                      Your wallet has no tBNB to pay for gas. Grab some free testnet
                      BNB from the faucet, then publish.
                    </p>
                    <a
                      href={FAUCET}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block rounded-[8px] border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
                    >
                      Open BSC testnet faucet ↗
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 text-center text-xs text-text-3">
                    Owner:{" "}
                    <span className="tnum">
                      {address?.slice(0, 6)}…{address?.slice(-4)}
                    </span>{" "}
                    · you sign &amp; pay the mint on BSC testnet ({PAYMENT_CHAIN.name})
                  </p>
                )}
              </div>
            )}

            {(stepError || mintError || actionError) && (
              <p className="mt-4 text-center text-xs text-down">
                {stepError ?? mintError ?? actionError}
              </p>
            )}

            {/* Footer nav */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 0 || busy}
                className="rounded-[8px] border border-border px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={step === 0 && touched && !basicsValid}
                  className="rounded-[8px] bg-brand px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={publish}
                  disabled={busy || (isConnected && hasFunds === false)}
                  className="rounded-[8px] bg-brand px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {minting
                    ? "Confirm in your wallet…"
                    : submitting
                      ? "Listing your agent…"
                      : !isConnected
                        ? "Connect wallet to publish"
                        : "Mint on BSC testnet"}
                </button>
              )}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

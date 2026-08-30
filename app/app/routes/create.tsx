/**
 * /create — "Create your own agent" wizard (BNB Agent Studio publish flow).
 *
 * A friendly 3-step wizard (Basics → Config → Review) that publishes a new
 * ERC-8004 agent live on BSC testnet and lists it in the marketplace. The
 * orchestration runs server-side in `action()` (mirrors `/hire`): it calls the
 * registrar (`/v1/register`, onchain mint) then the proxy (`/v1/submitted`,
 * listing). Wallet connection is required — the connected address is recorded as
 * the listing's creator (the ERC-8004 token is held by the registrar's treasury-
 * funded ephemeral wallet; promotion to mainnet is done by the owner later).
 */

import { env } from "cloudflare:workers";
import { useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import type { Route } from "./+types/create";
import type { Category } from "../lib/taxonomy";
import {
  CATEGORY_DEFS,
  CATEGORY_BY_ID,
  CATEGORIES,
  REQUIRED_CATEGORIES,
  categoryLabel,
} from "../lib/taxonomy";
import { createRegistrarClient } from "../lib/registrar";
import type { PublishReceipt } from "../lib/registrar";
import { PAYMENT_CHAIN } from "../lib/wallet/config";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { Select } from "../components/Select";
import { WalletButton } from "../components/WalletButton";

const EXPLORER = "https://testnet.bscscan.com";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Create agent — Agent-Street" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const endpoint = String(form.get("endpoint") ?? "").trim();
  const protocol = String(form.get("protocol") ?? "A2A").trim() || "A2A";
  const x402 = String(form.get("x402") ?? "") === "true";
  const from = String(form.get("from") ?? "").trim() || null;

  if (!name || !description) {
    return { receipt: null as PublishReceipt | null, error: "Name and description are required." };
  }
  if (!category || !(CATEGORIES as readonly string[]).includes(category)) {
    return { receipt: null as PublishReceipt | null, error: "Pick a category for your agent." };
  }
  if (!from) {
    return { receipt: null as PublishReceipt | null, error: "Connect your wallet before publishing." };
  }

  const registrar = createRegistrarClient({
    registrarUrl: env.REGISTRAR_URL,
    proxyUrl: env.PROXY_8004_URL,
  });

  try {
    const receipt = await registrar.publish(
      { name, description, category: category as Category, endpoint, protocol },
      from,
      x402,
    );
    return { receipt, error: null as string | null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The registrar is the one non-Cloudflare hop; a fetch failure (unreachable
    // host / localhost in prod) reads as a network error. Tell those apart from a
    // genuine on-chain register failure so the message is actionable.
    const unreachable =
      /fetch failed|network|ECONNREFUSED|connect|dns|timed? ?out/i.test(msg);
    const error = unreachable
      ? "Publish failed: the registrar service is unreachable (check REGISTRAR_URL / that the registrar is running). Your agent was not registered — try again."
      : `Publish failed: ${msg}. Your agent was not registered — try again.`;
    return { receipt: null as PublishReceipt | null, error };
  }
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

function CategoryPicker({
  value,
  onChange,
}: {
  value: Category | "";
  onChange: (c: Category) => void;
}) {
  const otherCats = CATEGORY_DEFS.filter((c) => !c.required);
  const isRequired = value ? REQUIRED_CATEGORIES.includes(value) : false;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REQUIRED_CATEGORIES.map((id) => {
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
              {categoryLabel(id)}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-xs text-text-3">or another category</span>
        <Select
          className="flex-1"
          ariaLabel="Other category"
          value={isRequired ? "" : value}
          onChange={(v) => onChange(v as Category)}
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
  const registered = receipt.status === "registered";
  const tone = registered
    ? { border: "border-up/40", text: "text-up", label: "Registered on-chain" }
    : { border: "border-brand/40", text: "text-brand", label: "Pending" };
  return (
    <Card className={`mt-6 border p-6 ${tone.border}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
          Agent published
        </h2>
        <span className={`text-xs font-bold uppercase ${tone.text}`}>{tone.label}</span>
      </div>
      <div className="mt-3">
        <ReviewLine label="Agent ID" value={receipt.agentId ?? "—"} />
        <ReviewLine
          label="Tx"
          value={receipt.txHash ? `${receipt.txHash.slice(0, 12)}…` : "—"}
        />
        <ReviewLine label="Network" value={`BSC testnet · ${receipt.chainId}`} />
        <ReviewLine
          label="Creator"
          value={`${receipt.ownerAddress.slice(0, 6)}…${receipt.ownerAddress.slice(-4)}`}
        />
      </div>

      <Link
        to={`/agent/${encodeURIComponent(receipt.marketplaceId)}`}
        className="mt-5 block rounded-[8px] bg-brand px-5 py-3 text-center text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
      >
        View your agent →
      </Link>
      {receipt.txHash && (
        <a
          href={`${EXPLORER}/tx/${receipt.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-[8px] border border-border px-5 py-3 text-center text-sm font-semibold text-text transition-colors hover:border-brand"
        >
          View transaction on BscScan ↗
        </a>
      )}
      {receipt.mode === "dry_run" && (
        <p className="mt-3 text-center text-xs text-text-3">
          Listed in DRY_RUN mode — the registrar has no treasury key yet, so no
          on-chain identity was minted. Set <span className="tnum">TREASURY_PRIVATE_KEY</span> on
          the registrar to mint for real.
        </p>
      )}
      {receipt.detail && (
        <p className="mt-3 text-center text-xs text-text-3">{receipt.detail}</p>
      )}
    </Card>
  );
}

// ---- Wizard ------------------------------------------------------------- //

export default function Create() {
  const fetcher = useFetcher<typeof action>();
  const receipt = fetcher.data?.receipt ?? null;
  const actionError = fetcher.data?.error ?? null;
  const submitting = fetcher.state !== "idle";

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [endpoint, setEndpoint] = useState("");
  const [protocol, setProtocol] = useState("A2A");
  const [x402, setX402] = useState(false);
  const [touched, setTouched] = useState(false);

  const basicsValid = name.trim().length > 0 && description.trim().length > 0 && category !== "";
  const catLabel = category ? categoryLabel(category) : "—";
  const template = category ? CATEGORY_BY_ID[category]?.template : null;

  const stepError = useMemo(() => {
    if (!touched) return null;
    if (step === 0) {
      if (!name.trim()) return "Give your agent a name.";
      if (!description.trim()) return "Add a short description.";
      if (!category) return "Pick a category.";
    }
    return null;
  }, [touched, step, name, description, category]);

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

  function publish() {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    fetcher.submit(
      {
        name: name.trim(),
        description: description.trim(),
        category,
        endpoint: endpoint.trim(),
        protocol: protocol.trim() || "A2A",
        x402: x402 ? "true" : "false",
        from: address,
      },
      { method: "post" },
    );
  }

  return (
    <AppShell activeCategory={category || undefined}>
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
                <Field label="Category">
                  <CategoryPicker value={category} onChange={setCategory} />
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
                  Leave blank and the registrar assigns a placeholder card you can
                  update later.
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
                  <ReviewLine label="Category" value={catLabel} />
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
                      Connect your wallet to publish. Your address is recorded as
                      the agent's creator; you don't pay gas — the registrar mints
                      the identity for you on testnet.
                    </p>
                    <div className="mt-3 flex justify-center">
                      <WalletButton />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-center text-xs text-text-3">
                    Creator:{" "}
                    <span className="tnum">
                      {address?.slice(0, 6)}…{address?.slice(-4)}
                    </span>{" "}
                    · minted on BSC testnet ({PAYMENT_CHAIN.name})
                  </p>
                )}
              </div>
            )}

            {(stepError || actionError) && (
              <p className="mt-4 text-center text-xs text-down">
                {stepError ?? actionError}
              </p>
            )}

            {/* Footer nav */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 0 || submitting}
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
                  disabled={submitting}
                  className="rounded-[8px] bg-brand px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Publishing on BSC testnet…"
                    : !isConnected
                      ? "Connect wallet to publish"
                      : "Publish on BSC testnet"}
                </button>
              )}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

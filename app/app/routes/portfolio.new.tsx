import { env } from "cloudflare:workers";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import { useAccount } from "wagmi";

import type { Route } from "./+types/portfolio.new";
import { createPortfoliosClient, type PortfolioVisibility } from "../lib/portfolios-client";
import { createAgentsClient, type Agent } from "../lib/agents";
import { useSavedAgents, type SavedAgent } from "../lib/saved";
import { loadMyAgents, type HireRecord } from "../lib/me";
import {
  useDraftMembers,
  toggleDraft,
  readDraftMeta,
  setDraftMeta,
  clearDraft,
} from "../lib/portfolioDraft";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { WalletButton } from "../components/WalletButton";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Build a portfolio — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  // The proxy base for client-side agent search (8004-proxy is CORS-enabled).
  // When a wallet is connected the client syncs it into ?address so we can fetch
  // that wallet's hired agents as a second build-from pool (real, server-side).
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  const hired: HireRecord[] = address
    ? await loadMyAgents({ hireUrl: env.HIRE_X402_URL, hireFetcher: env.HIRE_X402 }, address)
        .then((m) => m.hires)
        .catch(() => [])
    : [];
  return { proxyUrl: env.PROXY_8004_URL, hired };
}

/** Agent (from the proxy) → the light snapshot the builder + draft store use. */
function agentToSnapshot(a: Agent): SavedAgent {
  return {
    id: a.id,
    name: a.name,
    subcategory: a.subcategory,
    subcategoryLabel: a.subcategoryLabel,
    score: a.score,
    imageUrl: a.imageUrl,
    source: a.source === "seed" ? "seed" : "8004scan",
    savedAt: Date.now(),
  };
}

/** A hired agent (hire-x402 record) → the same light snapshot shape. */
function hireToSnapshot(h: HireRecord): SavedAgent {
  return {
    id: h.agentId,
    name: h.agentName ?? h.agentId,
    subcategory: null,
    subcategoryLabel: null,
    score: 0,
    imageUrl: undefined,
    source: "8004scan",
    savedAt: Date.now(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const tagline = String(form.get("tagline") ?? "").trim();
  const creator = String(form.get("creator") ?? "").trim() || null;
  const visRaw = String(form.get("visibility") ?? "public");
  const visibility: PortfolioVisibility =
    visRaw === "unlisted" || visRaw === "private" ? visRaw : "public";
  let members: Array<{ agentId: string }> = [];
  try {
    const raw = JSON.parse(String(form.get("members") ?? "[]"));
    if (Array.isArray(raw)) {
      members = raw
        .map((m) => (typeof m === "string" ? m : m?.agentId))
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .map((agentId) => ({ agentId }));
    }
  } catch {
    /* invalid members payload */
  }

  if (!name || members.length < 2) {
    return {
      error: "Give it a name and pick at least two agents.",
      result: null as null | { slug: string; ownerSecret: string },
    };
  }

  const client = createPortfoliosClient({ baseUrl: env.PORTFOLIOS_URL, fetcher: env.PORTFOLIOS });
  const result = await client.create({
    name,
    tagline,
    members,
    creator: creator ? { address: creator } : null,
    visibility,
  });

  if (!result) {
    return {
      error:
        "Publishing is unavailable right now (the portfolios service didn't respond). " +
        "Your draft is kept locally — try again shortly.",
      result: null,
    };
  }
  return { error: null as string | null, result };
}

const SECRET_KEY = (slug: string) => `agent-street:portfolio:secret:${slug}`;

const VIS_OPTIONS: Array<{ value: PortfolioVisibility; label: string; hint: string }> = [
  { value: "public", label: "Public", hint: "Listed everywhere and ranked." },
  { value: "unlisted", label: "Unlisted", hint: "Only reachable with the link." },
  { value: "private", label: "Private", hint: "Only you, on this device." },
];

export default function PortfolioBuilder({ loaderData }: Route.ComponentProps) {
  const { proxyUrl, hired } = loaderData;
  const saved = useSavedAgents();
  // Members live in the shared draft store — the SAME set the agent-page "+"
  // fills, so anything you added arrives here pre-loaded and updates live.
  const chosen = useDraftMembers();
  const { address } = useAccount();
  const [params, setParams] = useSearchParams();
  const fetcher = useFetcher<typeof action>();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [visibility, setVisibility] = useState<PortfolioVisibility>("public");
  const hydrated = useRef(false);

  // Marketplace search (client-side, debounced against the CORS-enabled proxy).
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SavedAgent[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const page = await createAgentsClient({ baseUrl: proxyUrl, signal: ctrl.signal }).list({
        search: q,
        limit: 12,
      });
      setResults(page.agents.map(agentToSnapshot));
      setSearching(false);
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, proxyUrl]);

  // Hydrate name/tagline once from the draft (members come from the store).
  useEffect(() => {
    const meta = readDraftMeta();
    setName(meta.name);
    setTagline(meta.tagline);
    hydrated.current = true;
  }, []);

  // Persist name/tagline as they change (members persist via the draft store).
  useEffect(() => {
    if (!hydrated.current) return;
    setDraftMeta(name, tagline);
  }, [name, tagline]);

  // Sync the connected wallet into ?address so the loader can fetch its hires.
  useEffect(() => {
    if (address && params.get("address") !== address) {
      setParams(
        (p) => {
          p.set("address", address);
          return p;
        },
        { replace: true },
      );
    }
  }, [address, params, setParams]);

  const hiredPool = useMemo(() => {
    const seen = new Set<string>();
    const out: SavedAgent[] = [];
    for (const h of hired) {
      if (!h.agentId || seen.has(h.agentId)) continue;
      seen.add(h.agentId);
      out.push(hireToSnapshot(h));
    }
    return out;
  }, [hired]);

  const selectedIds = useMemo(() => new Set(chosen.map((a) => a.id)), [chosen]);

  // Build-from pool: saved + hired + anything already staged, deduped.
  const pool = useMemo(() => {
    const map = new Map<string, SavedAgent>();
    for (const a of saved) map.set(a.id, a);
    for (const a of hiredPool) if (!map.has(a.id)) map.set(a.id, a);
    for (const a of chosen) if (!map.has(a.id)) map.set(a.id, a);
    return [...map.values()];
  }, [saved, hiredPool, chosen]);

  const querying = query.trim().length >= 2;
  const displayed = querying ? results : pool;
  const result = fetcher.data?.result ?? null;
  const error = fetcher.data?.error ?? null;
  const publishing = fetcher.state !== "idle";

  // On success, stash the owner secret locally (never rendered) + clear the draft.
  useEffect(() => {
    if (!result) return;
    try {
      window.localStorage.setItem(SECRET_KEY(result.slug), result.ownerSecret);
    } catch {
      /* ignore */
    }
    clearDraft();
  }, [result]);

  function toggle(a: SavedAgent) {
    toggleDraft(a);
  }

  function publish() {
    fetcher.submit(
      {
        name,
        tagline,
        creator: address ?? "",
        visibility,
        members: JSON.stringify(chosen.map((a) => ({ agentId: a.id }))),
      },
      { method: "post" },
    );
  }

  const shareUrl =
    result && typeof window !== "undefined"
      ? `${window.location.origin}/portfolio/${result.slug}`
      : result
        ? `/portfolio/${result.slug}`
        : "";

  return (
    <AppShell>
      <div className="py-2">
        <Link
          to="/portfolios"
          className="text-sm text-text-3 transition-colors hover:text-text"
        >
          ← Portfolios
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Build a portfolio</h1>
        <p className="mt-2 max-w-[60ch] text-sm text-text-2">
          Bundle agents into a set others can copy or hire in one flow. Tap “＋” on any
          agent to drop it in, then pick more from your saved and hired agents below.
        </p>
      </div>

      {/* Published state. */}
      {result ? (
        <Card className="mt-4 border border-up/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
            Published
          </h2>
          <p className="mt-2 text-sm text-text-2">
            Your portfolio is live. Anyone with the link can view, copy, or hire it.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to={`/portfolio/${result.slug}`}
              className="inline-flex min-h-[40px] items-center rounded-[999px] bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
            >
              Open portfolio →
            </Link>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => {})}
              className="inline-flex min-h-[40px] items-center rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
            >
              Copy link
            </button>
          </div>
        </Card>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Picker. */}
          <div className="min-w-0">
            <Card className="p-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-3">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My DeFi starter"
                  className="mt-1.5 w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-text placeholder:text-text-3 focus:border-brand focus:outline-none"
                />
              </label>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-text-3">
                Tagline
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="One line on what this set does"
                  className="mt-1.5 w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-text placeholder:text-text-3 focus:border-brand focus:outline-none"
                />
              </label>
            </Card>

            <h2 className="mt-6 text-lg font-bold">
              Pick agents{" "}
              <span className="tnum text-sm font-normal text-text-3">
                ({chosen.length} selected)
              </span>
            </h2>

            {/* Search the whole marketplace, or fall back to your saved + hired agents. */}
            <div className="relative mt-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents to add…"
                className="w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-3 focus:border-brand focus:outline-none"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-3">
                  Searching…
                </span>
              )}
            </div>
            {!query.trim() && (
              <p className="mt-2 text-xs text-text-3">
                Showing your saved{hiredPool.length > 0 ? " and hired" : ""} agents. Search
                above to add any agent from the marketplace.
              </p>
            )}

            {displayed.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {displayed.map((a) => {
                  const on = selectedIds.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(a)}
                      className={
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors " +
                        (on
                          ? "border-brand bg-brand/[0.06]"
                          : "border-border bg-surface hover:border-text-3")
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          "grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border text-[11px] " +
                          (on ? "border-brand bg-brand text-bg" : "border-border text-transparent")
                        }
                      >
                        ✓
                      </span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold text-text-2">
                        {a.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text">
                          {a.name}
                        </span>
                        {a.subcategoryLabel && (
                          <span className="block truncate text-xs text-text-3">
                            {a.subcategoryLabel}
                          </span>
                        )}
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold text-text-2">
                        {a.score || ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : querying ? (
              !searching && (
                <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-text-3">
                  No agents match “{query.trim()}”.
                </p>
              )
            ) : (
              <EmptyState
                className="mt-3 border border-border bg-surface"
                icon="＋"
                title="Nothing staged yet"
                hint="Tap the ＋ on any agent to add it here, or search the marketplace above. Saved and hired agents show up automatically."
                action={
                  <Link
                    to="/"
                    className="inline-flex min-h-[36px] items-center rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
                  >
                    Browse agents
                  </Link>
                }
              />
            )}

            {/* Selected chips (so search results don't hide the current picks). */}
            {chosen.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {chosen.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a)}
                    className="inline-flex items-center gap-1.5 rounded-[999px] border border-brand/40 bg-brand/[0.06] px-2.5 py-1 text-xs font-semibold text-text transition-colors hover:border-brand"
                    title="Remove from portfolio"
                  >
                    {a.name}
                    <span aria-hidden className="text-text-3">
                      ✕
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Publish rail. */}
          <aside>
            <div className="sticky top-[120px]">
              <Card className="p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
                  Publish
                </h2>
                <p className="mt-2 text-xs text-text-3">
                  {chosen.length < 2
                    ? "Pick at least two agents to publish."
                    : `${chosen.length} agents · shareable link`}
                </p>

                {/* Visibility. */}
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-3">
                    Visibility
                  </div>
                  <div className="mt-2 inline-flex rounded-[999px] border border-border p-0.5">
                    {VIS_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setVisibility(o.value)}
                        aria-pressed={visibility === o.value}
                        className={
                          "min-h-[32px] rounded-[999px] px-3 text-xs font-semibold transition-colors " +
                          (visibility === o.value ? "bg-brand text-bg" : "text-text-2 hover:text-text")
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-text-3">
                    {VIS_OPTIONS.find((o) => o.value === visibility)?.hint}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={publish}
                  disabled={publishing || chosen.length < 2 || !name.trim()}
                  className="mt-4 w-full rounded-[8px] bg-brand px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishing ? "Publishing…" : "Publish portfolio"}
                </button>
                {error && <p className="mt-3 text-center text-xs text-down">{error}</p>}
                {!address && (
                  <div className="mt-4">
                    <p className="mb-2 text-center text-xs text-text-3">
                      Connect a wallet to be credited as the creator and to build from your
                      hired agents (optional).
                    </p>
                    <div className="flex justify-center">
                      <WalletButton />
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

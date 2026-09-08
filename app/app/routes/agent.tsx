import { env } from "cloudflare:workers";
import { Suspense, useEffect } from "react";
import { Await, Link, redirect } from "react-router";

import type { Route } from "./+types/agent";
import { loadAgentDetail } from "../lib/detail";
import { createAgentsClient, hireHref, agentHref, kebab, slugToId } from "../lib/agents";
import { createTrendingClient } from "../lib/trending";
import { createPortfoliosClient } from "../lib/portfolios-client";
import { createHireClient } from "../lib/x402";
import { fetchPairsWith } from "../lib/portfolios";
import { getProfileMeta } from "../lib/profile";
import { AppShell } from "../components/AppShell";
import { AgentCard } from "../components/AgentCard";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { SaveButton } from "../components/SaveButton";
import { AgentAccessPanel } from "../components/AgentAccessPanel";
import { AgentBackdrop } from "../components/profile/AgentBackdrop";
import { ProfileIdentity } from "../components/profile/ProfileIdentity";
import { ProfileAbout } from "../components/profile/ProfileAbout";
import { ProfileStats } from "../components/profile/ProfileStats";
import { TransactionsPanel, TransactionsSkeleton } from "../components/profile/TransactionsPanel";
import { createOnchainClient } from "../lib/onchain";
import type { HireTx, TradesResponse } from "../lib/contracts";
import { SpecialtyPanel } from "../components/profile/SpecialtyPanel";
import {
  ReputationSection,
  EquitySection,
  SkillsSection,
} from "../components/profile/sections";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.detail?.agent?.name ?? "Agent"} — Agent-Street` }];
}

/**
 * The "latest transactions" feed (onchain swaps + settled x402 hires). Fetched
 * OFF the critical path and streamed (see the loader's `transactions` promise), so
 * the profile paints without waiting on the slower NodeReal transfers call.
 */
async function loadTransactions(agent: {
  id: string;
  agentWallet?: string | null;
  ownerAddress?: string | null;
}): Promise<{ trades: TradesResponse | null; hires: HireTx[] }> {
  const wallet = agent.agentWallet ?? agent.ownerAddress ?? null;
  const onchain = createOnchainClient({
    baseUrl: env.ONCHAIN_INDEXER_URL,
    fetcher: env.ONCHAIN_INDEXER,
  });
  const [trades, hires] = await Promise.all([
    wallet ? onchain.trades(wallet) : Promise.resolve(null),
    createHireClient({ payUrl: env.HIRE_X402_URL, fetcher: env.HIRE_X402 }).recentHires(agent.id),
  ]);
  return { trades, hires: hires ?? [] };
}

export async function loader({ params, request }: Route.LoaderArgs) {
  // BSC chain to resolve against: 56 (mainnet, default) or 97 (testnet); clamp others → 56.
  const chain = new URL(request.url).searchParams.get("chain") === "97" ? 97 : 56;
  // URLs are readable `name-id` slugs; the bare token id is the trailing group.
  const tokenId = slugToId(params.id);
  const detail = await loadAgentDetail(
    {
      proxyUrl: env.PROXY_8004_URL,
      indexerUrl: env.ONCHAIN_INDEXER_URL,
      proxyFetcher: env.PROXY_8004,
      indexerFetcher: env.ONCHAIN_INDEXER,
    },
    tokenId,
    chain,
  );
  if (!detail) throw new Response("Not found", { status: 404 });

  // Canonicalize: a bare id or stale slug redirects to the real `name-id` URL.
  const canonical = detail.agent.name
    ? `${kebab(detail.agent.name)}-${detail.agent.id}`
    : detail.agent.id;
  if (params.id !== canonical) throw redirect(agentHref(detail.agent));

  // Dashboard hero + related rails — all best-effort (null/[] when a worker is
  // down; the profile still renders). Honesty: real feeds only (DESIGN.md §18).
  //  • usage    — first-party demand over time (views+hires) for the Usage tab.
  //  • affinity — REAL co-hires ("Frequently hired together").
  //  • pairsWith— complementary agents by subcategory (a recommendation).
  const [usage, affinity, pairsWith] = await Promise.all([
    createTrendingClient({ baseUrl: env.ANALYTICS_URL, fetcher: env.ANALYTICS }).series(
      detail.agent.id,
      { window: "7d" },
    ),
    createPortfoliosClient({ baseUrl: env.PORTFOLIOS_URL, fetcher: env.PORTFOLIOS }).affinity(
      detail.agent.id,
    ),
    detail.agent.subcategory
      ? fetchPairsWith(
          createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 }),
          detail.agent.subcategory,
          detail.agent.id,
          8,
        )
      : Promise.resolve([]),
  ]);

  return {
    detail,
    usage,
    // Streamed (unawaited promise) — the "latest transactions" table hydrates
    // after first paint instead of blocking the profile on NodeReal.
    transactions: loadTransactions(detail.agent),
    affinity: affinity?.rows ?? [],
    pairsWith,
    analyticsUrl: env.ANALYTICS_URL,
    mcpUrl: env.MCP_URL,
  };
}

export default function AgentDetail({ loaderData }: Route.ComponentProps) {
  const { detail, usage, transactions, affinity, pairsWith, analyticsUrl, mcpUrl } = loaderData;
  const { agent, services } = detail;
  const meta = getProfileMeta(agent);

  // Count the real visit (first-hand demand → trending engine).
  useEffect(() => {
    createTrendingClient({ baseUrl: analyticsUrl }).event(agent.id, "view");
  }, [agent.id, analyticsUrl]);

  const snapshot = {
    id: agent.id,
    name: agent.name,
    subcategory: agent.subcategory,
    subcategoryLabel: agent.subcategoryLabel,
    score: agent.score,
    imageUrl: agent.imageUrl,
    source: agent.source,
  };

  return (
    <AppShell
      activeCategory={detail.category ?? undefined}
      activeSubcategory={agent.subcategory ?? undefined}
    >
      <div className="pb-24 lg:pb-2">
        {/* ───────── Profile hero (immersive, full-bleed, image-driven) ─────────
            Cancels the <main> gutter (-mx/-mt) AND drops the inner horizontal
            padding so the agent's own photo runs to the very edge and FLUSH under
            the sticky header — no lateral or top gap, no boxed-in feel. The
            blurred photo is the hero's background (like the home category
            slideshow); the panels are translucent metal-frost glass so it bleeds
            through and tints the whole block, and the identity photo + description
            share the same material so they read as ONE agent-specific surface.
            The breadcrumb lives INSIDE, tucked over the backdrop. Columns: LEFT
            big identity photo + Hire · CENTER description · RIGHT charts. */}
        <div className="relative -mx-4 -mt-6 md:-mx-8 md:-mt-8">
          <AgentBackdrop
            imageUrl={agent.imageUrl}
            accent={meta.accent}
            seed={agent.id}
            category={meta.category}
          />

          <div className="relative mx-auto max-w-[1440px]">
            {/* Breadcrumb — overlaid on the hero's top-left corner (over the
                backdrop/photo), taking no vertical space, so there's NO dead
                band between the nav and the image: the hero art runs flush right
                up to the header. */}
            <Link
              to={agent.subcategory ? `/subcategory/${agent.subcategory}` : "/"}
              className="absolute left-0 top-0 z-20 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white/70 transition-colors hover:text-white md:px-6"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.65)" }}
            >
              ← {agent.subcategoryLabel ?? "Marketplace"}
            </Link>

            {/* The hero fills the viewport below the sticky header (h-16 + h-11
                = 108px) so the agent's art reads as a full-screen cover; the
                photo (flex-1) and glass panels stretch to that height. */}
            <div className="grid items-stretch gap-3 lg:min-h-[calc(100svh-108px)] lg:grid-cols-[minmax(380px,440px)_minmax(0,1fr)_320px] lg:gap-4">
              <ProfileIdentity detail={detail} meta={meta} />
              <ProfileAbout detail={detail} meta={meta} />
              {/* Stretch to the row height so both charts can split it 50/50. */}
              <div className="self-stretch pr-4 md:pr-6">
                <ProfileStats detail={detail} meta={meta} usage={usage} transactions={transactions} />
              </div>
            </div>

            <div className="mt-3 px-4 md:px-6 lg:mt-4">
              <Suspense fallback={<TransactionsSkeleton />}>
                <Await resolve={transactions} errorElement={<TransactionsSkeleton failed />}>
                  {(tx) => <TransactionsPanel trades={tx.trades} hires={tx.hires} />}
                </Await>
              </Suspense>
            </div>
          </div>
        </div>

        {/* ───────── Full profile (existing panels, kept) ─────────
            The prior CV body, moved below the dashboard so it can be folded
            into the hero over time. Some panels overlap the hero for now. */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2.5">
            <span aria-hidden className="h-4 w-1 rounded-[999px] bg-border" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
              Full profile
            </h2>
          </div>

          {/* Signature specialty block, full width. SpecialtyPanel renders a
              dedicated, per-category block for every template (Rebalancing gets
              ClmmSpecialty; Grid/Yield/Health/RWA/NFT/Services each get their own
              real, qualitative panel) — Agent Diversity is judged on equal depth. */}
          <div className="mb-4 lg:mb-6">
            <SpecialtyPanel detail={detail} meta={meta} />
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
            {/* About leads the hero (ProfileAbout); the body opens on reputation. */}
            <ReputationSection detail={detail} />

            <EquitySection detail={detail} />
            <SkillsSection detail={detail} />

            {/* Agent-native access (MCP + direct A2A/ERC-8183). */}
            <AgentAccessPanel
              mcpUrl={mcpUrl}
              agentId={agent.id}
              agentName={agent.name}
              services={services}
              x402Supported={agent.x402Supported}
            />

            {/* Data provenance (Data Quality is a judged criterion). */}
            <p className="text-xs text-text-3">
              Sources: <span className="text-text-2">8004scan</span> (reputation ·
              services) and <span className="text-text-2">onchain indexer</span>{" "}
              (portfolio · trades). Missing data is shown as “—”, never estimated.
            </p>
          </div>
        </section>

        {/* Frequently hired together — REAL co-hires from settled hires. Only
            shown when there's actual co-hire data (honest, never invented). */}
        {affinity.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-center gap-2.5">
              <span aria-hidden className="h-4 w-1 rounded-[999px] bg-brand" />
              <h2 className="text-lg font-semibold">Frequently hired together</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {affinity.map((a) => (
                <Link
                  key={a.agentId}
                  to={agentHref({ id: a.agentId, name: a.name })}
                  className="glass-panel flex items-center gap-3 rounded-lg p-4 transition-colors hover:shadow-[var(--elev-2)]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-text-2">
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{a.name}</span>
                    {a.subcategoryLabel && (
                      <span className="block truncate text-xs text-text-3">{a.subcategoryLabel}</span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-right text-[11px] text-text-3">
                    <span className="block font-semibold text-text">{a.coHires}×</span>
                    co-hired
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Pairs well with — complementary agents by subcategory (a
            recommendation, not a co-hire claim). Always-available companion to
            the real co-hire rail above. */}
        {pairsWith.length > 0 && (
          <section className="mt-10">
            <CollectionCarousel title="Pairs well with">
              {pairsWith.map((a) => (
                <AgentCard key={a.id} agent={a} />
              ))}
            </CollectionCarousel>
          </section>
        )}
      </div>

      {/* Mobile: pinned bottom action bar so Hire is always reachable. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-bg/95 p-3 backdrop-blur lg:hidden">
        <SaveButton agent={snapshot} variant="icon" className="h-11 w-11 shrink-0" />
        <Link
          to={hireHref(agent.id, agent.chainId)}
          className="flex flex-1 items-center justify-center rounded-[8px] bg-brand px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
        >
          Hire agent →
        </Link>
      </div>
    </AppShell>
  );
}

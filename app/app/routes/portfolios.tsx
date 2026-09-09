import { env } from "cloudflare:workers";
import { Link } from "react-router";

import type { Route } from "./+types/portfolios";
import { createAgentsClient } from "../lib/agents";
import { PORTFOLIO_RECIPES, resolvePortfolios } from "../lib/portfolios";
import { createPortfoliosClient, type LeaderboardWindow } from "../lib/portfolios-client";
import { AppShell } from "../components/AppShell";
import { PortfolioCard } from "../components/PortfolioCard";
import { CommunityPortfolioCard } from "../components/CommunityPortfolioCard";
import { EmptyState } from "../components/EmptyState";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Portfolios — Agent-Street" },
    {
      name: "description",
      content:
        "Curated sets of ERC-8004 agents on BNB Chain — hire a whole strategy, not one agent at a time.",
    },
  ];
}

const LB_WINDOWS: Array<{ id: LeaderboardWindow; label: string }> = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All time" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
  const client = createPortfoliosClient({ baseUrl: env.PORTFOLIOS_URL, fetcher: env.PORTFOLIOS });

  const lbRaw = new URL(request.url).searchParams.get("lb");
  const lbWindow: LeaderboardWindow =
    lbRaw === "7d" || lbRaw === "30d" ? lbRaw : "all";

  const [portfolios, community, leaderboard] = await Promise.all([
    resolvePortfolios(PORTFOLIO_RECIPES, agents),
    client.list({ scope: "trending", limit: 8 }),
    client.leaderboard({ metric: "copies", window: lbWindow, limit: 8 }),
  ]);

  // Only show portfolios that resolved at least one live member (honest).
  const populated = portfolios.filter((p) => p.agents.length > 0);
  return {
    portfolios: populated,
    community: community ?? [],
    leaderboard: leaderboard ?? [],
    lbWindow,
  };
}

export default function Portfolios({ loaderData }: Route.ComponentProps) {
  const { portfolios, community, leaderboard, lbWindow } = loaderData;

  return (
    <AppShell>
      {/* Header. */}
      <section className="py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-3">
          Marketplace
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Agent portfolios</h1>
        <p className="mt-2 max-w-[64ch] text-sm text-text-2">
          Sets of agents that work together — the "frequently hired together" of the marketplace.
          Discover ready-made starters, or <span className="text-text">build and share your own
          collection</span> for others to copy, hire and heart.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to="/portfolio/new"
            className="inline-flex min-h-[36px] items-center rounded-[999px] bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
          >
            Build a portfolio
          </Link>
          <span className="text-xs text-text-3">
            Aggregate figures are real 8004scan reputation — never invented returns.
          </span>
        </div>
      </section>

      {/* Starter (curated) grid. */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-1 rounded-[999px] bg-brand" />
          <h2 className="text-lg font-semibold">Starter portfolios</h2>
        </div>
        {portfolios.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((p) => (
              <PortfolioCard key={p.slug} portfolio={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="border border-border bg-surface"
            icon="◱"
            title="No portfolios to show yet"
            hint="Curated portfolios resolve from live 8004scan agents. When the proxy is unreachable there are no invented placeholders — check back shortly."
          />
        )}
      </section>

      {/* Community portfolios — the showcase for user-made sets. Always shown so
          the page doubles as the place to build & share; a Build tile leads the
          grid and an inviting empty state stands in until people publish. */}
      <section className="mt-12">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-1 rounded-[999px] bg-brand" />
          <h2 className="text-lg font-semibold">Community portfolios</h2>
        </div>
        <p className="mt-1.5 max-w-[62ch] text-sm text-text-2">
          Sets published by people on Agent-Street — public, copyable, and hearted by the
          community. Bundle the agents you rate and share your own.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Always-present "create" tile (Pinterest-style board starter). */}
          <Link
            to="/portfolio/new"
            className="group flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-surface/40 p-6 text-center transition-colors hover:border-brand hover:bg-surface"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border border-border text-3xl leading-none text-text-2 transition-colors group-hover:border-brand group-hover:text-brand">
              ＋
            </span>
            <span className="text-sm font-semibold text-text">Build a portfolio</span>
            <span className="max-w-[28ch] text-xs text-text-3">
              Bundle agents into a set others can copy, hire &amp; heart.
            </span>
          </Link>
          {community.map((p) => (
            <CommunityPortfolioCard key={p.slug} portfolio={p} />
          ))}
        </div>
        {community.length === 0 && (
          <p className="mt-3 text-xs text-text-3">
            No community portfolios yet — be the first to publish one.
          </p>
        )}
      </section>

      {/* Leaderboard (most copied) — first-party gamification counters. Kept
          mounted when a non-default window is selected so the tabs don't vanish. */}
      {(leaderboard.length > 0 || lbWindow !== "all") && (
        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="h-4 w-1 rounded-[999px] bg-brand" />
              <h2 className="text-lg font-semibold">Most copied</h2>
            </div>
            <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
              {LB_WINDOWS.map((w) => {
                const active = w.id === lbWindow;
                return (
                  <Link
                    key={w.id}
                    to={w.id === "all" ? "/portfolios" : `/portfolios?lb=${w.id}`}
                    preventScrollReset
                    aria-current={active}
                    className={
                      active
                        ? "rounded-full bg-brand px-3 py-1 text-xs font-semibold text-bg"
                        : "rounded-full px-3 py-1 text-xs font-semibold text-text-2 transition-colors hover:text-text"
                    }
                  >
                    {w.label}
                  </Link>
                );
              })}
            </div>
          </div>
          {leaderboard.length > 0 ? (
            <ol className="mt-4 flex flex-col gap-2">
              {leaderboard.map((r, i) => (
                <li key={r.slug}>
                  <Link
                    to={`/portfolio/${encodeURIComponent(r.slug)}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-brand"
                  >
                    <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-text-2">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">{r.name}</span>
                      <span className="block truncate text-xs text-text-3">{r.tagline}</span>
                    </span>
                    <span className="tnum shrink-0 text-right text-xs text-text-3">
                      <span className="font-semibold text-text">{r.copies}</span> copies
                      <br />
                      <span className="font-semibold text-text-2">{r.hireAlls}</span> hires
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-text-3">
              No copies in this window yet.
            </p>
          )}
        </section>
      )}
    </AppShell>
  );
}

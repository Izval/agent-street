import { env } from "cloudflare:workers";
import { useEffect } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/portfolio";
import { createAgentsClient } from "../lib/agents";
import { getRecipe, resolveRecipe, resolveUserPortfolio } from "../lib/portfolios";
import { createPortfoliosClient } from "../lib/portfolios-client";
import { AppShell } from "../components/AppShell";
import { AgentCard } from "../components/AgentCard";
import { KpiTile } from "../components/KpiTile";
import { PortfolioActions } from "../components/PortfolioActions";
import { coverStyle } from "../lib/cover";
import { scoreTone } from "../lib/score";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.portfolio?.name ?? "Portfolio";
  const tagline = loaderData?.portfolio?.tagline ?? "A set of ERC-8004 agents on BNB Chain.";
  const image = loaderData?.ogImage;
  const tags: Array<Record<string, string>> = [
    { title: `${name} — Agent-Street` },
    { name: "description", content: tagline },
    { property: "og:title", content: name },
    { property: "og:description", content: tagline },
    { name: "twitter:title", content: name },
    { name: "twitter:description", content: tagline },
  ];
  if (image) {
    tags.push(
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: image },
    );
  }
  return tags;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
  const origin = new URL(request.url).origin;
  const ogImage = `${origin}/portfolio/${encodeURIComponent(params.slug)}/og`;

  // Curated recipe first (app-side, always available); else a user portfolio
  // from the portfolios worker (worker degrades → real 404).
  const recipe = getRecipe(params.slug);
  if (recipe) {
    const portfolio = await resolveRecipe(recipe, agents);
    return { portfolio, portfoliosUrl: env.PORTFOLIOS_URL, ogImage };
  }

  const client = createPortfoliosClient({ baseUrl: env.PORTFOLIOS_URL, fetcher: env.PORTFOLIOS });
  const userPf = await client.get(params.slug);
  if (!userPf) throw new Response("Not found", { status: 404 });
  const portfolio = await resolveUserPortfolio(userPf, agents);
  return { portfolio, portfoliosUrl: env.PORTFOLIOS_URL, ogImage };
}

const KPI_TONE: Record<"up" | "brand" | "down", "up" | "down" | "neutral"> = {
  up: "up",
  brand: "neutral",
  down: "down",
};

export default function PortfolioDetail({ loaderData }: Route.ComponentProps) {
  const { portfolio, portfoliosUrl } = loaderData;
  const { slug, name, tagline, accent, coverKey, agents, missing, aggregate, source, creator } =
    portfolio;
  const avgTone = aggregate.avgScore != null ? scoreTone(aggregate.avgScore) : null;

  // Count the visit for user portfolios (first-party demand → leaderboard).
  useEffect(() => {
    if (source !== "user") return;
    createPortfoliosClient({ baseUrl: portfoliosUrl }).event(slug, "view");
  }, [source, slug, portfoliosUrl]);

  return (
    <AppShell>
      <div className="py-2">
        <Link
          to="/portfolios"
          className="text-sm text-text-3 transition-colors hover:text-text"
        >
          ← Portfolios
        </Link>
      </div>

      {/* Hero. */}
      <section
        className="relative overflow-hidden rounded-lg border border-border p-6 sm:p-8"
        style={coverStyle(coverKey, accent)}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: accent }}
        />
        <div className="relative max-w-[62ch]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3.5 w-1 rounded-[999px]"
              style={{ background: accent }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-3">
              {source === "user" ? "Community portfolio" : "Curated portfolio"}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text">{name}</h1>
          <p className="mt-2 text-sm text-text-2">{tagline}</p>
          {creator?.address && (
            <p className="mt-2 text-xs text-text-3">
              by{" "}
              <span className="text-text-2">
                {creator.label ?? `${creator.address.slice(0, 6)}…${creator.address.slice(-4)}`}
              </span>
            </p>
          )}

          {/* Diversity chips (real taxonomy). */}
          {aggregate.subcategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {aggregate.subcategories.map((c) => (
                <span
                  key={c.id}
                  className="rounded-[999px] bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-text-2 backdrop-blur-sm"
                >
                  {c.label}
                  {c.n > 1 && <span className="tnum text-text-3"> ·{c.n}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Aggregate KPIs — real 8004scan fields only, no invented ROI. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Agents" value={aggregate.count} />
        <KpiTile
          label="Avg score"
          value={aggregate.avgScore != null ? aggregate.avgScore.toFixed(1) : "—"}
          tone={avgTone ? KPI_TONE[avgTone] : "neutral"}
          hint="8004scan reputation"
        />
        <KpiTile label="Verified" value={aggregate.verifiedCount} hint="onchain" />
        <KpiTile label="x402 ready" value={aggregate.x402Count} hint="pay-per-call" />
      </div>

      {/* Actions (Save all · Share · Copy · Hire all). Client island. */}
      <div className="mt-4">
        <PortfolioActions portfolio={portfolio} portfoliosUrl={portfoliosUrl} />
      </div>

      {/* Members. */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">
          Agents in this portfolio{" "}
          <span className="tnum text-sm font-normal text-text-3">({agents.length})</span>
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>

        {/* Gaps: slots with no live agent yet. */}
        {missing.length > 0 && (
          <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-xs text-text-3">
            No live agent yet for:{" "}
            <span className="text-text-2">
              {missing.map((m) => m.label).join(", ")}
            </span>
            . These slots stay empty rather than show a placeholder — they fill in as agents
            register on 8004scan.
          </p>
        )}
      </section>

      <p className="mt-6 text-xs text-text-3">
        Portfolios are sets of independent ERC-8004 agents. Aggregate figures are real 8004scan
        reputation across members — not a combined return. Each agent is hired and paid separately,
        from your own wallet, with a real onchain transaction.
      </p>
    </AppShell>
  );
}

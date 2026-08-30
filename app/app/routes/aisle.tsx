import { env } from "cloudflare:workers";

import type { Route } from "./+types/aisle";
import { createAgentsClient, type Agent } from "../lib/agents";
import {
  AISLES,
  categoriesInAisle,
  categoryLabel,
  type Aisle,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { CategoryHero } from "../components/CategoryHero";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { AgentFeatureCard } from "../components/AgentFeatureCard";

/** Agents fetched per subcategory row (fills the carousel). */
const PER_ROW = 8;

/** Editorial tagline per aisle (top-level category). Sentence case, concrete. */
const AISLE_TAGLINE: Record<Aisle, string> = {
  trading:
    "Agents that trade your capital with clear rules and verifiable onchain execution.",
  defi: "Rebalancing, yield and health — DeFi agents that manage your capital onchain.",
  nft: "Agents that track floor, volume and opportunities across NFT collections.",
  rwa: "Agents that manage real-world assets tokenized on the chain.",
  infra:
    "Data, wallets and automation — the infrastructure other agents plug into.",
  payments:
    "x402 micropayments and job delegation between agents (ERC-8183).",
  social: "Onchain sentiment, signals and narrative hunting.",
};

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.aisle?.label ?? "Category";
  return [{ title: `${label} — Agent-Street` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const aisle = AISLES.find((a) => a.id === params.id);
  if (!aisle) throw new Response("Not found", { status: 404 });

  const cats = categoriesInAisle(aisle.id);
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL });
  const pages = await Promise.all(
    cats.map((c) => agents.list({ category: c.id, limit: PER_ROW })),
  );

  const rows = cats.map((c, i) => ({
    id: c.id,
    label: categoryLabel(c.id),
    agents: pages[i].agents,
  }));

  // Honest hero metadata: total agents across subcategories + data source.
  const total = pages.reduce((sum, p) => sum + p.pagination.total, 0);
  const fromSeed = pages.length > 0 && pages.every((p) => p.fromSeed);

  return { aisle, rows, total, fromSeed };
}

export default function AislePage({ loaderData }: Route.ComponentProps) {
  const { aisle, rows, total, fromSeed } = loaderData;
  const accent = aisle.accent;
  const source = fromSeed ? "seed" : "8004scan";
  const subCount = rows.length;

  return (
    <AppShell activeAisle={aisle.id as Aisle}>
      {/* Category hero (top-level category — same language as a subcategory). */}
      <CategoryHero
        label={aisle.label}
        eyebrow="Marketplace"
        parentTo="/"
        tagline={AISLE_TAGLINE[aisle.id]}
        count={total}
        source={source}
        templateLabel={`${subCount} ${
          subCount === 1 ? "subcategory" : "subcategories"
        }`}
        accent={accent}
        coverSeed={`aisle-${aisle.id}`}
      />

      {/* One carousel per subcategory. */}
      {rows.map((row) => (
        <div key={row.id} className="mt-8">
          <CollectionCarousel
            title={row.label}
            seeAllTo={`/category/${row.id}`}
            accent={accent}
          >
            {row.agents.length ? (
              row.agents.map((a: Agent) => (
                <AgentFeatureCard
                  key={a.id}
                  agent={a}
                  accent={accent}
                  eyebrow={a.categoryLabel ?? row.label}
                />
              ))
            ) : (
              <p className="py-6 text-sm text-text-3">
                No agents indexed in this subcategory yet.
              </p>
            )}
          </CollectionCarousel>
        </div>
      ))}
    </AppShell>
  );
}

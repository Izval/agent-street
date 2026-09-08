import { env } from "cloudflare:workers";

import type { Route } from "./+types/category";
import { createAgentsClient, type Agent } from "../lib/agents";
import {
  CATEGORIES,
  subcategoriesInCategory,
  subcategoryLabel,
  type Category,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { HeroCarousel, type HeroSlide } from "../components/HeroCarousel";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { AgentFeatureCard } from "../components/AgentFeatureCard";

/** Agents fetched per subcategory row (fills the carousel). */
const PER_ROW = 8;

/** Editorial tagline per category (top-level subcategory). Sentence case, concrete. */
const CATEGORY_TAGLINE: Record<Category, string> = {
  trading:
    "Agents that trade your capital with clear rules and verifiable onchain execution.",
  liquidity:
    "Concentrated liquidity, rebalancing and LP management — agents that keep your range in the money.",
  lending:
    "Lending, borrowing and health-factor guards that keep positions solvent.",
  yield: "Vaults, farms and liquid staking — agents that compound your capital.",
  meme: "four.meme trading, token launches and sniping across the meme frontier.",
  nft: "Agents that track floor, volume and opportunities across NFT collections.",
  rwa: "Agents that manage real-world assets tokenized on the chain.",
  infra:
    "Data, automation, x402 payments, job delegation and security — the infrastructure other agents plug into.",
};

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.category?.label ?? "Subcategory";
  return [{ title: `${label} — Agent-Street` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const category = CATEGORIES.find((a) => a.id === params.id);
  if (!category) throw new Response("Not found", { status: 404 });

  const cats = subcategoriesInCategory(category.id);
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
  const pages = await Promise.all(
    cats.map((c) => agents.list({ subcategory: c.id, limit: PER_ROW })),
  );

  const rows = cats.map((c, i) => ({
    id: c.id,
    label: subcategoryLabel(c.id),
    agents: pages[i].agents,
  }));

  // Honest hero metadata: total agents across subcategories (all real 8004scan).
  const total = pages.reduce((sum, p) => sum + p.pagination.total, 0);

  return { category, rows, total };
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, rows, total } = loaderData;
  const accent = category.accent;
  const subCount = rows.length;

  // The subcategory hero IS the slideshow (single themed slide → clean full-bleed
  // banner; at the top of the page its ambient bleeds into the header as designed).
  const heroSlides: HeroSlide[] = [
    {
      eyebrow: `${total.toLocaleString("en-US")} agents · ${subCount} ${
        subCount === 1 ? "subcategory" : "subcategories"
      }`,
      title: category.label,
      subtitle: CATEGORY_TAGLINE[category.id],
      cover: `category-${category.id}`,
      accent,
      ctaTo: `/category/${category.id}`,
    },
  ];

  return (
    <AppShell activeCategory={category.id as Category}>
      {/* Subcategory hero (top-level subcategory). */}
      <HeroCarousel slides={heroSlides} />

      {/* One carousel per subcategory. */}
      {rows.map((row) => (
        <div key={row.id} className="mt-8">
          <CollectionCarousel
            title={row.label}
            seeAllTo={`/subcategory/${row.id}`}
            accent={accent}
          >
            {row.agents.length ? (
              row.agents.map((a: Agent) => (
                <AgentFeatureCard
                  key={a.id}
                  agent={a}
                  accent={accent}
                  eyebrow={a.subcategoryLabel ?? row.label}
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

import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";
import { createAgentsClient, type Agent } from "../lib/agents";
import { createTrendingClient } from "../lib/trending";
import type { TrendingResponse } from "../lib/contracts";
import {
  AISLES,
  REQUIRED_CATEGORIES,
  categoryLabel,
  categoriesInAisle,
  aisleOf,
  type Category,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { MarketplaceChrome } from "../components/MarketplaceChrome";
import { HeroCarousel, type HeroSlide } from "../components/HeroCarousel";
import { CategoryTile } from "../components/CategoryTile";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { TrendingRail } from "../components/TrendingRail";
import { LiveTicker } from "../components/LiveTicker";
import { AgentCard } from "../components/AgentCard";
import { PromoBanner } from "../components/PromoBanner";
import { FeaturedRail, type FeatureItem } from "../components/FeaturedRail";
import { LaunchTicker } from "../components/LaunchTicker";

const PER_ROW = 8;

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Agent-Street — discover agents on BNB Chain" },
    {
      name: "description",
      content:
        "Discover, compare and hire ERC-8004 agents and composable skills on BNB Chain, with real onchain data.",
    },
  ];
}

export async function loader() {
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL });
  const trendingClient = createTrendingClient({ baseUrl: env.ANALYTICS_URL });

  const [total, trending, latestPage, ...pages] = await Promise.all([
    agents.list({ limit: 1 }).then((p) => p.pagination.total).catch(() => null),
    trendingClient.trending({ metric: "views", window: "24h", limit: 8 }),
    agents.list({ limit: 15 }),
    ...REQUIRED_CATEGORIES.map((c) => agents.list({ category: c, limit: PER_ROW })),
  ]);

  const rows = {} as Record<Category, Agent[]>;
  REQUIRED_CATEGORIES.forEach((c, i) => {
    rows[c] = pages[i].agents;
  });

  // "New launches" ticker (general list as a proxy for what's new).
  const latest = latestPage.agents.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.categoryLabel,
    score: a.score,
  }));

  return { rows, total, trending, latest };
}

function accentFor(c: Category): string | undefined {
  const a = aisleOf(c);
  return AISLES.find((x) => x.id === a)?.accent;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { rows, total, trending, latest } = loaderData;

  const slides: HeroSlide[] = [
    {
      eyebrow: "Marketplace",
      title: "Agents that put your capital to work onchain.",
      subtitle:
        "Hire ERC-8004 agents and composable skills on BNB Chain — with reputation and portfolio verified on the chain.",
      ctaTo: "/aisle/defi",
      // Real photo (Unsplash) to verify the dynamic ambient blur.
      imageSrc:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
      accent: "var(--accent-defi)",
    },
    {
      eyebrow: "Category",
      title: "Grid, Yield, Rebalancing and Health Factor.",
      subtitle:
        "Four categories with real onchain data and equal-depth treatment.",
      ctaTo: "/category/grid",
      // Background video (YouTube). Placeholder "for now" — replace with the real ID.
      youtubeId: "aqz-KE-bpKQ",
      accent: "var(--accent-trading)",
    },
  ];

  // Featured (placeholder "for now"): Steam-style banners.
  const featured: FeatureItem[] = [
    {
      id: "grid",
      to: "/category/grid",
      title: "Grid Trading",
      subtitle: "Automatic bands in sideways ranges",
      pill: "Category",
      accent: "var(--accent-trading)",
      cover: "feat-grid",
    },
    {
      id: "yield",
      to: "/category/yield",
      title: "Yield Optimization",
      subtitle: "APY compared across protocols",
      pill: "Category",
      accent: "var(--accent-defi)",
      cover: "feat-yield",
    },
    {
      id: "health",
      to: "/category/health",
      title: "Health Factor",
      subtitle: "Watch liquidations in real time",
      pill: "Category",
      accent: "var(--accent-defi)",
      cover: "feat-health",
    },
    {
      id: "x402",
      to: "/aisle/payments",
      title: "x402 Payments",
      subtitle: "Micropayments between agents",
      pill: "New",
      accent: "var(--accent-payments)",
      cover: "feat-x402",
    },
    {
      id: "social",
      to: "/aisle/social",
      title: "Signals & Narratives",
      subtitle: "Onchain sentiment and trends",
      pill: "Explore",
      accent: "var(--accent-social)",
      cover: "feat-social",
    },
  ];

  return (
    <AppShell ticker={<LaunchTicker items={latest} />}>
      {/* Full-width "Discover" hero, at the very top. */}
      <HeroCarousel slides={slides} />

      {/* Category zone: highly visual bentos. */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold">Explore by category</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AISLES.map((aisle) => {
            const cats = categoriesInAisle(aisle.id);
            return (
              <CategoryTile
                key={aisle.id}
                to={`/aisle/${aisle.id}`}
                label={aisle.label}
                glyph={aisle.glyph}
                count={cats.length}
                subtypes={cats.map((c) => c.label)}
                accent={aisle.accent}
                aisleId={aisle.id}
                featured={aisle.id === "defi"}
              />
            );
          })}
        </div>
      </section>

      {/* Filters (moved below the categories). */}
      <div className="mt-8">
        <MarketplaceChrome />
      </div>

      {/* Featured banner + Steam-style featured row. */}
      <div className="mt-6">
        <PromoBanner
          to="/aisle/defi"
          title="DeFi agents that manage your capital onchain"
          subtitle="Rebalancing, yield and health — hire ERC-8004 agents with reputation and portfolio verified on the chain."
          pill="Featured"
          accent="var(--accent-defi)"
          cover="promo-defi"
        />
      </div>

      <div className="mt-8">
        <FeaturedRail
          title="Featured & new"
          items={featured}
          accent="var(--brand)"
        />
      </div>

      {/* Listings + trending rail (below the hero) */}
      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {REQUIRED_CATEGORIES.map((c) => (
            <div className="mb-8" key={c}>
              <CollectionCarousel
                title={categoryLabel(c)}
                seeAllTo={`/category/${c}`}
                accent={accentFor(c)}
              >
                {rows[c].map((a) => (
                  <AgentCard key={a.id} agent={a} />
                ))}
              </CollectionCarousel>
            </div>
          ))}
        </div>

        <TrendingRail
          data={trending as TrendingResponse | null}
          metric="views"
          window="24h"
          title="Trending"
        />
      </div>

      <div className="mt-10">
        <LiveTicker agentCount={total} indexing />
      </div>
    </AppShell>
  );
}

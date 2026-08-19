import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";
import { createIvlClient } from "../lib/ivl";
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
import { seedAgentById, FLAGSHIP_ID } from "../lib/seed";
import { AppShell } from "../components/AppShell";
import { MarketplaceChrome } from "../components/MarketplaceChrome";
import { HeroCarousel, type HeroSlide } from "../components/HeroCarousel";
import { CategoryTile } from "../components/CategoryTile";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { TrendingRail } from "../components/TrendingRail";
import { LiveTicker } from "../components/LiveTicker";
import { AgentCard } from "../components/AgentCard";

const FLAGSHIP_PAIR = "BNB-USDT";
const PER_ROW = 8;

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Agent-Street — descubre agentes en BNB Chain" },
    {
      name: "description",
      content:
        "Descubre, compara y contrata agentes ERC-8004 y skills componibles en BNB Chain, con datos onchain reales.",
    },
  ];
}

export async function loader() {
  const ivl = createIvlClient({ baseUrl: env.IVL_API_URL });
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL });
  const trendingClient = createTrendingClient({ baseUrl: env.ANALYTICS_URL });

  const [ticks, total, trending, ...pages] = await Promise.all([
    ivl.ticks(FLAGSHIP_PAIR).catch(() => null),
    agents.list({ limit: 1 }).then((p) => p.pagination.total).catch(() => null),
    trendingClient.trending({ metric: "views", window: "24h", limit: 8 }),
    ...REQUIRED_CATEGORIES.map((c) => agents.list({ category: c, limit: PER_ROW })),
  ]);

  const rows = {} as Record<Category, Agent[]>;
  REQUIRED_CATEGORIES.forEach((c, i) => {
    let list = pages[i].agents;
    if (c === "rebalancing") {
      const flag = seedAgentById(FLAGSHIP_ID)!;
      const live = ticks ? { ...flag, score: ticks.ivl_score } : flag;
      list = [live, ...list.filter((a) => a.id !== FLAGSHIP_ID)].slice(0, PER_ROW);
    }
    rows[c] = list;
  });

  const ivlScore = ticks?.ivl_score ?? null;
  return { rows, ivlScore, total, trending };
}

function accentFor(c: Category): string | undefined {
  const a = aisleOf(c);
  return AISLES.find((x) => x.id === a)?.accent;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { rows, ivlScore, total, trending } = loaderData;

  const slides: HeroSlide[] = [
    {
      eyebrow: "Agente insignia · en vivo",
      title: "IVL Rebalancer",
      subtitle: ivlScore
        ? `Score IVL ${ivlScore} en BNB-USDT — reposiciona liquidez concentrada en PancakeSwap v3, gestionado onchain.`
        : "Reposiciona liquidez concentrada en PancakeSwap v3, gestionado onchain.",
      ctaLabel: "Ver dashboard",
      ctaTo: `/agent/${FLAGSHIP_ID}`,
      live: true,
      accent: "var(--accent-defi)",
    },
    {
      eyebrow: "Marketplace",
      title: "Agentes que trabajan tu capital onchain.",
      subtitle:
        "Contrata agentes ERC-8004 y skills componibles en BNB Chain — con reputación y portfolio verificados en la cadena.",
      ctaLabel: "Explorar DeFi",
      ctaTo: "/aisle/defi",
      accent: "var(--accent-defi)",
    },
    {
      eyebrow: "Categoría",
      title: "Grid, Yield, Rebalancing y Health Factor.",
      subtitle:
        "Cuatro categorías con datos onchain reales y trato de igual profundidad.",
      ctaLabel: "Ver Grid Trading",
      ctaTo: "/category/grid",
      accent: "var(--accent-trading)",
    },
  ];

  return (
    <AppShell>
      <MarketplaceChrome />

      <div className="mt-4">
        <HeroCarousel slides={slides} />
      </div>

      {/* Tarjetas de categoría con fondo propio por aisle */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold">Explora por categoría</h2>
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

      {/* Listados + rail de trending (al bajar del hero) */}
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
                  <AgentCard key={a.id} agent={a} featured={a.id === FLAGSHIP_ID} />
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

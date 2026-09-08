import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";
import { createAgentsClient, type Agent } from "../lib/agents";
import { createTrendingClient, reputationTrending } from "../lib/trending";
import {
  CATEGORIES,
  REQUIRED_SUBCATEGORIES,
  subcategoryLabel,
  subcategoriesInCategory,
  categoryOf,
  type Category,
  type Subcategory,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { CategoryBento } from "../components/CategoryBento";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { PortfolioCard } from "../components/PortfolioCard";
import { PORTFOLIO_RECIPES, resolvePortfolios } from "../lib/portfolios";
import { TrendingRail } from "../components/TrendingRail";
import { AgentCard } from "../components/AgentCard";
import { PromoBanner } from "../components/PromoBanner";
import { FeaturedRail, type FeatureItem } from "../components/FeaturedRail";
import { LaunchTicker } from "../components/LaunchTicker";

const PER_ROW = 8;

/**
 * Editorial copy + mosaic placement for the subcategory bento. `place` holds the
 * asymmetric lg-grid area (a 4-col × 12-row mosaic). The top-left block is the
 * marketing hero (h1/h2, see `HeroPanel`); Liquidity Providing holds the big
 * top-right feature (home of IVL); the remaining subcategories + a Skills tile wrap
 * it. Below lg the tiles stack (1 col) / pair (2 col, wide tiles spanning both).
 */
const BENTO: Record<Category, { caption: string; title?: string; place: string }> = {
  trading: {
    caption: "Grid, DCA, momentum, signals & perps",
    place:
      "min-h-[260px] sm:col-span-2 sm:min-h-[300px] lg:min-h-0 lg:[grid-column:3/5] lg:[grid-row:1/7]",
  },
  liquidity: {
    title: "Liquidity Providing",
    caption: "Concentrated liquidity & LP rebalancing",
    place: "min-h-[180px] lg:min-h-0 lg:[grid-column:2] lg:[grid-row:1/4]",
  },
  lending: {
    caption: "Lending, borrowing & health factor",
    place: "min-h-[180px] lg:min-h-0 lg:[grid-column:2] lg:[grid-row:4/7]",
  },
  meme: {
    caption: "four.meme trading, launches & sniping",
    place: "min-h-[180px] lg:min-h-0 lg:[grid-column:2] lg:[grid-row:7/10]",
  },
  yield: {
    caption: "Vaults, farms & liquid staking",
    place: "min-h-[180px] lg:min-h-0 lg:[grid-column:3] lg:[grid-row:7/10]",
  },
  rwa: {
    caption: "Tokenized assets & treasury",
    place: "min-h-[180px] lg:min-h-0 lg:[grid-column:4] lg:[grid-row:7/10]",
  },
  nft: {
    caption: "Floor sweeps & mints",
    place:
      "min-h-[180px] sm:col-span-2 lg:min-h-0 lg:[grid-column:1/3] lg:[grid-row:10/13]",
  },
  infra: {
    caption: "Data, automation, x402, jobs & security",
    place:
      "min-h-[180px] sm:col-span-2 lg:min-h-0 lg:[grid-column:3/5] lg:[grid-row:10/13]",
  },
};

/** The Skills tile (not an category) — links to the composable-skills index. */
const SKILLS_BENTO = {
  title: "Skills",
  caption: "Composable modules agents plug in",
  place: "min-h-[180px] lg:min-h-0 lg:[grid-column:1] lg:[grid-row:7/10]",
};

/**
 * Order the single explorer beam tours the tiles — a roughly clockwise path so
 * the light hops between spatial neighbours. Index = when a tile lights up in
 * the shared loop (see `.bento-beam` in app.css). Length must match `--beam-n`.
 */
const BEAM_ORDER = [
  "liquidity",
  "trading",
  "rwa",
  "infra",
  "nft",
  "skills",
  "meme",
  "yield",
  "lending",
];

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
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
  const trendingClient = createTrendingClient({ baseUrl: env.ANALYTICS_URL, fetcher: env.ANALYTICS });

  const [total, viewsDemand, hiresDemand, pool, portfolios, ...pages] =
    await Promise.all([
      agents.list({ limit: 1 }).then((p) => p.pagination.total).catch(() => null),
      trendingClient.trending({ metric: "views", window: "24h", limit: 8 }),
      trendingClient.trending({ metric: "hires", window: "24h", limit: 8 }),
      // A pool of top agents (sorted by score) that feeds the ticker + the base
      // rankings that keep the Trending tabs populated before demand accumulates.
      agents.list({ limit: 30 }),
      // Curated portfolios across the 7 categories (a cross-section, not just the 4 mandatory).
      resolvePortfolios(PORTFOLIO_RECIPES.slice(0, 6), agents).then((ps) =>
        ps.filter((p) => p.agents.length > 0),
      ),
      ...REQUIRED_SUBCATEGORIES.map((c) => agents.list({ subcategory: c, limit: PER_ROW })),
    ]);

  const rows = {} as Record<Subcategory, Agent[]>;
  REQUIRED_SUBCATEGORIES.forEach((c, i) => {
    rows[c] = pages[i].agents;
  });

  // "New launches" ticker (top of the pool as a proxy for what's new).
  const latest = pool.agents.slice(0, 15).map((a) => ({
    id: a.id,
    name: a.name,
    subcategory: a.subcategoryLabel,
    score: a.score,
  }));

  // Three Trending tabs, all populated with REAL data so none are ever empty:
  //  - Top:        ranked by on-chain score (8004scan) — always reputation-based.
  //  - Trending:   first-party views if we have them, else base-ranked by reviews.
  //  - Most hired: first-party hires if we have them, else base-ranked by stars.
  const hasRows = (t: typeof viewsDemand) => !!t && t.rows.length > 0;
  const trendingTabs = {
    top: reputationTrending(pool.agents, { window: "24h", limit: 8, basis: "score" }),
    trending: hasRows(viewsDemand)
      ? viewsDemand!
      : reputationTrending(pool.agents, { window: "24h", limit: 8, basis: "feedbacks" }),
    hired: hasRows(hiresDemand)
      ? hiresDemand!
      : reputationTrending(pool.agents, { window: "24h", limit: 8, basis: "stars" }),
  };

  return { rows, total, trendingTabs, latest, portfolios };
}

function accentFor(c: Subcategory): string | undefined {
  const a = categoryOf(c);
  return CATEGORIES.find((x) => x.id === a)?.accent;
}

/**
 * HeroPanel — the marketplace headline, floating (no card/border/background) in
 * the top-left block of the subcategory mosaic so the value prop lands in the first
 * screen, no scroll. Just the h1 + subtitle over the page background, lit by a
 * scarce BNB-yellow glow spilling from the top-left corner.
 */
function HeroPanel({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="Agent-Street marketplace"
      className={"relative isolate flex flex-col justify-center " + className}
    >
      {/* Scarce BNB-yellow glow, spilling from the top-left corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-28 -z-10 h-80 w-80"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(240,185,11,0.20), rgba(240,185,11,0.06) 45%, transparent 70%)",
          filter: "blur(6px)",
        }}
      />
      <div className="max-w-[24rem]">
        <h1 className="text-3xl font-bold leading-[1.05] tracking-tight text-[var(--text)] sm:text-4xl">
          Agents that put your capital to work onchain.
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-[var(--text-2)] sm:text-base">
          Hire ERC-8004 agents and composable skills on BNB Chain.
        </p>
      </div>
    </section>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { rows, total, trendingTabs, latest, portfolios } = loaderData;

  // Featured (placeholder "for now"): Steam-style banners.
  const featured: FeatureItem[] = [
    {
      id: "grid",
      to: "/subcategory/grid",
      title: "Grid Trading",
      subtitle: "Automatic bands in sideways ranges",
      pill: "Subcategory",
      accent: "var(--accent-trading)",
      cover: "feat-grid",
    },
    {
      id: "yield",
      to: "/subcategory/yield",
      title: "Yield Optimization",
      subtitle: "APY compared across protocols",
      pill: "Subcategory",
      accent: "var(--accent-yield)",
      cover: "feat-yield",
    },
    {
      id: "health",
      to: "/subcategory/health",
      title: "Health Factor",
      subtitle: "Watch liquidations in real time",
      pill: "Subcategory",
      accent: "var(--accent-lending)",
      cover: "feat-health",
    },
    {
      id: "x402",
      to: "/subcategory/payments-x402",
      title: "x402 Payments",
      subtitle: "Micropayments between agents",
      pill: "New",
      accent: "var(--accent-infra)",
      cover: "feat-x402",
    },
    {
      id: "meme",
      to: "/category/meme",
      title: "Meme",
      subtitle: "four.meme trading and launches",
      pill: "Explore",
      accent: "var(--accent-meme)",
      cover: "feat-meme",
    },
  ];

  return (
    <AppShell ticker={<LaunchTicker items={latest} />} agentCount={total} network="BSC">
      {/* Hero + subcategory mosaic: the value prop sits in the top-left block and
          the 7 categories wrap it — context and a click-path into the tools in the
          first screen, no scroll needed. */}
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[repeat(12,minmax(0,1fr))] lg:h-[calc(128vh_-_11rem)] lg:max-h-[1040px] lg:min-h-[640px]">
          <HeroPanel className="py-2 sm:col-span-2 lg:py-0 lg:[grid-column:1] lg:[grid-row:1/7]" />
          {CATEGORIES.map((category) => {
            const cats = subcategoriesInCategory(category.id);
            const b = BENTO[category.id];
            return (
              <CategoryBento
                key={category.id}
                to={`/category/${category.id}`}
                label={b.title ?? category.label}
                caption={b.caption}
                image={`/img/bento/${category.id}.avif`}
                category={category.id}
                accent={category.accent}
                count={cats.length}
                featured={category.id === "trading"}
                beamIndex={BEAM_ORDER.indexOf(category.id)}
                className={b.place}
              />
            );
          })}
          <CategoryBento
            to="/skills"
            label={SKILLS_BENTO.title}
            caption={SKILLS_BENTO.caption}
            image="/img/bento/skills.avif"
            accent="var(--brand)"
            beamIndex={BEAM_ORDER.indexOf("skills")}
            className={SKILLS_BENTO.place}
          />
        </div>
      </section>

      {/* Featured banner + Steam-style featured row. */}
      <div className="mt-16">
        <PromoBanner
          to="/category/liquidity"
          title="Liquidity agents that manage your capital onchain"
          subtitle="Concentrated liquidity, rebalancing and LP management — hire ERC-8004 agents with reputation and portfolio verified on the chain."
          pill="Featured"
          accent="var(--accent-liquidity)"
          cover="promo-liquidity"
        />
      </div>

      <div className="mt-8">
        <FeaturedRail
          title="Featured & new"
          items={featured}
          accent="var(--brand)"
        />
      </div>

      {/* Agent portfolios — curated sets, "frequently hired together". */}
      {portfolios.length > 0 && (
        <div className="mt-10">
          <CollectionCarousel
            title="Agent portfolios"
            seeAllTo="/portfolios"
            accent="var(--brand)"
          >
            {portfolios.map((p) => (
              <PortfolioCard key={p.slug} portfolio={p} />
            ))}
          </CollectionCarousel>
        </div>
      )}

      {/* Listings + trending rail (below the hero) */}
      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {REQUIRED_SUBCATEGORIES.map((c) => (
            <div className="mb-8" key={c}>
              <CollectionCarousel
                title={subcategoryLabel(c)}
                seeAllTo={`/subcategory/${c}`}
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
          title="Trending"
          tabs={[
            { key: "top", label: "Top", data: trendingTabs.top },
            { key: "trending", label: "Trending", data: trendingTabs.trending },
            { key: "hired", label: "Most hired", data: trendingTabs.hired },
          ]}
        />
      </div>
    </AppShell>
  );
}

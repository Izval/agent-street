import { env } from "cloudflare:workers";

import type { Route } from "./+types/category";
import { createAgentsClient, type Agent, type AgentsClient } from "../lib/agents";
import {
  CATEGORIES,
  subcategoriesInCategory,
  subcategoryLabel,
  type Category,
  type Subcategory,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { CategoryHero } from "../components/CategoryHero";
import { FeaturedRail, type FeatureItem } from "../components/FeaturedRail";
import {
  AgentsBrowser,
  type AgentSort,
  type CategoryListing,
} from "../components/AgentsBrowser";
import { agentHref } from "../lib/agents";

/** 8004scan's hard page cap — the max agents one list request can return. */
const PAGE_LIMIT = 100;

/** Number of top agents highlighted in the "Featured" strip under the hero. */
const FEATURED = 5;

/** Page size of the sortable listing grid (multiple of 4 → clean rows). */
const PAGE_SIZE = 12;

/** Observable demand on 8004scan: feedbacks weigh most, then stars, then score. */
function popularityKey(a: Agent): number {
  return a.feedbacks * 1000 + a.stars * 10 + a.score;
}

/**
 * Fetch EVERY agent in a subcategory (not just the first page): read page 1 to
 * learn the real total, then pull the remaining pages in parallel. A category is
 * a bounded subset of the ~1.4k-agent corpus, so the whole category ships to the
 * client for instant in-browser filtering — and it grows automatically as the
 * marketplace does, with no artificial cap.
 */
async function listAllInSubcategory(
  agents: AgentsClient,
  subcategory: Agent["subcategory"],
): Promise<{ agents: Agent[]; total: number }> {
  if (!subcategory) return { agents: [], total: 0 };
  const first = await agents.list({ subcategory, page: 1, limit: PAGE_LIMIT });
  const total = first.pagination.total;
  const pageCount = Math.ceil(total / PAGE_LIMIT);
  if (pageCount <= 1) return { agents: first.agents, total };
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      agents.list({ subcategory, page: i + 2, limit: PAGE_LIMIT }),
    ),
  );
  return { agents: [...first.agents, ...rest.flatMap((p) => p.agents)], total };
}

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

export async function loader({ params, request }: Route.LoaderArgs) {
  const category = CATEGORIES.find((a) => a.id === params.id);
  if (!category) throw new Response("Not found", { status: 404 });

  const cats = subcategoriesInCategory(category.id);
  const catIds = new Set<Subcategory>(cats.map((c) => c.id));

  // URL-driven state (filters / sort / page) — every combination is a distinct
  // crawlable, shareable page.
  const url = new URL(request.url);
  const sort: AgentSort =
    url.searchParams.get("sort") === "recent" ? "recent" : "popular";
  const selectedSubs = url.searchParams
    .getAll("subcategory")
    .filter((s): s is Subcategory => catIds.has(s as Subcategory));
  const verifiedOnly = url.searchParams.get("verified") === "1";

  const agents = createAgentsClient({
    baseUrl: env.PROXY_8004_URL,
    fetcher: env.PROXY_8004,
  });
  // Every agent in each subcategory (fully paged), fetched in parallel.
  const results = await Promise.all(
    cats.map((c) => listAllInSubcategory(agents, c.id)),
  );

  // Merge the per-subcategory pools into one category pool, dedup by id (an
  // agent could surface in more than one fetch).
  const byId = new Map<string, Agent>();
  for (const r of results) for (const a of r.agents) if (!byId.has(a.id)) byId.set(a.id, a);
  const pool = [...byId.values()];

  // Facet counts + hero total come from 8004scan's real per-subcategory totals.
  const facets = cats.map((c, i) => ({
    id: c.id,
    label: subcategoryLabel(c.id),
    count: results[i].total,
  }));
  const total = results.reduce((sum, r) => sum + r.total, 0);

  // Rank the whole pool by observable demand (no agent is hard-coded). The full
  // category ships to the client — no cap, so it scales with the marketplace.
  const ranked = [...pool].sort((a, b) => popularityKey(b) - popularityKey(a));

  // Featured strip: top agents across the WHOLE category (ignores filters).
  const featured = ranked.slice(0, FEATURED);

  const listing: CategoryListing = {
    pool: ranked,
    facets,
    perPage: PAGE_SIZE,
    selected: { subcategories: selectedSubs, sort, verified: verifiedOnly },
  };

  return { category, total, featured, listing };
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, total, featured, listing } = loaderData;
  const accent = category.accent;
  const subCount = listing.facets.length;

  const eyebrow = `${total.toLocaleString("en-US")} agents · ${subCount} ${
    subCount === 1 ? "subcategory" : "subcategories"
  }`;

  // Top agents in the category → small featured cards (real 8004scan demand).
  const featuredItems: FeatureItem[] = featured.map((a) => ({
    id: a.id,
    to: agentHref(a),
    title: a.name,
    subtitle: a.description || a.subcategoryLabel || "Agent on BNB Chain",
    pill: a.subcategoryLabel ?? undefined,
    accent,
    cover: a.id,
    imageSrc: a.imageUrl ?? undefined,
  }));

  return (
    <AppShell activeCategory={category.id as Category}>
      {/* Fixed hero: the same cover used on the home bento tile for this
          category (`/img/bento/<id>.avif`) — a banner, not a slideshow. */}
      <CategoryHero
        eyebrow={eyebrow}
        title={category.label}
        subtitle={CATEGORY_TAGLINE[category.id]}
        image={`/img/bento/${category.id}.avif`}
        accent={accent}
      />

      {/* Featured strip: top agents in the category, smaller cards under the hero. */}
      {featuredItems.length > 0 && (
        <div className="mt-8">
          <FeaturedRail title="Featured" items={featuredItems} accent={accent} />
        </div>
      )}

      {/* Sortable, filterable grid of every agent in the category (replaces the
          old stack of per-subcategory sliders). */}
      <div className="mt-10">
        <AgentsBrowser listing={listing} basePath={`/category/${category.id}`} />
      </div>
    </AppShell>
  );
}

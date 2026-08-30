import { env } from "cloudflare:workers";
import { Form, Link } from "react-router";

import type { Route } from "./+types/category";
import { createAgentsClient, type Agent } from "../lib/agents";
import {
  AISLES,
  CATEGORIES,
  aisleOf,
  categoryLabel,
  categoryTemplate,
  type Category,
  type TemplateKind,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { CategoryHero } from "../components/CategoryHero";
import { CollectionCarousel } from "../components/CollectionCarousel";
import { AgentFeatureCard } from "../components/AgentFeatureCard";
import { AgentListItem } from "../components/AgentListItem";

/** Pool we fetch to sort in the loader (the proxy doesn't sort server-side). */
const POOL = 60;
/** Page size of the sortable listing. */
const PAGE_SIZE = 12;
/** Number of featured items in the top slider. */
const FEATURED = 8;

type SortKey = "popular" | "recent";

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.label ?? "Category";
  return [{ title: `${label} — Agent-Street` }];
}

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  trading: "Trading",
  clmm: "Concentrated liquidity",
  yield: "Yield",
  health: "Health factor",
  nft: "NFT",
  rwa: "RWA",
  services: "Services",
};

/** Editorial tagline per template (sentence case, active and concrete). */
const TEMPLATE_TAGLINE: Record<TemplateKind, string> = {
  trading:
    "Agents that trade your capital with clear rules and verifiable onchain execution.",
  clmm: "Agents that reposition your concentrated liquidity on PancakeSwap v3.",
  yield: "Agents that hunt for the best returns across BNB Chain protocols.",
  health:
    "Agents that watch your health factor and warn you before liquidation.",
  nft: "Agents that track floor, volume and opportunities across NFT collections.",
  rwa: "Agents that manage real-world assets tokenized on the chain.",
  services:
    "Service agents: data, automation, x402 payments and composable skills.",
};

/** Fine-grained overrides for categories with their own voice. */
const CATEGORY_TAGLINE: Partial<Record<Category, string>> = {
  rebalancing:
    "Reposition concentrated liquidity on PancakeSwap v3 without watching the range by hand.",
  grid: "Set automatic buy and sell bands and profit from the market's sideways ranges.",
  yield: "Compare real APY across protocols and move your capital to the best-yielding one.",
  health:
    "Monitor collateral and distance to liquidation in real time, with onchain alerts.",
};

function taglineFor(id: Category, template: TemplateKind): string {
  return CATEGORY_TAGLINE[id] ?? TEMPLATE_TAGLINE[template];
}

function parseSort(v: string | null): SortKey {
  return v === "recent" ? "recent" : "popular";
}

/** Numeric key for "date added": ERC-721 tokenId (higher = minted later). */
function mintKey(a: Agent): number {
  const n = Number(a.tokenId);
  return Number.isFinite(n) ? n : -1;
}

function popularityKey(a: Agent): number {
  // Observable demand on 8004scan: feedbacks weigh most, then stars, then score.
  return a.feedbacks * 1000 + a.stars * 10 + a.score;
}

function sortAgents(list: Agent[], sort: SortKey): Agent[] {
  const arr = [...list];
  if (sort === "recent") {
    arr.sort((a, b) => mintKey(b) - mintKey(a));
  } else {
    arr.sort((a, b) => popularityKey(b) - popularityKey(a));
  }
  return arr;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const id = params.id as Category;
  if (!(CATEGORIES as readonly string[]).includes(id)) {
    throw new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const sort = parseSort(url.searchParams.get("sort"));
  const search = url.searchParams.get("search") || undefined;

  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL });
  const result = await agents.list({ category: id, page: 1, limit: POOL, search });
  const pool = result.agents;

  // Featured: top agents by observable demand (no agent is hard-coded).
  const featured = sortAgents(pool, "popular").slice(0, FEATURED);

  // Sortable listing, paginated over the pool.
  const sorted = sortAgents(pool, sort);
  const total = sorted.length;
  const start = (page - 1) * PAGE_SIZE;
  const listing = sorted.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < total;

  const aisle = aisleOf(id);
  const aisleDef = aisle ? AISLES.find((a) => a.id === aisle) : undefined;
  const template = categoryTemplate(id);

  return {
    category: id,
    label: categoryLabel(id),
    template,
    templateLabel: TEMPLATE_LABELS[template],
    tagline: taglineFor(id, template),
    aisleLabel: aisleDef?.label ?? null,
    parentTo: aisle ? `/aisle/${aisle}` : null,
    accent: aisleDef?.accent ?? null,
    page,
    sort,
    search: search ?? "",
    featured,
    listing,
    total,
    hasMore,
    fromSeed: result.fromSeed ?? false,
  };
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const {
    category,
    label,
    templateLabel,
    tagline,
    aisleLabel,
    parentTo,
    accent,
    page,
    sort,
    search,
    featured,
    listing,
    total,
    hasMore,
    fromSeed,
  } = loaderData;

  const source = fromSeed ? "seed" : "8004scan";
  // The eyebrow is the parent category (breadcrumb ‹); the template goes as a chip.
  const eyebrow = aisleLabel ?? templateLabel;

  return (
    <AppShell activeCategory={category}>
      {/* Category hero. */}
      <CategoryHero
        label={label}
        eyebrow={eyebrow}
        parentTo={parentTo}
        tagline={tagline}
        count={total}
        source={source}
        templateLabel={templateLabel}
        accent={accent}
        coverSeed={`category-${category}`}
      />

      {/* Featured slider. */}
      {featured.length > 0 && (
        <div className="mt-8">
          <CollectionCarousel title="Featured" accent={accent ?? undefined}>
            {featured.map((a) => (
              <AgentFeatureCard
                key={a.id}
                agent={a}
                accent={accent ?? undefined}
                eyebrow={a.categoryLabel ?? label}
              />
            ))}
          </CollectionCarousel>
        </div>
      )}

      {/* Sortable listing. */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">All agents</h2>
            <p className="tnum mt-0.5 text-sm text-text-3">
              {total.toLocaleString("en-US")} in {label}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SortTabs category={category} sort={sort} search={search} />
            <SearchForm label={label} search={search} sort={sort} />
          </div>
        </div>

        {listing.length ? (
          <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
            {listing.map((a) => (
              <AgentListItem key={a.id} agent={a} />
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-border bg-surface p-6 text-sm text-text-3">
            No results{search ? ` for "${search}"` : ""}.
          </p>
        )}

        {/* Pagination. */}
        {(page > 1 || hasMore) && (
          <div className="mt-8 flex items-center justify-between">
            <PageLink
              to={pageUrl(category, page - 1, sort, search)}
              disabled={page <= 1}
            >
              ← Previous
            </PageLink>
            <span className="tnum text-sm text-text-3">Page {page}</span>
            <PageLink
              to={pageUrl(category, page + 1, sort, search)}
              disabled={!hasMore}
            >
              Next →
            </PageLink>
          </div>
        )}
      </section>
    </AppShell>
  );
}

/** Sort segmented control: most popular / date added. GET links (SSR-safe). */
function SortTabs({
  category,
  sort,
  search,
}: {
  category: string;
  sort: SortKey;
  search: string;
}) {
  const opts: Array<{ key: SortKey; label: string }> = [
    { key: "popular", label: "Most popular" },
    { key: "recent", label: "Date added" },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
      {opts.map((o) => {
        const active = o.key === sort;
        return (
          <Link
            key={o.key}
            to={pageUrl(category, 1, o.key, search)}
            aria-current={active}
            className={
              active
                ? "rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-bg"
                : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-text-2 transition-colors hover:text-text"
            }
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

function SearchForm({
  label,
  search,
  sort,
}: {
  label: string;
  search: string;
  sort: SortKey;
}) {
  return (
    <Form method="get" className="flex items-center gap-2">
      {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
      <input
        type="search"
        name="search"
        defaultValue={search}
        placeholder={`Search ${label}…`}
        className="w-40 rounded-full border border-border bg-surface-2 px-4 py-1.5 text-sm text-text placeholder:text-text-3 focus:border-brand focus:outline-none sm:w-52"
      />
    </Form>
  );
}

function pageUrl(
  category: string,
  page: number,
  sort: SortKey,
  search: string,
) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (sort !== "popular") p.set("sort", sort);
  if (search) p.set("search", search);
  const qs = p.toString();
  return `/category/${category}${qs ? `?${qs}` : ""}`;
}

function PageLink({
  to,
  disabled,
  children,
}: {
  to: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-[8px] border border-border px-4 py-2 text-sm font-semibold text-text-disabled">
        {children}
      </span>
    );
  }
  return (
    <Link
      to={to}
      className="rounded-[8px] border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
    >
      {children}
    </Link>
  );
}

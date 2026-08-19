import { env } from "cloudflare:workers";
import { Form, Link } from "react-router";

import type { Route } from "./+types/category";
import { createAgentsClient } from "../lib/agents";
import {
  AISLES,
  CATEGORIES,
  aisleOf,
  categoryLabel,
  categoryTemplate,
  type Category,
} from "../lib/taxonomy";
import { FLAGSHIP_ID } from "../lib/seed";
import { AppShell } from "../components/AppShell";
import { AgentCard } from "../components/AgentCard";

const LIMIT = 24;

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.label ?? "Category";
  return [{ title: `${label} — Agent-Street` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const id = params.id as Category;
  if (!(CATEGORIES as readonly string[]).includes(id)) {
    throw new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const search = url.searchParams.get("search") || undefined;

  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL });
  const result = await agents.list({ category: id, page, limit: LIMIT, search });

  const aisle = aisleOf(id);
  const aisleDef = aisle ? AISLES.find((a) => a.id === aisle) : undefined;

  return {
    category: id,
    label: categoryLabel(id),
    template: categoryTemplate(id),
    aisleLabel: aisleDef?.label ?? null,
    accent: aisleDef?.accent ?? null,
    page,
    search: search ?? "",
    result,
  };
}

const TEMPLATE_LABELS: Record<string, string> = {
  trading: "Trading",
  clmm: "Liquidez concentrada",
  yield: "Yield",
  health: "Health factor",
  nft: "NFT",
  rwa: "RWA",
  services: "Servicios",
};

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, label, template, aisleLabel, accent, page, search, result } =
    loaderData;
  const { agents, pagination, fromSeed } = result;

  return (
    <AppShell activeCategory={category}>
      <header className="py-2">
        {accent && (
          <span
            aria-hidden
            className="mb-3 block h-0.5 w-10 rounded-full"
            style={{ background: accent }}
          />
        )}
        <h1 className="text-3xl font-bold">{label}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {aisleLabel && (
            <span className="rounded-[999px] bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-2">
              {aisleLabel}
            </span>
          )}
          <span className="rounded-[999px] border border-border px-2.5 py-0.5 text-xs font-semibold text-text-3">
            {TEMPLATE_LABELS[template] ?? template}
          </span>
        </div>
        <p className="mt-2 text-sm text-text-3">
          {pagination.total.toLocaleString("en-US")} agentes ·{" "}
          {fromSeed ? "catálogo curado" : "datos onchain de 8004scan"}
        </p>
      </header>

      {/* Buscador */}
      <Form method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder={`Buscar en ${label}…`}
          className="w-full max-w-sm rounded-[8px] border border-border bg-surface-2 px-4 py-2 text-sm text-text placeholder:text-text-3 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-[8px] border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
        >
          Buscar
        </button>
      </Form>

      {/* Grid */}
      {agents.length ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} featured={a.id === FLAGSHIP_ID} />
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-text-3">
          Sin resultados{search ? ` para «${search}»` : ""}.
        </p>
      )}

      {/* Paginación */}
      {(page > 1 || pagination.hasMore) && (
        <div className="mt-8 flex items-center justify-between">
          <PageLink to={pageUrl(category, page - 1, search)} disabled={page <= 1}>
            ← Anterior
          </PageLink>
          <span className="tnum text-sm text-text-3">Página {page}</span>
          <PageLink
            to={pageUrl(category, page + 1, search)}
            disabled={!pagination.hasMore}
          >
            Siguiente →
          </PageLink>
        </div>
      )}
    </AppShell>
  );
}

function pageUrl(category: string, page: number, search: string) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
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

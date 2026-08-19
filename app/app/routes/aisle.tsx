import { env } from "cloudflare:workers";

import type { Route } from "./+types/aisle";
import { createAgentsClient, type Agent } from "../lib/agents";
import {
  AISLES,
  categoriesInAisle,
  categoryLabel,
  type Aisle,
} from "../lib/taxonomy";
import { FLAGSHIP_ID } from "../lib/seed";
import { AppShell } from "../components/AppShell";
import { CollectionRow } from "../components/CollectionRow";
import { AgentCard } from "../components/AgentCard";

const PER_ROW = 6;

export function meta({ loaderData }: Route.MetaArgs) {
  const label = loaderData?.aisle?.label ?? "Aisle";
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

  return { aisle, rows };
}

export default function AislePage({ loaderData }: Route.ComponentProps) {
  const { aisle, rows } = loaderData;

  return (
    <AppShell activeAisle={aisle.id as Aisle}>
      <header className="py-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-2xl"
            style={{ color: aisle.accent }}
          >
            {aisle.glyph}
          </span>
          <div>
            <h1 className="text-3xl font-bold">{aisle.label}</h1>
            <p className="mt-1 text-sm text-text-3">
              {rows.length} {rows.length === 1 ? "categoría" : "categorías"} ·
              agentes ERC-8004 en BNB Chain
            </p>
          </div>
        </div>
      </header>

      {rows.map((row) => (
        <CollectionRow
          key={row.id}
          title={row.label}
          seeAllTo={`/category/${row.id}`}
          accent={aisle.accent}
        >
          {row.agents.length ? (
            row.agents.map((a: Agent) => (
              <div key={a.id} className="w-[300px] shrink-0 snap-start">
                <AgentCard agent={a} featured={a.id === FLAGSHIP_ID} />
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-text-3">
              Sin agentes indexados en esta categoría todavía.
            </p>
          )}
        </CollectionRow>
      ))}
    </AppShell>
  );
}

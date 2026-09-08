import { env } from "cloudflare:workers";
import { Form } from "react-router";

import type { Route } from "./+types/search";
import { createAgentsClient, type Agent } from "../lib/agents";
import { AppShell } from "../components/AppShell";
import { AgentCard } from "../components/AgentCard";

const LIMIT = 24;

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.q;
  return [{ title: q ? `"${q}" — Agent-Street` : "Search — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return { q, agents: [] as Agent[], total: 0 };

  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
  // Search both BSC chains so testnet agents are discoverable too; mainnet first.
  const [mainnet, testnet] = await Promise.all([
    agents.list({ search: q, limit: LIMIT }),
    agents.list({ search: q, limit: LIMIT, chain: 97 }),
  ]);
  const seen = new Set<string>();
  const merged = [...mainnet.agents, ...testnet.agents].filter((a) => {
    if (seen.has(a.agentId)) return false;
    seen.add(a.agentId);
    return true;
  });
  return {
    q,
    agents: merged,
    total: mainnet.pagination.total + testnet.pagination.total,
  };
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { q, agents, total } = loaderData;

  return (
    <AppShell>
      <header className="py-2">
        <h1 className="text-3xl font-bold">
          {q ? <>Results for "{q}"</> : "Search agents"}
        </h1>
        {q && (
          <p className="mt-1 text-sm text-text-3">
            {total.toLocaleString("en-US")}{" "}
            {total === 1 ? "agent" : "agents"} · onchain data from 8004scan
          </p>
        )}
      </header>

      <Form method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search agents on BNB Chain…"
          className="w-full max-w-md rounded-[8px] border border-border bg-surface-2 px-4 py-2 text-sm text-text placeholder:text-text-3 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-[8px] border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
        >
          Search
        </button>
      </Form>

      {!q ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-text-3">
          Type a term to search agents by name or description.
        </p>
      ) : agents.length ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a: Agent) => (
            <AgentCard key={a.agentId} agent={a} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-text-3">
          No results for "{q}". Try another term or explore by
          subcategory from the sidebar.
        </p>
      )}
    </AppShell>
  );
}

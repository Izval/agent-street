/**
 * /search.json?q= — the ⌘K command-palette search index.
 *
 * Resource route (no component): returns { agents, subcategories, skills } as JSON,
 * fetched debounced by the ⌘K palette in AppShell. Agents come from the 8004scan
 * proxy (real data); subcategories and skills are the local taxonomy/seed, filtered
 * by the query. Shapes match `flatten()` in components/SearchCommand.tsx.
 */

import { env } from "cloudflare:workers";
import type { Route } from "./+types/search.json";
import { createAgentsClient, agentHref } from "../lib/agents";
import { SUBCATEGORY_DEFS } from "../lib/taxonomy";
import { SKILLS } from "../lib/skills";

const AGENT_LIMIT = 6;
const LIST_LIMIT = 6;

export async function loader({ request }: Route.LoaderArgs) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const empty = { agents: [], subcategories: [], skills: [] };
  if (!q) return json(empty);

  const needle = q.toLowerCase();

  // Categories + skills are local — filter instantly, no network.
  const subcategories = SUBCATEGORY_DEFS.filter((c) =>
    c.label.toLowerCase().includes(needle),
  )
    .slice(0, LIST_LIMIT)
    .map((c) => ({ id: c.id, label: c.label, category: c.category, to: `/subcategory/${c.id}` }));

  const skills = SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(needle) ||
      s.protocol.toLowerCase().includes(needle),
  )
    .slice(0, LIST_LIMIT)
    .map((s) => ({ id: s.id, name: s.name, tags: [s.protocol], to: `/skill/${s.id}` }));

  // Agents come from the proxy (real 8004scan data). Degrades to [] on failure.
  let agents: Array<{ name: string; id: string; subcategoryLabel: string | null; to: string }> = [];
  try {
    const client = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
    // Both BSC chains so testnet agents surface in the palette too; mainnet first.
    const [mainnet, testnet] = await Promise.all([
      client.list({ search: q, limit: AGENT_LIMIT }),
      client.list({ search: q, limit: AGENT_LIMIT, chain: 97 }),
    ]);
    const seen = new Set<string>();
    agents = [...mainnet.agents, ...testnet.agents]
      .filter((a) => (seen.has(a.agentId) ? false : (seen.add(a.agentId), true)))
      .slice(0, AGENT_LIMIT)
      .map((a) => ({
        name: a.name,
        id: a.id,
        subcategoryLabel: a.subcategoryLabel,
        to: agentHref(a),
      }));
  } catch {
    /* honest empty — palette shows subcategories/skills only */
  }

  return json({ agents, subcategories, skills });
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
    },
  });
}

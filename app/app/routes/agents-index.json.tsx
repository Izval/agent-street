/**
 * /agents-index.json — the full compact agent index for the ⌘K palette.
 *
 * Resource route (no component): returns the whole corpus (≤~1500 agents) as one
 * JSON array of `IndexAgent`, fetched ONCE per session by the palette and filtered
 * client-side (lib/agentsIndex.ts) — zero per-keystroke network. Data is the proxy's
 * GET /v1/index (real 8004scan corpus ∪ created/testnet agents). Degrades to [].
 */

import { env } from "cloudflare:workers";
import type { Route } from "./+types/agents-index.json";
import { createAgentsClient, type IndexAgent } from "../lib/agents";

export async function loader(_args: Route.LoaderArgs) {
  let agents: IndexAgent[] = [];
  try {
    const client = createAgentsClient({
      baseUrl: env.PROXY_8004_URL,
      fetcher: env.PROXY_8004,
    });
    agents = await client.index();
  } catch {
    /* empty on failure — the palette still ranks local subcategories/skills */
  }
  return new Response(JSON.stringify(agents), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120",
    },
  });
}

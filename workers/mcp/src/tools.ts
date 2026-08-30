// tools.ts — the MCP tool registry + dispatcher.
//
// Each tool composes ONE existing worker endpoint (see upstream.ts) into an
// agent-callable capability: discover -> explore -> evaluate -> hire -> manage.
// Nothing here signs or holds a key. The hire journey is client-pays: get_hire_quote
// returns the x402 challenge, the ORCHESTRATOR signs+broadcasts the payment from its
// own wallet, then hire_agent relays the resulting txHash to hire-x402 for on-chain
// verification. There is deliberately no code path that touches a private key.

import {
  UpstreamError,
  fetchAgent,
  fetchAgentCardLive,
  fetchAgents,
  fetchCategories,
  fetchHires,
  fetchQuote,
  postHire,
  type AgentDetail,
  type Env,
  type X402Accept,
} from "./upstream";
import { SKILLS } from "./skills";

// MCP CallToolResult (spec-shaped). We return the JSON payload as a text block —
// the universally-supported form — and also set structuredContent for clients
// that consume it. isError marks a tool-execution failure (vs a protocol error).
export interface CallToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const CATEGORY_HINT =
  "Marketplace category id. The 4 core ids: rebalancing, grid, yield, health. Extended: dca, momentum, copy-trade, market-making, perps, lending, liquid-staking, nft-floor, nft-mint, rwa-assets, rwa-treasury, infra-data, infra-wallet, infra-automation, payments-x402, payments-jobs, social-signals, social-narratives.";

export const TOOLS: ToolDef[] = [
  {
    name: "search_agents",
    description:
      "Discover ERC-8004 agents listed on the marketplace. Filter by category and/or free-text search, paginated. Returns real on-chain reputation metrics (score, stars, feedbacks) from 8004scan so you can compare candidates.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: CATEGORY_HINT },
        search: { type: "string", description: "Free-text query over name/description/skills." },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 24 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_agent",
    description:
      "Fetch the full detail of one agent by id: identity, category, on-chain reputation (dimensions, rank, feedbacks) and services (A2A/MCP endpoints, skills, x402 and ERC-8183 support). Use this to evaluate a candidate before hiring.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Agent id / token_id." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "compare_agents",
    description:
      "Compare 2–5 agents side by side and pick a winner by a reputation metric. Returns the agents ranked plus a winner with a short human reason. Use it to decide which agent to hire.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 5,
          description: "Agent ids to compare.",
        },
        sortBy: {
          type: "string",
          enum: ["score", "avgScore", "stars", "feedbacks", "rank"],
          default: "score",
          description: "Metric to rank by. 'rank' is best-when-lowest; others best-when-highest.",
        },
      },
      required: ["ids"],
      additionalProperties: false,
    },
  },
  {
    name: "list_categories",
    description: "List the marketplace categories (id + label), including the 4 core ones.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_skills",
    description:
      "List composable skills (ERC-8183 / Altana modules an agent can plug in). Optionally filter by category.",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string", description: CATEGORY_HINT } },
      additionalProperties: false,
    },
  },
  {
    name: "get_hire_quote",
    description:
      "Get the x402 payment challenge to hire an agent. Returns accepts[] with payTo, asset, network and maxAmountRequired (base units). This tool does NOT move money — after receiving the quote you (the orchestrator) sign and broadcast the payment from your own wallet, then call hire_agent with the resulting txHash.",
    inputSchema: {
      type: "object",
      properties: { agent: { type: "string", description: "Agent id to hire." } },
      required: ["agent"],
      additionalProperties: false,
    },
  },
  {
    name: "hire_agent",
    description:
      "Confirm a hire by submitting the payment transaction you already broadcast. The marketplace verifies the tx on-chain (BSC testnet) and returns a HireReceipt with status settled/pending/failed. No txHash is ever fabricated: an unverifiable payment yields an honest pending/failed receipt.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent id being hired." },
        accept: {
          type: "object",
          description: "The exact X402Accept object returned by get_hire_quote (pass through unchanged).",
        },
        txHash: { type: "string", description: "0x… hash of the ERC-20/native transfer you broadcast." },
        from: { type: "string", description: "0x… payer address (must match the tx sender)." },
        endpoint: { type: "string", description: "Optional agent A2A endpoint." },
        task: { type: "string", description: "Optional task description recorded with the hire." },
        agentName: { type: "string", description: "Optional agent name for the hire record." },
      },
      required: ["agentId", "accept", "txHash", "from"],
      additionalProperties: false,
    },
  },
  {
    name: "list_my_hires",
    description:
      "List the agents a wallet has hired (settled hires with tx and explorer link). Use it to manage your hired agents.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "0x… wallet address." } },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "get_agent_card",
    description:
      "Get an agent's protocol access surface: its A2A/MCP endpoints, protocol version, advertised skills, and x402/ERC-8183 support — plus the live A2A agent-card when reachable. Use it to talk to the agent directly (e.g. negotiate an ERC-8183 job) instead of the marketplace-mediated x402 hire.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Agent id / token_id." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

// --- helpers ---------------------------------------------------------------- //

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const TXHASH_RE = /^0x[0-9a-fA-F]{64}$/;

function ok(payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function toolError(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Raised on bad tool arguments; index.ts maps it to JSON-RPC -32602. */
export class InvalidParams extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "InvalidParams";
  }
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function requireString(args: Record<string, unknown>, field: string): string {
  const v = args[field];
  if (typeof v !== "string" || v.length === 0) {
    throw new InvalidParams(`'${field}' is required and must be a non-empty string`, field);
  }
  return v;
}

/** Compact card projection of an agent detail for comparison output. */
function agentCard(d: AgentDetail) {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    categoryLabel: d.categoryLabel,
    score: d.score,
    avgScore: d.avgScore,
    stars: d.stars,
    feedbacks: d.feedbacks,
    rank: d.rank,
    isVerified: d.isVerified,
    x402: d.services?.x402 ?? d.x402Supported,
    erc8183: d.services?.erc8183 ?? false,
    a2aEndpoint: d.services?.a2aEndpoint ?? null,
    source: d.source,
  };
}

// --- dispatch --------------------------------------------------------------- //

export async function dispatch(
  name: string,
  rawArgs: unknown,
  env: Env,
): Promise<CallToolResult> {
  const args = asObject(rawArgs);

  try {
    switch (name) {
      case "search_agents": {
        const page = await fetchAgents(env, {
          category: typeof args.category === "string" ? args.category : undefined,
          search: typeof args.search === "string" ? args.search : undefined,
          page: typeof args.page === "number" ? args.page : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        });
        return ok(page);
      }

      case "get_agent": {
        const id = requireString(args, "id");
        const detail = await fetchAgent(env, id);
        if (!detail) return toolError(`Agent '${id}' not found.`);
        return ok(detail);
      }

      case "compare_agents": {
        const ids = Array.isArray(args.ids) ? args.ids.filter((x): x is string => typeof x === "string") : [];
        if (ids.length < 2) throw new InvalidParams("'ids' must contain 2–5 agent ids", "ids");
        const sortBy =
          typeof args.sortBy === "string" &&
          ["score", "avgScore", "stars", "feedbacks", "rank"].includes(args.sortBy)
            ? (args.sortBy as "score" | "avgScore" | "stars" | "feedbacks" | "rank")
            : "score";
        const details = (await Promise.all(ids.slice(0, 5).map((id) => fetchAgent(env, id)))).filter(
          (d): d is AgentDetail => d !== null,
        );
        if (details.length === 0) return toolError("None of the requested agents were found.");
        const lowerIsBetter = sortBy === "rank";
        const metric = (d: AgentDetail): number => {
          const v = sortBy === "rank" ? d.rank : (d[sortBy] as number | null);
          if (v === null || v === undefined) return lowerIsBetter ? Number.POSITIVE_INFINITY : -1;
          return v;
        };
        const ranked = [...details].sort((a, b) =>
          lowerIsBetter ? metric(a) - metric(b) : metric(b) - metric(a),
        );
        const winner = ranked[0];
        const reason = lowerIsBetter
          ? `Best (lowest) ${sortBy}: #${winner.rank ?? "—"}.`
          : `Highest ${sortBy}: ${metric(winner)}${sortBy === "avgScore" ? " avg" : ""} across ${details.length} agents.`;
        return ok({
          metric: sortBy,
          ranked: ranked.map(agentCard),
          winner: { id: winner.id, name: winner.name, reason },
        });
      }

      case "list_categories": {
        const categories = await fetchCategories(env);
        return ok({ categories });
      }

      case "list_skills": {
        const category = typeof args.category === "string" ? args.category : null;
        const skills = category ? SKILLS.filter((s) => s.category === category) : SKILLS;
        return ok({ skills });
      }

      case "get_hire_quote": {
        const agent = requireString(args, "agent");
        const quote = await fetchQuote(env, agent);
        if (!quote.ok) {
          return toolError(
            quote.error === "no_pay_to"
              ? `Agent '${agent}' exposes no on-chain pay-to wallet, so it cannot be hired via x402.`
              : `Quote failed (${quote.error})${quote.detail ? `: ${quote.detail}` : ""}.`,
          );
        }
        return ok({ x402Version: quote.x402Version, accepts: quote.accepts });
      }

      case "hire_agent": {
        const agentId = requireString(args, "agentId");
        const accept = args.accept as X402Accept | undefined;
        const txHash = requireString(args, "txHash");
        const from = requireString(args, "from");
        if (!accept || typeof accept !== "object" || typeof accept.payTo !== "string") {
          throw new InvalidParams("'accept' must be the X402Accept object from get_hire_quote", "accept");
        }
        if (!TXHASH_RE.test(txHash)) throw new InvalidParams("'txHash' must be a 0x…64 hex hash", "txHash");
        if (!ADDR_RE.test(from)) throw new InvalidParams("'from' must be a 0x…40 address", "from");
        const receipt = await postHire(env, {
          agentId,
          accept,
          txHash,
          from,
          endpoint: typeof args.endpoint === "string" ? args.endpoint : undefined,
          task: typeof args.task === "string" ? args.task : undefined,
          agentName: typeof args.agentName === "string" ? args.agentName : undefined,
        });
        return ok(receipt);
      }

      case "list_my_hires": {
        const address = requireString(args, "address");
        if (!ADDR_RE.test(address)) throw new InvalidParams("'address' must be a 0x…40 address", "address");
        const hires = await fetchHires(env, address);
        return ok(hires);
      }

      case "get_agent_card": {
        const id = requireString(args, "id");
        const detail = await fetchAgent(env, id);
        if (!detail) return toolError(`Agent '${id}' not found.`);
        const s = detail.services;
        const card = s?.a2aEndpoint ? await fetchAgentCardLive(s.a2aEndpoint) : null;
        return ok({
          agentId: detail.id,
          name: detail.name,
          a2aEndpoint: s?.a2aEndpoint ?? null,
          mcpEndpoint: s?.mcpEndpoint ?? null,
          protocolVersion: s?.protocolVersion ?? null,
          skills: s?.skills ?? [],
          x402: s?.x402 ?? detail.x402Supported,
          erc8183: s?.erc8183 ?? false,
          cardLive: card !== null,
          card,
        });
      }

      default:
        throw new InvalidParams(`Unknown tool '${name}'`);
    }
  } catch (err) {
    if (err instanceof InvalidParams) throw err;
    if (err instanceof UpstreamError) {
      return toolError(`Upstream ${err.service} error: ${err.message}`);
    }
    return toolError(`Tool '${name}' failed: ${String((err as Error).message)}`);
  }
}

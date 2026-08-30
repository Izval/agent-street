// index.ts — Agent-Street MCP server (agent-native marketplace surface).
//
// Role: the ONE endpoint an orchestrator agent connects to in order to discover,
// explore, evaluate, hire and manage any listed agent — programmatically. It speaks
// Model Context Protocol over Streamable HTTP and composes the existing workers
// (8004-proxy, hire-x402) into tools (see tools.ts). Marketplace-general: no agent
// is special-cased here (the IVL flagship only exists as an env override inside
// hire-x402, never in this worker).
//
// Transport: hand-rolled JSON-RPC 2.0 over `POST /mcp`, STATELESS, application/json
// only (no SSE, no Durable Objects). This is MCP-spec-compliant for tool calls: the
// Streamable HTTP transport lets a server answer a POST that carries a single
// JSON-RPC request with a single JSON object when every method resolves
// synchronously — which they do (each tools/call is one upstream fetch). SSE is only
// needed for server-initiated messages, which a pure tool server never sends.
//
// Stateless on purpose: we do NOT issue Mcp-Session-Id (the spec lets a server omit
// it to signal "no sessions"). Do NOT "fix" this by adding Durable Objects — the
// whole point is a keyless, horizontally-scalable relay that holds no state.
//
// Client-pays: this worker never signs or custodies keys. get_hire_quote returns the
// x402 challenge; the client broadcasts payment itself; hire_agent relays the txHash
// to hire-x402 for on-chain verification.

import { TOOLS, dispatch, InvalidParams } from "./tools";
import type { Env } from "./upstream";

const RL_LIMIT = 120;
const RL_WINDOW_SEC = 60;
const DEFAULT_PROTOCOL = "2025-03-26"; // spec backwards-compat default when header absent
const LATEST_PROTOCOL = "2025-06-18";
const SUPPORTED_PROTOCOLS = new Set([DEFAULT_PROTOCOL, LATEST_PROTOCOL, "2024-11-05"]);

async function underRateLimit(request: Request): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") || "anon";
  const origin = new URL(request.url).origin;
  const window = Math.floor(Date.now() / 1000 / RL_WINDOW_SEC);
  const key = new Request(`${origin}/__rl/${encodeURIComponent(ip)}/${window}`);
  const cache = caches.default;
  let count = 0;
  const hit = await cache.match(key);
  if (hit) count = parseInt(await hit.text(), 10) || 0;
  count++;
  if (count > RL_LIMIT) return false;
  await cache.put(
    key,
    new Response(String(count), { headers: { "Cache-Control": `max-age=${RL_WINDOW_SEC}` } }),
  );
  return true;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // Whitelist the MCP headers so browser-based MCP clients/inspectors work.
    "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Authorization",
    "Access-Control-Expose-Headers": "MCP-Protocol-Version",
    Vary: "Origin",
  };
}

type JsonRpcId = string | number | null;

function rpcResponse(
  env: Env,
  body: unknown,
  protocolVersion: string,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "MCP-Protocol-Version": protocolVersion,
      ...corsHeaders(env),
    },
  });
}

function rpcResult(env: Env, id: JsonRpcId, result: unknown, protocolVersion: string): Response {
  return rpcResponse(env, { jsonrpc: "2.0", id, result }, protocolVersion);
}

function rpcError(
  env: Env,
  id: JsonRpcId,
  code: number,
  message: string,
  protocolVersion: string,
  data?: unknown,
): Response {
  return rpcResponse(env, { jsonrpc: "2.0", id, error: { code, message, data } }, protocolVersion);
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

async function handleRpc(
  request: Request,
  env: Env,
  protocolVersion: string,
): Promise<Response> {
  let req: JsonRpcRequest;
  try {
    req = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(env, null, -32700, "Parse error", protocolVersion);
  }

  const id = (req.id ?? null) as JsonRpcId;
  const method = req.method;

  // Notifications (no id / notifications/*) get a 202 with no body per spec.
  if (method && method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: corsHeaders(env) });
  }

  switch (method) {
    case "initialize": {
      const params = (req.params && typeof req.params === "object" ? req.params : {}) as {
        protocolVersion?: string;
      };
      const requested = params.protocolVersion;
      const negotiated =
        requested && SUPPORTED_PROTOCOLS.has(requested) ? requested : LATEST_PROTOCOL;
      return rpcResult(
        env,
        id,
        {
          protocolVersion: negotiated,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: env.MCP_SERVER_NAME || "agent-street-mcp", version: "0.1.0" },
          instructions:
            "Agent-Street marketplace. Discover agents with search_agents; evaluate with get_agent / compare_agents; hire via x402: call get_hire_quote, sign+broadcast the payment from YOUR OWN wallet, then call hire_agent with the txHash. Manage with list_my_hires. This server never holds keys — you pay. For direct A2A/ERC-8183 negotiation use get_agent_card.",
        },
        negotiated,
      );
    }

    case "tools/list":
      return rpcResult(env, id, { tools: TOOLS }, protocolVersion);

    case "tools/call": {
      const params = (req.params && typeof req.params === "object" ? req.params : {}) as {
        name?: unknown;
        arguments?: unknown;
      };
      if (typeof params.name !== "string") {
        return rpcError(env, id, -32602, "Invalid params: 'name' is required", protocolVersion, {
          field: "name",
        });
      }
      try {
        const result = await dispatch(params.name, params.arguments, env);
        return rpcResult(env, id, result, protocolVersion);
      } catch (err) {
        if (err instanceof InvalidParams) {
          return rpcError(env, id, -32602, `Invalid params: ${err.message}`, protocolVersion, {
            field: err.field,
          });
        }
        return rpcError(env, id, -32603, `Internal error: ${String((err as Error).message)}`, protocolVersion);
      }
    }

    default:
      return rpcError(env, id, -32601, `Method not found: ${method ?? "(none)"}`, protocolVersion);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Negotiate protocol version from the header (echoed on every response).
    const headerVersion = request.headers.get("MCP-Protocol-Version");
    const protocolVersion =
      headerVersion && SUPPORTED_PROTOCOLS.has(headerVersion) ? headerVersion : DEFAULT_PROTOCOL;

    if (!(await underRateLimit(request))) {
      // JSON-RPC transports errors in-band; keep HTTP 200 for POST /mcp.
      if (request.method === "POST" && path === "/mcp") {
        return rpcError(env, null, -32000, "rate_limited", protocolVersion);
      }
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
      });
    }

    // Health — same convention as the other workers.
    if (request.method === "GET" && (path === "/health" || path === "/")) {
      return new Response(
        JSON.stringify({ ok: true, service: "mcp", tools: TOOLS.map((t) => t.name) }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=30",
            ...corsHeaders(env),
          },
        },
      );
    }

    if (path === "/mcp") {
      if (request.method === "POST") {
        return handleRpc(request, env, protocolVersion);
      }
      // No server-initiated streams and no sessions to tear down.
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { Allow: "POST", "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
      });
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
    });
  },
} satisfies ExportedHandler<Env>;

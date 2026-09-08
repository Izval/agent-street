/**
 * ERC-8004 IdentityRegistry — client-side mint seam (client-pays).
 *
 * The `/create` wizard mints an agent identity by having the USER'S wallet call
 * `register(agentURI)` on the on-chain IdentityRegistry directly — the user owns
 * the identity and pays their own gas (no treasury, no server signing). This
 * module holds everything the browser needs to build that call: the registry
 * address per chain, the minimal ABI fragments (viem), and the agent-URI
 * builder that reproduces the BNB Agent Studio SDK's registration file so
 * SDK-registered and marketplace-registered agents resolve identically.
 *
 * Parity source (read from the installed SDK, not guessed):
 *   - address:        bnbagent/config.py               (registry_contract)
 *   - register(...)   bnbagent/erc8004/contract.py:180 (register(agentURI))
 *   - registration    bnbagent/erc8004/agent_uri.py    (generate_registration_file)
 *   - A2A card path   bnbagent_studio_core/erc8004/helpers.py (a2a_agent_card_endpoint)
 */

import type { Abi } from "viem";

/** IdentityRegistry per chain. Verified live on BSC testnet via eth_getCode. */
export const REGISTRY_BY_CHAIN: Record<number, `0x${string}`> = {
  97: "0x8004A818BFB912233c491871b3d84c89A494BD9e", // BSC testnet
  56: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", // BSC mainnet
};

/**
 * Minimal ABI: the single-arg `register(agentURI)` overload (nonpayable) plus
 * the `Registered` event we parse the new agentId out of. We deliberately use
 * the no-metadata overload — the SDK injects a `built_with` tag, but we are not
 * minting through the BNB SDK, so omitting it is the honest representation.
 */
export const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const satisfies Abi;

const A2A_WELL_KNOWN = "/.well-known/agent-card.json";
const MCP_PATH = "/mcp";
const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * A2A agent-card URL: append the discovery path unless the URL already points
 * at a card. Mirrors `a2a_agent_card_endpoint` (helpers.py) minus the Foundry
 * special-case (not reachable from this wizard).
 */
export function a2aCardUrl(endpoint: string): string {
  const url = (endpoint || "").trim().replace(/\/+$/, "");
  return url.endsWith(A2A_WELL_KNOWN) ? url : `${url}${A2A_WELL_KNOWN}`;
}

/** MCP streamable-HTTP URL: append `/mcp` unless already present. */
export function mcpUrl(endpoint: string): string {
  const url = (endpoint || "").trim().replace(/\/+$/, "");
  return url.endsWith(MCP_PATH) ? url : `${url}${MCP_PATH}`;
}

interface ServiceEntry {
  name: string;
  endpoint: string;
  version?: string;
}

/** Build the `services[]` entry for the chosen protocol (A2A default, or MCP). */
function serviceEntry(protocol: string, endpoint: string, version: string): ServiceEntry {
  if (protocol === "MCP") {
    return { name: "MCP", endpoint: mcpUrl(endpoint), version: MCP_PROTOCOL_VERSION };
  }
  return { name: "A2A", endpoint: a2aCardUrl(endpoint), version };
}

/**
 * Canonical JSON with recursively sorted keys and compact separators — matches
 * Python's `json.dumps(obj, sort_keys=True, separators=(",", ":"))` so the
 * on-chain agentURI is byte-identical to what the SDK would have produced.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
}

/** UTF-8 → base64 (btoa only handles latin1, so encode via TextEncoder first). */
function base64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export interface BuildAgentUriArgs {
  name: string;
  description: string;
  /** Base URL where the agent is reachable; blank → caller passes a placeholder. */
  endpoint: string;
  /** ERC-8004 `services[].name` — "A2A" (default) or "MCP". */
  protocol?: string;
  /** A2A protocol version recorded on the endpoint. */
  version?: string;
}

/**
 * Build the self-contained `data:application/json;base64,<json>` agent URI —
 * the exact EIP-8004 registration file the SDK generates
 * (`generate_registration_file`), so no off-chain hosting is needed.
 */
export function buildAgentUri({
  name,
  description,
  endpoint,
  protocol = "A2A",
  version = "0.3.0",
}: BuildAgentUriArgs): string {
  const registrationFile = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description,
    image: "",
    services: [serviceEntry(protocol, endpoint, version)],
    registrations: [] as unknown[],
  };
  const json = canonicalJson(registrationFile);
  return `data:application/json;base64,${base64Utf8(json)}`;
}

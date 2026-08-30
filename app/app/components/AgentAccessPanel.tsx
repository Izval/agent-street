/**
 * AgentAccessPanel — the agent-native access surface for a single listing.
 *
 * Agent-Street is built to be consumed by agents, not only humans: an orchestrator
 * agent discovers, evaluates, hires and manages listings through the marketplace MCP
 * server. This panel makes that visible on every agent's page — it shows the exact
 * MCP tool calls for THIS listing plus its direct A2A/ERC-8183 access surface.
 *
 * Marketplace-general: reads only `services` (already loaded) + the agent id. No
 * listing is special-cased.
 */

import { useState } from "react";
import { Link } from "react-router";
import { Card } from "./Card";
import { X402Badge } from "./Badge";
import type { AgentServices } from "../lib/contracts";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      className="shrink-0 rounded-[6px] border border-border px-2 py-1 text-[11px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-text-2">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-text-3">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function AgentAccessPanel({
  mcpUrl,
  agentId,
  agentName,
  services,
  x402Supported,
}: {
  mcpUrl: string;
  agentId: string;
  agentName: string;
  services: AgentServices | null;
  x402Supported: boolean;
}) {
  const call = (name: string, args: Record<string, unknown>) =>
    JSON.stringify(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      },
      null,
      2,
    );

  const x402 = services?.x402 ?? x402Supported;
  const erc8183 = services?.erc8183 ?? false;
  const a2a = services?.a2aEndpoint ?? null;

  return (
    <Card className="mt-4 p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Agent access</h2>
        <Link
          to="/for-agents"
          className="text-xs font-semibold text-text-3 transition-colors hover:text-brand"
        >
          For agents →
        </Link>
      </div>
      <p className="mb-3 text-xs text-text-3">
        Consume this agent programmatically. An orchestrator connects to the marketplace
        MCP server and calls these tools — no scraping, no human in the loop.
      </p>

      {/* MCP endpoint */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Marketplace MCP endpoint
          </div>
          <div className="truncate font-mono text-xs text-text-2">{mcpUrl}/mcp</div>
        </div>
        <CopyButton text={`${mcpUrl}/mcp`} />
      </div>

      {/* Capability badges */}
      <div className="mb-3 flex flex-wrap gap-2">
        {x402 && <X402Badge />}
        {erc8183 && (
          <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
            ERC-8183
          </span>
        )}
        {a2a && (
          <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
            A2A
          </span>
        )}
        {services?.mcpEndpoint && (
          <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
            MCP
          </span>
        )}
      </div>

      {/* Tool call snippets for THIS listing */}
      <div className="flex flex-col gap-3">
        <Snippet title="Evaluate — get_agent" code={call("get_agent", { id: agentId })} />
        {x402 && (
          <Snippet title="Hire — get_hire_quote" code={call("get_hire_quote", { agent: agentId })} />
        )}
      </div>

      {/* Direct A2A / ERC-8183 path */}
      {a2a && (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Direct A2A endpoint
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-xs text-text-2">{a2a}</span>
            <CopyButton text={a2a} />
          </div>
          <p className="mt-1 text-[11px] text-text-3">
            {erc8183
              ? `Or negotiate an ERC-8183 job directly: call get_agent_card { id: "${agentId}" } to read the live card, then negotiate.`
              : `Talk to ${agentName} directly over A2A instead of the marketplace-mediated hire.`}
          </p>
        </div>
      )}
    </Card>
  );
}

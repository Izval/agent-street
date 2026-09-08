/**
 * /compare?ids=a,b,c — side-by-side agent comparison.
 *
 * Closes the discover→compare→hire journey: the ⌘K palette / cards queue agents
 * (lib/compare.ts), the floating pill links here. One column per agent, rows
 * aligned so a judge reads the advantage at a glance. Real 8004scan data via the
 * proxy; honest "—" for anything the proxy doesn't expose.
 */

import { env } from "cloudflare:workers";
import { Link } from "react-router";

import type { Route } from "./+types/compare";
import { createAgentsClient, agentHref, hireHref, type AgentDetailRaw } from "../lib/agents";
import { AppShell } from "../components/AppShell";
import { scoreTone } from "../lib/score";

const MAX = 4;
const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

export function meta() {
  return [{ title: "Compare agents — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);
  if (!ids.length) return { agents: [] as AgentDetailRaw[] };

  const client = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });
  const settled = await Promise.all(ids.map((id) => client.getDetail(id)));
  return { agents: settled.filter((a): a is AgentDetailRaw => a != null) };
}

/** One comparison row: a label + a cell renderer per agent. */
interface Row {
  label: string;
  cell: (a: AgentDetailRaw) => React.ReactNode;
}

const yesNo = (v: boolean) => (v ? "Yes" : "—");

const ROWS: Row[] = [
  { label: "Subcategory", cell: (a) => a.subcategoryLabel ?? "—" },
  {
    label: "Score",
    cell: (a) =>
      Number.isFinite(a.score) ? (
        <span className={`tnum font-semibold ${TONE_TEXT[scoreTone(a.score)]}`}>
          {Math.round(a.score)}
        </span>
      ) : (
        "—"
      ),
  },
  { label: "Avg score", cell: (a) => (a.avgScore ? a.avgScore.toFixed(1) : "—") },
  { label: "Reviews", cell: (a) => String(a.feedbacks ?? 0) },
  { label: "Stars", cell: (a) => String(a.stars ?? 0) },
  { label: "Verified", cell: (a) => yesNo(!!a.isVerified) },
  { label: "x402 (hireable)", cell: (a) => yesNo(!!a.x402Supported) },
  { label: "Endpoint live", cell: (a) => yesNo(!!a.services?.a2aEndpoint) },
  {
    label: "Owner",
    cell: (a) =>
      a.ownerUsername || (a.ownerAddress ? `${a.ownerAddress.slice(0, 8)}…` : "—"),
  },
];

export default function Compare({ loaderData }: Route.ComponentProps) {
  const { agents } = loaderData;

  return (
    <AppShell>
      <header className="py-2">
        <h1 className="text-3xl font-bold">Compare agents</h1>
        <p className="mt-1 text-sm text-text-3">
          Side by side · real onchain data from 8004scan
        </p>
      </header>

      {agents.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-text-3">
          No agents selected. Add agents to compare from any card, or open the ⌘K
          search, then return here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-40 border-b border-border p-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-text-3">
                  Agent
                </th>
                {agents.map((a) => (
                  <th key={a.id} className="border-b border-border p-3 text-left align-bottom">
                    <Link
                      to={agentHref(a)}
                      className="font-semibold text-text hover:text-brand"
                    >
                      {a.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th className="border-b border-border/60 p-3 text-left text-xs font-medium text-text-3">
                    {row.label}
                  </th>
                  {agents.map((a) => (
                    <td key={a.id} className="tnum border-b border-border/60 p-3 text-text-2">
                      {row.cell(a)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th className="p-3" />
                {agents.map((a) => (
                  <td key={a.id} className="p-3">
                    <Link
                      to={hireHref(a.id, a.chainId)}
                      className="inline-block rounded-[8px] border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
                    >
                      Hire →
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

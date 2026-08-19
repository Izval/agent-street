import { env } from "cloudflare:workers";
import { Link } from "react-router";

import type { Route } from "./+types/hire";
import { createAgentsClient } from "../lib/agents";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { SourceBadge } from "../components/Badge";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Hire — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agent");
  if (!agentId) return { agent: null };
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL });
  const agent = await agents.get(agentId);
  return { agent };
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <span className="text-sm text-text-3">{label}</span>
      <span className="tnum text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

export default function Hire({ loaderData }: Route.ComponentProps) {
  const { agent } = loaderData;

  return (
    <AppShell activeCategory={agent?.category ?? undefined}>
      <div className="mx-auto max-w-[720px]">
        <div className="py-2">
          <Link
            to={agent ? `/agent/${encodeURIComponent(agent.id)}` : "/"}
            className="text-sm text-text-3 transition-colors hover:text-text"
          >
            ← {agent ? agent.name : "Marketplace"}
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Hire agent</h1>
        </div>

        {agent ? (
          <>
            {/* Resumen del agente */}
            <Card className="mt-4 flex items-center gap-3 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 font-bold text-text-2">
                {agent.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{agent.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  {agent.categoryLabel && (
                    <span className="text-xs text-text-3">
                      {agent.categoryLabel}
                    </span>
                  )}
                  <SourceBadge source={agent.source} />
                </div>
              </div>
            </Card>

            {/* Quote x402 (placeholder — se cablea en Fase 3) */}
            <Card className="mt-6 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
                Payment · x402
              </h2>
              <div className="mt-3">
                <Line label="Task" value="Rebalance LP (BNB-USDT)" />
                <Line label="Price" value="— USDT" />
                <Line
                  label="x402 supported"
                  value={agent.x402Supported ? "Yes" : "Unknown"}
                />
                <Line label="Session spend-cap" value="— USDT / día" />
                <Line label="Expiry" value="—" />
              </div>
              <button
                disabled
                className="mt-6 w-full cursor-not-allowed rounded-[8px] bg-surface-2 px-5 py-3 text-sm font-semibold text-text-disabled"
                title="El flujo de pago x402 se cablea en la Fase 3 (bag x402 quote/buy)"
              >
                Pay & hire (Fase 3)
              </button>
              <p className="mt-3 text-center text-xs text-text-3">
                El quote y el pago x402 (sesión + spend-cap vía BNBAgent SDK) se
                conectan en la Fase 3. Este es el shell del journey.
              </p>
            </Card>
          </>
        ) : (
          <Card className="mt-4 p-6 text-sm text-text-2">
            No se seleccionó agente.{" "}
            <Link to="/" className="text-brand hover:underline">
              Volver al marketplace
            </Link>
            .
          </Card>
        )}
      </div>
    </AppShell>
  );
}

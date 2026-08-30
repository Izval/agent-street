/**
 * SpecialtyPanel — the section that changes most per template. It is where the
 * agent's "specialty" is shown: a CLMM agent's range approach, a yield agent's
 * protocol set, a health agent's monitoring mandate, etc.
 *
 * Honesty: category-specific live figures (APY, floor, health-factor, LP range)
 * are read from the agent's own endpoint at hire — never invented here. This
 * panel stays qualitative and real (protocols, tags, interface).
 */

import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { Card } from "../Card";
import { ScoreMeter } from "../ScoreMeter";

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-[999px] bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-text-3">{children}</p>;
}

export function SpecialtyPanel({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent, services, reputation } = detail;
  const protocols = agent.supportedProtocols ?? [];
  const tags = agent.tags ?? [];

  return (
    <Card accent={meta.accent} className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-text">{meta.specialtyTitle}</h2>

      {/* clmm — concentrated-liquidity range approach */}
      {meta.template === "clmm" ? (
        <>
          <p className="text-sm text-text-2">
            Manages a concentrated-liquidity range: repositions the LP band as
            volatility and price move, aiming to stay in range and earn fees.
          </p>
          {protocols.length > 0 && (
            <div className="mt-3">
              <Chips items={protocols} />
            </div>
          )}
          {tags.length > 0 && (
            <div className="mt-3">
              <Chips items={tags} />
            </div>
          )}
          <Note>
            The live range (tickLower/tickUpper) is computed by the agent's own
            endpoint at hire — not indexed here.
          </Note>
        </>
      ) : null}

      {/* yield / rwa — protocol set */}
      {meta.template === "yield" || meta.template === "rwa" ? (
        <>
          {protocols.length > 0 ? (
            <>
              <div className="mb-2 text-xs text-text-3">Protocols</div>
              <Chips items={protocols} />
            </>
          ) : (
            <p className="text-sm text-text-2">
              {meta.template === "yield"
                ? "Routes capital across BSC yield venues, rebalancing to the best risk-adjusted return."
                : "Manages tokenized real-world asset exposure onchain."}
            </p>
          )}
          {tags.length > 0 && <div className="mt-3"><Chips items={tags} /></div>}
          <Note>Live APY / TVL is quoted by the agent's endpoint — not indexed here.</Note>
        </>
      ) : null}

      {/* health — monitoring mandate + reliability */}
      {meta.template === "health" ? (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          {(reputation?.health ?? agent.healthScore) != null && (
            <ScoreMeter
              score={Math.round(reputation?.health ?? agent.healthScore ?? 0)}
              label="Monitoring reliability"
              size="lg"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm text-text-2">
              Watches your lending positions' health factor and deleverages before
              liquidation. It reads your live position at hire — the reliability
              score above is this agent's 8004scan track record, not your position.
            </p>
            {(protocols.length > 0 || tags.length > 0) && (
              <div className="mt-3">
                <Chips items={[...protocols, ...tags]} />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* trading — strategy summary */}
      {meta.template === "trading" ? (
        <>
          <p className="text-sm text-text-2">{agent.description}</p>
          {tags.length > 0 && <div className="mt-3"><Chips items={tags} /></div>}
          <Note>
            PnL / win-rate need NAV history and are labeled "since indexed" once an
            indexer key is set — never estimated here.
          </Note>
        </>
      ) : null}

      {/* nft — capabilities */}
      {meta.template === "nft" ? (
        <>
          <p className="text-sm text-text-2">{agent.description}</p>
          {tags.length > 0 && <div className="mt-3"><Chips items={tags} /></div>}
          <Note>Floor / volume / holdings are not indexed for this agent yet.</Note>
        </>
      ) : null}

      {/* services — interface */}
      {meta.template === "services" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-text-3">A2A endpoint</div>
              <div className="truncate font-mono text-xs text-text-2">
                {services?.a2aEndpoint ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-text-3">MCP endpoint</div>
              <div className="truncate font-mono text-xs text-text-2">
                {services?.mcpEndpoint ?? "—"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {services?.protocolVersion && (
              <span className="rounded-[999px] border border-border px-2.5 py-1 text-xs font-semibold text-text-2">
                A2A v{services.protocolVersion}
              </span>
            )}
            {services?.x402 && (
              <span className="rounded-[999px] border border-border px-2.5 py-1 text-xs font-semibold text-text-2">
                x402
              </span>
            )}
            {services?.erc8183 && (
              <span className="rounded-[999px] border border-border px-2.5 py-1 text-xs font-semibold text-text-2">
                ERC-8183
              </span>
            )}
          </div>
          {tags.length > 0 && <div className="mt-3"><Chips items={tags} /></div>}
        </>
      ) : null}
    </Card>
  );
}

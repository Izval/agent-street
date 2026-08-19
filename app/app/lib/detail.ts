/**
 * Compositor del detalle de agente (WS1.3) — ensambla `AgentDetail` (contracts.ts)
 * a partir de las tres fuentes: proxy 8004scan enriquecido (agente + reputación +
 * services), indexer onchain (portfolio + trades) e IVL (solo flagship).
 *
 * Lo consume `routes/agent.tsx` (Ola 3). Cada fuente degrada a null de forma
 * independiente: si el indexer cae, el detalle sigue mostrando reputación real.
 */

import type { AgentDetail } from "./contracts";
import { createAgentsClient } from "./agents";
import { createOnchainClient, deriveMetrics } from "./onchain";
import { createIvlClient } from "./ivl";
import { aisleOf, categoryTemplate } from "./taxonomy";
import { FLAGSHIP_ID } from "./seed";

const FLAGSHIP_PAIR = "BNB-USDT";

export interface DetailEnv {
  proxyUrl: string;
  indexerUrl: string;
  ivlUrl: string;
  signal?: AbortSignal;
}

export async function loadAgentDetail(
  env: DetailEnv,
  id: string,
): Promise<AgentDetail | null> {
  const agents = createAgentsClient({ baseUrl: env.proxyUrl, signal: env.signal });
  const onchain = createOnchainClient({ baseUrl: env.indexerUrl, signal: env.signal });

  const raw = await agents.getDetail(id);
  if (!raw) return null;

  const { reputation, services, ...agent } = raw;
  const category = agent.category;
  const aisle = category ? aisleOf(category) : null;
  const template = categoryTemplate(category);

  // Wallet a indexar: la del agente o, en su defecto, el owner.
  const wallet = agent.agentWallet ?? agent.ownerAddress ?? null;

  const [portfolio, trades, ivl] = await Promise.all([
    wallet ? onchain.portfolio(wallet) : Promise.resolve(null),
    wallet ? onchain.trades(wallet) : Promise.resolve(null),
    agent.id === FLAGSHIP_ID
      ? createIvlClient({ baseUrl: env.ivlUrl, signal: env.signal })
          .ticks(FLAGSHIP_PAIR)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    agent,
    aisle,
    category,
    template,
    portfolio,
    metrics: deriveMetrics(portfolio, trades),
    equity: null, // v1: sin histórico de NAV (ver onchain.deriveMetrics)
    trades,
    reputation,
    services,
    ivl,
  };
}

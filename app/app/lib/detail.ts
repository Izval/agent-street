/**
 * Agent detail compositor (WS1.3) — assembles `AgentDetail` (contracts.ts) from
 * two sources: the enriched 8004scan proxy (agent + reputation + services) and
 * the onchain indexer (portfolio + trades).
 *
 * Consumed by `routes/agent.tsx` (Wave 3). Each source degrades to null
 * independently: if the indexer goes down, the detail still shows real reputation.
 */

import type { AgentDetail } from "./contracts";
import { createAgentsClient } from "./agents";
import { createOnchainClient, deriveMetrics } from "./onchain";
import { categoryOf, subcategoryTemplate } from "./taxonomy";

export interface DetailEnv {
  proxyUrl: string;
  indexerUrl: string;
  signal?: AbortSignal;
  /** Service bindings (same-account worker-to-worker; see the lib clients). */
  proxyFetcher?: Fetcher;
  indexerFetcher?: Fetcher;
}

export async function loadAgentDetail(
  env: DetailEnv,
  id: string,
  /** BSC chain to resolve against: 56 (mainnet, default) or 97 (testnet). */
  chain?: number,
): Promise<AgentDetail | null> {
  const agents = createAgentsClient({
    baseUrl: env.proxyUrl,
    signal: env.signal,
    fetcher: env.proxyFetcher,
  });
  const onchain = createOnchainClient({
    baseUrl: env.indexerUrl,
    signal: env.signal,
    fetcher: env.indexerFetcher,
  });

  const raw = await agents.getDetail(id, chain);
  if (!raw) return null;

  const { reputation, services, ...agent } = raw;
  const subcategory = agent.subcategory;
  const category = subcategory ? categoryOf(subcategory) : null;
  const template = subcategoryTemplate(subcategory);

  // Wallet to index: the agent's, or failing that, the owner's.
  const wallet = agent.agentWallet ?? agent.ownerAddress ?? null;

  const [portfolio, trades] = await Promise.all([
    wallet ? onchain.portfolio(wallet) : Promise.resolve(null),
    wallet ? onchain.trades(wallet) : Promise.resolve(null),
  ]);

  return {
    agent,
    category,
    subcategory,
    template,
    portfolio,
    metrics: deriveMetrics(portfolio, trades),
    equity: null, // v1: no NAV history (see onchain.deriveMetrics)
    trades,
    reputation,
    services,
  };
}

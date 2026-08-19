import { env } from "cloudflare:workers";
import { useEffect } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/agent";
import { loadAgentDetail } from "../lib/detail";
import { createTrendingClient } from "../lib/trending";
import { categoryLabel } from "../lib/taxonomy";
import { FLAGSHIP_ID } from "../lib/seed";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { KpiTile } from "../components/KpiTile";
import { ScoreMeter } from "../components/ScoreMeter";
import { SourceBadge, VerifiedBadge, X402Badge, LiveBadge } from "../components/Badge";
import { Donut } from "../components/charts/Donut";
import { BarCompare } from "../components/charts/BarCompare";
import { AreaChart } from "../components/charts/AreaChart";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.detail?.agent?.name ?? "Agent"} — Agent-Street` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const detail = await loadAgentDetail(
    {
      proxyUrl: env.PROXY_8004_URL,
      indexerUrl: env.ONCHAIN_INDEXER_URL,
      ivlUrl: env.IVL_API_URL,
    },
    params.id,
  );
  if (!detail) throw new Response("Not found", { status: 404 });
  return { detail, analyticsUrl: env.ANALYTICS_URL };
}

function usd(n: number) {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  if (n >= 1_000)
    return `$${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function short(addr?: string | null) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function AgentDetail({ loaderData }: Route.ComponentProps) {
  const { detail, analyticsUrl } = loaderData;
  const { agent, portfolio, metrics, trades, reputation, services, ivl, template } =
    detail;

  // Cuenta la visita real (demanda de primera mano → motor de trending).
  useEffect(() => {
    createTrendingClient({ baseUrl: analyticsUrl }).event(agent.id, "view");
  }, [agent.id, analyticsUrl]);

  const isFlagship = agent.id === FLAGSHIP_ID;
  const owner =
    agent.ownerUsername ?? agent.ownerEns ?? short(agent.agentWallet ?? agent.ownerAddress);

  // Allocation → slices reales (solo holdings con precio).
  const slices =
    portfolio?.holdings
      .filter((h) => h.valueUsd != null && h.valueUsd > 0)
      .map((h) => ({ label: h.symbol, value: h.valueUsd as number })) ?? [];

  // Dimensiones de reputación (reales 8004scan) → barras.
  const repBars =
    reputation?.dimensions.map((d) => ({
      label: d.key,
      value: Math.round(d.score),
    })) ?? [];

  return (
    <AppShell activeAisle={detail.aisle ?? undefined} activeCategory={agent.category ?? undefined}>
      <div className="py-2">
        <Link
          to={agent.category ? `/category/${agent.category}` : "/"}
          className="text-sm text-text-3 transition-colors hover:text-text"
        >
          ← {agent.categoryLabel ?? "Marketplace"}
        </Link>
      </div>

      {/* Header (glass) */}
      <Card glass className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className={
                "grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-bold " +
                (isFlagship
                  ? "bg-gradient-to-br from-brand to-brand-bright text-bg"
                  : "bg-surface-2 text-text-2")
              }
            >
              {isFlagship ? "IVL" : agent.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <div className="mt-1 text-sm text-text-3">
                {owner ? <>por {owner} · </> : null}ERC-8004
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {agent.categoryLabel && (
                  <span className="rounded-[999px] bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-2">
                    {agent.categoryLabel}
                  </span>
                )}
                <SourceBadge source={agent.source} />
                {agent.isVerified && <VerifiedBadge />}
                {agent.x402Supported && <X402Badge />}
                {typeof agent.rank === "number" && (
                  <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
                    Rank #{agent.rank}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <LiveBadge />
            <div className="mt-1 text-[11px] text-text-3">BSC · {agent.chainId}</div>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-text-2">{agent.description}</p>
      </Card>

      {/* KPI row — real + honesto */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Portfolio value"
          value={metrics ? usd(metrics.totalUsd) : "—"}
          hint={portfolio?.source === "onchain" ? "onchain" : "sin indexar"}
        />
        <KpiTile label="Total score" value={reputation?.totalScore.toFixed(1) ?? String(agent.score)} hint="8004scan" />
        <KpiTile
          label="Health"
          value={reputation?.health != null ? String(Math.round(reputation.health)) : "—"}
          hint="8004scan"
        />
        <KpiTile
          label="Trades"
          value={metrics ? String(metrics.tradeCount) : "—"}
          hint={metrics?.tradeCount ? "since indexed" : "requiere key indexer"}
        />
      </div>

      {/* Charts: allocation real + panel template-driven */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Asset allocation</h2>
          {slices.length ? (
            <Donut
              slices={slices}
              centerLabel="Portfolio"
              centerValue={metrics ? usd(metrics.totalUsd) : undefined}
            />
          ) : (
            <p className="text-sm text-text-3">
              Sin holdings con precio en la wallet del agente ({short(agent.agentWallet ?? agent.ownerAddress)}).
            </p>
          )}
        </Card>

        <Card className="p-5">
          {isFlagship && ivl ? (
            <>
              <h2 className="mb-4 text-sm font-semibold text-text">
                Estrategia IVL en vivo · {ivl.pair}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <KpiTile label="IVL score" value={ivl.ivl_score} hint="api.zvlint.com" />
                <KpiTile label="Clasificación" value={ivl.classification} hint="live" />
                <KpiTile
                  label="Rango LP (ticks)"
                  value={<span className="font-mono text-base">{ivl.ticks.tickLower}/{ivl.ticks.tickUpper}</span>}
                  hint={`fee ${ivl.ticks.feeTier * 100}%`}
                />
                <KpiTile label="Acción" value={ivl.decision.action} hint={ivl.decision.breakoutRisk + " risk"} />
              </div>
              <p className="mt-3 text-xs text-text-2">{ivl.decision.rationale}</p>
            </>
          ) : (
            <>
              <h2 className="mb-4 text-sm font-semibold text-text">
                Reputación · dimensiones onchain
              </h2>
              {repBars.length ? (
                <BarCompare bars={repBars} unit="" />
              ) : (
                <p className="text-sm text-text-3">Reputación no disponible.</p>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Equity curve (v1: sin histórico → estado honesto) */}
      {detail.equity && detail.equity.length > 1 && (
        <Card className="mt-4 p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Equity curve</h2>
          <AreaChart points={detail.equity.map((e) => ({ ts: e.ts, value: e.navUsd }))} tone="up" />
        </Card>
      )}

      {/* Recent trades */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Recent trades</h2>
          <span className="text-xs text-text-3">onchain</span>
        </div>
        {trades && trades.trades.length ? (
          <ul className="divide-y divide-border">
            {trades.trades.slice(0, 8).map((t) => (
              <li key={t.hash} className="flex items-center justify-between py-2 text-sm">
                <span className="font-semibold text-text-2">
                  {t.side} {t.tokenIn}→{t.tokenOut}
                </span>
                <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="tnum font-mono text-xs text-text-3 hover:text-brand">
                  {short(t.hash)} ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-3">
            Sin swaps recientes indexados. El feed de trades onchain requiere una
            API key del indexer (BscScan) — sin ella, este panel queda vacío en vez
            de mostrar datos inventados.
          </p>
        )}
      </Card>

      {/* Services & skills */}
      {services && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">Services & skills</h2>
            {services.cardLive && <LiveBadge />}
          </div>
          <div className="flex flex-wrap gap-2">
            {services.x402 && <X402Badge />}
            {services.erc8183 && (
              <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
                ERC-8183
              </span>
            )}
            {services.protocolVersion && (
              <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
                A2A v{services.protocolVersion}
              </span>
            )}
          </div>
          {services.skills.length > 0 && (
            <ul className="mt-4 space-y-2">
              {services.skills.map((s) => (
                <li key={s.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="text-sm font-semibold text-text">{s.name}</div>
                  {s.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-text-3">{s.description}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Hire */}
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-4">
          <ScoreMeter score={agent.score} label="Score" size="md" />
          <p className="max-w-sm text-sm text-text-2">
            Contrata al agente vía x402 con una sesión y spend-cap. El pago se
            cablea en la Fase 3.
          </p>
        </div>
        <Link
          to={`/hire?agent=${encodeURIComponent(agent.id)}`}
          className="rounded-[8px] bg-brand px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
        >
          Hire agent
        </Link>
      </Card>
    </AppShell>
  );
}

import { env } from "cloudflare:workers";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { agentHref } from "../lib/agents";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";

import type { Route } from "./+types/me";
import { loadMyAgents, type HireRecord, type OwnedAgent } from "../lib/me";
import { createPortfoliosClient, type UserPortfolio } from "../lib/portfolios-client";
import { createSessionsClient } from "../lib/sessions-client";
import type { Session } from "../lib/contracts";
import { AppShell } from "../components/AppShell";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { WalletButton } from "../components/WalletButton";

export function meta(_: Route.MetaArgs) {
  return [{ title: "My agents — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  const [me, portfolios, sessions] = await Promise.all([
    loadMyAgents({ hireUrl: env.HIRE_X402_URL, hireFetcher: env.HIRE_X402 }, address),
    address
      ? createPortfoliosClient({ baseUrl: env.PORTFOLIOS_URL, fetcher: env.PORTFOLIOS }).list({
          owner: address,
          limit: 50,
        })
      : Promise.resolve(null),
    address
      ? createSessionsClient({ baseUrl: env.HIRE_X402_URL, fetcher: env.HIRE_X402 }).list(address)
      : Promise.resolve([] as Session[]),
  ]);
  return { ...me, portfolios: portfolios ?? [], sessions: sessions ?? [] };
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-3">
        {children}
      </h2>
      {count != null && (
        <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-2">
          {count}
        </span>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-6 text-center text-sm text-text-3">{children}</Card>
  );
}

function HireCard({ h }: { h: HireRecord }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-text-2">
        {(h.agentName ?? h.agentId ?? "AG").slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={agentHref({ id: h.agentId, name: h.agentName })}
            className="truncate font-semibold text-text hover:text-brand"
          >
            {h.agentName ?? h.agentId}
          </Link>
          <span className="rounded-full border border-up/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-up">
            Settled
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-text-3">
          {h.task ?? "Task"} · {h.network}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="tnum text-sm font-semibold text-text">
          {h.amount != null ? `${h.amount} ${h.assetSymbol ?? ""}`.trim() : "—"}
        </div>
        <div className="mt-0.5 text-xs text-text-3">
          {new Date(h.settledAt).toLocaleDateString()}
        </div>
      </div>
      {h.explorerUrl && (
        <a
          href={h.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-1 shrink-0 rounded-[8px] border border-border px-3 py-2 text-xs font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          Tx ↗
        </a>
      )}
    </Card>
  );
}

function SessionRow({ s }: { s: Session }) {
  const cap = s.spend[0];
  const capLabel = cap
    ? `${Number(formatUnits(BigInt(cap.limitBase), cap.decimals ?? 18))} ${cap.symbol ?? ""}/${cap.period}`
    : "Session";
  const tone =
    s.status === "active"
      ? "border-up/40 text-up"
      : s.status === "revoked"
        ? "border-down/40 text-down"
        : "border-border text-text-3";
  return (
    <Link to="/manage" className="block">
      <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="tnum truncate font-semibold text-text">{capLabel}</span>
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}
            >
              {s.status}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-text-3">
            {s.remainingAmount != null
              ? `${s.remainingAmount} ${cap?.symbol ?? ""} remaining · `
              : ""}
            {s.allowlist.length === 0 ? "any listing" : `${s.allowlist.length} agent(s)`}
          </div>
        </div>
        <span className="shrink-0 text-text-3">→</span>
      </Card>
    </Link>
  );
}

function OwnedCard({ a }: { a: OwnedAgent }) {
  const inner = (
    <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand">
      <Avatar
        src={a.imageUrl}
        name={a.name}
        seed={a.id}
        size="h-10 w-10"
        rounded="rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-text">{a.name}</div>
        <div className="mt-0.5 text-xs text-text-3">
          {a.network === "testnet" ? "BSC testnet" : "BSC mainnet"} · #{a.id}
        </div>
      </div>
      {a.score != null && (
        <div className="tnum shrink-0 text-sm font-semibold text-text-2">{a.score}</div>
      )}
      <span className="shrink-0 text-text-3">{a.external ? "↗" : "→"}</span>
    </Card>
  );
  return a.external ? (
    <a href={a.href} target="_blank" rel="noreferrer" className="block">
      {inner}
    </a>
  ) : (
    <Link to={a.href} className="block">
      {inner}
    </Link>
  );
}

function MyPortfolioCard({ p }: { p: UserPortfolio }) {
  return (
    <Link to={`/portfolio/${encodeURIComponent(p.slug)}`} className="block">
      <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-text-2">
          {p.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-text">{p.name}</div>
          <div className="tnum mt-0.5 text-xs text-text-3">
            {p.members.length} agents · {p.stats.copies} copies · {p.stats.hireAlls} hires
          </div>
        </div>
        <span className="shrink-0 text-text-3">→</span>
      </Card>
    </Link>
  );
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const { hires, launchedMainnet, launchedTestnet, portfolios, sessions } = loaderData;
  const { address, isConnected } = useAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramAddr = searchParams.get("address");

  // Sync the connected wallet (client-only) with the loader's ?address=.
  useEffect(() => {
    if (isConnected && address && paramAddr !== address) {
      setSearchParams({ address }, { replace: true });
    } else if (!isConnected && paramAddr) {
      setSearchParams({}, { replace: true });
    }
  }, [isConnected, address, paramAddr, setSearchParams]);

  const launchedTotal = launchedMainnet.length + launchedTestnet.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-[820px]">
        <div className="flex items-end justify-between py-2">
          <div>
            <h1 className="text-3xl font-bold">My agents</h1>
            {address && (
              <p className="tnum mt-1 text-sm text-text-3">
                {address.slice(0, 6)}…{address.slice(-4)}
              </p>
            )}
          </div>
          <Link to="/" className="text-sm text-text-3 transition-colors hover:text-text">
            ← Marketplace
          </Link>
        </div>

        {!isConnected ? (
          <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-sm text-text-2">
              Connect your wallet to see your hired and launched agents.
            </p>
            <WalletButton />
          </Card>
        ) : (
          <>
            {/* Hired */}
            <SectionTitle count={hires.length}>Hired</SectionTitle>
            {hires.length === 0 ? (
              <Empty>
                You haven't hired any agents yet.{" "}
                <Link to="/" className="text-brand hover:underline">
                  Explore the marketplace
                </Link>
                .
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {hires.map((h) => (
                  <HireCard key={h.txHash} h={h} />
                ))}
              </div>
            )}

            {/* Managed sessions (manage flow) */}
            <div className="flex items-center justify-between">
              <SectionTitle count={sessions.length}>Sessions</SectionTitle>
              <Link
                to="/manage"
                className="mt-8 text-xs font-semibold text-brand transition-colors hover:underline"
              >
                Manage →
              </Link>
            </div>
            {sessions.length === 0 ? (
              <Empty>
                No managed sessions yet.{" "}
                <Link to="/manage" className="text-brand hover:underline">
                  Grant a spend-capped session
                </Link>{" "}
                to hire within a cap without signing each time.
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            )}

            {/* Portfolios (created by this wallet) */}
            <div className="flex items-center justify-between">
              <SectionTitle count={portfolios.length}>Portfolios</SectionTitle>
              <Link
                to="/portfolio/new"
                className="mt-8 text-xs font-semibold text-brand transition-colors hover:underline"
              >
                Build one →
              </Link>
            </div>
            {portfolios.length === 0 ? (
              <Empty>
                You haven't published any portfolios yet.{" "}
                <Link to="/portfolio/new" className="text-brand hover:underline">
                  Build a portfolio
                </Link>{" "}
                to bundle agents others can copy or hire.
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {portfolios.map((p) => (
                  <MyPortfolioCard key={p.slug} p={p} />
                ))}
              </div>
            )}

            {/* Launched */}
            <SectionTitle count={launchedTotal}>Launched</SectionTitle>
            {launchedTotal === 0 ? (
              <Empty>
                We found no agents whose onchain owner is this wallet (neither mainnet nor
                testnet). When you register an ERC-8004 agent with this wallet, it will appear here.
              </Empty>
            ) : (
              <div className="flex flex-col gap-4">
                {launchedMainnet.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">
                      Mainnet
                    </div>
                    <div className="flex flex-col gap-2">
                      {launchedMainnet.map((a) => (
                        <OwnedCard key={`m-${a.id}`} a={a} />
                      ))}
                    </div>
                  </div>
                )}
                {launchedTestnet.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-3">
                      Testnet
                    </div>
                    <div className="flex flex-col gap-2">
                      {launchedTestnet.map((a) => (
                        <OwnedCard key={`t-${a.id}`} a={a} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

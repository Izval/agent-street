import { env } from "cloudflare:workers";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { useAccount } from "wagmi";

import type { Route } from "./+types/me";
import { loadMyAgents, type HireRecord, type OwnedAgent } from "../lib/me";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { WalletButton } from "../components/WalletButton";

export function meta(_: Route.MetaArgs) {
  return [{ title: "My agents — Agent-Street" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  return loadMyAgents({ hireUrl: env.HIRE_X402_URL }, address);
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
            to={`/agent/${encodeURIComponent(h.agentId)}`}
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

function OwnedCard({ a }: { a: OwnedAgent }) {
  const inner = (
    <Card className="flex items-center gap-3 p-4 transition-colors hover:border-brand">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-sm font-bold text-text-2">
        {a.imageUrl ? (
          <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          a.name.slice(0, 2).toUpperCase()
        )}
      </span>
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

export default function Me({ loaderData }: Route.ComponentProps) {
  const { hires, launchedMainnet, launchedTestnet } = loaderData;
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

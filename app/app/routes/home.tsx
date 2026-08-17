import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";
import {
  createIvlClient,
  ivlScoreTone,
  type IvlTicksResponse,
} from "../lib/ivl";
import { CATEGORY_LABELS } from "../lib/categories";

const FLAGSHIP_PAIR = "BNB-USDT";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Agent-Street — BNB Agent marketplace" },
    {
      name: "description",
      content:
        "Discover, compare and hire ERC-8004 agents & skills on BNB Chain.",
    },
  ];
}

export async function loader() {
  const ivl = createIvlClient({ baseUrl: env.IVL_API_URL });
  let flagship: IvlTicksResponse | null = null;
  let error: string | null = null;
  try {
    flagship = await ivl.ticks(FLAGSHIP_PAIR);
  } catch (e) {
    error = (e as Error).message;
  }
  return { flagship, error };
}

const TONE_CLASS: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

function num(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { flagship, error } = loaderData;
  const tone = flagship ? ivlScoreTone(flagship.ivl_score) : "brand";

  return (
    <div className="min-h-dvh bg-bg text-text">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand font-bold text-bg">
              A
            </span>
            <span className="text-lg font-bold tracking-tight">
              Agent<span className="text-brand">-</span>Street
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-text-3 sm:inline">
              Built on BNB Chain
            </span>
            <button className="rounded-[999px] bg-brand px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright">
              Connect
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-24 md:px-8">
        {/* Hero */}
        <section className="py-12 md:py-16">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            The marketplace for{" "}
            <span className="text-brand">autonomous agents</span> on BNB Chain.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-text-2">
            Discover, compare and hire ERC-8004 agents & composable skills — with
            real onchain performance data.
          </p>
        </section>

        {/* Tabs */}
        <nav className="flex gap-6 border-b border-border">
          <span className="-mb-px border-b-2 border-brand pb-3 font-semibold text-text">
            Agents
          </span>
          <span className="-mb-px cursor-not-allowed border-b-2 border-transparent pb-3 font-semibold text-text-2">
            Skills
          </span>
        </nav>

        {/* Category chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(
            (id, i) => (
              <span
                key={id}
                className={
                  "rounded-[999px] px-4 py-1.5 text-sm font-semibold " +
                  (i === 0
                    ? "bg-brand text-bg"
                    : "bg-surface-2 text-text-2")
                }
              >
                {CATEGORY_LABELS[id]}
              </span>
            ),
          )}
        </div>

        {/* Flagship IVL card */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-3">
            Flagship agent
          </h2>
          <article className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-bright font-bold text-bg">
                    IVL
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">IVL Rebalancer</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-[999px] bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-2">
                        {CATEGORY_LABELS.rebalancing}
                      </span>
                      <span className="text-xs text-text-3">ERC-8004</span>
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-md text-sm text-text-2">
                  Reads live range quality from the IVL engine and repositions a
                  PancakeSwap v3 LP — concentrated liquidity, managed onchain.
                </p>
              </div>

              {/* Live data — Data Quality */}
              <div className="shrink-0 rounded-lg border border-border bg-surface-2 p-5">
                {flagship ? (
                  <div className="flex items-center gap-8">
                    <div>
                      <div className="text-xs text-text-3">
                        IVL score · {flagship.pair}
                      </div>
                      <div
                        className={
                          "tnum text-4xl font-bold " + TONE_CLASS[tone]
                        }
                      >
                        {flagship.ivl_score}
                      </div>
                      <div className="text-xs capitalize text-text-3">
                        {flagship.classification}
                      </div>
                    </div>
                    <div className="border-l border-border pl-8 text-sm">
                      <div className="text-xs text-text-3">LP range (ticks)</div>
                      <div className="tnum mt-1 font-mono text-text">
                        {flagship.ticks.tickLower} / {flagship.ticks.tickUpper}
                      </div>
                      <div className="tnum mt-1 text-xs text-text-3">
                        {num(flagship.ticks.priceLower)} –{" "}
                        {num(flagship.ticks.priceUpper)}
                      </div>
                      <div className="mt-2 text-xs text-text-3">
                        fee {flagship.ticks.feeTier * 100}% · action{" "}
                        <span className="text-text-2">
                          {flagship.decision.action}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-down">
                    Live IVL data unavailable{error ? ` · ${error}` : ""}
                  </div>
                )}
                <div className="mt-3 text-right text-[11px] text-text-3">
                  ● Live · api.zvlint.com
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Data layer note (8004scan) */}
        <p className="mt-10 text-sm text-text-3">
          Agent breadth is indexed from 8004scan (ERC-8004 registries on BSC).
          Connect the proxy Worker + API key to populate the four categories with
          real onchain reputation and performance.
        </p>
      </main>
    </div>
  );
}

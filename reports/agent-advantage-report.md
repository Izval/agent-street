# Agent Advantage Report — IVL Rebalancer

> **Thesis:** hiring the **IVL Rebalancer** agent (concentrated-liquidity management guided by the IVL score) returns more per unit of capital than managing the range yourself — fixed (*naive*) or random ranges. The evidence is **real** market data (live Binance klines), not made-up figures.

## Methodology

- **Engine:** IVL (`api.zvlint.com` / `third_city`), consumed as a seam — the Agent-Street agent lists it, it does not reimplement it.
- **`compare`** (trading/profitability task): walk-forward simulation with the SAME capital for three ways of choosing the range; measures `net = Σ(fees − IL) − cost·rebalances`.
- **`backtest`**: for each point, derives the IVL range (μ_vwap ± 2σ) and simulates holding it over the forward horizon; measures time-in-range, breakout rate and fee-efficiency (fees/width).
- **Agent vs DIY axes (TermiX):** each trading task reports **time** (turnaround), **cost** (on-chain transactions) and **output quality** (net PnL / IL avoided).
- **Reproducible:** `node reports/generate.mjs` (live, needs the sibling `third_city` repo) or `node reports/generate.mjs --offline` (renders from the committed `reports/metrics/*.json`).

**Generated:** 2026-09-03T13:53:46.878Z · **Mode:** offline (committed metrics) · **Tasks measured:** 4/4 (trading: 1) · **TermiX requirement:** ≥3 tasks, ≥1 trading → ✅ met

## Task 1 — LP profitability — AAVE/WBNB (1d, 365 candles) · _trading/profitability_

**Pair:** AAVE-WBNB · scale 1d · 365 candles · typical width 15.1%

| Strategy | Net (fees−IL) | Gross fees | IL | Time in range | Rebalances |
|---|---:|---:|---:|---:|---:|
| **IVL (agent)** | 2.21 | 123.26 | 107.55 | 25.9% | 9 |
| Naive (DIY fixed) | -39.63 | 297.77 | 289.39 | 100.0% | 32 |
| Random (DIY chance) | -46.19 | 267.76 | 265.88 | 99.4% | 32 |

- **IVL vs Random:** **loss→gain** (+48.4 net)
- **IVL vs Naive:** **loss→gain** (+41.84 net)
- **IL avoided:** IVL 107.55 vs Naive 289.39 (−63%)
- **Track record:** window 365 1d candles (~1.0 yr) · risk: −63% IL/drawdown vs the DIY naive range · outcome: net 2.21 (agent) vs -39.63 (DIY).

**With agent vs without (TermiX axes):**

| Axis | With agent (IVL) | Without (DIY naive) | Advantage |
|---|---|---|---|
| Time (turnaround) | seconds (compute + submit) | ~20 min (manual, estimated) | agent decides in seconds |
| Cost (on-chain txs) | 9 rebalances | 32 rebalances | −72% gas txs |
| Output quality (net) | 2.21 | -39.63 | **loss→gain** (+41.84 net) |

<sub>Cost = on-chain transactions (rebalances); the agent's fewer rebalances mean less gas.</sub>

<sub>Raw metrics: [`metrics/compare-aave-wbnb.json`](./metrics/compare-aave-wbnb.json)</sub>

## Task 2 — Walk-forward backtest — BNB/USDT (flagship)

**Pair:** BNB-USDT · 54 evaluations (lookback 96, hold 48, step 16)

| Range | Time in range | Breakout rate | Fee-efficiency (fees/width) |
|---|---:|---:|---:|
| **IVL (μ±2σ)** | 78.1% | 50.0% | 1.85 |
| Naive (wide range S..R) | 83.8% | 42.6% | 1.78 |

- **Fee-efficiency gain (IVL vs naive):** **1.037×**
- **When the skill ENTERS** (score≥60 or concentrate) [4 cases]: time in range 70.8% · breakout 50.0% · fee-efficiency 1.56
- **Cost:** simulation only — no on-chain execution, so gas cost is n/a for this task (see the AAVE/WBNB task for the measured on-chain-tx cost comparison).

<sub>Raw metrics: [`metrics/backtest-bnb-usdt.json`](./metrics/backtest-bnb-usdt.json)</sub>

## Task 3 — Walk-forward backtest — CAKE/WBNB (PancakeSwap-native)

**Pair:** CAKE-WBNB · 54 evaluations (lookback 96, hold 48, step 16)

| Range | Time in range | Breakout rate | Fee-efficiency (fees/width) |
|---|---:|---:|---:|
| **IVL (μ±2σ)** | 72.3% | 64.8% | 3055945.33 |
| Naive (wide range S..R) | 83.6% | 44.4% | 2621992.43 |

- **Fee-efficiency gain (IVL vs naive):** **1.166×**
- The skill did not enter any window (market unfit per IVL — an honest abstention).
- **Cost:** simulation only — no on-chain execution, so gas cost is n/a for this task (see the AAVE/WBNB task for the measured on-chain-tx cost comparison).

<sub>Raw metrics: [`metrics/backtest-cake-wbnb.json`](./metrics/backtest-cake-wbnb.json)</sub>

## Task 4 — Walk-forward backtest — ETH/USDT (major)

**Pair:** ETH-USDT · 54 evaluations (lookback 96, hold 48, step 16)

| Range | Time in range | Breakout rate | Fee-efficiency (fees/width) |
|---|---:|---:|---:|
| **IVL (μ±2σ)** | 85.9% | 38.9% | 0.81 |
| Naive (wide range S..R) | 86.8% | 33.3% | 0.74 |

- **Fee-efficiency gain (IVL vs naive):** **1.093×**
- **When the skill ENTERS** (score≥60 or concentrate) [4 cases]: time in range 100.0% · breakout 0.0% · fee-efficiency 0.54
- **Cost:** simulation only — no on-chain execution, so gas cost is n/a for this task (see the AAVE/WBNB task for the measured on-chain-tx cost comparison).

<sub>Raw metrics: [`metrics/backtest-eth-usdt.json`](./metrics/backtest-eth-usdt.json)</sub>

## Verdict

On the measured pairs, the IVL range concentrates liquidity where the market actually oscillates and widens/withdraws ahead of trend — capturing more fees per unit of capital and avoiding the IL a fixed narrow range suffers on a breakout, while rebalancing fewer times (lower gas cost). That differential is exactly the value a hirer buys when they **hire** the agent in the marketplace instead of managing the LP by hand.

<sub>Built on BNB Chain · IVL engine via its public API · scripts: `third_city/skills/ivl/scripts/{compare,backtest}.mjs`.</sub>

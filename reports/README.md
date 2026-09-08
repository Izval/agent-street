# reports — Agent Advantage Report (TermiX bounty)

Measurable evidence that **hiring** the *IVL Rebalancer* agent from the marketplace manages
concentrated liquidity better than doing it yourself. This is the deliverable for the **TermiX
bounty** ("Agent Advantage Report": ≥3 measured tasks, ≥1 trading — see `docs/roadmap.md` Phase 3).

Each trading task reports the three axes TermiX asks for — **time** (turnaround), **cost**
(on-chain transactions) and **output quality** (net PnL / IL avoided) — for the agent path vs the
do-it-yourself path.

## What's here

| File | What it is |
|---|---|
| `generate.mjs` | Pure Node runner (no deps). Invokes the IVL engine scripts, captures their real `--json`, composes the report. Has an offline mode. |
| `agent-advantage-report.md` | The generated report (tables + verdict). **Regenerable.** |
| `metrics/*.json` | Raw per-task metrics, exactly as each script emits them (reproducible). |

## IP separation (hard rule, CLAUDE.md §2)

The **IVL engine is a separate asset** (`third_city` / `api.zvlint.com`) and is **not copied** into
Agent-Street. This runner only **invokes** the IVL scripts by path — it does not vendor their code.
Agent-Street ships without dragging the IVL engine along; this report is external evidence.

## Regenerate

```bash
# Live — needs the sibling third_city repo next to agent-street (default layout):
#   ../third_city/skills/ivl/scripts/{compare,backtest}.mjs
node reports/generate.mjs

# Or with an explicit path to the IVL scripts:
IVL_SCRIPTS_DIR=/path/to/third_city/skills/ivl/scripts node reports/generate.mjs

# Offline — renders the report from the committed metrics/*.json, no sibling repo needed.
# (Also the automatic fallback when ../third_city is absent, so a judge can regenerate anywhere.)
node reports/generate.mjs --offline
```

No npm deps: the live scripts do a plain fetch to **live Binance klines**, so the report reflects
real market at generation time. It exits 0 only if ≥3 tasks / ≥1 trading are met.

## Measured tasks

1. **`compare` AAVE/WBNB (trading/profitability)** — IVL vs naive vs random with the same capital:
   `net = Σ(fees − IL) − cost·rebalances`. The direct "hiring > DIY" evidence, with the time/cost/
   quality axes. Cost is measured as on-chain transactions (IVL rebalances 9 vs naive 32 → −72% gas).
2–4. **`backtest`** BNB/USDT, CAKE/WBNB, ETH/USDT — IVL range (μ±2σ) vs a wide naive range:
   time-in-range, breakout rate and fee-efficiency (fees/width). Simulations, so gas cost is n/a.

To add pairs/tasks, edit the `TASKS` array in `generate.mjs`.

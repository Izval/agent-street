# PancakeSwap LP — live on-chain evidence (IVL Rebalancer)

**Bounty:** PancakeSwap partner challenge — *deliver a real benefit to PancakeSwap LPs (smarter
liquidity management) without ever putting user funds at risk.*

This is the **on-chain** half of that evidence. The quantitative half (backtest across 32 pairs) is in
[`agent-advantage-report.md`](./agent-advantage-report.md). Together: the benefit is both **measured**
(backtest) and **demonstrated live** (this page).

## What the agent does

The **IVL Rebalancer** ([`agent-ivl/`](../agent-ivl/)) reads a live optimal LP range from the IVL engine
(`api.zvlint.com/v1/ivl/ticks`), then **opens, holds, and rebalances** a real PancakeSwap **v3**
concentrated-liquidity position on BSC testnet — mapping IVL's decision (`open_or_hold` /
`withdraw_or_widen` / `reset`) to `mint` / `decrease+collect+re-mint` / `+burn`.

**Funds are never at risk.** The agent is the **sole signer of its own wallet**; the position recipient
is the agent's own address; all signing is fixed code, never exposed as an LLM tool. It custodies **no
user funds** — it manages its own capital as a working demonstration.

## Live position (verify it yourself)

| | |
|---|---|
| **Network** | BSC testnet (chain 97) |
| **Agent wallet** | [`0xa1Fe55…06f1`](https://testnet.bscscan.com/address/0xa1Fe55DCf41c1D3805Aad41D4aD1C9E1E06F06f1) · ERC-8004 agent id **2055** |
| **Pool** | [`0x2dbB5a4c…abDB`](https://testnet.bscscan.com/address/0x2dbB5a4c235164B9f772179A43faca2c71a8abDB) — BNB-USDT **0.05%** |
| **Current position** | tokenId **37197**, range ticks **[-23580, -22950]**, **in range** (pool tick ≈ -23265), two-sided, liquidity ≈ 4.09e18 |
| **Mint tx** | [`0x889cca1a…b3a9d`](https://testnet.bscscan.com/tx/0x889cca1afe5b3a9d19945818e576be351f289c7f3beeec1e2fac575e110b3a9d) |

Anyone can re-verify without trusting us — read the chain directly:

- `NonfungiblePositionManager.ownerOf(37197)` → `0xa1Fe55…06f1` (the agent owns it)
- `NonfungiblePositionManager.positions(37197)` → liquidity > 0, ticks `[-23580, -22950]`
- `PancakeV3Pool(0x2dbB5a4c…).slot0().tick` sits **inside** that range → the position is in-range and
  earning fees on both sides

> **Why anchor-to-live-tick.** IVL emits the *absolute* optimal range for the real BNB price (~US$700).
> The BSC-*testnet* pool is synthetically mispriced (live tick ≈ -23265 ≈ 10 USDT/BNB), so the agent
> preserves the IVL **width** and centers it on the live tick. Result: a genuinely in-range, two-sided
> position on the real pool — not a single-sided artifact. On mainnet the absolute IVL ticks are used
> directly.

## Rebalance cycle — the loop, on-chain

IVL returned **`withdraw_or_widen`** (score 60, breakout risk *high*). The agent executed a full
**rewiden** cycle, proving it manages the position over time rather than opening once and walking away:

| Step | Tx |
|---|---|
| decrease liquidity (37142) | [`0xa9ad1f97…16e83`](https://testnet.bscscan.com/tx/0xa9ad1f97de332639d0d949fba0f3d520dc207cbf6a43d2b60ecfe0531d716e83) |
| collect | [`0x91cfe4fc…be55a9`](https://testnet.bscscan.com/tx/0x91cfe4fcbf460cc80fa141fe6c5b104a90dc0da85ade0e2dcc584776efbe55a9) |
| approve USDT → NPM | [`0x587d78bd…4316e7`](https://testnet.bscscan.com/tx/0x587d78bdf2c27b45e00185e41862d739c7da701313b0eecd09b4af39b44316e7) |
| approve WBNB → NPM | [`0x6517b32f…4b3dfd`](https://testnet.bscscan.com/tx/0x6517b32fc77bbe1e21115405d3cb52795dc82e78380ecce4be3218bfc24b3dfd) |
| re-mint wider (→ **37197**) | [`0x889cca1a…b3a9d`](https://testnet.bscscan.com/tx/0x889cca1afe5b3a9d19945818e576be351f289c7f3beeec1e2fac575e110b3a9d) |

Position **37142** (the prior range `[-23420, -23110]`) is now drained to **0 liquidity** — the capital
was widened into 37197. That's the observable lifecycle: **open → widen → re-open**, entirely on-chain.

## Reproduce

```bash
# from agent-ivl/ivlrebalancer/app/agent (agent venv + funded keystore required)
./.venv/bin/python rebalance.py --pair BNB-USDT --json          # read-only plan + dry-run
./.venv/bin/python rebalance.py --pair BNB-USDT --execute --cap-base 0.02   # signs + broadcasts
```

Raw machine-readable record: [`metrics/pancakeswap-lp.json`](./metrics/pancakeswap-lp.json).

## IP separation (CLAUDE.md §2)

The IVL **engine** is a separate asset (`third_city` / `api.zvlint.com`) and is **not** vendored into
Agent-Street. Only the separable listing agent `agent-ivl/` calls it; the marketplace core never does.
This page is external bounty evidence about that agent, not marketplace code.

---
title: Aisles & categories
description: How the catalog is organized — 8 aisles, subcategories, and the per-category templates that shape each listing.
---

The catalog has two levels: **aisles** (the App-Store-style top level) and **subcategories** inside them. Agents are classified into a subcategory from their on-chain metadata; browsing works at either level.

## The 8 aisles

| Aisle | What lives here |
|---|---|
| **Trading** | Grid, DCA, copy-trade, market-making, perps, momentum, signals, narratives |
| **Liquidity Providing** (LP) | Rebalancing, concentrated-liquidity / LP management |
| **Lending** | Lending, borrowing, health-factor guards |
| **Yield** | Yield optimization, liquid staking |
| **Meme** | four.meme trading, token launches & sniping |
| **NFT** | Floor sweeping, mint watching |
| **RWA** | Tokenized real-world assets, treasury |
| **Infrastructure** (Infra) | Data, automation, x402 payments, agent-to-agent jobs, security (audits, threat monitoring, approvals) |

Open an aisle (e.g. `/aisle/liquidity`) to see one row per subcategory; open a subcategory (e.g. `/category/rebalancing`) for the full, sortable listing.

## Subcategories

There are ~23 subcategories across the aisles. Four of them are **first-class, always-visible categories** (marked ★ in the sidebar): **Rebalancing**, **Grid**, **Yield**, and **Health Factor**. They get equal depth in the catalog — the marketplace is built for the whole spectrum, not just these four.

## Category templates

Not every category should look the same — a yield farmer and a grid trader care about different numbers. Each subcategory maps to a **template** that fixes which KPIs and charts its cards and detail page render:

| Template | Primary KPIs | Chart |
|---|---|---|
| `trading` (Grid, DCA, Momentum…) | Win rate · PnL · Volume · #trades | Equity area + trades |
| `clmm` (Rebalancing) | Score · Reviews · Portfolio · Range | Score meter |
| `yield` (Yield, Lending, LST) | APY · TVL · Protocol | Bar compare |
| `health` (Health Factor) | Health factor · Liquidation distance · Collateral | Gauge |
| `nft` | Floor · Volume · Holdings | Floor sparkline |
| `rwa` | Asset type · Backing · Yield | — |
| `services` (Infrastructure, Security, Signals) | Services/skills · x402 · Uptime · Freshness | — |

So a listing's shape tells you, at a glance, what kind of agent it is. Templates never invent data: a KPI with no verified value shows `—`.

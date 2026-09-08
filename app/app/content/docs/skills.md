---
title: Skills
description: Composable modules an agent plugs in — the difference between a skill and an agent, and what's in the catalog.
---

A **skill** is a composable capability an agent plugs in — a lending integration, a liquidity module, a copy-trade engine. Skills are **not** agents: an agent is an on-chain identity you can hire; a skill is a building block that agents compose (over [ERC-8183](/docs/standards)).

## Skills vs. agents

| | Agent | Skill |
|---|---|---|
| What it is | An on-chain ERC-8004 identity | A composable module |
| Source | The 8004scan registry | Curated skill catalog |
| You can… | Hire it | See which agents compose it |
| Appears in | The Agents catalog | The Skills catalog (`/skills`) |

## The catalog

The Skills catalog lists curated ERC-8183 / Altana modules, each mapped to the [category](/docs/taxonomy) it serves — for example range-quality scoring, PancakeSwap liquidity and trading, Aave and Venus lending, liquid staking, copy-trade, token radar, wallet tracker, and x402 API payments. Open a skill (`/skill/:id`) to see its description, provider and protocol, what it composes with, and a link to the provider's own docs.

## Why skills matter

Composability is the point: an agent isn't a monolith. A rebalancer might compose a liquidity skill; a payments agent an x402 skill. On the marketplace, a strong skill can stand on its own merit — listed like any other building block — while the agents that use it are hired separately. If you're building, see how skills attach in [Create an agent](/docs/create-agent).

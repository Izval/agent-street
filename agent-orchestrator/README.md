# Agent-Street Orchestrator (reference)

A small **buyer-side** agent that demonstrates the marketplace is agent-native: an
orchestrator discovers, evaluates, hires and manages agents on its own, through the
Agent-Street **MCP server** — no human in the loop.

This is a **separable example listing** (like `agent-ivl/`), not part of the
marketplace core. The marketplace works without it.

## The journey

```
discover ─▶ compare ─▶ decide ─▶ quote ─▶ pay ─▶ hire ─▶ manage
```

Every step is one MCP tool call against the marketplace, except the payment, which the
orchestrator signs and broadcasts from **its own wallet** (client-pays — the
marketplace never holds a key), then hands the txHash back for on-chain verification.

| Step | Tool | Notes |
|------|------|-------|
| discover | `search_agents` | by category, with real 8004scan reputation |
| compare / decide | `compare_agents`, `get_agent` | rank by score, pick a winner |
| quote | `get_hire_quote` | x402 challenge (payTo, asset, amount) |
| pay | *(local)* `payments.pay_quote` | ERC-20/native transfer via the SDK wallet |
| hire | `hire_agent` | marketplace verifies the tx on-chain → receipt |
| manage | `list_my_hires` | your settled hires |

An alternative **direct** mode (`--mode direct`) reads the agent card
(`get_agent_card`) and negotiates an ERC-8183 job straight with the seller — the power
path for agents that run a live ERC-8183 seller. It is stubbed (prints the plan).

## Layout

```
orchestrator/app/agent/
├── mcp_client.py   # MCP client over Streamable HTTP (httpx JSON-RPC)
├── payments.py     # x402 client-transfer signer (SDK wallet) — FIXED code, never an LLM tool
├── orchestrate.py  # the journey + CLI
└── register.py     # optional: list this orchestrator (infra-automation)
```

## Run

```bash
cd orchestrator
python -m venv app/agent/.venv
app/agent/.venv/bin/pip install -e ./app/agent

# Dry-run (no spend): exercises the whole path, prints the payment plan.
app/agent/.venv/bin/python app/agent/orchestrate.py --category rebalancing

# Real hire on BSC testnet: unlock a keystore + set WALLET_PASSWORD, fund the address
# with testnet USDT (settlement token) + a little tBNB for gas, then:
app/agent/.venv/bin/python app/agent/orchestrate.py --category rebalancing --execute

# Optional: list this orchestrator as an agent
app/agent/.venv/bin/python app/agent/orchestrate.py --register
```

Config defaults (MCP URL, RPC) live in `app/agent/studio.toml [marketplace]` and can be
overridden with `--mcp-url` / `--rpc-url` or the `MCP_URL` / `BSC_TESTNET_RPC` env vars.

## Honesty

No txHash is ever fabricated: an unverifiable payment yields an honest `pending`/`failed`
receipt from the marketplace. `--dry-run` (the default) broadcasts nothing.

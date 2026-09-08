# agent-ivl — IVL Rebalancer (BNBAgent SDK)

ERC-8004 agent that reads a live LP range from the IVL engine (`api.zvlint.com/v1/ivl/ticks`) and
**opens / holds / widens / resets** a PancakeSwap **v3** position on BSC testnet. It is the marketplace
flagship and covers the PancakeSwap bounty. See [`../docs/roadmap.md`](../docs/roadmap.md) §4b and the
on-chain evidence in [`../reports/pancakeswap-lp.md`](../reports/pancakeswap-lp.md).

## Layout

```
agent-ivl/
├── .venv/                     # `bag` CLI venv (Python 3.12) — gitignored
├── requirements*.txt          # bag CLI deps
└── ivlrebalancer/             # ⬅ AGENT PROJECT (`bag init` scaffold, SDK workspace)
    ├── studio.toml            # workspace config
    ├── .studio/               # keystore + .env.local (SECRETS) — gitignored
    └── app/agent/             # the Agent (sole signer, value layer)
        ├── main.py            # A2A entrypoint (instruction = IVL Rebalancer)
        ├── seller_core.py     # ERC-8183 seller logic (negotiate / notify_funded)
        ├── signing.py         # ALL signing (fixed code, never an LLM tool)
        ├── tools.py           # READ-ONLY LLM tools (incl. ivl_rebalance_plan)
        ├── ivl_client.py      # ⬅ IVL engine client (httpx)
        ├── pancake_v3.py      # ⬅ v3 LP execution (mint + tick orientation)
        ├── capital.py         # ⬅ capital prep (wrap tBNB→WBNB, swap WBNB→USDT)
        ├── rebalance.py       # ⬅ orchestrator: IVL → decision → dry-run/execute + CLI
        └── .venv/             # agent venv (google-adk, web3, httpx…) — gitignored
```

## What the agent does

1. **Reads IVL** (`ivl_client.py`): `GET /v1/ivl/ticks?pair=BNB-USDT` → `tickLower/tickUpper`,
   `tickSpacing`, `feeTier` and `decision.action` (`open_or_hold` / `withdraw_or_widen` / `reset`).
2. **Executes v3 LP** (`pancake_v3.py`): encodes `NonfungiblePositionManager.mint(MintParams{…})` with
   those ticks and signs with the SDK `EVMWalletProvider` (the agent is the sole signer).
3. **Orchestrates** (`rebalance.py`): maps the IVL action to an intent (mint / rewiden / reset), runs a
   **dry-run** (`eth_call`, spends nothing) or **executes**, and produces the seller deliverable manifest.
4. The read-only skill `ivl_rebalance_plan` is registered as an LLM tool in `tools.py`; **signing/broadcast**
   (`rebalance.execute_rebalance`) is **fixed code, never a tool** — money never passes through the LLM.

> **No LLM by default (decision 2026-08-18):** the seller deliverable is DETERMINISTIC (the plan + the tx),
> not prose. The `run_work` hook (`main._run_rebalance`) calls `plan_rebalance` and returns the manifest —
> it invokes **no LLM**. So `bag dev` needs **no `ANTHROPIC_API_KEY`** and spends no tokens/$U.

## Status — LIVE on BSC testnet (chain 97)

- **ERC-8004 identity:** registered, **agent id 2055**, owner/signer **`0xa1Fe55…06f1`**. A2A endpoint
  live at `https://ivl.onrender.com` (`/.well-known/agent.json`, skills `negotiate` / `notify_funded`).
- **PancakeSwap v3 position:** **live and in-range.** Current tokenId **37197**, pool
  `0x2dbB5a4c…` (BNB-USDT 0.05%), range ticks `[-23580, -22950]` straddling the live pool tick,
  two-sided, earning fees. A full **rewiden** cycle (decrease + collect → re-mint wider) has run on-chain
  (prior tokenId 37142 → 37197). All tx hashes + a verify-it-yourself guide:
  [`../reports/pancakeswap-lp.md`](../reports/pancakeswap-lp.md).

> **Anchor-to-live-tick (why in-range).** IVL emits the *absolute* optimal range for the real BNB price
> (~US$700). The BSC-*testnet* pool is synthetically mispriced (live tick ≈ -23265 ≈ 10 USDT/BNB), so on
> chain 97 the agent preserves the IVL **width** and centers it on the live tick — in-range and two-sided
> by construction, not a single-sided artifact. On mainnet the absolute IVL ticks are used directly.

## Wallets — do not confuse them

- **Agent signer/owner:** **`0xa1Fe55DCf41c1D3805Aad41D4aD1C9E1E06F06f1`** — the keystore in
  `.studio/wallets/`, set as `address` in `studio.toml [wallet]`. This is the ONLY signer; it owns the
  8004 identity (agent 2055) and the v3 position (37197). `bag wallet show` must print `0xa1Fe55…06f1`.
- **User funding wallet** (`0xf634…4c1e`): a *separate* wallet the user funds from — **not** the agent
  wallet. Never set it as the agent's `studio.toml` address.

## Run / operate

```bash
cd ivlrebalancer/app/agent
./.venv/bin/python capital.py balances                              # tBNB / WBNB / USDT
./.venv/bin/python rebalance.py --pair BNB-USDT --json              # read-only plan + dry-run
./.venv/bin/python rebalance.py --pair BNB-USDT --execute --cap-base 0.02   # SIGNS + broadcasts (gated by keystore + WALLET_PASSWORD)
```

`execute_rebalance` is fully implemented (approve→mint; decrease+collect[+burn]→mint for rewiden/reset),
gated by credentials (it signs with `get_wallet()` and requires WBNB/USDT balance). The v3 mint spends
**WBNB/USDT** (ERC20), not native tBNB — `capital.py prepare` wraps tBNB→WBNB and buys USDT in the pool.

### On-chain tx runbook (first-time setup — already done for agent 2055)

1. Import the wallet key (hidden prompt; never pasted inline):
   `export WALLET_PASSWORD='<strong>'` then `(cd app/agent && bag wallet new --private-key)`;
   confirm `bag wallet show` prints `0xa1Fe55…06f1`; set that same address in `studio.toml [wallet]`.
2. *(Optional)* 8004scan Pro API key (form: https://forms.gle/jQevEPCAacBXaKG79) → `.studio/.env.local`.
   The proxy works anonymously; the key only raises the rate limit.
3. Register the on-chain identity: `(cd app/agent && bag erc8004 register)` → appears on 8004scan.
4. Fund + prepare capital, then execute the rebalance (see commands above).

> **Managed `bag deploy` caveat:** the managed path transmits the private key to the operator's Secrets
> Manager — for that path use a **throwaway** wallet, never the funded agent wallet. Current `studio.toml`
> keeps `[deploy].destination` self (commented), so the key stays local. The live A2A endpoint runs on
> Render, not the managed platform.

## CLI environment

- **Python 3.12** (Homebrew) + venv in `.venv/`. `pip install -r requirements.txt` → `bnbagent-studio`
  (CLI **`bag`**). The agent has its **own** venv at `app/agent/.venv` (google-adk, web3, httpx…),
  created with `python -m venv app/agent/.venv && app/agent/.venv/bin/pip install -e ./app/agent`.

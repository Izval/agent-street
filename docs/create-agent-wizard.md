# Create-Agent Wizard — `/create` (renovado 24-ago-2026)

> **Feature doc.** How the "Create your own agent" wizard publishes a new ERC-8004
> agent live on BSC testnet and lists it in the marketplace. Read alongside
> [`roadmap.md`](./roadmap.md) (§0.5 registrar row) and [`../CLAUDE.md`](../CLAUDE.md) §3.
> Written in English per CLAUDE.md §7 (deliverable to BNB Chain).

## 0. What it is
A friendly 3-step wizard (**Basics → Config → Review**) reachable from the
**"Build agent"** CTA (sidebar + NoveltyBar, now `→ /create` instead of the
external BNB Agent Studio link). It fills the gap that BNB Agent Studio is CLI+IDE
only (no web console): the wizard is the web/API layer that mints an ERC-8004
identity for a new agent and makes it discoverable — **without the user touching a
private key or the CLI**.

## 1. Decisions taken
- **Real on-chain mint on testnet.** Publish mints an ERC-8004 identity on BSC
  testnet (chain 97). Promotion to mainnet is done later by each owner with their
  own wallet — out of scope here.
- **Wallet connection required.** The connected address is recorded as the
  listing's `creator/owner`. The user does **not** sign or pay gas: the registrar
  mints via a **treasury-funded ephemeral wallet** (ERC-8004 = 1 identity per
  address). User-wallet-as-true-signer is future work.
- **Minimal fields first** (name, description, category, optional endpoint,
  protocol, x402 flag). Avatar/skills/ERC-8183 pricing can be added later.

## 2. Flow (server-side orchestration)
The wizard UI is client-side multi-step; the actual publish runs in the
`routes/create.tsx` **`action`** (mirrors `/hire` — the only other route with an
action), so no secret or CORS surface reaches the browser:

```
Wizard (client)  ──POST form──▶  routes/create.tsx action()
                                   1) POST {REGISTRAR_URL}/v1/register   → {agentId, txHash, ownerAddress, status, mode}
                                   2) POST {PROXY_8004_URL}/v1/submitted → AgentDetail (id = t97-<agentId>)
                                   ▼
                             receipt → success step (agentId, BscScan tx link, "View your agent" → /agent/t97-<agentId>)
```

If register returns `pending` (DRY_RUN, or a slow/failed receipt) the agent is
still listed as `pending` — the proxy's `submittedToDetail` handles it. **Never a
fabricated agentId or tx hash** (DESIGN.md v2 §18).

## 3. Code map
| Piece | File |
|---|---|
| Route (loader-less; `action` + wizard UI) | `app/app/routes/create.tsx` |
| Publish client (`register` → `list` → `publish`) | `app/app/lib/registrar.ts` |
| Route registration | `app/app/routes.ts` (`route("create", …)`) |
| CTA repoint (external → `/create`) | `app/app/components/Sidebar.tsx`, `NoveltyBar.tsx` |
| Env binding | `app/wrangler.jsonc` (`REGISTRAR_URL`) + `worker-configuration.d.ts` |
| Registrar backend (mint) | `services/registrar/app.py` — `POST /v1/register` |
| Marketplace listing sink | `workers/8004-proxy/src/index.ts` — `POST /v1/submitted` |

Reused, not rebuilt: `AppShell`, `Card`, `WalletButton`, `PAYMENT_CHAIN`,
`CATEGORY_DEFS`/`REQUIRED_CATEGORIES`/`categoryLabel` (`app/lib/taxonomy.ts`).
The 4 required categories are featured as the primary picker tiles.

## 4. Env / ops — what "real on-chain now" needs `[USUARIO]`
The registrar is the **only non-Cloudflare piece** (Python FastAPI, `uvicorn`) and
has only ever run in DRY_RUN. To make Publish mint for real:
1. **Funded treasury wallet** — a BSC testnet EVM wallet funded from the faucet
   (`testnet.bnbchain.org/faucet-smart`). Each register sends `FUND_WEI` (~0.0015
   BNB) to a fresh ephemeral wallet + gas. Set `TREASURY_PRIVATE_KEY` (never in repo).
2. **Host it publicly** — deploy with a public HTTPS URL reachable by the CF Pages
   action. Set `WALLET_PASSWORD` and `ALLOWED_ORIGIN` (the marketplace origin).
3. **Wire `REGISTRAR_URL`** — point `app/wrangler.jsonc` at that URL (default is
   `http://localhost:8080`; override for dev via `.dev.vars`). Rerun `wrangler types`.
4. **De-risk once (CLAUDE.md §6)** — `erc8004_core.register(...)` has never run
   on-chain. Do a single real `POST /v1/register`, confirm a real `agentId` + tx on
   BscScan/8004scan **before** relying on the button. Fallback: direct
   `IdentityRegistry` contract call, or ship DRY_RUN `pending` listings meanwhile.
5. **Timeout note** — the registrar waits on fund + register receipts (~up to 120s);
   a slow block may hit CF action limits. The `pending` fallback covers it (list now,
   reconcile later).

Optional: if the proxy sets `SUBMIT_TOKEN`, pass it as `x-submit-token` on the
`/v1/submitted` call (the `createRegistrarClient` `submitToken` option).

## 5. Verify end-to-end
- `cd app && npm run typecheck` (wrangler types + react-router typegen + tsc).
- DRY_RUN dev loop: run the registrar locally (`uvicorn app:app --port 8080`, no
  treasury key), `.dev.vars` `REGISTRAR_URL=http://localhost:8080` → the wizard
  lists a `pending` agent without spending tBNB.
- Real: with `TREASURY_PRIVATE_KEY` + a public `REGISTRAR_URL`, complete the wizard
  and confirm the new agent at `/agent/t97-<agentId>`, the tx on
  `testnet.bscscan.com`, and the identity on 8004scan.
- UI (verified 24-ago-2026 on `:5173`): all 3 steps render, validation gates
  Basics, `activeCategory` lights the aisle, and Review gates Publish behind a
  connected wallet. **Note:** the app must be hydrated for the wizard to be
  interactive — a stale wagmi reconnect to an unresponsive injected wallet can hang
  hydration (see the WalletButton loading-placeholder fix).

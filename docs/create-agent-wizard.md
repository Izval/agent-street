# Create-Agent Wizard — `/create` (client-pays, renovado 31-ago-2026)

> **Feature doc.** How the "Create your own agent" wizard mints a new ERC-8004
> agent live on BSC testnet and lists it in the marketplace. Read alongside
> [`roadmap.md`](./roadmap.md) (fila `/create`) and [`../CLAUDE.md`](../CLAUDE.md) §3.
> Written in English per CLAUDE.md §7 (deliverable to BNB Chain).

## 0. What it is
A friendly 3-step wizard (**Basics → Config → Review**) reachable from the
**"Build agent"** CTA (sidebar + NoveltyBar, `→ /create` instead of the external
BNB Agent Studio link). It fills the gap that BNB Agent Studio is CLI+IDE only (no
web console/marketplace): the wizard is the web layer that mints an ERC-8004
identity for a new agent and makes it discoverable.

## 1. Decisions taken
- **Client-pays mint (the user signs & pays).** Publish has the user's **connected
  wallet** call `register(agentURI)` on the ERC-8004 IdentityRegistry directly —
  the user **owns** the identity and pays their own gas. *"We build the medium;
  they pay."* Matches BNB Agent Studio's own self-fund model (agents self-fund via
  x402; the platform does not pay). This **replaced** the old treasury/ephemeral-
  wallet registrar, which is now legacy/optional.
- **Real on-chain mint on testnet (chain 97).** Registry
  `0x8004A818BFB912233c491871b3d84c89A494BD9e` (verified live). Mainnet promotion is
  each owner's own later step.
- **Minimal fields first** (name, description, category, optional endpoint,
  protocol, x402 flag). Avatar/skills/ERC-8183 pricing can be added later.

## 2. Flow (client-side mint, then server-side listing)
The mint happens **in the browser** (wagmi); only the marketplace listing runs in
the `routes/create.tsx` **`action`** (so the proxy's `x-submit-token` stays
server-side):

```
Wizard publish() (client, wagmi)
  1) switchChain → BSC testnet (97)
  2) buildAgentUri(name, desc, endpoint, protocol)        (lib/erc8004.ts — byte-identical to SDK)
  3) writeContract register(agentURI) on IdentityRegistry  ← USER SIGNS & PAYS GAS
  4) waitForTransactionReceipt → decode Registered event → agentId (+ owner)
  5) fetcher.submit({agentId, txHash, ownerAddress, …})
        ──▶ routes/create.tsx action()
              POST {PROXY_8004_URL}/v1/submitted (via PROXY_8004 binding) → AgentDetail (id = t97-<agentId>)
              ▼
        receipt → success step (agentId, BscScan tx link, "View your agent" → /agent/t97-<agentId>)
```

Only what the user actually minted is listed — the **real** agentId + txHash, owned
by their wallet. **Never a fabricated agentId or tx hash** (DESIGN.md v2 §18). If
the mint succeeds but listing fails, the wizard says so (the agent still resolves on
8004scan; retry lists it here).

## 3. Code map
| Piece | File |
|---|---|
| Route (loader-less; `action` + wizard UI + client mint) | `app/app/routes/create.tsx` |
| ERC-8004 mint helpers (registry, ABI, `buildAgentUri`) | `app/app/lib/erc8004.ts` |
| Listing client (`listCreatedAgent` → `/v1/submitted`) | `app/app/lib/registrar.ts` |
| Custom dropdown (no native `<select>`) | `app/app/components/Select.tsx` |
| Route registration | `app/app/routes.ts` (`route("create", …)`) |
| Wallet write infra (client-pays, reused from `/hire`) | `app/app/lib/wallet/config.ts` |
| Marketplace listing sink | `workers/8004-proxy/src/index.ts` — `POST /v1/submitted` |
| Legacy sponsored registrar (off-path) | `services/registrar/app.py` — `POST /v1/register` |

Reused, not rebuilt: `AppShell`, `Card`, `WalletButton`, `PAYMENT_CHAIN`, the wagmi
config, and `CATEGORY_DEFS`/`REQUIRED_CATEGORIES`/`categoryLabel`
(`app/lib/taxonomy.ts`). The 4 required categories are the primary picker tiles.

## 4. Ops — what "real on-chain now" needs
Nothing server-side. The user just needs a wallet on **BSC testnet with a little
tBNB** (faucet: `testnet.bnbchain.org/faucet-smart`). The Review step checks the
balance and, if zero, blocks Publish with a faucet link. No treasury, no
`REGISTRAR_URL`, no secrets. (`REGISTRAR_URL` remains only for the optional legacy
sponsored path; the Render service can be paused.)

Optional: if the proxy sets `SUBMIT_TOKEN`, the listing client passes it as
`x-submit-token` (the `createListingClient` `submitToken` option).

## 5. Verify end-to-end
- `cd app && npm run typecheck` (wrangler types + react-router typegen + tsc) and
  `npm run build` — both clean.
- **Agent-URI parity:** `lib/erc8004.ts buildAgentUri` output is **byte-identical**
  to the SDK's `generate_agent_uri` (verified by diffing base64 against
  `bnbagent.erc8004.agent_uri`).
- Real mint: with a wallet on BSC testnet + tBNB, complete the wizard → the wallet
  prompts to sign `register` → confirm the new agent at `/agent/t97-<agentId>`, the
  tx to `0x8004A818…BD9e` on `testnet.bscscan.com` (event `Registered`, `owner` =
  your wallet), and the identity on 8004scan.
- No-funds path: a wallet with 0 tBNB shows the faucet nudge and Publish disabled.
- Rejected signature: a clear message, no phantom listing.
- **Note:** the app must be hydrated for the wizard to be interactive — a stale
  wagmi reconnect to an unresponsive injected wallet can hang hydration (see the
  WalletButton loading-placeholder fix).

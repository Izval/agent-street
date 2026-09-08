# Manage flow + Altana sessions — roadmap & checklist

> **Purpose:** durable, instance-portable checklist for the *manage* step of the marketplace
> journey (discover → compare → hire → **manage**). Any Claude instance can pick this up mid-way.
> All text/code/docs in English (CLAUDE.md §7).
>
> **Separation (CLAUDE.md §2):** this is a **generic marketplace feature** — it works for hiring any
> agent, does **not** couple IVL, and the Altana SDK spike runs in **agent-street scratch, NEVER in
> `agent-ivl/`** (agent-ivl is a separate asset/listing).

## Context — why
The hire journey dead-ends. After payment, `app/app/routes/hire.tsx` swaps the payment card for an
inline `<Receipt>` (~L317–318) — no redirect, no manage surface. The worker
`workers/hire-x402/src/index.ts` only persists settled `HireRecord`s in `HIRES_KV` (a per-tx receipt
log); there is **no session, spend-cap, expiry, or revocation**. `/me` is a passive history. And
`app/app/components/profile/HireRail.tsx:68` already *promises* "Hire via x402 with a session and
spend cap" — copy for a feature that does not exist.

**Goal:** extend the journey to **manage**, where manage = the **Altana session surface** the bounty
requires: a session with allowlist + **spend-cap** + expiry in the keystore, **tx via the session
key**, and **user revocation**, all visible in the **Altana explorer** (main `docs/roadmap.md` §7
lists this as unbuilt / stretch). Also serves the "manage" pillar of the pitch.

## Locked decisions
- **Option 1: spike-first, full Altana, with automatic approve-based fallback.** ~80% of the build
  (worker session model, `/manage` UI, `/me` tab, hire integration) is identical either way; only the
  signing primitive in `app/app/lib/altana.ts` swaps. A **Day-0 spike decides GO vs FALLBACK**.
- **Hire = one explicit choice at hire time:** `[ Pay directly ]` vs `[ Pay with Altana session ]`.
  - **Direct** = current client-pays flow, unchanged.
  - **Altana** = if no active session yet, the Altana path itself performs the **smart-wallet setup +
    budget (spend-cap) grant**, then executes the hire via the session key. Subsequent Altana hires
    reuse the live session (no per-hire prompt).
- **Spike location:** agent-street scratch / session scratchpad (throwaway). **Not `agent-ivl/`.**
- **Honesty (DESIGN.md §18):** on FALLBACK, no "Altana explorer" claim anywhere in copy.

---

## Phase 0 — Altana de-risk spike (GATE, do first)
- [ ] Throwaway node/TS script in agent-street scratch (session scratchpad or gitignored
      `spike-altana/`). **Do not touch `agent-ivl/`.**
- [ ] `npm i @altananetwork/altana-sdk`; run against BSC testnet (chain 97). Answer:
  - [ ] Can a plain injected **EOA be the admin**, or must an Altana **smart-account** be deployed first?
  - [ ] `grantSession({ spendCap })` → does the tx appear in the **Altana keystore explorer**?
  - [ ] `execute(session, calls)` → a tiny call within the cap succeeds?
  - [ ] `revokeSession()` → produces a revoke tx?
  - [ ] Any API key / facilitator / keystore contract address needed on chain 97? Gas needs?
- [ ] **Record GO / NO-GO + concrete facts** in "Spike results" below.
- GO → Phases 2–3 use the Altana SDK. NO-GO → `lib/altana.ts` fallback branch (approve-based:
  `approve(sessionKey, cap)` / `transferFrom` / `approve(0)`; real BscScan tx, honest, but NOT
  Altana-explorer-visible → adjust copy).

## Phase 1 — Session data model + worker state (shared, GO or FALLBACK) — ✅ DONE (2026-09-03)
- [x] `app/app/lib/contracts.ts`: added `Session`, `SpendCap { token, limitBase, period, symbol?,
      decimals? }`, `SpendPeriod`, `SessionStatus` (`active | expired | revoked`). Added `sessionId?`
      to `app/app/lib/me.ts` `HireRecord`.
- [x] `workers/hire-x402/src/index.ts` (keyless verify-only; reuses `HIRES_KV` with a `session:` prefix
      — no new namespace):
  - [x] `POST /v1/sessions` — verifies the grant tx on-chain when a hash is provided (`verifyTxSuccess`
        in `x402.ts`; relay may confirm without a hash → `grantTxHash: null`, honest), persists
        `session:{owner}:{id}`.
  - [x] `GET /v1/sessions?address=` — lists sessions with computed `status` + `usedAmount`/`remainingAmount`
        (summed from hires carrying the matching `sessionId`).
  - [x] `POST /v1/sessions/revoke` — verifies the revoke tx, sets a persisted `revoked` flag (survives
        reload even when the relay gives no hash).
  - [x] `handleHire` stores `sessionId` on each `HireRecord`.
- [x] `workers/hire-x402/wrangler.toml`: reused `HIRES_KV` (no `SESSIONS_KV` needed); added optional
      public `ALTANA_KEYSTORE` var for the keystore explorer link.
- [x] Both `hire-x402` (`tsc --noEmit`) and `app` (`tsc -b`) typecheck clean.

## Phase 2 — Client session plumbing + hire decision — ✅ DONE (2026-09-03)
- [x] New `app/app/lib/altana.ts` — **client-only** (dynamic `import()` of `@altananetwork/sdk`,
      `import type` only at top-level → stays out of the SSR bundle). `createSession` (passkey wallet →
      generated session key → `grantSession(spend cap + expiry, register:true)` → persist via
      `serializeSession` + key in localStorage keyed by the connected EOA), `executeHire` (session key
      sends the SAME transfer as Direct → worker verifies identically), `revokeActiveSession` (passkey
      admin), `getActiveSession` / `sessionCoversAgent`. Passkey model per user decision.
- [x] `app/app/lib/sessions-client.ts` — server-side seam (`list`/`record`/`revoke`) to the worker.
- [x] `app/app/lib/x402.ts` — `pay()` input gains optional `sessionId` (forwarded to the worker).
- [x] `app/app/routes/hire.tsx`: **payment-method choice** (`Pay directly` | `Altana session`).
  - [x] Direct → existing `onPayAndHire` (untouched; coexists with the concurrent deliverable feature).
  - [x] Altana → active-session check (client); if none covers the agent → route to `/manage?agent=`;
        else `executeHire` → submit txHash + `sessionId` to the action (worker verifies).
  - [x] `<Receipt>` gains a **"Manage sessions →"** link (dead-end killed).

## Phase 3 — Manage surface (the UX) — ✅ DONE (2026-09-03)
- [x] New route `app/app/routes/manage.tsx` + `app/app/routes.ts` entry:
  - [x] **Grant panel**: cap amount + token (USDT/BNB) + period + expiry (h) + optional `?agent=`
        allowlist prefill → `createSession` → records via the action.
  - [x] **Active/past session cards**: cap, used / remaining, expiry countdown, allowlist, smart wallet,
        **Grant tx ↗** + **Keystore explorer ↗** + **Revoke tx ↗** links, and a **Revoke** button.
- [x] `app/app/routes/me.tsx`: **"Sessions"** section (loads via `sessions-client`, compact `SessionRow`,
      links to `/manage`).
- [x] App `tsc -b` clean + `react-router build` succeeds (SDK dynamic import doesn't break SSR).

## Phase 4 — Copy, docs, honesty — ✅ DONE (2026-09-03)
- [x] `HireRail.tsx:66-68` ("Hire via x402 with a session and spend cap") is now **true** — the feature
      shipped, so the previously-aspirational copy became honest. No change needed.
- [x] `for-agents.tsx` "Manage" line describes the **MCP agent-native** surface (`list_my_hires`), which
      remains accurate — left honest (MCP does not expose sessions yet).
- [x] `docs/roadmap.md` §Frente-5 + §7 link back here (done earlier this session).
- GO path taken → no FALLBACK copy cleanup needed.

## Browser smoke-check (2026-09-07, local `npm run dev` :5173)
- `/manage` renders correctly (header, grant intro, wallet-connect gate); **no console errors**.
- `/hire?agent=…` renders; the quote card shows "Quote unavailable" **for every agent in local dev**
  — the `HIRE_X402` service binding loops back to the `agent-street-hire-x402` worker, which isn't
  running in the vite dev session, so the quote seam is down. This is **pre-existing** (it blocks the
  Direct hire too) and unrelated to the session work. The deployed worker returns 402 for these agents
  (verified via curl), so the Direct|Altana toggle — correctly gated on a real quote — WILL render on a
  build where the binding resolves.
- Not exercisable in the automation browser: the toggle (needs a live quote) and the `/manage` grant
  panel (behind wallet-connect; needs an injected wallet + passkey). Verify these in your own Chrome.
- **To light up the toggle/grant locally:** run the `hire-x402` worker in the same dev session (so the
  binding resolves) or point at a deploy; then connect a wallet.

## ⚠ Live-verification still pending (operational, [USER])
The full path **typechecks + builds** but the on-chain passkey/relay flow is **not yet live-tested** —
it needs a browser (WebAuthn) + a funded chain-97 Altana smart wallet (same funding gate as the spike).
To verify end-to-end: fund the smart-wallet address surfaced on `/manage` (faucet), then grant → hire →
revoke and confirm the tx in the explorer. Until then, treat Phases 2–3 as **code-complete, live-unverified**.

## Verification (end-to-end)
1. `npm run dev` in `app/`; connect an injected wallet on BSC testnet.
2. `/hire` → choose **Altana session**, set a small cap → grant tx resolves in the explorer
   (Altana keystore on GO, BscScan on FALLBACK).
3. Hire an allowlisted agent → GO settles via session key **without a new prompt**; spend **accrues**,
   remaining drops on `/manage`.
4. Revoke → confirm the revoke tx and that further session-hires are refused.
5. `/me` "Sessions" lists the session; the receipt card links to `/manage`.
6. Worker: `/v1/sessions` verify rejects an unverifiable/foreign tx (honest, no fabricated state).

## Key files
- Routes: `app/app/routes/hire.tsx`, `app/app/routes/me.tsx`, **new** `app/app/routes/manage.tsx`, `app/app/routes.ts`
- Libs: **new** `app/app/lib/altana.ts`, `app/app/lib/x402.ts`, `app/app/lib/contracts.ts`
- Worker: `workers/hire-x402/src/index.ts`, `workers/hire-x402/src/x402.ts`, `workers/hire-x402/wrangler.toml`
- Copy/docs: `app/app/components/profile/HireRail.tsx`, `app/app/routes/for-agents.tsx`, `docs/roadmap.md`
- Spike: agent-street scratch only (discarded on NO-GO) — **never `agent-ivl/`**

## Implications & risks
- Spike can fail → automatic fallback; only the ~½-day spike is throwaway.
- Onboarding may gain a smart-account setup step (extra tx/gas) on the Altana path.
- Largest remaining build with the deadline close and Main/Pancake/TermiX live → the Day-0 gate is
  non-negotiable so no UI is built on a broken primitive.
- Separation preserved: generic marketplace feature; no IVL coupling; spike outside agent-ivl.

## Spike results — **GO** (2026-09-03, paper + partial-live confirmed)
- **Package:** `@altananetwork/sdk` v0.9.0 (+ `viem`). NOT `altana-sdk`. x402 client, ERC-8004 &
  ERC-8183 helpers all ship in the same SDK.
- **Chain 97 is first-class:** ready-made `BNB_TESTNET` NetworkConfig — full-stack (keystore +
  account stack + relay all on chain 97).
  - `keyStore` = `0x6b8361C29d05D498b1a12B54A37310f94171E94A`
  - `keyStoreController` = `0xb530D1971f5453F3359518343F05D0AedFfF7e12`
  - `publicRpcUrl` = `https://bsc-testnet-rpc.publicnode.com` · `explorer` = `https://testnet.bscscan.com`
  - `relayUrl` = `https://testnet-relay.altana.network` (`TESTNET_RELAY_URL`; serves chain 97 only)
- **Admin model = Altana smart-account, NOT the injected EOA.** Signer is a **private key**
  (`signerFromPrivateKey`) or a **passkey** (`createPasskeyWallet`, WebAuthn — browser path, no
  MetaMask). `createWallet` is counterfactual (no tx); KeyStore registration is batched into the
  first `execute`. The wallet address must be funded (tBNB) before the first on-chain action.
- **Session API (exact):**
  - `client.grantSession({ wallet, signer, permissions: { calls?, spend?: [{ limit: bigint, period:
    "minute"|"hour"|"day"|"week"|"month"|"year", token? }] }, expiry, sessionSigner?, register?,
    chainId? }) → GrantSessionResult` (Session + `transactionHash?`). `register: true` ⇒ key in
    KeyStore ⇒ verifiable on-chain (`verify_authorization`) = explorer-visible.
  - `client.execute({ session, calls, chainId?, feeToken? }) → ExecuteResult` (session path; no admin prompt).
  - `client.revokeSession({ wallet, signer, session, chainId? }) → ExecuteResult` (single tx, immediate).
  - Persist with `serializeSession`/`deserializeSession` (JSON-safe; caller keeps the session key).
  - `client.fetchWithX402({ session, url })` — a fetch that transparently pays an x402 challenge with
    the session key **within the spend cap**. → this is the natural "hire under a session" primitive.
- **Gas/relay:** ops go through the testnet relay; `feeToken` lets fees be paid in a token;
  `fundNative`/`waitForBalance` helpers exist.
- **API key / signup:** none required.
- **Live-partial run:** `createClient` + `createWallet` reached the relay and returned a chain-97
  smart-account (`0x9526…caAC`); stopped at the funding gate by design.
- **Only remaining confirmation (operational, [USER]):** fund a throwaway chain-97 wallet and run
  `PRIVATE_KEY=0x… node spike.mjs` to capture the grant/execute/revoke tx hashes. Spike script:
  session scratchpad `spike-altana/spike.mjs`.
- **Consequences for the build:** the Altana path is a **separate passkey/key smart wallet** from the
  connected EOA (onboarding gains a "create Altana wallet" step); the session key must be persisted
  (localStorage/KV); hiring under a session = `execute` or `fetchWithX402`. Existing `hire-x402`
  worker keeps its role for recording sessions/hires + the Direct path.

## Progress log (instances update as phases complete)
- [x] **Phase 0 — GO** (spike done, live-tx confirmation pending funding)
- [x] **Phase 1 — DONE** (types + worker session state, typechecks clean)
- [x] **Phase 2 — DONE** (altana.ts client lib + hire Direct|Altana decision, builds clean)
- [x] **Phase 3 — DONE** (/manage surface + /me Sessions section, builds clean)
- [x] **Phase 4 — DONE** (copy already honest; docs linked)
- [ ] **Live verification** (needs browser + funded chain-97 smart wallet) — the one open item.

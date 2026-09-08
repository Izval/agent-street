# Agent Portfolios — `/portfolios` (staged A→C)

> **Feature doc.** How Agent-Street groups agents into **portfolios** — curated
> or user-made SETS you can discover, compare, hire in bulk, and share. Read
> alongside [`roadmap.md`](./roadmap.md) and [`../CLAUDE.md`](../CLAUDE.md) §2–§3.
> Written in English per CLAUDE.md §7 (deliverable to BNB Chain).

## 0. What it is
A portfolio is a **set of agents** that work together — the marketplace analog of
Amazon's *"frequently bought together" / "customers also bought"*, but over the
`hire` action. It gives the marketplace a **merchandising + gamification + copy-
trading** layer:
- **Curated portfolios** — editorial sets (e.g. *DeFi Core*, *Active Trader*,
  *RWA Treasury*) defined by **taxonomy**, resolved to real agents at load.
- **User portfolios** — anyone assembles a set, publishes it, gets a shareable
  link, and others can **copy** it (agentic copy-trading) or **hire the whole
  set**.
- **Frequently hired together** — real co-hire affinity computed from settled
  hires.

> ⚠️ Not to be confused with an agent's **onchain portfolio** (its token
> holdings), which is `PortfolioResponse`/`PortfolioMetrics` in
> `app/app/lib/contracts.ts` and lives inside `/agent/:id`. A *portfolio* here is
> a set of agents. Different type, different route.

## 1. Decisions taken
- **Name:** "Portfolios" in the UI. Code uses distinct types (`Portfolio`,
  `ResolvedPortfolio`, `PortfolioRecipe`) and routes (`/portfolios`,
  `/portfolio/:slug`, `/portfolio/new`) to avoid the holdings collision.
- **Staged A→C** (de-risk per CLAUDE.md §7 — bounties first, marketplace upside):
  - **Phase A** — curated sets + "Pairs well with". **No new backend**; works off
    the existing 8004-proxy. Always available.
  - **Phase B** — `workers/portfolios/` (KV) for user portfolios, first-party
    counters, leaderboard, and real co-hire affinity.
  - **Phase C** — copy-trading (clone), "Hire all" guided multi-hire, leaderboard
    UI, `/me` integration, badges.
- **Curated = recipes, not frozen agentIds.** A recipe is a list of **subcategory
  slots**; it resolves to the top real agents in those subcategories. This keeps
  sets always-populated, honest, and — critically — **IVL-agnostic** (no
  hard-coded ids, no `FLAGSHIP_ID`; IVL only appears if it is genuinely top in its
  subcategory, by merit — CLAUDE.md §2).
- **Honesty (DESIGN.md §18).** A portfolio **never** shows invented ROI/PnL.
  "Performs well" = real **8004scan reputation** aggregated across members
  (avg score, verified count, x402 count, taxonomy diversity) + (Phase B)
  **first-party demand** (views/copies/hire-alls we count ourselves). Everything
  nullable, honest empty states.
- **Taxonomy is 7 aisles / ~23 subcategories.** The 4 mandatory hackathon
  subcategories (`rebalancing/grid/yield/health`) are a **subset**, not the
  universe. Curated portfolios deliberately **cover every aisle**. Source of
  truth: `app/app/lib/taxonomy.ts`.

## 2. Data model (`app/app/lib/portfolios.ts`)
```ts
PortfolioRecipe { slug, name, tagline, coverKey?, accent?, slots: PortfolioSlot[] }
PortfolioSlot   { category: Category, take?=1, label? }        // a subcategory
ResolvedPortfolio { slug, name, tagline, accent, coverKey, source,
                    agents: Agent[], missing[], aggregate, creator?, stats? }
PortfolioAggregate { count, avgScore|null, verifiedCount, x402Count,
                     categories[], aisles[] }                  // REAL 8004scan only
PortfolioStats  { views, copies, hireAlls, followers }         // null until Phase B
```
**Resolution** (efficient, one proxy call per distinct subcategory):
`resolvePortfolios(recipes, agentsClient)` → `fetchCategoryPools` (parallel,
ranked by real `score` then demand) → `composeRecipe` (dedups members across
slots; records `missing` slots with no live agent). Reuses `createAgentsClient`
from `app/app/lib/agents.ts`. **The marketplace never calls `api.zvlint.com`.**

## 3. Phase A — curated + "Pairs well with" (shipped)
**New**
- `app/app/lib/portfolios.ts` — types, `PORTFOLIO_RECIPES` (9 sets across the 7
  aisles), resolver, aggregate, `pairsWith`/`fetchPairsWith`.
- `app/app/components/PortfolioCard.tsx` — merchandising card (generative cover
  via `lib/cover.ts`, member avatar stack, honest aggregate strip).
- `app/app/components/PortfolioActions.tsx` — client island (Phase A: **Save all**
  → `lib/saved.ts`; **Share** → clipboard/Web Share).
- `app/app/routes/portfolios.tsx` (`/portfolios`) — index grid.
- `app/app/routes/portfolio.tsx` (`/portfolio/:slug`) — detail: hero + honest KPIs
  (`KpiTile`) + member `AgentCard`s + `missing` note.

**Edited**
- `app/app/routes.ts` — routes registered.
- `app/app/routes/home.tsx` — "Agent portfolios" carousel (curated cross-section
  of the 7 aisles).
- `app/app/routes/agent.tsx` — **"Pairs well with"** rail (real complementary
  agents; an honest recommendation, **not** a co-hire claim).
- `app/app/components/NoveltyBar.tsx` + `Sidebar.tsx` — "Portfolios" nav entry.

## 4. Phase B — portfolios worker + affinity (shipped)
`workers/portfolios/` mirrors `workers/analytics/` (CORS + KV + rate-limit +
router; types mirrored by hand; service bindings `HIRE_X402`, `PROXY_8004`).
> **Deploy status:** the KV namespace is created and its ids are wired into
> `workers/portfolios/wrangler.toml`; both `agent-street-portfolios` and the
> updated `agent-street-hire-x402` (with `/v1/cohires`) are **deployed**. The
> **remaining step is the Pages app deploy** (`cd app && npm run deploy`) so the
> app's server-side loaders get the `PORTFOLIOS` binding + `PORTFOLIOS_URL` var;
> until then curated portfolios still work (they use the 8004-proxy) but the
> community/leaderboard/affinity/builder features degrade to empty in prod. The
> app is a deployable, green build.
Endpoints:
- `POST /v1/portfolios` → `{slug, ownerSecret}` (owner secret stored client-side,
  low-friction like the create-wizard). `GET /v1/portfolios/:slug` (public + stats).
  `PATCH/DELETE` gated by `x-owner-secret`.
- `GET /v1/portfolios?scope=user|trending&limit=` — curated stay app-side.
- `POST /v1/portfolios/:slug/event {type:view|copy|hire_all|follow}` — first-party
  counters (dedup IP+slug+type+hour; reuses the analytics bucket math).
- `GET /v1/portfolios/leaderboard?metric=copies|hires|views&window=`.
- `GET /v1/affinity/:agentId` — **frequently hired together**: reads hire records
  via the `HIRE_X402` binding, counts pairs co-hired by the same wallet, honest
  empty state.
- KV keys: `pf:{slug}`, `pf:owner:{addr}`, `pf:secret:{slug}`,
  `pfev:{type}:{slug}:{bucket}`, `pfidx:*`.

Also: `hire-x402` gains `GET /v1/cohires?agent=` — aggregates settled hires by
wallet and returns co-hire pair counts **without leaking any address**; the
portfolios worker's `/v1/affinity/:id` consumes it and enriches via 8004-proxy.

**App:** `app/app/lib/portfolios-client.ts` (pattern of `lib/trending.ts`,
degrades to `null`; `create`/`list`/`get`/`event`/`leaderboard`/`affinity`/`remove`);
`PORTFOLIOS_URL` var + `PORTFOLIOS` service binding in `app/wrangler.jsonc` +
`app/worker-configuration.d.ts`; `/portfolio/new` builder — **searches the whole
marketplace** (debounced, client-side against the CORS-enabled 8004-proxy) and
also lists your saved agents → publish → shareable slug; `CommunityPortfolioCard`
+ "Community portfolios" and "Most copied" sections on `/portfolios`; agent page
shows real "Frequently hired together" when affinity returns rows.

## 5. Phase C — copy-trading + gamification (shipped)
- **Copy & edit (clone):** `/portfolio/:slug` → `copy` event + seeds a builder
  draft (`agent-street:portfolio:draft:v1`) with the same members and navigates to
  `/portfolio/new`. Honest agentic copy-trading; increments the real `copies`
  counter (in `PortfolioActions.tsx`).
- **Hire all:** records the `hire_all` intent, then a guided step-by-step list
  walks each member through the **existing** per-agent client-pays flow
  (`/hire?agent=`) — every payment a **real onchain tx**, nothing batched or
  faked. Per-agent `hire` demand is still counted by analytics on settle.
- **Leaderboard:** "Most copied" on `/portfolios` with **time-window tabs**
  (7d / 30d / All). The worker keeps per-day buckets for windowed sums (`pfb:*`,
  ~40d TTL) alongside all-time totals; the UI reads `?lb=` in the loader.
- **Follow:** user portfolios show a Follow/Following toggle + follower count.
  Per-viewer state lives in `localStorage` (`…:follow:{slug}`); the worker
  increments on `follow` and decrements (floor 0) on `unfollow` — no server dedup
  (the client owns idempotency).
- **`/me`:** "My portfolios" (created by the wallet, via `owner=`) with real stats.
- **Ownership lifecycle:** publishing stashes a per-slug owner secret in the
  creator's browser (`agent-street:portfolio:secret:{slug}`). On a user
  portfolio's detail page the owner (the browser holding that secret) gets a
  **Delete** control → `DELETE /v1/portfolios/:slug` with `x-owner-secret` (wrong
  secret → 403). No secret, no control — nobody else can edit/delete it.

## 6. Compliance checklist
- [x] No `api.zvlint.com`, no `FLAGSHIP_ID`, no `if (isIVL)`. IVL = normal member.
- [x] No invented ROI/PnL — only real 8004scan reputation + first-party demand.
- [x] Marketplace works without the portfolios worker (curated resolve app-side;
      worker features degrade to `null`).
- [x] All 7 aisles / ~23 subcategories are first-class; the 4 mandatory keep
      equal depth (judging requirement) but are not the universe.
- [x] English only; DESIGN.md tokens, dark theme, reused components.

## 7. Verification
- `cd app && npm run dev` → `/portfolios`, `/portfolio/:slug`, home carousel, and
  the "Pairs well with" rail on `/agent/:id`. Curated resolve from real proxy
  data; honest empty when the proxy is unreachable.
- Worker (Phase B): `cd workers/portfolios && npx wrangler dev --port <free>
  --local`; `curl` create/get/event/leaderboard/affinity.
- Typecheck: `cd app && npm run typecheck` (+ worker `tsc`).
- E2E (Phase C): create → copy link → open elsewhere → Copy → Hire all on testnet
  (real tx) → counters increment and appear on the leaderboard.

# Roadmap — Agent-Street (recta final, renovado 1-sep-2026)

> **Punto de entrada de ejecución.** Planeación y construcción cerradas; el marketplace ya está **vivo y
> público**. Lo que queda es **pulir judging (diversidad + journey) + cerrar el gate onchain de nuestro
> agente (bounties)**. Lee en orden: este roadmap → [`plan.md`](./plan.md) (estrategia) →
> [`../DESIGN.md`](../DESIGN.md) (UI) → [`seed-catalog.md`](./seed-catalog.md).

## 0. Contexto en 30 segundos
- **Qué:** **Agent-Street**, marketplace de **agentes + skills** ERC-8004 para BNB Chain. Entrega al
  hackathon *"The Smart Money Era: Build the Era"*. **Deadline 9-sep-2026. Hoy 1-sep → ~8 días.**
- **Estrategia:** híbrido apalancado. Un activo (**IVL**, ya construido) alimenta 3 premios: track
  principal ($30k + adopción), bounty **PancakeSwap** (CAKE) y bounty **TermiX** ($6k). Altana = stretch.
- **Stack:** **React Router v8 (sucesor de Remix) + Cloudflare Workers** (solo dev). IVL vía su
  API pública `api.zvlint.com` (no duplicar código, no filtrar IP).
- **⚠ Pivote de la recta final (ACTUALIZADO):** el marketplace **ya está desplegado y público** (Worker,
  no Pages) y los 6 workers están vivos. El requisito duro del Main (marketplace público + agentes vivos
  en BSC vía 8004scan) **está cumplido**. → El eje ahora es: **subir la calidad de judging (profundidad
  real por categoría + cerrar el journey compare) → cerrar el gate onchain de *nuestro* agente (bounties
  PancakeSwap/TermiX) → hardening → demo/submission.** De "poner vivo" a "ganar por calidad".

## 0.5. Estado REAL verificado (auditoría 1-sep-2026, 4 instancias en paralelo)
> **Regla dura:** no se marca ✅ nada que no se haya **ejecutado/desplegado/curl-eado**. "Código listo" ≠
> "vivo". Esta tabla es verdad-terreno auditada hoy (deploy curl + 3 sweeps de código).

| Área | Código | Ejecutado / Vivo | Gap clave |
|---|---|---|---|
| **`app/`** (RR v8) | ~85% real: rutas con loaders reales a workers+IVL, honesto (nulls, no inventa) | **✅ DESPLEGADO Y VIVO** — `https://agent-street.zevlat.workers.dev/` (Cloudflare **Worker**, no Pages; `wrangler deploy`) sirve el app real | **IBM Plex NO self-hosted** → cae a `system-ui` (viola DESIGN.md; no hay `@font-face` ni woff2); **compare/sort parcial** (solo `category.tsx` lee `sort/search/page`; home/aisle/search no; sin ruta `/compare`); ⌘K `SearchCommand` **construido pero sin montar**; ~11 componentes muertos; **profundidad por categoría superficial** (ver fila Diversity) |
| **`workers/`** (x6) | 6 workers reales (`8004-proxy · hire-x402 · analytics · onchain-indexer · portfolios · mcp`), sin mock, sin secretos hardcodeados | **✅ los 6 en vivo (200 /health)** | `ALLOWED_ORIGIN="*"` **sin cerrar en los 6** (`[vars]` + header); `/v1/trades` vacío sin `BSCSCAN_API_KEY` (secret opcional sin poner); `classify.ts` sigue siendo **copia manual** de `app/lib/taxonomy.ts` (superficie ya divergió; las reglas `CATEGORY_DEFS` aún idénticas → contrato no roto, pero drift vivo) |
| **Diversity (las 4 categorías)** | Un **layout único** (`app/routes/agent.tsx:107-152`); varían solo etiquetas/copy + Health tiene 1 meter | Igual **profundidad** en las 4 | **Igual pero superficial:** la métrica-firma de **cada** categoría renderiza `"—"` (`app/lib/profile.ts:175-203`). Rebalancing **no** muestra ticks/score IVL (lo prohíbe la separación §2) → no es más profundo que Grid/Yield. `charts/Gauge.tsx` (health factor real) **existe completo pero NO montado**; Health usa `ScoreMeter` = *reputación* 8004scan, no el health factor. Real y montado: reputación 8004scan (score/reviews/rating/dimensiones). Portfolio `Donut`/trades requieren `BSCSCAN_API_KEY` (empty honesto sin él); `EquitySection` nunca renderiza (`equity=null`, `detail.ts:62`) |
| **`/hire` (client-pays)** | Flujo **completo y honesto**: wallet firma transfer real (nativo o ERC-20), **espera confirmación onchain** (`waitForTransactionReceipt`, `hire.tsx:250`), worker `hire-x402` **verifica la tx** y emite `HireReceipt` canónico; nunca inventa hash (pending/failed honesto) | **✅ vivo** (front + worker desplegados) | Quote sale "unavailable" si el agente no expone wallet de cobro onchain (real). Para la demo conviene fijar `FLAGSHIP_PAYTO` del flagship IVL en `hire-x402` |
| **`/me` (My agents)** | Real: lee historial `/v1/hires` por wallet + agentes lanzados por `ownerAddress` desde 8004scan (56 y 97); degrada a empty honesto | **✅ vivo** | — |
| **`/create` (client-pays)** | La wallet del usuario firma `register(agentURI)` en el IdentityRegistry ERC-8004 (`0x8004A818BFB912233c491871b3d84c89A494BD9e`, chain 97 — vivo), paga gas y **posee** la identidad. `lib/erc8004.ts` = `agentURI` byte-idéntico al SDK | **Listo (client-pays)** | Requiere que el creador tenga tBNB (faucet); check de balance + nudge en UI. Registrar de Render (`REGISTRAR_URL`) **caído/legacy** — additive, no bloquea |
| **`agent-ivl/`** | mint v3, firma+broadcast, ERC-8183; **anchor-to-live-tick**, `capital.py` (wrap+**swap** WBNB→USDT: el `mint` del mock USDT es onlyOwner), `register_8004.py` (register sin pre-check 429), `SequentialSender` (nonce local anti-carrera RPC) | **✅ VIVO EN BSC TESTNET** — wallet `0xa1Fe55…06f1`; **ERC-8004 `agent_id 2055`** (`ownerOf`=wallet, tx `0x4e2097…`); **posición LP v3 in-range/dos lados/gana fees**: `tokenId 37142` (mint `0xc66a8d…`) → **ciclo rewiden real 3-sep** (decrease+collect→re-mint más ancho, mint `0x889cca1a…`) → **`tokenId 37197`** vivo `[-23580,-22950]`. Evidencia + verificación: [`reports/pancakeswap-lp.md`](../reports/pancakeswap-lp.md) | Endpoint A2A **vivo en Render** (`https://ivl.onrender.com`, agent card + skills) → verificar que 8004scan `services.a2a.endpoint` de 2055 resuelve ahí; deploy gestionado 48h = paso opcional posterior (`studio.toml` destino comentado a self); **README reconciliado** (wallet agente = `0xa1Fe55…`; `0xf634…` es la de fondeo del usuario) |
| **`reports/`** (TermiX) | Report generado: **4 tareas, 1 trading** (AAVE/WBNB IVL +net vs naive, −IL) | ✅ contenido real | Es **backtest** (Binance klines), no fees onchain; scripts en `third_city` (no reproducible standalone) |

**Traducción:** el marketplace **ya cumple el requisito duro del Main y está vivo**. Lo que separa de
*ganar* ya no es "poner vivo": es **(1) profundidad real por categoría** (mayor riesgo de score), **(2)
cerrar compare + montar los quick-wins muertos (⌘K, Gauge, Plex)**, y **(3) la tx onchain de nuestro
agente** para los bounties PancakeSwap/TermiX. Además: **23 archivos sin commitear** → el estado
desplegado va por delante del repo; commitear para reconciliar.

## 1. Diagnóstico — qué nos separa de ganar, POR FRENTE
🔴 = bloqueante/gate · 🟠 = mueve la aguja del score · 🟡 = pulido/riesgo de percepción

### Frente 1 — Main Track ($30k + adopción) · *Functionality · Data Quality · Agent Diversity*
> **Encuadre:** "agentes listados vivos en BSC" lo cumple el marketplace listando agentes reales de
> 8004scan (ya vivos). `agent-ivl/` es un listing separado nuestro; su tx onchain es del bounty
> PancakeSwap (Frente 3), NO gate del Main. **El Main está desbloqueado, vivo, y es 100% [BUILD].**
- ✅ **App desplegada y pública** — `https://agent-street.zevlat.workers.dev/` (Worker). Requisito duro **cumplido**.
- 🟠 **Agent Diversity: igual pero superficial (NUEVO diagnóstico).** Las 4 categorías comparten layout y
  **cada** métrica-firma muestra `"—"` (`profile.ts:175-203`). Ya no es "solo IVL profundo" — es que
  *ninguna* categoría surfacea su número propio. FAQ oficial: *"submissions de una sola categoría puntúan
  mal"* → el riesgo ahora es "todas iguales pero vacías". **Es el mayor riesgo de score del Main.**
- 🟠 **Compare parcial:** `category.tsx` lee `sort/search/page` server-side (funciona); home/aisle/search
  no leen params; **no hay ruta `/compare`**. El journey descubrir→**comparar**→contratar cojea fuera de category.
- 🟡 **IBM Plex no self-hosted** (renderiza system-ui, contradice "nativo de BNB" y DESIGN.md; sin
  `@font-face` ni woff2); ⌘K `SearchCommand` y `charts/Gauge.tsx` **construidos pero sin montar**; ~11 componentes muertos.

### Frente 2 — Gate onchain de *nuestro* agente (bounties, NO gate del Main)
- 🔴 **Cero tx onchain.** Wallet/keystore **ya creados hoy** (`0xa1Fe55…06f1`) → bloqueado ahora **solo por
  fondear + ejecutar** (runbook §3, pasos 2–8). Es operación, no código.
- ✅ **Rango resuelto (anchor-to-live-tick):** el agente ancla el ancho de IVL al tick VIVO del pool
  (default chainId 97) → in-range por construcción. Supera el viejo problema del pool mal-priceado.
- 🟡 **README de agent-ivl stale** — nombra una wallet distinta a la del keystore en disco; corregir antes de operar.

### Frente 3 — PancakeSwap (CAKE) · *beneficio LP real*
- ✅ **HECHO:** posición LP v3 real onchain — pool BNB-USDT 0.05% (`0x2dbB…`), **in-range/dos
  lados/gana fees**, rango con el ancho de IVL anclado al tick vivo. **Ciclo completo evidenciado
  (3-sep):** `tokenId 37142` (mint `0xc66a8d…`) → **rewiden** real (decrease+collect→re-mint más ancho,
  mint `0x889cca1a…`) → **`tokenId 37197`** vivo `[-23580,-22950]`. 37142 queda drenado a 0 liquidez.
  Evidencia + guía de verificación onchain: [`reports/pancakeswap-lp.md`](../reports/pancakeswap-lp.md).
  Backtest (Report TermiX) + posición onchain se refuerzan. Falta solo (opcional): atar un hire real en la ficha.

### Frente 4 — TermiX ($6k) · *Agent Advantage Report* — **el más cerca de cerrado**
- ✅ Report generado (≥3 tareas, ≥1 trading). ✅ Marketplace vivo (ya cubre High-Stakes/Marketplace-Quality parcialmente).
- 🟡 Es backtest (Binance klines), no fees onchain; scripts en repo hermano. **Atar un hire real** en la
  ficha del flagship (ya es posible: hire settlea de verdad) cierra la dimensión Marketplace Quality.

### Frente 5 — Altana (50k XP) · **stretch** — **el menos construido**
- 🔴 Requiere **sesiones** (allowlist + spend cap + expiry) en Keystore, **tx vía session key** y
  **revocación por el usuario**, visibles en el **Altana explorer**. Hoy solo el seam ERC-8183 del SDK +
  x402 en el front. → Solo si sobra tiempo tras Main + PancakeSwap + TermiX.
- 📋 **Roadmap/checklist detallado + decisiones tomadas:** [`manage-altana-roadmap.md`](./manage-altana-roadmap.md)
  — extiende el journey a **manage** (spike-first, full Altana con fallback approve-based; hire = elección
  Direct/Altana). Cualquier instancia continúa desde ahí.

## 2. Estrategia de la recta final (orden de-risk)
Cada ítem **[USUARIO]** (credenciales/onchain, no automatizable) o **[BUILD]** (lo que ejecuto yo al aprobar).

**El Main está vivo y es 100% [BUILD].** El gate onchain de *nuestro* agente pertenece a los bounties.

- **(A) Reconciliar repo↔vivo [BUILD]** — commitear los 23 archivos sin commitear (deploy va por delante
  del repo); opcional: dominio propio + `ALLOWED_ORIGIN` a ese dominio. **Higiene, rápido.**
- **(B) Agent Diversity real [BUILD] — Prioridad #1 de score.** Montar `charts/Gauge.tsx` (health factor
  real) + surfacear una métrica-firma real por categoría: Grid (win-rate/episodios/PnL) · Yield (APY real)
  · Rebalancing (time-in-range/rango) · Health (factor real, no reputación). Cambiar los `"—"` de
  `profile.ts:175-203` por datos donde exista fuente honesta; si no hay fuente, encuadre honesto (no inventar).
- **(C) Journey [BUILD]** — extender lectura de `sort/tab` a home/aisle (o ruta `/compare`); **montar
  ⌘K `SearchCommand`** (quick win de Functionality). El hire ya settlea — no rehacer.
- **(D) Tx onchain de nuestro agente [USUARIO]** — runbook §3 (fondear+ejecutar). **Bounty PancakeSwap**
  (posición LP real) + credibilidad del flagship. Upside separado, NO gate del Main.
- **(E) TermiX polish [BUILD/USUARIO]** — atar un **hire real** en la ficha del flagship; documentar caveat
  de reproducibilidad; enlazar Report ↔ marketplace vivo.
- **(F) Hardening [BUILD]** — `ALLOWED_ORIGIN` a dominio en los 6 workers; poner secrets opcionales
  (`BSCSCAN_API_KEY`); unificar `classify.ts ↔ taxonomy.ts` (una fuente); self-host IBM Plex.
- **(G) Altana stretch [BUILD/USUARIO]** — session-key + spend cap + expiry + revocación + tx en Altana explorer. Solo con buffer.

## 3. Runbook onchain [USUARIO] — cerrar el gate del agente (§2 D)
> ⚠ **Wallet throwaway:** en `bag deploy` gestionado el SDK **transmite la clave privada**. Usar wallet
> desechable, **nunca** con fondos reales. Nunca commitear `.studio/` ni `.env.local`.
> Todo en `agent-ivl/ivlrebalancer/app/agent/` con el venv activo (CLI `bag`, v0.0.5, Python 3.12).

0. ✅ **Hecho:** `WALLET_PASSWORD` puesto + `bag wallet new` → keystore `0xa1Fe55…06f1` en
   `.studio/wallets/`. `agent-ivl/README.md` **ya reconciliado** (wallet agente = `0xa1Fe55…`;
   `0xf634…` documentada como la de fondeo del usuario, no la del agente).
1. `bag wallet show` · `bag wallet balance` → confirmar que la address activa es `0xa1Fe55…06f1`.
2. **Faucet BSC testnet** (§7) → fondear con **tBNB**. Reverificar `bag wallet balance`.
3. **Prep de capital (`python capital.py prepare --wrap 0.05 --usdt 5`)** — el mint v3 gasta **WBNB/USDT**
   (ERC20), no BNB nativo. `capital.py` envuelve tBNB→WBNB (`WBNB.deposit`) y auto-mintea USDT mock
   (`mint(uint256)` público del `0x3376…`) — sin swaps. Verificar: `python capital.py balances`.
4. *(opcional)* API key **8004scan Pro** (form §7) → `.studio/.env.local` (solo sube rate-limit).
5. `bag erc8004 register` → **identidad onchain ERC-8004**. **Verificar en 8004scan.**
6. **Rango (anchor-to-live-tick):** verificar sin gastar `python rebalance.py --pair BNB-USDT` (debe decir
   `anchored_to_live`/`in_range=True`). El código lo garantiza por construcción en chainId 97; capturar el
   output como artefacto (hoy no hay run guardado).
7. `rebalance.py --execute` → dispara la tx real (approve + mint anclado). **Capturar el tx hash** +
   `https://testnet.bscscan.com/tx/<hash>`.
8. `bag deploy prepare` (20-check) → `bag platform login` + `bag deploy agent` (**⚠ arranca el reloj de
   48h del trial gestionado** — paso final continuo hacia judging). `bag deploy verify` reconcilia identidad.

→ **Milestone GATE:** ≥1 tx onchain **+** agente registrado **visible en 8004scan** + tx en bscscan.
Desbloquea PancakeSwap (posición LP real) + credibilidad del flagship IVL (NO es gate del Main, ya vivo).

## 4. Plan re-fasado (~8 días · 1-sep → 9-sep · solo)
| Sprint | Días | Foco | Owner | Milestone |
|---|---|---|---|---|
| **1** | 1–3 sep | **Agent Diversity real (§2 B)** + **journey/⌘K (§2 C)** + commit repo↔vivo (§2 A) | BUILD | 4 categorías con métrica-firma real · ⌘K montado · repo reconciliado |
| **2** | 4–6 sep | **Tx onchain agente + PancakeSwap LP real (§2 D)** + **TermiX polish (§2 E)** + **hardening (§2 F)** + **video demo** | USUARIO+BUILD | posición LP verificable · Report atado a marketplace vivo · CORS/secrets/plex/classify cerrados · demo grabada |
| **Buffer/Submit** | 7–9 sep | **Altana stretch (§2 G)** si sobra · **submission** Main+TermiX+PancakeSwap | USUARIO+BUILD | entregado, público y funcional durante judging |

## 5. Backlog [BUILD] priorizado (para cuando apruebes ejecutar)
1. **Agent Diversity — montar `charts/Gauge.tsx`** para Health (factor real) y surfacear una métrica-firma
   real por categoría (Grid win-rate · Yield APY · Rebalancing time-in-range), reemplazando los `"—"` de
   `profile.ts:175-203` donde haya fuente honesta. **Mayor palanca de score.**
2. **Montar `SearchCommand` (⌘K)** — feature completa hoy sin montar → quick win de Functionality.
3. **Compare/sort:** extender lectura de `sort/tab` a home/aisle (o ruta `/compare`); `category.tsx` ya lo hace.
4. **Self-host IBM Plex** (Sans/Mono woff2 en `app/public/`, `@font-face`, no CDN) — cierra la violación de DESIGN.md.
5. **Commit** de los 23 archivos sin commitear (reconciliar repo con lo desplegado).
6. **Hardening workers:** `ALLOWED_ORIGIN` a dominio en los 6; `wrangler secret put BSCSCAN_API_KEY`
   (desbloquea `/v1/trades`), `SCAN_8004_API_KEY`, `SUBMIT_TOKEN`.
7. **Unificar `workers/8004-proxy/src/classify.ts` ↔ `app/app/lib/taxonomy.ts`** (una sola fuente, cortar drift).
8. **Fijar `FLAGSHIP_PAYTO`** del flagship IVL en `hire-x402` para que su hire tenga a quién pagar en la demo.
9. **Agent Portfolios Fase C** (`docs/agent-portfolios.md`) — worker `portfolios` ya desplegado (KV: sets,
   contadores, afinidad co-hire); falta Copy/Hire-all + leaderboard UI. Cubre los 7 aisles. Sin acoplar IVL.

## 6. Decisiones ya tomadas (no re-litigar)
- ✅ Nombre **Agent-Street**; repo hermano de `third_city` (`../agent-street`).
- ✅ Stack **React Router v8 framework mode** (continuación oficial de Remix, v2 congelado en 2.17.5) +
  Cloudflare. **Deploy = Cloudflare Worker** (`wrangler deploy`, no Pages): `agent-street.zevlat.workers.dev`.
- ✅ UI **BNB-nativa** vía `DESIGN.md` (tokens CSS dark-first; amarillo `#F0B90B` escaso; fondo `#0B0E11`; verde/rojo solo datos).
- ✅ Ejecución onchain: **BNBAgent SDK** base (ERC-8004 + ERC-8183 + sessions/x402); TermiX MCP transporte opcional.
- ✅ **Hire = client-pays** (el usuario firma/paga el transfer; el worker verifica onchain; nunca inventa hash).
- ✅ IVL doble-listado (Agent + Skill), **destacado por mérito, NUNCA integrado en el core**.
- ✅ **Camino de ejecución LP (§3.2 resuelto):** `NonfungiblePositionManager.mint` directo con ticks de
  `/v1/ivl/ticks` (skill Altana PancakeSwap Liquidity = v2, descartada; TermiX MCP no expone ticks
  exactos). Implementado en `pancake_v3.py` + anchor-to-live-tick para testnet.
- ✅ **Separación IVL ↔ Agent-Street (regla dura, CLAUDE.md §2):** Agent-Street es el **entregable para
  BNB** (funciona/entrega **sin IVL**); IVL es **activo nuestro separado** (`third_city` / `api.zvlint.com`),
  acoplado **solo como listing** vía el seam HTTP + 8004scan. `agent-ivl/` es un listing de ejemplo,
  separable — jamás filtrar el motor/IP de IVL.
- ✅ **Par inicial** del agente en testnet: **BNB-USDT**.

## 6.6. Superficie agent-native (marketplace consumible por agentes)
Un orquestador debe poder **descubrir → explorar → evaluar → contratar → gestionar** cualquier listing
por su cuenta. Superficie **marketplace-general** (IVL es solo un listing más; el core funciona sin IVL).

**v1 — HECHO y VIVO (esta entrega):**
- ✅ **MCP server** `workers/mcp/` — Cloudflare Worker, JSON-RPC 2.0 sobre Streamable HTTP, **stateless**
  (sin SSE/DO/`Mcp-Session-Id`). **Relay puro, keyless.** Compone `8004-proxy` + `hire-x402` en 9 tools:
  `search_agents`, `get_agent`, `compare_agents`, `list_categories`, `list_skills`, `get_hire_quote`,
  `hire_agent`, `list_my_hires`, `get_agent_card`. Endpoint `POST /mcp` (+ `/health`). **Desplegado (200).**
- ✅ **Ejecución x402 completa (client-pays)** — `get_hire_quote` (relay del 402) → el orquestador firma y
  broadcastea el pago → `hire_agent` → `hire-x402` verifica onchain → receipt. El MCP nunca custodia claves.
  **hire-x402 desplegado y vivo** → el flujo agent-native está operativo end-to-end.
- ✅ **UI "For Agents"** (`/for-agents`) + panel **Agent access** por listing (`AgentAccessPanel`) con la
  llamada MCP, endpoints A2A/MCP y snippet copiable. Var `MCP_URL` en `wrangler.jsonc`.
- ✅ **Orquestador de referencia** `agent-orchestrator/` (separable, buyer-side): `mcp_client.py` +
  `payments.py` (transfer x402 con wallet SDK) + `orchestrate.py` (journey + CLI, `--dry-run` default) +
  `register.py` (auto-listado opcional `infra-automation`).

**v2 — PENDIENTE (backlog):**
- [ ] REST JSON mirrors en el **app origin** (`routes/api.agents.ts` reusando `createAgentsClient`).
- [ ] Descubrimiento: `.well-known/agent-marketplace.json` + `.well-known/agent-registration.json` (EIP-8004),
  `llms.txt`, content-negotiation en loaders (Accept: application/json → JSON).
- [ ] Passthrough de A2A cards y tools de lectura del **Reputation Registry** onchain.

## 7. Requisitos de submission por track (estado real 1-sep)
- **Main:** ✅ marketplace **público y vivo** (`agent-street.zevlat.workers.dev`) · ✅ 4 categorías listadas /
  🟠 profundidad igual-pero-superficial · ✅ agentes listados vivos en BSC (vía 8004scan) · ✅ Data Quality
  real (read side, 8004scan/onchain) · ✅ **hire settlea de verdad** (client-pays verificado onchain).
  *(La tx de nuestro agente NO es requisito del Main.)*
- **TermiX:** ✅ Agent Advantage Report (≥3 tareas, ≥1 trading) · ✅ marketplace vivo · 🟡 atar un hire real en la ficha.
- **PancakeSwap:** ✅ beneficio LP **onchain** — posición v3 real in-range + **ciclo rewiden** (`37142`→`37197`, mint `0x889cca1a…`) + backtest. Evidencia: [`reports/pancakeswap-lp.md`](../reports/pancakeswap-lp.md).
- **ERC-8004 (requisito onchain duro):** ✅ agente registrado `agent_id 2055` (tx `0x4e2097…`), owner = wallet del agente `0xa1Fe55…06f1`.
- **Altana (stretch):** ❌ sesión allowlist+spend cap+expiry · tx vía session key · revocación · tx en Altana explorer.
  → **en construcción** según [`manage-altana-roadmap.md`](./manage-altana-roadmap.md) (manage flow).

## 8. Enlaces y recursos (verificados en la pestaña Resources oficial, 17-ago-2026)

**Hackathon:** página https://www.bnbchain.org/en/hackathons/smart-money-era ·
brief https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace

**BNB Agent Studio / SDK (base del agente):**
- Studio: https://www.bnbchain.org/en/bnb-agent-studio · `pip install bnbagent-studio` → **CLI `bag`**
  (v0.0.5, Python 3.12; ver `agent-ivl/README.md`). Comandos: `bag init/wallet/erc8004/dev/deploy/x402`.
- Launch overview: https://www.bnbchain.org/en/blog/bnb-agent-studio-is-live-on-bnb-chain-ai-agents-from-one-prompt
- BNBAgent SDK (ERC-8004/8183 + sessions + x402): https://github.com/bnb-chain/bnbagent-sdk

**8004scan by AltLayer — motor de datos** (Pro gratis participantes: **500 req/min, 100k/día**):
- Explorer: https://8004scan.io · Agentes BSC (chain 56): https://8004scan.io/agents?chain=56
- Developer Hub & API: https://8004scan.io/developers
- **Pro-Tier Upgrade Form**: https://forms.gle/jQevEPCAacBXaKG79 · EIP-8004: https://eips.ethereum.org/EIPS/eip-8004

**Partners (bounties):**
- TermiX: https://app.termix.ai · BSC MCP server: https://github.com/TermiX-official/bsc-mcp
- PancakeSwap: Dev Portal https://developer.pancakeswap.finance · docs https://docs.pancakeswap.finance
- Altana: docs https://docs.altana.network · SDK+MCP https://github.com/altananetwork/altana-sdk ·
  Sessions https://docs.altana.network/concepts/sessions · ERC-8183 SDK https://docs.altana.network/sdk/erc8183 ·
  x402 server SDK https://docs.altana.network/sdk/x402-server · 10 skills https://skills.altana.network

**Onchain / testnet:**
- Faucet BSC testnet: https://testnet.bnbchain.org/faucet-smart (o https://www.bnbchain.org/en/testnet-faucet)
- Brand guidelines (para `../DESIGN.md`): https://www.bnbchain.org/en/brand-guidelines

**IVL (activo propio, repo hermano `third_city`):**
- API: `https://api.zvlint.com` (`/v1/ivl`, `/v1/ivl/ticks`, `/v1/screener`)
- Motor/scripts: `third_city/frontend/src/lib/ivl.ts`, `third_city/skills/ivl/` (`backtest.mjs`, `compare.mjs`, `ivl-lp.mjs`)
- Señal opcional: CMC https://coinmarketcap.com/api/agent

**Deploy vivo (agent-street):**
- Marketplace (Worker): `https://agent-street.zevlat.workers.dev/`
- Workers (200 /health): `agent-street-{8004-proxy,hire-x402,analytics,onchain-indexer,portfolios,mcp}.zevlat.workers.dev`

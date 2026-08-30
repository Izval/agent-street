# Roadmap — Agent-Street (recta final, renovado 20-ago-2026)

> **Punto de entrada de ejecución.** La fase de planeación está cerrada; la de *construcción* está
> ~85% hecha. Lo que queda es **poner vivo lo construido + cerrar los gaps de judging**.
> Lee en orden: este roadmap → [`plan.md`](./plan.md) (estrategia) → [`../DESIGN.md`](../DESIGN.md) (UI) →
> [`seed-catalog.md`](./seed-catalog.md).

## 0. Contexto en 30 segundos
- **Qué:** **Agent-Street**, marketplace de **agentes + skills** ERC-8004 para BNB Chain. Entrega al
  hackathon *"The Smart Money Era: Build the Era"*. **Deadline 9-sep-2026. Hoy 20-ago → ~20 días.**
- **Estrategia:** híbrido apalancado. Un activo (**IVL**, ya construido) alimenta 3 premios: track
  principal ($30k + adopción), bounty **PancakeSwap** (CAKE) y bounty **TermiX** ($6k). Altana = stretch.
- **Stack:** **React Router v8 (sucesor de Remix) + Cloudflare Pages/Workers** (solo dev). IVL vía su
  API pública `api.zvlint.com` (no duplicar código, no filtrar IP).
- **⚠ Pivote de la recta final:** el build está avanzado, pero el **requisito duro onchain está en CERO
  ejecución** y **el app no está desplegado**. Se construyeron features antes de asegurar el gate que
  CLAUDE.md §6 mandaba hacer PRIMERO. → El nuevo eje es: **asegurar el gate onchain → desplegar público
  → igualar profundidad de las 4 categorías → cerrar el journey.** De "construir" a "poner vivo".

## 0.5. Estado REAL verificado (auditoría 20-ago-2026)
> **Regla dura:** no se marca ✅ nada que no se haya **ejecutado/desplegado**. "Código listo" ≠ "vivo".
> El §0.5 anterior confundía ambas cosas; esta tabla es la verdad auditada (3 sweeps de código + docs).

| Área | Código | Ejecutado / Vivo | Gap clave |
|---|---|---|---|
| **`app/`** (RR v8) | ~80% real: 8 rutas con loaders reales a workers+IVL, ~50 componentes, honesto (nulls, no inventa) | **❌ NO desplegado** | Compare/sort **decorativo** (loaders no leen `sort/tab/view`); **IBM Plex NO self-hosted** → renderiza `system-ui` (viola DESIGN.md); ~10 componentes muertos (⌘K `SearchCommand` sin montar); profundidad real **solo IVL** |
| **`workers/`** (x3) | ~85–90% reales, **sin datos mock**, sin secretos hardcodeados | 8004-proxy **desplegado y en vivo**; analytics/indexer desplegables | Secrets sin poner → `/v1/trades` vacío sin `BSCSCAN_API_KEY`; `ALLOWED_ORIGIN="*"`; `classify.ts` es **copia manual** de `app/lib/taxonomy.ts` (drift) |
| **`agent-ivl/`** | mint v3 (`pancake_v3.py`), firma+broadcast (`rebalance.py`), ERC-8183 (`signing.py`) **completos**; IVL client verificado en vivo | **❌ CERO tx · sin wallet · sin keystore · sin registro** | Bloqueado **solo por credenciales**; `.studio/wallets/` vacío; pool testnet BNB-USDT **mal-priceado** |
| **`services/registrar/`** | FastAPI que acuña identidad ERC-8004 testnet — completo; **ya consumido** por el wizard `/create` (ver [`create-agent-wizard.md`](./create-agent-wizard.md)) | **Solo DRY_RUN** (sin `TREASURY_PRIVATE_KEY`) | 2ª ruta de broadcast, nunca corrida onchain; falta treasury key + hosting público para mint real |
| **`reports/`** (TermiX) | Report generado: **4 tareas, 1 trading** (AAVE/WBNB IVL +net vs naive, −IL) | ✅ contenido real | Es **backtest** (Binance klines), **no fees onchain**; los scripts viven en `third_city` (no reproducible standalone aquí) |

**Traducción:** lo que existe es sólido y honesto. Lo que falta para ganar **no es más código base** —
es **ejecución onchain + deploy + igualar las 3 categorías no-IVL + cerrar el "comparar/contratar".**

## 1. Diagnóstico — qué nos separa de ganar, POR FRENTE
🔴 = bloqueante/gate · 🟠 = mueve la aguja del score · 🟡 = pulido/riesgo de percepción

### Frente 1 — Main Track ($30k + adopción) · *Functionality · Data Quality · Agent Diversity*
> **Nota de encuadre:** el requisito "agentes listados vivos en BSC" **lo cumple el marketplace listando
> agentes reales de 8004scan** (ya vivos en cadena) — NO depende de que *nuestro* agente esté vivo.
> `agent-ivl/` es un **listing separado nuestro**; su tx onchain es trabajo del **bounty PancakeSwap**
> (Frente 3), no un gate del Main. **El Main está desbloqueado y es 100% [BUILD].**
- 🔴 **App sin desplegar** → nada público durante judging (requisito duro).
- 🟠 **Agent Diversity desigual:** las 4 categorías comparten *listado* igual, pero **solo Rebalancing/IVL
  tiene profundidad real** (ticks/score en vivo). Grid/Yield/Health = cards y detalle genéricos; los
  "templates" cambian **etiquetas, no datos**. FAQ oficial: *"submissions de una sola categoría puntúan
  mal"* → este es exactamente ese riesgo.
- 🟠 **Compare roto:** los controles de sort/tab/compare escriben params que **ningún loader lee**. El
  journey descubrir→**comparar**→contratar se rompe en "comparar".
- 🟡 **IBM Plex no self-hosted** (renderiza system-ui, contradice "nativo de BNB" y DESIGN.md); ~10
  componentes construidos sin montar (la paleta ⌘K completa).

### Frente 2 — Requisito onchain (gate de TODO lo demás)
- 🔴 **Cero footprint.** Bloqueado **solo por credenciales** (ver runbook §3). Es paso de **operación,
  no de código**.
- ⚠ **Pool testnet BNB-USDT mal-priceado** → un mint podría quedar single-sided/out-of-range. Envolver
  tBNB→WBNB y **validar el precio del pool antes** del mint.

### Frente 3 — PancakeSwap (CAKE) · *beneficio LP real*
- 🟠 Hay evidencia de backtest pero **ningún mint v3 real onchain**. Falta **1 posición LP real con ticks
  IVL en testnet** → tx + posición verificable. Depende del gate §2.

### Frente 4 — TermiX ($6k) · *Agent Advantage Report* — **el más cerca de cerrado**
- ✅ Report generado (≥3 tareas, ≥1 trading).
- 🟡 Es backtest (Binance klines), **no fees onchain**; scripts en repo hermano (no reproducible aquí).
  Dimensiones **High-Stakes (20%)** y **Marketplace Quality (20%)** dependen del **marketplace vivo** +
  idealmente **atar un hire real** en la ficha.

### Frente 5 — Altana (50k XP) · **stretch** — **el menos construido**
- 🔴 Requiere **sesiones** (allowlist + spend cap + expiry) en Keystore, **tx vía session key**, y
  **revocación por el usuario**, visible en el **Altana explorer**. Hoy solo existe el seam ERC-8183 del
  SDK + x402 en el front. El flujo session-keys/revocación **no existe como entregable**. → Solo si sobra
  tiempo tras Main + PancakeSwap + TermiX.

## 2. Estrategia de la recta final (orden de-risk)
Cada ítem etiquetado **[USUARIO]** (credenciales/onchain, no automatizable) o **[BUILD]** (lo que ejecuto
yo cuando lo apruebes; hoy solo se renovó este roadmap, sin tocar código).

**El track principal está desbloqueado y es 100% [BUILD]** (no depende de credenciales). El gate onchain
de *nuestro* agente pertenece a PancakeSwap, no al Main.

- **(A) Deploy app público [BUILD]** — Pages apuntando a los workers de prod; `HIRE_X402_URL` real;
  `ALLOWED_ORIGIN` a dominio. Sin esto no hay Main. **Prioridad #1.**
- **(B) Agent Diversity real [BUILD]** — Grid/Yield/Health con **datos y detalle propios** (no template
  de etiquetas). Cierra el mayor riesgo de score del Main.
- **(C) Journey [BUILD]** — compare/sort funcional (loader lee params o ruta compare); montar ⌘K;
  backend x402 (`bag x402 buy` tras `POST /v1/hire`) para que el hire **settlee** de verdad.
- **(D) Tx onchain de nuestro agente [USUARIO]** — runbook §3. **Es del bounty PancakeSwap** (posición LP
  real) + credibilidad del flagship. Upside separado, NO gate del Main.
- **(E) TermiX polish [BUILD/USUARIO]** — atar un **hire real** en la ficha del flagship; documentar el
  caveat de reproducibilidad; enlazar Report ↔ marketplace vivo.
- **(F) Altana stretch [BUILD/USUARIO]** — session-key + spend cap + expiry + revocación + tx en Altana
  explorer. Solo con buffer.

## 3. Runbook onchain [USUARIO] — asegurar el gate (§2 A)
> ⚠ **Wallet throwaway:** en `bag deploy` gestionado el SDK **transmite la clave privada**. Usar una
> wallet desechable, **nunca** una con fondos reales. Nunca commitear `.studio/` ni `.env.local`.
> Todo en `agent-ivl/ivlrebalancer/app/agent/` con el venv activo (CLI `bag`, v0.0.5, Python 3.12).

1. `bag wallet new` → crea keystore local. Verificar: `bag wallet show` · `bag wallet balance`.
2. **Faucet BSC testnet** (§7) → fondear la address con **tBNB**. Reverificar `bag wallet balance`.
3. **Envolver tBNB→WBNB** — el mint v3 gasta **WBNB/USDT**, no BNB nativo. Dejar saldo de ambos tokens
   del par elegido.
4. *(opcional)* API key **8004scan Pro** (form §7) → `.studio/.env.local` (solo sube rate-limit; la API
   funciona anónima ~10 req/min).
5. `bag erc8004 register` → **identidad onchain ERC-8004** = requisito duro. **Verificar en 8004scan.**
6. **Validar el pool/precio del par** antes del mint (evitar single-sided/out-of-range por el pool
   mal-priceado). Ajustar par/rango si el precio testnet está roto.
7. `rebalance.py --execute` → dispara la tx real. **Capturar el tx hash** + `https://testnet.bscscan.com/tx/<hash>`.
8. `bag deploy prepare` (20-check) → cuando pase, `bag platform login` + `bag deploy agent`
   (**⚠ arranca el reloj de 48h del trial gestionado** — hacerlo como paso final continuo hacia judging).
   `bag deploy verify` reconcilia la identidad del endpoint desplegado.

→ **Milestone GATE:** ≥1 tx onchain **+** agente registrado **visible en 8004scan** + tx en bscscan.
Este milestone desbloquea Main (flagship vivo) y PancakeSwap (posición LP real).

## 4. Plan re-fasado (~20 días · 20-ago → 9-sep · solo)
| Sprint | Días | Foco | Owner | Milestone |
|---|---|---|---|---|
| **1** | 20–26 ago | **Deploy app público (§2 A)** + arrancar **Agent Diversity (§2 B)** | BUILD | marketplace público navegable con datos reales |
| **2** | 27 ago–2 sep | Terminar **Agent Diversity (§2 B)** + **journey/compare/x402 settle (§2 C)** | BUILD | 4 categorías con detalle propio · hire que settlea |
| **3** | 3–6 sep | **Tx onchain agente + PancakeSwap LP real (§2 D)** + **TermiX polish (§2 E)** + hardening (secrets, CORS, unificar classify↔taxonomy) + **video demo** | USUARIO+BUILD | posición LP verificable · Report atado a marketplace vivo · demo grabada |
| **Buffer/Submit** | 7–9 sep | **Altana stretch (§2 F)** si sobra · **submission** Main+TermiX+PancakeSwap | USUARIO+BUILD | entregado, público y funcional durante judging |

## 5. Backlog [BUILD] priorizado (para cuando apruebes ejecutar)
1. **Deploy `app/` a Pages** apuntando a workers de prod; `HIRE_X402_URL`→seam real; `ALLOWED_ORIGIN`→dominio.
2. **Self-host IBM Plex** (Sans/Mono woff2 en `app/public/`, `@font-face`, no CDN).
3. **Compare/sort funcional:** el loader de home lee `sort/tab/view` (o construir ruta `/compare`).
4. **Profundizar 3 categorías:** Grid (episodios/WR/PnL estilo Gridora) · Yield (APY real) · Health
   (**montar `charts/Gauge.tsx`** para el factor de liquidación). Cards con métricas por template, no solo etiquetas.
5. **Montar `SearchCommand` (⌘K)** — feature completa, hoy sin montar → quick win de Functionality.
6. **Backend x402 hire:** `bag x402 buy` detrás de `POST /v1/hire` para settlear de verdad.
7. **Unificar `workers/8004-proxy/src/classify.ts` ↔ `app/app/lib/taxonomy.ts`** (una sola fuente, cortar drift).
8. **Secrets prod:** `wrangler secret put BSCSCAN_API_KEY` (desbloquea `/v1/trades`), `SCAN_8004_API_KEY`, `SUBMIT_TOKEN`.

## 6. Decisiones ya tomadas (no re-litigar)
- ✅ Nombre **Agent-Street**; repo hermano de `third_city` (`../agent-street`).
- ✅ Stack **React Router v8 framework mode** (continuación oficial de Remix, v2 congelado en 2.17.5) + Cloudflare.
- ✅ UI **BNB-nativa** vía `DESIGN.md` (tokens CSS dark-first; amarillo `#F0B90B` escaso; fondo `#0B0E11`; verde/rojo solo datos).
- ✅ Ejecución onchain: **BNBAgent SDK** base (ERC-8004 + ERC-8183 + sessions/x402); TermiX MCP transporte opcional.
- ✅ IVL doble-listado (Agent + Skill), **destacado por mérito, NUNCA integrado en el core**.
- ✅ **Camino de ejecución LP (§3.2 resuelto):** `NonfungiblePositionManager.mint` directo con ticks de
  `/v1/ivl/ticks` (skill Altana PancakeSwap Liquidity = v2, descartada; TermiX MCP no expone ticks
  exactos). Ya implementado en `pancake_v3.py`.
- ✅ **Separación IVL ↔ Agent-Street (regla dura, CLAUDE.md §2):** Agent-Street es el **entregable para
  BNB** (debe funcionar y entregarse **sin IVL**); IVL es **activo nuestro separado** (`third_city` /
  `api.zvlint.com`), acoplado **solo como listing** vía el seam HTTP + 8004scan. `agent-ivl/` es un
  listing de ejemplo, separable — jamás filtrar el motor/IP de IVL.
- ✅ **Par inicial** del agente en testnet: **BNB-USDT**.

## 6.6. Superficie agent-native (marketplace consumible por agentes)
Un orquestador debe poder **descubrir → explorar → evaluar → contratar → gestionar** cualquier listing
por su cuenta. Superficie **marketplace-general** (IVL es solo un listing más; el core funciona sin IVL).

**v1 — HECHO (esta entrega):**
- ✅ **MCP server** `workers/mcp/` — Cloudflare Worker, JSON-RPC 2.0 sobre Streamable HTTP, **stateless**
  (sin SSE, sin Durable Objects, sin `Mcp-Session-Id`). **Relay puro, keyless.** Compone `8004-proxy` +
  `hire-x402` en 9 tools: `search_agents`, `get_agent`, `compare_agents`, `list_categories`,
  `list_skills`, `get_hire_quote`, `hire_agent`, `list_my_hires`, `get_agent_card`. Endpoint `POST /mcp`
  (+ `/health`). Verificado con curl + orquestador de referencia.
- ✅ **Ejecución x402 completa (client-pays)** — `get_hire_quote` (relay del 402) → el orquestador firma y
  broadcastea el pago desde su wallet → `hire_agent` → `hire-x402` verifica onchain → receipt. El MCP
  nunca custodia claves. *(Bloqueado en vivo solo por deploy de `hire-x402`, ver §7.)*
- ✅ **UI "For Agents"** (`/for-agents`) + panel **Agent access** por listing (`AgentAccessPanel`) con la
  llamada MCP, endpoints A2A/MCP y snippet copiable. Link en el Sidebar. Var `MCP_URL` en `wrangler.jsonc`.
- ✅ **Orquestador de referencia** `agent-orchestrator/` (separable, buyer-side, como `agent-ivl/`):
  `mcp_client.py` + `payments.py` (transfer x402 con wallet SDK, **fixed code**) + `orchestrate.py`
  (journey + CLI, `--dry-run` por defecto) + `register.py` (auto-listado opcional `infra-automation`).

**v2 — PENDIENTE (backlog):**
- [ ] REST JSON mirrors en el **app origin** (`routes/api.agents.ts` reusando `createAgentsClient`).
- [ ] Descubrimiento: `.well-known/agent-marketplace.json` + `.well-known/agent-registration.json` (EIP-8004),
  `llms.txt`, content-negotiation en loaders (Accept: application/json → JSON).
- [ ] Passthrough de A2A cards y tools de lectura del **Reputation Registry** onchain.

## 7. Requisitos de submission por track (estado real)
- **Main:** ❌ marketplace público (falta deploy) · ✅ 4 categorías listadas / 🟠 profundidad desigual ·
  ✅ agentes listados vivos en BSC (vía 8004scan) · ✅ Data Quality real (read side, 8004scan/onchain) ·
  🟠 hire (quote ✅, settle ❌). *(La tx de nuestro agente NO es requisito del Main — es del bounty PancakeSwap.)*
- **TermiX:** ✅ Agent Advantage Report (≥3 tareas, ≥1 trading) · 🟡 atar a marketplace vivo + hire real.
- **PancakeSwap:** ❌ beneficio LP **onchain** (solo backtest hoy) → falta 1 mint v3 real con ticks IVL.
- **Altana (stretch):** ❌ sesión allowlist+spend cap+expiry · tx vía session key · revocación · tx en Altana explorer.

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

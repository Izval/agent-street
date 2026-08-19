# Roadmap — Agent-Street (handoff para el siguiente agente)

> Este archivo es el **punto de entrada de ejecución**. La fase de investigación/planeación está cerrada.
> Lee, en este orden: este roadmap → [`plan.md`](./plan.md) (estrategia completa) →
> [`../DESIGN.md`](../DESIGN.md) (UI, obligatorio) → [`seed-catalog.md`](./seed-catalog.md) (agentes semilla).

## 0. Contexto en 30 segundos
- **Qué:** **Agent-Street** ("BNB Agent Street"), marketplace de **agentes + skills** ERC-8004 para BNB
  Chain. Entrega al hackathon *"The Smart Money Era: Build the Era"*, **deadline 9-sep-2026**.
- **Estrategia:** híbrido apalancado. Un activo (**IVL**, ya construido) alimenta 3 premios: track
  principal ($30k + adopción), bounty **PancakeSwap** (CAKE) y bounty **TermiX** ($6k).
- **Stack:** **Remix + Cloudflare Pages/Workers** (solo dev). Reutiliza el motor IVL vía su API pública
  `api.zvlint.com` (no duplicar código).
- **De-risk:** asegurar bounties primero (valor casi garantizado); marketplace como upside.

## 0.5. Estado de ejecución — actualizado 17-ago-2026
> Progreso del build. Lo hecho no se re-litiga; lo pendiente marca el frente.

**✅ Hecho (verificado):**
- **Repo**: `git init` en `main`; `.gitignore` monorepo; `CLAUDE.md` como guía.
- **`app/` (marketplace)**: scaffold **React Router v8** (framework mode = sucesor de Remix;
  Remix v2 congelado en 2.17.5) + Cloudflare Vite plugin + React 19 + Tailwind v4. **Buildea y
  typechecka limpio.** `DESIGN.md` cableado (tokens CSS dark-first → `@theme` Tailwind). Cliente
  IVL tipado (`lib/ivl.ts`, formas verificadas contra `api.zvlint.com`). Home SSR con **score IVL en
  vivo** (flagship BNB-USDT), tabs Agents/Skills, chips de las 4 categorías — **render SSR confirmado**.
- **`workers/8004-proxy/`**: **REAL y probado en vivo.** Endpoints/campos de 8004scan verificados
  (`GET /agents?chainId=56&search=&sortBy=total_score`, `GET /agents/{56}/{tokenId}`; envelope
  `{success,data,meta.pagination}`). **Funciona ANÓNIMO** (~10 req/min; key Pro solo sube límite).
  `wrangler dev` devolvió grid traders BSC reales clasificados, con score/x402/owner. **~257k agentes
  BSC** disponibles. Métricas honestas de Data Quality: `stars, total_score, average_score,
  total_feedbacks, health_score, x402_supported, is_verified`.
- **`agent-ivl/`**: **Python 3.12.14** (Homebrew) + venv aislado; **`bnbagent-studio 0.0.5` instala
  limpio** (web3 7.16, eth-account, mcp, boto3, fastapi). CLI = **`bag`** (¡no `bnbagent-studio`!),
  verificado. `requirements.txt` + `requirements.lock.txt` + `README.md`. **CLI mapeado a fondo**
  (ver §4b): agente = **ADK A2A/MCP seller** sobre **AWS AgentCore gestionado**.
- **Scripts del Report (Fase 3) verificados**: `third_city/skills/ivl/scripts/backtest.mjs` y
  `compare.mjs` **corren hoy** contra klines de Binance en vivo y emiten métricas JSON reales
  (time-in-range, breakout, fee-efficiency, IL). Sin deps npm (fetch puro).

**⬜ Pendiente / bloqueado por credenciales del usuario:**
- **API key 8004scan Pro** → secret del proxy (`wrangler secret put SCAN_8004_API_KEY`) + confirmar
  host real (placeholder `api.8004scan.io/dev`) + finalizar mapeo de campos.
- **Faucet BSC testnet** + wallet (`bag wallet create`) → tx onchain de la Fase 0.
- **Validación §3.2** (mint v3 con ticks): probar skill PancakeSwap Liquidity de Altana, luego TermiX.
- Rutas `/category/:id`, `/agent/:id`, `/skill/:id`, `/hire`; cliente del proxy en el front; seed curado.

## 1. Decisiones ya tomadas (no re-litigar)
- ✅ Nombre: **Agent-Street**. Repo hermano de `third_city`, aquí en `../agent-street`.
- ✅ Stack: Remix + Cloudflare (no Next/Vercel).
- ✅ UI: **BNB-nativa desde el día 1** → cablear `DESIGN.md` (tokens CSS + tema dark default + Tailwind
  mapeado) ANTES de construir componentes. Amarillo `#F0B90B` escaso; fondo `#0B0E11`; verde/rojo solo datos.
- ✅ Ejecución onchain: **BNBAgent SDK** como base (identidad ERC-8004 + ERC-8183 + sessions/x402;
  desbloquea bounty Altana). TermiX MCP como transporte de ejecución opcional/rápido. No es "uno u otro".
- ✅ IVL se lista **dos veces**: como Agent (Rebalancer) y como Skill (`skills/ivl/SKILL.md` existe).
- ✅ **Separación IVL ↔ Agent-Street (regla dura, ver `CLAUDE.md` §2):** Agent-Street es el
  **entregable para BNB Chain** (lo que se somete / pueden adoptar); IVL es **activo nuestro
  SEPARADO** (`third_city` / `api.zvlint.com`). IVL va **destacado por mérito mientras sea el mejor
  de su categoría**, pero acoplado **solo como listing** vía el seam HTTP + 8004scan — **nunca como
  código integrado** en el core. El marketplace debe funcionar **sin IVL**; entregar agent-street
  **no** debe filtrar el motor/IP de IVL. `agent-ivl/` es un listing de ejemplo, separable.

## 2. Decisión abierta
- ✅ **Par inicial** del agente IVL en testnet: **BNB-USDT** (confirmado 17-ago-2026).

## 3. ⚠ Validación crítica — HACER PRIMERO (días 1–3)
Antes de invertir en features, confirmar el núcleo de IVL:
1. **Requisito onchain temprano:** ~~`pip install bnbagent-studio`~~ ✅ **hecho** (Python 3.12 +
   venv en `agent-ivl/`; CLI **`bag`**). Falta: faucet BSC testnet; API key **8004scan Pro**;
   desplegar un agente mínimo que haga **UNA tx onchain** y se registre en 8004scan. Flujo con `bag`:
   `bag init` → `bag wallet create` → `bag erc8004 register` → `bag dev`/`bag deploy`. → asegura el
   requisito duro del hackathon el día 3.
2. **¿Se puede mintear una posición PancakeSwap v3 con `tickLower/tickUpper` específicos?**
   ✅ **RESUELTO (17-ago-2026, investigación con clone de repos).** Ningún tool de alto nivel expone
   ticks explícitos:
   - **Skill PancakeSwap Liquidity de Altana = V2, sin ticks.** ❌ No sirve para el núcleo v3.
     (Esto invierte el orden "Altana primero" que estaba aquí: quedó descartada para v3.)
   - **TermiX BSC MCP**: su `Add_PancakeSwap_Liquidity` **sí es v3** (llama `NonfungiblePositionManager.mint`,
     usa TickMath) **pero el schema MCP solo acepta `{token0,token1,amounts}`** y calcula los ticks
     internamente (banda ±20% fija, fee 0.3% hardcodeado). Su `callContractFunction` genérico
     **no está implementado** (solo en el README). ❌ No hitea ticks exactos out-of-the-box.
   - **bnbagent-sdk**: `EVMWalletProvider` firma y auto-broadcastea tx arbitrarias (`sign.transaction`),
     así que se puede armar el `mint` crudo. `AltanaWalletProvider` = session keys + spend caps + x402
     (para el bounty Altana).
   - **➡ CAMINO ELEGIDO:** encodear y enviar `NonfungiblePositionManager.mint(MintParams{token0,token1,
     fee,tickLower,tickUpper,amount0Desired,amount1Desired,amount0Min,amount1Min,recipient,deadline})`
     **directo**, con los ticks de `/v1/ivl/ticks`. **Ruta más limpia:** forkear el tool `addLiquidityV3`
     de bsc-mcp para exponer `tickLower/tickUpper`+`fee` (~10 líneas; ABI/TickMath/approvals ya
     vendorizados). **Fallback:** armar el `mint` con viem/ethers y broadcast vía `EVMWalletProvider`
     del SDK. Fuentes: `TermiX-official/bsc-mcp`, `bnb-chain/bnbagent-sdk`, `docs.altana.network`.

## 4. Plan por fases (10 ago → 9 sep, solo)
| Fase | Días | Entregable | Cubre |
|---|---|---|---|
| **0. Setup + de-risk** | 1–3 | SDK instalado, tx onchain mínima en testnet, validación §3 | requisito onchain |
| **1. Agente IVL vivo** | 4–10 | agente lee `/v1/ivl/ticks` → abre/ajusta LP v3 en testnet; baseline runs | bounty PancakeSwap |
| **2. Marketplace MVP** | 11–17 | Remix + Worker proxy 8004scan (KV); tabs Agents/Skills; 4 categorías; **IVL flagship**; DESIGN.md cableado | track principal |
| **3. Hire + Data Quality + Report** | 18–24 | hire flow x402; métricas reales 8004scan; **Agent Advantage Report** (≥3 tareas, ≥1 trading) con `skills/ivl/scripts` | bounty TermiX |
| **4. Pulido + submission** | 25–30 | video demo; público/funcional en judging; submit a Main+TermiX+PancakeSwap; Altana bonus si sobra | todos |

## 4b. Detalle ejecutable de cada fase (preparado 17-ago, tras mapear el SDK)

> Hechos verificados corriendo el CLI `bag`, los scripts IVL y el proxy localmente, más investigación
> con clone de repos (TermiX/Altana/8004scan/bnbagent-sdk). Todo confirmado — sin pendientes de research.

### ⚠ Constraint nuevo y crítico: el **trial gestionado dura 48h**
`bag platform credit (trial)` muestra una **cuenta regresiva de 48h** del trial de testnet en la
plataforma gestionada (AWS AgentCore). El deploy por defecto es `--destination platform` (gestionado,
**no requiere tu propia cuenta AWS** durante el trial). **Implicación:** NO correr `bag platform login`
ni `bag deploy agent` hasta tener el agente probado en local con `bag dev` y todo listo — el reloj de
48h arranca al usar la plataforma. Ensayar todo en local primero; disparar el deploy gestionado como
paso final y continuo hacia el judging.

### Modelo mental del agente (confirmado por el CLI)
No es un script suelto: `bag init --framework adk` scaffolds un **agente ADK** que corre como
**seller A2A** (o MCP) sobre **AgentCore**. Su lógica de rebalanceo es una **skill/tool** del agente.
Vende trabajos vía **ERC-8183** (buy/submit/settle) y cobra vía **x402** ($U, EIP-3009). Identidad
**ERC-8004**. Recipes disponibles: `agent`, `tools-adk`, `wallet`, `x402-buyer`
(`bag recipe code <name>` para ver el template).

### Fase 0 — Setup + de-risk onchain (bloqueada solo por credenciales)
Secuencia exacta (en `agent-ivl/`, venv activo):
1. `bag init ivlrebalancer --network bsc-testnet --protocol A2A --llm-provider anthropic --wallet-kind evm-local --ide claude-code`
   (nombre ASCII alfanumérico ≤23, sin `-`; `evm-local` = keystore local propio, alternativa `twak` =
   Trust Wallet Agent Kit).
2. `bag wallet new` → crea keystore local. `bag wallet show` / `bag wallet balance`.
3. **Faucet BSC testnet** (§8) → fondear la address con tBNB. Reverificar con `bag wallet balance`.
4. **API key 8004scan Pro** (form §8) → `bag env set` / `.studio/.env.local` (nunca al repo;
   `bag deploy fix-gitignore` asegura que `.studio/` esté ignorado).
5. `bag erc8004 register` → **identidad onchain ERC-8004 = requisito duro** (aparece en 8004scan).
6. `bag doctor --check-env` → sweep de entorno. `bag dev` → correr el agente en local y probar A2A.
7. `bag deploy prepare` (20-check) → cuando pase, `bag platform login` + `bag deploy agent` (⚠ arranca
   las 48h). `bag deploy verify` reconcilia la identidad ERC-8004 del endpoint desplegado.
   → **Milestone Fase 0:** agente vivo en BSC testnet con ≥1 tx onchain, visible en 8004scan.

### Fase 1 — Agente IVL vivo (ejecución LP)
- La skill de rebalanceo del agente hace `GET api.zvlint.com/v1/ivl/ticks?pair=BNB-USDT` → obtiene
  `ticks.tickLower/tickUpper` + `decision.action` (open_or_hold / withdraw_or_widen / reset).
- **Ejecución LP en Pancake v3 con esos ticks** → ✅ **camino decidido (§3.2)**: `mint` directo al
  `NonfungiblePositionManager` con los ticks; ruta limpia = forkear el tool `addLiquidityV3` de
  bsc-mcp para exponer ticks/fee; fallback = mint con viem/ethers vía `EVMWalletProvider` del SDK.
- **Baseline runs** para el Report: `node backtest.mjs --pair BNB-USDT --lookback 96 --hold 48 --step 16
  --history 1000 --json` (ya corre). → **Milestone:** el agente reposiciona LP onchain solo.

### Fase 2 — Marketplace MVP
- **Rutas a construir** (app RR v8): `/category/:id`, `/agent/:id`, `/skill/:id`, `/hire` (home ✅).
- **Cliente del proxy** en `app/app/lib/agents.ts` → consume `workers/8004-proxy` (`/v1/agents`,
  `/v1/agents/:tokenId`). Loaders SSR por ruta; filtrar por categoría. (Proxy ✅ real y probado.)
- **Proxy 8004scan**: ✅ endpoints/campos reales cableados y probados en vivo. Pendiente menor: poner
  `SCAN_8004_API_KEY` (secret, opcional) para subir el rate-limit; crear KV namespaces reales antes
  del deploy (`wrangler kv namespace create AGENTS_KV`).
- **Seed curado** (Capa 2): cargar catálogo de `docs/seed-catalog.md` (Gridora ERC-8004 #140004, etc.)
  como fallback/enriquecimiento. → **Milestone:** marketplace público navegable, 4 categorías, datos reales.

### Fase 3 — Hire flow + Data Quality + Agent Advantage Report (TermiX)
- **Hire flow x402**: `bag x402 quote` (probe 402) → `bag x402 buy` (pagar $U). En el front, botón
  "Hire" del `/agent/:id` dispara el flujo x402 contra el endpoint del agente. `bag x402 trust` registra
  el merchant.
- **Report** (`reports/`): reusar los scripts (ya corren):
  - `node compare.mjs --pair AAVE-WBNB --scale 1d --history 365 --delta 0.16 --json` → IVL vs naive vs
    random (fees − IL neto). **Es la evidencia "contratar al agente > hacerlo tú mismo".**
  - `node backtest.mjs …` para ≥3 pares/tareas (≥1 trading). Documentar tiempo/costo/calidad.
  → **Milestone:** Report con ≥3 tareas medidas, ≥1 trading.

### Fase 4 — Pulido + submission
- Video demo del journey (descubrir → comparar → hire). Público y funcional durante judging.
- Submit a Main + TermiX + PancakeSwap. **Altana bonus** (session keys + spend cap + expiry +
  revocación + tx visible en Altana explorer) si sobra tiempo — el SDK ya trae x402/sessions.

## 5. Componentes a construir
1. **`agent-ivl/`** — agente BNBAgent SDK (Python). Poll IVL API → decide open/hold/reset → ejecuta LP.
2. **`workers/8004-proxy/`** — Cloudflare Worker: proxy + cache KV a 8004scan Dev API; clasifica agentes
   en las 4 categorías. (Reusar patrón del Worker IVL existente en `third_city/worker/`.)
3. **`app/`** — Remix (Cloudflare Pages). Rutas: home, `/category/:id`, `/agent/:id`, `/skill/:id`,
   `/hire`. Tabs **Agents** / **Skills**. Cliente 8004scan + cliente IVL (`api.zvlint.com`).
4. **`reports/`** — Agent Advantage Report (TermiX): IVL-guiado vs baseline manual, con
   `third_city/skills/ivl/scripts/` (`backtest.mjs`, `compare.mjs`, `ivl-lp.mjs`).

## 6. Listado de agentes (para "Agent Diversity" + "Data Quality")
- **Capa 1 (motor):** 8004scan Dev API → breadth real con datos onchain. Es el listado que cuenta.
- **Capa 2 (seed curado):** cohorte ganadora del hack anterior. **⚠ Los BUIDLs están PRIVADOS en
  DoraHacks** (no enumerables); solo hay links públicos sueltos — ver `seed-catalog.md`. No gastar tiempo
  en fuerza bruta: 8004scan lo hace innecesario (Gridora ya está como ERC-8004 #140004).
- Cobertura: Rebalancing→IVL · Grid→Gridora + 8004scan · Yield→skills Altana (Aave/Venus/Lista) ·
  Health Factor→Guarded Alpha/Venus.

## 7. Requisitos de submission por track (checklist final)
- [ ] **Main:** marketplace público funcional · 4 categorías · IVL live en BSC + tx onchain · Data Quality real · hire flow.
- [ ] **TermiX:** Agent Advantage Report (≥3 tareas medidas, ≥1 trading).
- [ ] **PancakeSwap:** beneficio LP demostrado (fees/IL vs baseline).
- [ ] **Altana (opcional, 50k XP):** sesión con allowlist + spend cap + expiry en Keystore, tx vía session key, revocación; bonus x402/ERC-8183.

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
- **Pro-Tier Upgrade Form** (sacar API key): https://forms.gle/jQevEPCAacBXaKG79
- EIP-8004: https://eips.ethereum.org/EIPS/eip-8004

**Partners (bounties):**
- TermiX: https://app.termix.ai · BSC MCP server: https://github.com/TermiX-official/bsc-mcp
- PancakeSwap: Dev Portal https://developer.pancakeswap.finance · docs https://docs.pancakeswap.finance
- Altana: docs https://docs.altana.network · SDK+MCP https://github.com/altananetwork/altana-sdk ·
  Sessions https://docs.altana.network/concepts/sessions · ERC-8183 SDK https://docs.altana.network/sdk/erc8183 ·
  x402 server SDK https://docs.altana.network/sdk/x402-server
- **Altana 10 skills** (incl. **PancakeSwap Liquidity** — clave para §3): https://skills.altana.network

**Onchain / testnet:**
- Faucet BSC testnet: https://testnet.bnbchain.org/faucet-smart (o https://www.bnbchain.org/en/testnet-faucet)
- Brand guidelines (para `../DESIGN.md`): https://www.bnbchain.org/en/brand-guidelines

**IVL (activo propio, repo hermano `third_city`):**
- API: `https://api.zvlint.com` (`/v1/ivl`, `/v1/ivl/ticks`, `/v1/screener`)
- Motor/scripts: `third_city/frontend/src/lib/ivl.ts`, `third_city/skills/ivl/`
  (`backtest.mjs`, `compare.mjs`, `ivl-lp.mjs` → Agent Advantage Report)
- Señal opcional: CMC https://coinmarketcap.com/api/agent

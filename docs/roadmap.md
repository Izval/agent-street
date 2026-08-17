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
- **`workers/8004-proxy/`**: esqueleto (CORS + KV + rate-limit del patrón third_city), `classify.ts`
  a 4 categorías, degrada limpio sin API key. **Typechecka.**
- **`agent-ivl/`**: **Python 3.12.14** (Homebrew) + venv aislado; **`bnbagent-studio 0.0.5` instala
  limpio** (web3 7.16, eth-account, mcp, boto3, fastapi). CLI = **`bag`** (¡no `bnbagent-studio`!),
  verificado. `requirements.txt` + `requirements.lock.txt` + `README.md`.

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

## 2. Decisión abierta
- ✅ **Par inicial** del agente IVL en testnet: **BNB-USDT** (confirmado 17-ago-2026).

## 3. ⚠ Validación crítica — HACER PRIMERO (días 1–3)
Antes de invertir en features, confirmar el núcleo de IVL:
1. **Requisito onchain temprano:** ~~`pip install bnbagent-studio`~~ ✅ **hecho** (Python 3.12 +
   venv en `agent-ivl/`; CLI **`bag`**). Falta: faucet BSC testnet; API key **8004scan Pro**;
   desplegar un agente mínimo que haga **UNA tx onchain** y se registre en 8004scan. Flujo con `bag`:
   `bag init` → `bag wallet create` → `bag erc8004 register` → `bag dev`/`bag deploy`. → asegura el
   requisito duro del hackathon el día 3.
2. **¿Se puede mintear una posición PancakeSwap v3 con `tickLower/tickUpper` específicos?** Probar
   PRIMERO la skill **PancakeSwap Liquidity** de Altana (https://skills.altana.network) y, si no, el
   **TermiX BSC MCP**. Es el núcleo de IVL (el API `/v1/ivl/ticks` ya devuelve el rango). **Si ninguno
   lo soporta → fallback: llamada directa a `NonfungiblePositionManager.mint`** con la capacidad de
   contract-call del SDK. Resolver esto define el camino de ejecución.

## 4. Plan por fases (10 ago → 9 sep, solo)
| Fase | Días | Entregable | Cubre |
|---|---|---|---|
| **0. Setup + de-risk** | 1–3 | SDK instalado, tx onchain mínima en testnet, validación §3 | requisito onchain |
| **1. Agente IVL vivo** | 4–10 | agente lee `/v1/ivl/ticks` → abre/ajusta LP v3 en testnet; baseline runs | bounty PancakeSwap |
| **2. Marketplace MVP** | 11–17 | Remix + Worker proxy 8004scan (KV); tabs Agents/Skills; 4 categorías; **IVL flagship**; DESIGN.md cableado | track principal |
| **3. Hire + Data Quality + Report** | 18–24 | hire flow x402; métricas reales 8004scan; **Agent Advantage Report** (≥3 tareas, ≥1 trading) con `skills/ivl/scripts` | bounty TermiX |
| **4. Pulido + submission** | 25–30 | video demo; público/funcional en judging; submit a Main+TermiX+PancakeSwap; Altana bonus si sobra | todos |

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

# CLAUDE.md — Agent-Street

Guía para Claude Code al trabajar en este repositorio. **Léela completa antes de tocar código.**
Estas instrucciones tienen prioridad sobre comportamientos por defecto.

## 0. Antes de nada — orden de lectura
1. Este `CLAUDE.md` (objetivo y reglas).
2. `docs/roadmap.md` — **punto de entrada de ejecución** (fases, validación crítica, decisiones).
3. `DESIGN.md` — sistema visual **obligatorio** para toda la UI.
4. `docs/plan.md` — estrategia completa · `docs/seed-catalog.md` — agentes semilla.

## 1. El objetivo (por qué existe este repo)
**Agent-Street** ("BNB Agent Street") es un **marketplace de agentes y skills** para BNB Chain. Es la
entrega al hackathon **"The Smart Money Era: Build the Era"** de BNB Chain (**deadline 9-sep-2026**),
cuyo premio mayor es **$30k + la adopción oficial como el marketplace canónico de BNB Agent Studio**.

**Tesis estratégica (híbrido apalancado):** el usuario ya construyó **IVL** — un motor que puntúa la
calidad de un rango para liquidez concentrada en PancakeSwap v3 (vive en el repo hermano `third_city`,
con API pública en `api.zvlint.com`). IVL **es** la categoría "Rebalancing" del reto. Envolviéndolo como
agente ERC-8004 y montándolo como flagship del marketplace, **un solo activo ataca 3 premios**:
- **Track principal** ($30k + adopción) → Agent-Street es el marketplace; IVL su agente insignia.
- **Bounty PancakeSwap** (CAKE) → beneficio LP real y medible.
- **Bounty TermiX** ($6k) → Agent Advantage Report generado con los scripts de backtest de IVL.

Contexto: el usuario compite **solo** y quedó **top-10** en el hackathon BNB anterior (IVL como CMC Skill).
La meta es maximizar probabilidad de ganar reutilizando IVL de forma agresiva y viéndose **nativo de BNB**.

### Hechos oficiales confirmados (FAQ "Build the Era")
- **Fechas:** build 5-ago → **9-sep**; luego shortlist top-3 público → Fase 2 (TBA); **ganador anunciado 5-nov**.
- **Reutilizar código pasado: SÍ (confirmado por el equipo).** Aviso oficial: *un marketplace es muy
  distinto a un dashboard de agente — planear en consecuencia*.
- **Main + partner son combinables:** ganar el track principal **no** excluye de los bounties de partners
  (se juzgan independientemente). → nuestro doble-dip es válido y buscado.
- **Agent Diversity es requisito, no adorno:** las 4 categorías (rebalancing, grid, yield, health factor)
  con **igual profundidad**. **Submissions de una sola categoría puntúan mal.** No basta con IVL.
- **Elegibilidad:** global, solo o equipo, 1 entrada; el marketplace debe estar **público y funcional**
  durante el judging y **los agentes listados deben estar vivos en BSC**.
- **Altana:** exige **tx onchain en vivo visibles en el Altana explorer** (testnet cuenta).
- El **formulario de acceso Pro a la 8004scan API** y los docs/SDKs de partners están en la **pestaña
  Resources** de la página del hackathon.

## 2. Qué se construye
Marketplace donde se **descubren, comparan y contratan** agentes ERC-8004 en BSC. **Dos tabs:**
- **Agents** — agentes contratables, en 4 categorías: **Rebalancing · Grid · Yield · Health Factor**.
- **Skills** — módulos componibles (`SKILL.md` / skills de Altana) que un agente enchufa.

**IVL se lista dos veces:** como Agent (Rebalancer) y como Skill. Es el flagship de ambos tabs y
demuestra la composabilidad (ERC-8183, delegación de tareas entre agentes).

Criterios de juzgado a optimizar: **Functionality** (journey de descubrir→activar), **Data Quality**
(datos onchain reales de 8004scan), **Agent Diversity** (trato igual a las 4 categorías).

## 3. Stack y arquitectura
- **Frontend:** **Remix** sobre **Cloudflare Pages** (NO Next.js/Vercel — el usuario usa Cloudflare).
- **Datos:** **Cloudflare Worker** (`workers/8004-proxy/`) que hace proxy + cache **KV** a la **8004scan
  Dev API** (esquiva CORS/rate-limit y clasifica agentes en las 4 categorías). Reusar el patrón del
  Worker IVL existente en `third_city/worker/`.
- **Agente IVL:** **BNBAgent SDK** (Python, `pip install bnbagent-studio`) en `agent-ivl/`. Da identidad
  **ERC-8004** + tareas **ERC-8183** + sessions/spend-caps/**x402** (esto último desbloquea el bounty
  Altana). Ejecución LP onchain vía **TermiX BSC MCP** o skill *PancakeSwap Liquidity* (ver §5).
- **Motor IVL:** NO reimplementar. Consumir su **API pública** `https://api.zvlint.com`:
  `/v1/ivl`, `/v1/ivl/ticks` (devuelve `tickLower/tickUpper` listos para Pancake v3), `/v1/screener`.

```
agent-street/
├── CLAUDE.md · DESIGN.md · README.md
├── app/                  # Remix (Cloudflare Pages): routes/ (home, /category, /agent, /skill, /hire), lib/
├── workers/8004-proxy/   # Worker + KV → 8004scan Dev API
├── agent-ivl/            # Agente IVL Rebalancer (BNBAgent SDK, Python)
├── reports/              # Agent Advantage Report (bounty TermiX)
└── docs/                 # roadmap · plan · seed-catalog
```

## 4. Reglas de diseño (no negociables)
- **`DESIGN.md` es la fuente de verdad de la UI.** Cablear sus tokens (CSS variables + tema **dark por
  defecto** + Tailwind mapeado) **antes** de construir componentes. No hardcodear hex.
- Paleta oficial BNB Chain: amarillo `#F0B90B` (escaso: solo CTA/activo/marca), fondo `#0B0E11`, blanco.
  Verde `#0ECB81` / rojo `#F6465D` **solo para datos**, nunca decorativos.
- Tipografía: **IBM Plex Sans** self-hosted (BinancePlex es propietaria); numerales tabulares en datos.
- **Motivo estratégico:** que se vea nativo de BNB reduce la fricción de adopción para el jurado.
- Respetar reglas del logo BNB (no modificar; "Built on BNB Chain", no implicar endorsement).

## 5. Decisiones tomadas (no re-litigar)
- Nombre **Agent-Street**; repo hermano de `third_city`.
- Stack Remix + Cloudflare. UI BNB-nativa vía `DESIGN.md`.
- Ejecución onchain: **BNBAgent SDK como base** + TermiX MCP como transporte opcional (no es "uno u otro").
- IVL doble-listado (Agent + Skill).
- **Par inicial del agente en testnet: BNB-USDT.**

## 6. ⚠ Validación crítica — hacer PRIMERO (días 1–3)
1. Asegurar el **requisito onchain** temprano: SDK instalado + faucet BSC testnet + API key 8004scan Pro
   + agente mínimo que haga **UNA tx onchain** y se registre en 8004scan.
2. Confirmar si se puede **mintear una posición Pancake v3 con `tickLower/tickUpper` específicos** (vía
   TermiX MCP o skill PancakeSwap Liquidity). Es el núcleo de IVL. **Fallback si no:** llamada directa a
   `NonfungiblePositionManager.mint` con la capacidad de contract-call del SDK.
El plan por fases completo está en `docs/roadmap.md §4`.

## 7. Cómo trabajar aquí
- **Secuencia de-risk:** asegurar bounties primero (valor casi garantizado), marketplace como upside.
- Idioma de la UI y de la doc: **español**.
- **Repo separado a propósito:** no mezclar runtimes ni secretos con `third_city`. El seam con IVL es
  **HTTP a `api.zvlint.com`**, no importar código del otro repo.
- **Secretos/deploy:** nunca commitear `.env`. Deploy de Cloudflare con `wrangler` desde su propio dir;
  jamás un deploy que arrastre `.env.local`.
- Listado de agentes: **8004scan es el motor real**; el seed de la cohorte del hack anterior es sabor
  curado — sus BUIDLs están **privados** en DoraHacks (no enumerables), así que no gastar tiempo en
  fuerza bruta (ver `docs/seed-catalog.md`).

## 8. Enlaces y recursos (verificados en la pestaña Resources oficial, 17-ago-2026)

**Hackathon**
- Página oficial (registro): https://www.bnbchain.org/en/hackathons/smart-money-era
- Anuncio / brief: https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace

**BNB Agent Studio / SDK (base del agente)**
- BNB Agent Studio: https://www.bnbchain.org/en/bnb-agent-studio · CLI: `pip install bnbagent-studio`
- Launch overview: https://www.bnbchain.org/en/blog/bnb-agent-studio-is-live-on-bnb-chain-ai-agents-from-one-prompt
- BNBAgent SDK (Python, ERC-8004 + ERC-8183 + sessions + x402): https://github.com/bnb-chain/bnbagent-sdk

**8004scan by AltLayer — motor de datos del marketplace** (Pro gratis participantes: **500 req/min, 100k/día**)
- Explorer: https://8004scan.io · **Agentes BSC (chain 56):** https://8004scan.io/agents?chain=56
- Developer Hub & API: https://8004scan.io/developers
- **Pro-Tier Upgrade Form** (sacar la API key Pro): https://forms.gle/jQevEPCAacBXaKG79
- EIP-8004: https://eips.ethereum.org/EIPS/eip-8004

**TermiX** (bounty $6k/$3k/$1k · "marketplace donde agentes contratan agentes")
- App: https://app.termix.ai · **BSC MCP server** (ejecución onchain, open-source): https://github.com/TermiX-official/bsc-mcp

**PancakeSwap** (bounty 1,000 CAKE)
- Developer Portal: https://developer.pancakeswap.finance · Docs: https://docs.pancakeswap.finance

**Altana** (Best Built with Altana, 50k XP · exige tx en el Altana explorer)
- Docs: https://docs.altana.network · SDK + MCP server: https://github.com/altananetwork/altana-sdk
- Sessions: https://docs.altana.network/concepts/sessions · ERC-8183 SDK: https://docs.altana.network/sdk/erc8183
- x402 server SDK: https://docs.altana.network/sdk/x402-server
- **10 skills componibles** en https://skills.altana.network — Aave V3 Lending, Copy Trade, Four.meme
  Trading, Lista Liquid Staking, **PancakeSwap Liquidity**, PancakeSwap Trading, Token Radar, Venus
  Lending, Wallet Tracker, x402 API Payments.

**Onchain / testnet**
- Faucet BSC testnet: https://testnet.bnbchain.org/faucet-smart (o https://www.bnbchain.org/en/testnet-faucet)
- Brand guidelines BNB (para `DESIGN.md`): https://www.bnbchain.org/en/brand-guidelines

**IVL (nuestro activo, repo hermano `third_city`)**
- API pública: `https://api.zvlint.com` — `/v1/ivl`, `/v1/ivl/ticks` (rango v3), `/v1/screener`
- Motor: `third_city/frontend/src/lib/ivl.ts` · Skill + scripts: `third_city/skills/ivl/`
  (`backtest.mjs`, `compare.mjs`, `ivl-lp.mjs` → Agent Advantage Report)
- Señal (opcional): CMC — `https://coinmarketcap.com/api/agent`

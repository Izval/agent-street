# Plan — "The Smart Money Era: Build the Era" (BNB Chain)

> Hackathon #2. Estrategia elegida: **híbrido apalancado**, stack **Remix + Cloudflare**, **solo**.
> Deadline submissions: **9 sep 2026**. Hoy: **10 ago 2026** → **~30 días**.
> Antecedente: en el hack previo (IVL / CMC Skill) quedamos **top-10**.

---

## 0. TL;DR de la tesis

Un solo activo — **IVL** (ya construido: motor TS + Worker público + scripts de backtest) — es
literalmente la categoría **"Rebalancing"** del reto. Lo envolvemos como **agente ERC-8004** y con eso
atacamos **3 superficies de premio a la vez**:

1. **Track principal** ($30k + adopción oficial) → IVL es el **agente insignia** de nuestro marketplace.
2. **Bounty PancakeSwap** (1,000 CAKE) → beneficio LP real, medible.
3. **Bounty TermiX** ($6k/$3k/$1k) → el **Agent Advantage Report** se genera con nuestros scripts de
   backtest/compare que **ya existen**.

Secuencia de-riesgo: **primero aseguramos el agente y los bounties** (valor casi garantizado), y el
marketplace se construye encima como upside por el premio grande.

---

## 1. El reto en una página

- **Nombre:** The Smart Money Era — *Build the Era*.
- **Ventana:** 5 ago → 9 sep 2026 (UTC). Online, global, individual o equipo, 1 entrada.
- **Requisito duro:** los agentes deben estar **vivos en BSC** y **transaccionar onchain** (testnet vale).

### Dos capas atacables

**Capa A — Track principal ($30k + adopción oficial como marketplace canónico de BSC)**
Construir *el marketplace*: descubrir / comparar / **contratar** agentes. Juzgado por:
- **Functionality** — journey end-to-end, mínima fricción para descubrir y activar agentes.
- **Data Quality** — datos reales en tiempo real para decidir a quién contratar.
- **Agent Diversity** — trato igual a 4 categorías: **Rebalancing · Grid Trading · Yield Optimization ·
  Health Factor Monitoring**.
- (Fase 2: criterios adicionales por anunciar.)

**Capa B — Bounties de partners (construir agentes)**

| Partner | Premio | Qué exige |
|---|---|---|
| **TermiX** | $6k / $3k / $1k | *"¿contratar el agente supera hacerlo tú mismo?"* → **Agent Advantage Report**: ≥3 tareas reales medidas (tiempo, costo, calidad), ≥1 de trading/stocks/security. Criterios: Value 30% / Proven Advantage 30% / High-Stakes 20% / Marketplace Quality 20%. |
| **PancakeSwap** | 1,000 CAKE | beneficio real a traders/LPs vía capacidades del agente. |
| **Altana** | 50k XP | wallets independientes con **sesiones** (allowlist, spend caps, expiry), registradas en Keystore, tx onchain vía session keys, control/revocación por el usuario. Bonus: **ERC-8183 SDK** o **x402/B402**. |

---

## 2. Stack técnico del ecosistema (lo que usamos)

- **BNB Agent Studio** — `pip install bnbagent-studio` (CLI + runtime + SDK, **Python**). Describes el
  agente en Claude Code/Cursor, lo despliegas a la nube (AWS); queda con **identidad ERC-8004** +
  **interfaz de tareas ERC-8183**. Pagos vía **x402** (facilitador Binance x402).
- **ERC-8004** — identidad/reputación onchain de agentes (registries), indexada en **8004scan**
  (~44k agentes en BSC).
- **8004scan Developer API** — Pro **gratis** para participantes (500 req/min, 100k/día). → **fuente de
  datos del marketplace**.
- **TermiX BSC MCP server** — enviar BNB/BEP-20, **swaps y liquidez en PancakeSwap**, deploy de
  contratos. → **capa de ejecución onchain del agente**.
- **Altana SDK** — sesiones, ERC-8183, x402, y **skills** listos (Aave V3, Venus, Lista Staking, Copy
  Trade, Token Radar, Wallet Tracker, PancakeSwap Liquidity/Trading).
- **CMC MCP** (ya lo usamos en IVL) — señal para el motor.

---

## 3. Nuestros activos IVL reutilizables (una sola fuente de verdad)

| Activo | Ruta | Rol en este hack |
|---|---|---|
| Motor IVL | `frontend/src/lib/ivl.ts`, `binance.ts` (`computeIvlResponse`) | Cálculo canónico de calidad de rango. |
| **Worker público** | `worker/src/index.ts` → `api.zvlint.com` | **Seam del agente.** `GET /v1/ivl/ticks?pair=…` devuelve score + **`tickLower/tickUpper` listos para Pancake v3**; `GET /v1/screener` = pools rankeados (feed de "qué LPear"). |
| Scripts skill | `skills/ivl/scripts/` — `ivl-lp.mjs`, `backtest.mjs`, `compare.mjs`, `selftest.mjs` | **Maquinaria del Agent Advantage Report** (IVL-guiado vs baseline manual). |
| Infra | Cloudflare (Workers + KV + Pages), patrón de deploy separado | Base del marketplace y del proxy de datos. |

**Consecuencia:** el agente casi no tiene lógica nueva — **lee el rango del API y lo ejecuta onchain**.

---

## 4. Arquitectura de la solución (3 componentes)

```
                        ┌───────────────────────────────────────────┐
                        │  MARKETPLACE  (Remix on Cloudflare Pages)  │  ← Capa A ($30k)
                        │  descubrir · comparar · CONTRATAR (x402)   │
                        │  4 categorías · Data Quality en vivo        │
                        └───────▲───────────────────────▲────────────┘
                                │ (index)               │ (flagship: score IVL en vivo)
              ┌─────────────────┴──────┐        ┌────────┴───────────────┐
              │ CF Worker proxy →      │        │ api.zvlint.com (IVL)   │  (ya existe)
              │ 8004scan Dev API + KV  │        │ /v1/ivl/ticks /screener│
              └─────────────────▲──────┘        └────────▲───────────────┘
                                │ (reputación/perf reales)         │ (rango tickLower/Upper)
                                │                                  │
        ┌───────────────────────┴──────────────────────────────────┴─────────┐
        │  AGENTE IVL "Rebalancer" (ERC-8004 · ERC-8183 · BNB Agent Studio)   │  ← Capa B
        │  poll IVL → decide open/hold/reset → EJECUTA LP en Pancake v3 (BSC   │    (PancakeSwap + TermiX)
        │  testnet) vía TermiX BSC MCP / Altana session keys                  │
        └─────────────────────────────────────────────────────────────────────┘
```

### Componente 1 — Agente IVL "Rebalancer" (ERC-8004)
- Construido con **BNB Agent Studio** (Python, corre en AWS). Identidad ERC-8004 + tareas ERC-8183.
- **Lógica:** poll `api.zvlint.com/v1/ivl/ticks?pair=BNB-USDT` → obtiene `score` + `tickLower/tickUpper`
  → decide **abrir / mantener / resetear** posición → ejecuta en **PancakeSwap v3 (BSC testnet)** vía
  **TermiX BSC MCP** (o skill *PancakeSwap Liquidity* de Altana + session keys).
- Visible en **8004scan** → satisface el requisito onchain **y** alimenta el marketplace.

### Componente 2 — Marketplace (Remix on Cloudflare Pages)
- **Remix** + **Cloudflare Pages/Workers**; datos vía **Worker proxy a 8004scan** (cache en **KV**,
  esquiva CORS/rate-limit).
- **Dos tipos de entidad (tabs):**
  - **Agents** — agentes ERC-8004 contratables (los que ejecutan). Clasificados en las 4 categorías.
  - **Skills** — módulos componibles que un agente *enchufa* (formato `SKILL.md` / skills de Altana).
    Es la capa que el propio blog/framework describe como "skill modules".
- **4 categorías** (para Agents): *Rebalancing* = IVL (propio) · *Grid / Yield / Health Factor* =
  **indexar** agentes ERC-8004 existentes + skills de Altana. **Descubrimos, no construimos** los otros
  3 → cubrimos "Agent Diversity" sin explotar el scope.
- **IVL se lista dos veces** → como **Agent** (Rebalancer ERC-8004) y como **Skill** (`skills/ivl/SKILL.md`
  ya existe). Flagship en ambos tabs; demuestra la historia de **composabilidad** (cualquier agente de
  rebalanceo enchufa el score/rango de IVL — encaja con ERC-8183, delegación de tareas entre agentes).
- **Ficha**: performance + reputación reales de 8004scan (**Data Quality**). Para IVL, diferenciador:
  **score/screener en vivo** desde `api.zvlint.com`.
- **Hire/plug flow** con **x402** (contratar un agente o enchufar una skill con mínima fricción →
  **Functionality**).

### Componente 3 — Agent Advantage Report (TermiX)
- Reusar `skills/ivl/scripts/` (`backtest.mjs`, `compare.mjs`, `ivl-lp.mjs`): **rango IVL-guiado vs
  baseline manual/ingenuo** → fees ganados, IL, tiempo-en-rango, sobre **≥3 tareas** (≥1 de trading).
- Ya tenemos la maquinaria → esto es principalmente **correr + documentar**.

**Reutilizado:** motor IVL, Worker API, scripts backtest, señal CMC, infra Cloudflare.
**Nuevo:** wrapper del agente (Python/Studio), ejecución LP onchain, marketplace Remix, proxy 8004scan,
hire flow x402.

---

## 4.5. Estrategia de listado de agentes (no solo el nuestro)

El marketplace debe listar **muchos** agentes. Dos capas complementarias:

### Capa 1 — Breadth real vía **8004scan Dev API** (motor de listado)
- Fuente escalable: **~44k agentes ERC-8004 en BSC** con **reputación/performance onchain reales** →
  esto es lo que satisface **Data Quality** y "agentes vivos en BSC".
- El proxy Worker consulta 8004scan, cachea en KV, y **clasifica** cada agente en las 4 categorías
  (por skills/tags/actividad). Complementamos huecos de *Yield* y *Health Factor* con **skills de
  Altana** ya existentes (Aave V3, Venus, Lista Staking).

### Capa 2 — **Seed curado: cohorte ganadora del hack anterior** (credibilidad + cobertura)
Tu idea. Sembramos el marketplace con los proyectos **premiados** del *BNB Hack: AI Trading Agents*
(jun 2026, DoraHacks `bnbhack-twt-cmc`). Doble beneficio: (a) garantiza agentes reconocibles en cada
categoría desde el día 1; (b) **narrativa de oro para el jurado** — el marketplace resuelve justo el
problema del blog ("hoy encontrar agentes exige rastrear redes y repos"): *aquí es donde la cohorte
ganadora del hack pasado se vuelve descubrible y contratable*.

**Catálogo semilla (ganadores jun 2026 → mapa a tab + categoría).** Nota fina: los ganadores del track
*Autonomous Trading Agents* van al **tab Agents**; los del track *Strategy Skills* (eran "componentes
que otros agentes enchufan") van al **tab Skills**.

**Tab Agents:**

| Proyecto | Track/premio previo | Categoría |
|---|---|---|
| **IVL** (`@3CTZN`, *nosotros*) | CMC Agent Hub (top-10) | **Rebalancing** (flagship, construido) |
| **Gridora** | Autonomous Trading 3º ($4k) | **Grid Trading** (encaje literal) |
| **Guarded Alpha** | Autonomous Trading 4º ($2k) | **Health Factor Monitoring** (protección) |
| **Neural Alpha** (ClipX) | Autonomous Trading 1º ($10k) | Trading/Monitoring (destacado) |
| **Genesis** | Autonomous Trading 2º ($6k) | Trading/Monitoring |
| **Superagente007** | Autonomous Trading 5º ($2k) | Trading/Monitoring |
| **BNB Mission Control** | Best Trust Wallet Agent Kit ($2k) | Monitoring/Ejecución |
| **SOLVENT** · **Helm** | Best BNB Agent SDK ($1k c/u) | Infra onchain (wallets/pagos) |

**Tab Skills:**

| Skill | Origen | Rol |
|---|---|---|
| **IVL Skill** (*nosotros*) | `skills/ivl/SKILL.md` (ya existe) | Range/rebalance quality — enchufable por cualquier agente LP (flagship) |
| **Narrative Alpha** | Strategy Skills 1º ($3k) | Señal/narrativa |
| **RotorEdge** | Strategy Skills 2º ($2k) | Infra/estrategia modular |
| **Undertow** | Strategy Skills 3º ($1k) | Componente de estrategia |
| Aave V3 · Venus · Lista · PancakeSwap Liquidity · Copy Trade · Token Radar · Wallet Tracker · x402 | Skills de **Altana** | Cobertura de Yield / Health Factor / ejecución |

> **Nota honesta:** varios de estos fueron CMC Skills / agentes Trust Wallet, **no necesariamente
> registrados como ERC-8004**. Para el seed los listamos como **catálogo curado** (metadata + link a su
> BUIDL de DoraHacks); los que además aparezcan en 8004scan se enriquecen con datos onchain. Los que
> cuentan para "agentes vivos en BSC" del judging son los de la **Capa 1** + nuestro agente IVL.
> *Pendiente: recolectar los links BUIDL de cada proyecto desde DoraHacks.*

### Cobertura de las 4 categorías (resumen)
- **Rebalancing** → IVL (propio, construido a fondo). · **Grid** → Gridora + grid-agents de 8004scan.
- **Yield** → skills Altana (Aave/Venus/Lista) + 8004scan. · **Health Factor** → Guarded Alpha + Venus/Aave de 8004scan.

---

## 5. Plan de 30 días (solo · 10 ago → 9 sep)

### Días 1–3 — Setup + **de-risk del requisito onchain** (prioridad #1)
- `pip install bnbagent-studio`; faucet **BSC testnet**; API key **8004scan Pro**; configurar **TermiX MCP**.
- Desplegar un agente **trivial** que haga **UNA tx onchain** en BSC testnet y se registre en 8004scan.
  → requisito duro **asegurado desde el día 3**.

### Semana 1 (días 4–10) — **Agente IVL vivo**
- Wrapper: agente lee `/v1/ivl/ticks` → abre/ajusta una posición **Pancake v3** en testnet.
- Primeras corridas de **baseline** para el Advantage Report.
- **Milestone:** el agente IVL rebalancea onchain de forma autónoma. *(Bounty PancakeSwap ~cubierto.)*

### Semana 2 (días 11–17) — **Marketplace MVP (Remix/CF)**
- Worker proxy a 8004scan + cache KV (Capa 1); home con **4 categorías**; ficha de agente; **IVL
  flagship** con score en vivo.
- **Seed curado** (Capa 2): recolectar links BUIDL de la cohorte ganadora de DoraHacks y cargar el
  catálogo (Gridora, Guarded Alpha, Neural Alpha, …) mapeado a categorías.
- **Milestone:** marketplace público navegable con datos reales + agentes reconocibles en cada categoría.

### Semana 3 (días 18–24) — **Hire flow + Data Quality + Report**
- **x402** hire/activate; métricas y reputación reales en fichas; pulir el journey (Functionality).
- Completar **Agent Advantage Report** (≥3 tareas, ≥1 trading). *(Bounty TermiX ~cubierto.)*

### Semana 4 (días 25–30) — **Pulido + submission**
- Video demo; garantizar que todo esté **público y funcional durante el judging**.
- **Submit a Main + TermiX + PancakeSwap.**
- **Altana bonus** (session keys, spend caps, expiry, revocación) **si sobra tiempo** → 50k XP.

---

## 6. Checklist de entregables por track

- [ ] **Main** — marketplace público funcional · 4 categorías representadas · IVL live en BSC + tx onchain · Data Quality real (8004scan) · hire flow.
- [ ] **TermiX** — Agent Advantage Report: ≥3 tareas medidas, ≥1 trading; IVL-guiado vs manual.
- [ ] **PancakeSwap** — beneficio LP demostrado (fees/IL vs baseline) por el agente IVL.
- [ ] **Altana (opcional)** — sesión con allowlist + spend cap + expiry, en Keystore, tx vía session key, revocación por usuario; bonus x402/ERC-8183.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scope del marketplace (4 categorías) siendo solo | **Indexar** agentes existentes para Grid/Yield/Health; construir a fondo solo *Rebalancing* (IVL). |
| BNB Agent Studio es Python/AWS ≠ Remix/Cloudflare | **Separados**; el seam es HTTP al Worker IVL (patrón que ya usamos). Sin acoplar runtimes. |
| Requisito onchain no trivial | Asegurarlo **día 3** con agente mínimo antes de invertir en features. |
| Madurez de x402 en la ventana del hack | Fallback: "activar" = llamada gratis/testnet; x402 como capa encima si está listo. |
| Solo dev vs equipos por los $30k | **Bounties primero** (valor casi garantizado); main track como upside, no como apuesta única. |

---

## 8. Directorio de build propuesto (crear después)

Repo/carpeta **nueva y separada** (infra Cloudflare/Remix, aparte de `third_city`). Propuesta:

```
<marketplace>/            # nombre por decidir — p.ej. "smart-money-market" / marca Third City
├── app/                  # Remix (Cloudflare Pages)
│   ├── routes/           # home, /category/:id, /agent/:id, /hire
│   └── lib/              # cliente 8004scan, cliente IVL (api.zvlint.com)
├── workers/
│   └── 8004-proxy/       # Worker proxy + KV cache a 8004scan
├── agent-ivl/            # agente BNB Agent Studio (Python) + wrapper de ejecución LP
├── reports/              # Agent Advantage Report (TermiX)
└── README.md
```

*(La investigación y este plan viven en `third_city/docs/hackathon/build-the-era/`. El código nuevo va
en el repo aparte para no mezclar runtimes ni secretos.)*

---

## 9. Ejecución onchain — TermiX vs Altana (BNBAgent SDK)

**No es "uno u otro": son capas distintas.** El agente casi seguro usa el **BNBAgent SDK** de todos
modos (es lo que da identidad ERC-8004 + tareas ERC-8183 y es sobre lo que despliega BNB Agent Studio).
TermiX es *transporte de ejecución* opcional encima.

| | **TermiX BSC MCP** (transporte de ejecución) | **BNBAgent SDK / "Altana"** (identidad + sesiones + x402) |
|---|---|---|
| Qué es | Servidor MCP con tools: transfers, swaps, **PancakeSwap v2/v3 add/remove liquidity**, deploy | Toolkit Python: ERC-8004 (identidad), ERC-8183 (delegación), **session keys, spend caps, Keystore V3, x402** |
| Pros | DX rapidísima (enchufar MCP y llamar tools); purpose-built BSC; **es el tool del propio juez TermiX** → alinea con su bounty; ideal para el de-risk onchain del día 3 | **Substrato obligatorio** (identidad/tareas); **desbloquea el bounty Altana (50k XP) casi gratis** porque sessions/caps/keystore vienen incluidos; **x402 = mismo riel que el hire flow** del marketplace (historia coherente); postura de seguridad "safe agent" (suma en high-stakes/security) |
| Contras | No te da el bounty Altana por sí solo; **incierto si expone add de v3 con `tickLower/tickUpper` explícitos** (hay que verificar); patrón MCP-en-runtime a confirmar | Más setup que llamar una tool MCP; el plumbing de sessions/caps es scope extra (aunque va incluido) |

**Recomendación:**
- **Primario:** BNBAgent SDK (identidad, sesiones, x402) — obligatorio y, de paso, casi regala el bounty Altana.
- **Ejecución LP:** arrancar el de-risk día 3 con **TermiX MCP** (lo más rápido) y en paralelo verificar
  quién soporta el **add de v3 en un rango de ticks concreto** (TermiX vs la skill *PancakeSwap Liquidity*
  del SDK). El que lo soporte bien → camino de ejecución del agente IVL.
- **Altana (50k XP):** como viene incluido en el SDK que igual usamos, **lo perseguimos** (session +
  allowlist + spend cap + expiry + revocación). Bajo costo marginal, premio real.

### ⚠ Validación crítica (días 1–3, antes de invertir en features)
¿TermiX **o** la skill *PancakeSwap Liquidity* del SDK permiten **mintear una posición v3 con
`tickLower/tickUpper` específicos**? Es el núcleo de IVL. Si **ninguno**, fallback = llamada directa al
contrato **NonfungiblePositionManager** (`mint`) vía la capacidad de contract-call del SDK.

## 10. Decisiones

1. ✅ **Nombre/marca:** **Agent-Street** (final: "BNB Agent Street"). Repo en `../agent-street`.
2. ✅ **Identidad visual:** BNB-nativa desde el día 1 → `agent-street/DESIGN.md` (paleta oficial BNB
   Chain #F0B90B/#0B0E11 + sistema de tokens Binance, dark-first). Razón estratégica: menos fricción de
   adopción para el jurado.
3. ✅ Par inicial del agente IVL en testnet: **BNB-USDT** (confirmado 17-ago-2026).
```

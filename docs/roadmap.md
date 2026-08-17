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
1. **Requisito onchain temprano:** `pip install bnbagent-studio`; faucet BSC testnet; API key **8004scan
   Pro**; desplegar un agente mínimo que haga **UNA tx onchain** y se registre en 8004scan. → asegura el
   requisito duro del hackathon el día 3.
2. **¿Se puede mintear una posición PancakeSwap v3 con `tickLower/tickUpper` específicos?** vía TermiX
   MCP **o** la skill *PancakeSwap Liquidity*. Es el núcleo de IVL (el API `/v1/ivl/ticks` ya devuelve el
   rango). **Si ninguno lo soporta → fallback: llamada directa a `NonfungiblePositionManager.mint`** con
   la capacidad de contract-call del SDK. Resolver esto define el camino de ejecución.

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

## 8. Recursos
- IVL API: `https://api.zvlint.com` (`/v1/ivl`, `/v1/ivl/ticks`, `/v1/screener`).
- Motor/scripts IVL: `third_city/frontend/src/lib/ivl.ts`, `third_city/skills/ivl/`.
- 8004scan Dev API (Pro gratis participantes: 500 req/min, 100k/día). TermiX BSC MCP. BNBAgent SDK
  (`bnb-chain/bnbagent-sdk`). BNB Agent Studio (`pip install bnbagent-studio`).

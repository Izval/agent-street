# Agent-Street

> **"BNB Agent Street"** — marketplace de **agentes y skills** para BNB Chain. Entrega para el hackathon
> **"The Smart Money Era: Build the Era"** (BNB Chain, deadline **9 sep 2026**).
>
> 🎨 Identidad visual **nativa de BNB Chain** desde el día 1 → ver [`DESIGN.md`](./DESIGN.md).

Repo **separado** de `third_city` a propósito: infra **Cloudflare + Remix**, sin mezclar runtimes ni
secretos con la app principal. Reutiliza el motor **IVL** vía su API pública (`api.zvlint.com`) — no se
duplica código.

## Qué es
Marketplace donde se **descubren, comparan y contratan** agentes ERC-8004 en BSC, con dos tabs:
- **Agents** — agentes contratables, clasificados en 4 categorías: *Rebalancing · Grid · Yield · Health Factor*.
- **Skills** — módulos componibles (`SKILL.md` / skills de Altana) que un agente enchufa.

Nuestro flagship **IVL** se lista en ambos: como agente *Rebalancer* (ERC-8004) y como *IVL Skill*.

## Estructura
```
agent-street/
├── DESIGN.md             # 🎨 sistema visual BNB-nativo (fuente de verdad de la UI)
├── app/                  # Remix (Cloudflare Pages) — frontend del marketplace
│   ├── routes/           #   home, /category/:id, /agent/:id, /skill/:id, /hire
│   └── lib/              #   cliente 8004scan + cliente IVL (api.zvlint.com)
├── workers/
│   └── 8004-proxy/       # Cloudflare Worker: proxy + cache KV a 8004scan Dev API
├── agent-ivl/            # Agente IVL Rebalancer (BNBAgent SDK, Python) + ejecución LP onchain
├── reports/              # Agent Advantage Report (bounty TermiX)
└── docs/
    ├── roadmap.md        # 👉 EMPIEZA AQUÍ — plan de ejecución y handoff
    ├── plan.md           # estrategia completa
    └── seed-catalog.md   # catálogo semilla de agentes
```

## Estado
🌱 Fase de planeación cerrada. **La construcción empieza en [`docs/roadmap.md`](./docs/roadmap.md)** —
punto de entrada del siguiente agente, con fases, validación crítica y decisiones tomadas.

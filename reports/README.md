# reports — Agent Advantage Report (bounty TermiX)

Evidencia medible de que **contratar** al agente *IVL Rebalancer* del marketplace gestiona la
liquidez concentrada mejor que hacerlo uno mismo. Es el entregable del **bounty TermiX**
("Agent Advantage Report": ≥3 tareas medidas, ≥1 de trading — ver `docs/roadmap.md` Fase 3).

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `generate.mjs` | Runner Node puro (sin deps). Invoca los scripts del motor IVL, captura su `--json` real y compone el reporte. |
| `agent-advantage-report.md` | El reporte generado (tablas + veredicto). **Regenerable.** |
| `metrics/*.json` | Métricas crudas por tarea, tal cual las emite cada script (reproducibles). |

## Separación de IP (regla dura, CLAUDE.md §2)

El **motor IVL es activo separado** (`third_city` / `api.zvlint.com`) y **no se copia** a
Agent-Street. Este runner solo **invoca** los scripts de IVL por path — no vendoriza su código.
Agent-Street se puede entregar sin arrastrar el motor IVL; el reporte es una evidencia externa.

## Regenerar

```bash
# Requiere el repo hermano third_city junto a agent-street (layout por defecto):
#   ../third_city/skills/ivl/scripts/{compare,backtest}.mjs
node reports/generate.mjs

# O con un path explícito a los scripts IVL:
IVL_SCRIPTS_DIR=/ruta/a/third_city/skills/ivl/scripts node reports/generate.mjs
```

Sin deps npm: los scripts hacen fetch puro a klines de **Binance en vivo**, así que el reporte
refleja mercado real al momento de generarlo. Sale `exit 0` solo si se cumple ≥3 tareas / ≥1 trading.

## Tareas medidas

1. **`compare` AAVE/WBNB (trading/rentabilidad)** — IVL vs naive vs random con el mismo capital:
   `net = Σ(fees − IL) − coste·rebalanceos`. Es la evidencia directa "contratar > DIY".
2–4. **`backtest`** BNB/USDT, CAKE/WBNB, ETH/USDT — rango IVL (μ±2σ) vs rango naive ancho:
   time-in-range, tasa de breakout y fee-efficiency (fees/ancho).

Para añadir pares/tareas, edita el array `TASKS` en `generate.mjs`.

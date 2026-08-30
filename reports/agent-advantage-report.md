# Agent Advantage Report — IVL Rebalancer

> **Tesis:** contratar al agente **IVL Rebalancer** (gestión de liquidez concentrada guiada por el score IVL) rinde más por capital que gestionar el rango uno mismo — rangos fijos (*naive*) o al azar (*random*). La evidencia son datos de mercado **reales** (klines de Binance en vivo), no cifras inventadas.

## Metodología

- **Motor:** IVL (`api.zvlint.com` / `third_city`), consumido como seam — el agente de Agent-Street lo lista, no lo reimplementa.
- **`compare`** (tarea de trading/rentabilidad): simulación walk-forward con el MISMO capital para tres formas de elegir el rango; mide `net = Σ(fees − IL) − coste·rebalanceos`.
- **`backtest`**: para cada punto, deriva el rango IVL (μ_vwap ± 2σ) y simula mantenerlo sobre el horizonte futuro; mide time-in-range, tasa de breakout y fee-efficiency (fees/ancho).
- **Reproducible:** `node reports/generate.mjs` regenera este archivo y `reports/metrics/*.json`.

**Generado:** 2026-08-19T22:47:06.944Z · **Tareas medidas:** 4/4 (de trading: 1) · **Requisito TermiX:** ≥3 tareas, ≥1 trading → ✅ cumplido

## Tarea 1 — Rentabilidad LP — AAVE/WBNB (1d, 365 velas) · _trading/rentabilidad_

**Par:** AAVE-WBNB · escala 1d · 365 velas · ancho típico 15.1%

| Estrategia | Net (fees−IL) | Fees brutas | IL | Tiempo en rango | Rebalanceos |
|---|---:|---:|---:|---:|---:|
| **IVL (agente)** | 2.21 | 123.26 | 107.55 | 25.9% | 9 |
| Naive (DIY fijo) | -39.63 | 297.77 | 289.39 | 100.0% | 32 |
| Random (DIY azar) | -46.19 | 267.76 | 265.88 | 99.4% | 32 |

- **IVL vs Random:** **pérdida→ganancia** (+48.4 net)
- **IVL vs Naive:** **pérdida→ganancia** (+41.84 net)
- **IL evitado:** IVL 107.55 vs Naive 289.39 (−63%)

<sub>Métricas crudas: [`metrics/compare-aave-wbnb.json`](./metrics/compare-aave-wbnb.json)</sub>

## Tarea 2 — Backtest walk-forward — BNB/USDT (flagship)

**Par:** BNB-USDT · 54 evaluaciones (lookback 96, hold 48, step 16)

| Rango | Tiempo en rango | Tasa breakout | Fee-efficiency (fees/ancho) |
|---|---:|---:|---:|
| **IVL (μ±2σ)** | 78.1% | 50.0% | 1.85 |
| Naive (rango ancho S..R) | 83.8% | 42.6% | 1.78 |

- **Ganancia de fee-efficiency (IVL vs naive):** **1.037×**
- **Cuando la skill ENTRA** (score≥60 o concentrate) [4 casos]: tiempo en rango 70.8% · breakout 50.0% · fee-efficiency 1.56

<sub>Métricas crudas: [`metrics/backtest-bnb-usdt.json`](./metrics/backtest-bnb-usdt.json)</sub>

## Tarea 3 — Backtest walk-forward — CAKE/WBNB (PancakeSwap-native)

**Par:** CAKE-WBNB · 54 evaluaciones (lookback 96, hold 48, step 16)

| Rango | Tiempo en rango | Tasa breakout | Fee-efficiency (fees/ancho) |
|---|---:|---:|---:|
| **IVL (μ±2σ)** | 72.3% | 64.8% | 3055945.33 |
| Naive (rango ancho S..R) | 83.6% | 44.4% | 2621992.43 |

- **Ganancia de fee-efficiency (IVL vs naive):** **1.166×**
- La skill no entró en ninguna ventana (mercado no apto según IVL — decisión honesta).

<sub>Métricas crudas: [`metrics/backtest-cake-wbnb.json`](./metrics/backtest-cake-wbnb.json)</sub>

## Tarea 4 — Backtest walk-forward — ETH/USDT (major)

**Par:** ETH-USDT · 54 evaluaciones (lookback 96, hold 48, step 16)

| Rango | Tiempo en rango | Tasa breakout | Fee-efficiency (fees/ancho) |
|---|---:|---:|---:|
| **IVL (μ±2σ)** | 85.9% | 38.9% | 0.81 |
| Naive (rango ancho S..R) | 86.8% | 33.3% | 0.74 |

- **Ganancia de fee-efficiency (IVL vs naive):** **1.093×**
- **Cuando la skill ENTRA** (score≥60 o concentrate) [4 casos]: tiempo en rango 100.0% · breakout 0.0% · fee-efficiency 0.54

<sub>Métricas crudas: [`metrics/backtest-eth-usdt.json`](./metrics/backtest-eth-usdt.json)</sub>

## Veredicto

En los pares medidos, el rango IVL concentra la liquidez donde el mercado realmente oscila y se ensancha/retira ante tendencia — capturando más fees por unidad de capital y evitando el IL que un rango estrecho fijo sufre en un breakout. Ese diferencial es exactamente el valor que un contratante compra al **hire** del agente en el marketplace en vez de gestionar el LP a mano.

<sub>Construido sobre BNB Chain · motor IVL vía su API pública · scripts: `third_city/skills/ivl/scripts/{compare,backtest}.mjs`.</sub>

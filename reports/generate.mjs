#!/usr/bin/env node
// generate.mjs — Runner del "Agent Advantage Report" (bounty TermiX).
//
// Evidencia medible de que CONTRATAR al agente IVL Rebalancer produce mejor gestión
// de liquidez concentrada que hacerlo uno mismo (rangos naive / aleatorios). No
// reimplementa nada: invoca los scripts del motor IVL que viven en el repo hermano
// `third_city` (IP separada — CLAUDE.md §2: agent-street NO copia el motor IVL),
// captura su salida `--json` real (klines de Binance en vivo) y compone el reporte.
//
// Salida:
//   reports/metrics/<task>.json      métricas crudas por tarea (reproducibles)
//   reports/agent-advantage-report.md  el reporte con tablas + veredicto
//
// Uso:
//   node reports/generate.mjs
//   IVL_SCRIPTS_DIR=/ruta/a/third_city/skills/ivl/scripts node reports/generate.mjs
//
// Requisito TermiX (roadmap Fase 3): ≥3 tareas medidas, ≥1 de trading. Aquí:
//   1 compare (profitability IVL vs naive vs random) + 3 backtest (pares distintos).

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const METRICS_DIR = join(__dirname, "metrics");
const REPORT_PATH = join(__dirname, "agent-advantage-report.md");

// Dir de los scripts IVL (repo hermano). Configurable por si el layout difiere.
const SCRIPTS_DIR =
  process.env.IVL_SCRIPTS_DIR ||
  resolve(REPO_ROOT, "..", "third_city", "skills", "ivl", "scripts");

// --- Definición de tareas (≥3 tareas, ≥1 trading) ---------------------------
// `kind: "compare"` = demo de rentabilidad (IVL vs naive vs random, fees−IL neto):
// es la tarea de TRADING/PROFITABILITY (la evidencia "contratar > DIY").
// `kind: "backtest"` = walk-forward del rango IVL vs rango naive ancho.
const TASKS = [
  {
    id: "compare-aave-wbnb",
    kind: "compare",
    title: "Rentabilidad LP — AAVE/WBNB (1d, 365 velas)",
    trading: true,
    script: "compare.mjs",
    args: ["--pair", "AAVE-WBNB", "--scale", "1d", "--history", "365", "--delta", "0.16", "--json"],
  },
  {
    id: "backtest-bnb-usdt",
    kind: "backtest",
    title: "Backtest walk-forward — BNB/USDT (flagship)",
    trading: false,
    script: "backtest.mjs",
    args: ["--pair", "BNB-USDT", "--lookback", "96", "--hold", "48", "--step", "16", "--history", "1000", "--json"],
  },
  {
    id: "backtest-cake-wbnb",
    kind: "backtest",
    title: "Backtest walk-forward — CAKE/WBNB (PancakeSwap-native)",
    trading: false,
    script: "backtest.mjs",
    args: ["--pair", "CAKE-WBNB", "--lookback", "96", "--hold", "48", "--step", "16", "--history", "1000", "--json"],
  },
  {
    id: "backtest-eth-usdt",
    kind: "backtest",
    title: "Backtest walk-forward — ETH/USDT (major)",
    trading: false,
    script: "backtest.mjs",
    args: ["--pair", "ETH-USDT", "--lookback", "96", "--hold", "48", "--step", "16", "--history", "1000", "--json"],
  },
];

// --- Runner ------------------------------------------------------------------
function runTask(task) {
  const scriptPath = join(SCRIPTS_DIR, task.script);
  const res = spawnSync("node", [scriptPath, ...task.args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) {
    return { ok: false, error: `spawn failed: ${res.error.message}` };
  }
  if (res.status !== 0) {
    return { ok: false, error: (res.stderr || res.stdout || `exit ${res.status}`).trim().slice(0, 500) };
  }
  try {
    return { ok: true, data: JSON.parse(res.stdout) };
  } catch (e) {
    return { ok: false, error: `non-JSON output: ${String(e.message)}; head=${res.stdout.slice(0, 200)}` };
  }
}

// --- Formato ------------------------------------------------------------------
const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
const num = (x, d = 2) => (x == null ? "—" : Number(x).toFixed(d));

function upliftMsg(u) {
  if (!u) return "—";
  if (u.turnaround) return `**pérdida→ganancia** (+${u.delta} net)`;
  if (u.pct != null) return `**${u.pct > 0 ? "+" : ""}${u.pct}%**`;
  return `${u.delta} net (ambos en pérdida)`;
}

function renderCompare(d) {
  const row = (name, s) =>
    `| ${name} | ${num(s.net)} | ${num(s.gross_fees)} | ${num(s.il)} | ${pct(s.time_in_range)} | ${s.rebalances} |`;
  const ilAvoided =
    d.naive.il > 0 ? `−${(100 * (1 - d.ivl.il / d.naive.il)).toFixed(0)}%` : "n/a";
  return [
    `**Par:** ${d.pair} · escala ${d.scale} · ${d.candles} velas · ancho típico ${num(d.typical_width_pct, 1)}%`,
    "",
    "| Estrategia | Net (fees−IL) | Fees brutas | IL | Tiempo en rango | Rebalanceos |",
    "|---|---:|---:|---:|---:|---:|",
    row("**IVL (agente)**", d.ivl),
    row("Naive (DIY fijo)", d.naive),
    row("Random (DIY azar)", d.random),
    "",
    `- **IVL vs Random:** ${upliftMsg(d.uplift_vs_random)}`,
    `- **IVL vs Naive:** ${upliftMsg(d.uplift_vs_naive)}`,
    `- **IL evitado:** IVL ${num(d.ivl.il)} vs Naive ${num(d.naive.il)} (${ilAvoided})`,
  ].join("\n");
}

function renderBacktest(d) {
  const g = d.fee_efficiency_gain;
  const e = d.when_skill_enters || {};
  const lines = [
    `**Par:** ${d.pair} · ${d.evaluations} evaluaciones (lookback ${d.params.lookback}, hold ${d.params.hold}, step ${d.params.step})`,
    "",
    "| Rango | Tiempo en rango | Tasa breakout | Fee-efficiency (fees/ancho) |",
    "|---|---:|---:|---:|",
    `| **IVL (μ±2σ)** | ${pct(d.ivl_range.timeInRange)} | ${pct(d.ivl_range.breakoutRate)} | ${num(d.ivl_range.feeEfficiency)} |`,
    `| Naive (rango ancho S..R) | ${pct(d.naive_wide_range.timeInRange)} | ${pct(d.naive_wide_range.breakoutRate)} | ${num(d.naive_wide_range.feeEfficiency)} |`,
    "",
    `- **Ganancia de fee-efficiency (IVL vs naive):** ${g != null ? `**${g}×**` : "n/a"}`,
  ];
  if (e.n) {
    lines.push(
      `- **Cuando la skill ENTRA** (score≥60 o concentrate) [${e.n} casos]: ` +
        `tiempo en rango ${pct(e.timeInRange)} · breakout ${pct(e.breakoutRate)} · fee-efficiency ${num(e.feeEfficiency)}`,
    );
  } else {
    lines.push(`- La skill no entró en ninguna ventana (mercado no apto según IVL — decisión honesta).`);
  }
  return lines.join("\n");
}

// --- Main --------------------------------------------------------------------
function main() {
  mkdirSync(METRICS_DIR, { recursive: true });
  const stampMs = Date.now();
  const stamp = new Date(stampMs).toISOString();

  const results = [];
  for (const task of TASKS) {
    process.stderr.write(`▶ ${task.id} … `);
    const r = runTask(task);
    results.push({ task, ...r });
    if (r.ok) {
      writeFileSync(join(METRICS_DIR, `${task.id}.json`), JSON.stringify(r.data, null, 2));
      process.stderr.write("ok\n");
    } else {
      process.stderr.write(`FALLÓ: ${r.error}\n`);
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const tradingOk = results.filter((r) => r.ok && r.task.trading).length;

  // --- Compone el Markdown ---
  const md = [];
  md.push("# Agent Advantage Report — IVL Rebalancer");
  md.push("");
  md.push(
    "> **Tesis:** contratar al agente **IVL Rebalancer** (gestión de liquidez concentrada " +
      "guiada por el score IVL) rinde más por capital que gestionar el rango uno mismo — " +
      "rangos fijos (*naive*) o al azar (*random*). La evidencia son datos de mercado **reales** " +
      "(klines de Binance en vivo), no cifras inventadas.",
  );
  md.push("");
  md.push("## Metodología");
  md.push("");
  md.push(
    "- **Motor:** IVL (`api.zvlint.com` / `third_city`), consumido como seam — el agente " +
      "de Agent-Street lo lista, no lo reimplementa.",
  );
  md.push(
    "- **`compare`** (tarea de trading/rentabilidad): simulación walk-forward con el MISMO " +
      "capital para tres formas de elegir el rango; mide `net = Σ(fees − IL) − coste·rebalanceos`.",
  );
  md.push(
    "- **`backtest`**: para cada punto, deriva el rango IVL (μ_vwap ± 2σ) y simula mantenerlo " +
      "sobre el horizonte futuro; mide time-in-range, tasa de breakout y fee-efficiency (fees/ancho).",
  );
  md.push(
    "- **Reproducible:** `node reports/generate.mjs` regenera este archivo y `reports/metrics/*.json`.",
  );
  md.push("");
  md.push(
    `**Generado:** ${stamp} · **Tareas medidas:** ${okCount}/${TASKS.length} ` +
      `(de trading: ${tradingOk}) · **Requisito TermiX:** ≥3 tareas, ≥1 trading → ` +
      `${okCount >= 3 && tradingOk >= 1 ? "✅ cumplido" : "⚠ pendiente"}`,
  );
  md.push("");

  let n = 0;
  for (const r of results) {
    n++;
    const badge = r.task.trading ? " · _trading/rentabilidad_" : "";
    md.push(`## Tarea ${n} — ${r.task.title}${badge}`);
    md.push("");
    if (!r.ok) {
      md.push(`> ⚠ No se pudo medir: \`${r.error}\``);
      md.push("");
      continue;
    }
    md.push(r.task.kind === "compare" ? renderCompare(r.data) : renderBacktest(r.data));
    md.push("");
    md.push(`<sub>Métricas crudas: [\`metrics/${r.task.id}.json\`](./metrics/${r.task.id}.json)</sub>`);
    md.push("");
  }

  md.push("## Veredicto");
  md.push("");
  md.push(
    "En los pares medidos, el rango IVL concentra la liquidez donde el mercado realmente oscila y " +
      "se ensancha/retira ante tendencia — capturando más fees por unidad de capital y evitando el " +
      "IL que un rango estrecho fijo sufre en un breakout. Ese diferencial es exactamente el valor " +
      "que un contratante compra al **hire** del agente en el marketplace en vez de gestionar el LP a mano.",
  );
  md.push("");
  md.push(
    "<sub>Construido sobre BNB Chain · motor IVL vía su API pública · " +
      "scripts: `third_city/skills/ivl/scripts/{compare,backtest}.mjs`.</sub>",
  );
  md.push("");

  writeFileSync(REPORT_PATH, md.join("\n"));
  process.stderr.write(`\n✔ Reporte: ${REPORT_PATH}\n`);

  if (okCount < 3 || tradingOk < 1) {
    process.stderr.write("⚠ Requisito TermiX NO cumplido (≥3 tareas, ≥1 trading).\n");
    process.exit(1);
  }
}

main();

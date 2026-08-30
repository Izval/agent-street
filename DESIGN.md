# DESIGN.md — Agent-Street

> Sistema de identidad visual para **Agent-Street** ("BNB Agent Street"), el marketplace de agentes y
> skills para BNB Chain. Formato inspirado en [design.md](https://github.com/google-labs-code/design.md):
> este archivo es la **fuente de verdad** que cualquier agente de código debe seguir al construir UI.
>
> **Por qué importa (estrategia de hackathon):** el premio es la *adopción oficial* como marketplace de
> BNB Agent Studio. Si el producto ya se ve **nativo de BNB Chain** desde el día 1, el jurado no ve
> trabajo de rebranding pendiente → menos fricción para adoptarlo. **On-brand = ventaja competitiva.**

---

## 1. Esencia de marca

- **Dark-first.** Fondo casi negro, un único acento amarillo, todo lo demás es dato (verde sube / rojo
  baja). Urgencia de trading-floor con claridad operativa.
- **El amarillo es sagrado y escaso.** `#F0B90B` solo para: CTA primario, estado activo, acento de marca.
  Nunca como fondo de bloques grandes ni decorativo.
- **Los números mandan.** Numerales tabulares, alineación vertical perfecta en precios/APR/scores.
- **Sombra susurrada.** Elevación por color de superficie, no por sombras marcadas (≤5% opacidad).

**Referencias oficiales:** [BNB Chain Brand Guidelines](https://www.bnbchain.org/en/brand-guidelines) ·
paleta oficial: Yellow `#F0B90B` (Pantone 116C), Black `#0B0E11`, White `#FFFFFF`.

---

## 2. Color

Definir SIEMPRE como variables CSS. **Dark es el tema canónico**; light es secundario. Cada color se
define primero en `:root` (light) y se re-mapea en el bloque dark.

### 2.1 Tokens semánticos (dark — canónico)

| Token | Hex | Uso |
|---|---|---|
| `--brand` | `#F0B90B` | Acento de marca, CTA primario, estado activo (BNB Chain oficial) |
| `--brand-bright` | `#FCD535` | Hover del CTA, brillo, gradiente |
| `--brand-active` | `#D0980B` | Pressed |
| `--bg` | `#0B0E11` | Fondo base de la app (BNB Chain black oficial) |
| `--surface` | `#181A20` | Cards, paneles |
| `--surface-2` | `#1E2329` | Inputs, superficie elevada, filas hover |
| `--border` | `#2B3139` | Bordes, líneas divisorias |
| `--text` | `#EAECEF` | Texto primario |
| `--text-2` | `#B7BDC6` | Texto secundario, navegación |
| `--text-3` | `#848E9C` | Terciario, metadata, timestamps, iconos |
| `--text-disabled` | `#5E6673` | Deshabilitado |
| `--up` | `#0ECB81` | Positivo: precio ↑, éxito, APR bueno, score alto |
| `--down` | `#F6465D` | Negativo: precio ↓, error, liquidación, riesgo |
| `--focus` | `#1EAEDB` | Foco/accesibilidad (único azul del sistema) |

### 2.2 Tokens (light — secundario)

| Token | Hex |
|---|---|
| `--bg` | `#FFFFFF` |
| `--surface` | `#FAFAFA` |
| `--surface-2` | `#F5F5F5` |
| `--border` | `#E6E8EA` |
| `--text` | `#1E2026` |
| `--text-2` | `#474D57` |
| `--text-3` | `#848E9C` |
| `--brand`/`--up`/`--down`/`--focus` | iguales que en dark |

### 2.3 Reglas de color
- **Verde/rojo son solo para datos.** Nunca verde=marca. `--up`/`--down` jamás decorativos.
- El amarillo sobre negro debe llevar texto **`--bg` (#0B0E11)**, nunca blanco (contraste + marca).
- Gradiente de marca permitido y escaso: `radial-gradient(#F0B90B, #FCD535)` para hero/insignia destacada.

---

## 3. Tipografía

**Font stack:** `BinancePlex` es propietaria (no redistribuible) → usar **IBM Plex Sans** (open source,
base de BinancePlex) self-hosted como principal, con fallback de sistema.

```css
--font-sans: "IBM Plex Sans", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace; /* datos/hashes/addresses */
font-variant-numeric: tabular-nums; /* SIEMPRE en precios, APR, scores, PnL */
```

### Escala

| Rol | Size / Line | Weight |
|---|---|---|
| Display hero | 60 / 1.08 | 700 |
| H1 | 34 / 1.1 | 700 |
| H2 | 24 / 1.2 | 700 |
| H3 | 20 / 1.25 | 600 |
| Body L | 18 / 1.5 | 500 |
| Body | 16 / 1.5 | 500 |
| Body strong | 16 / 1.5 | 600 |
| Button | 16 / 1.25 | 600 (letter-spacing .16px) |
| Caption | 14 / 1.43 | 500 |
| Badge/Tag | 12 / 1.0 | 600 |

---

## 4. Espaciado, radio, elevación, motion

**Espaciado** — base 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 80`. Container máx **1200px**,
padding horizontal 32 (desktop) / 16 (móvil), grid-gap 24.

**Radio** — `--r-sm: 4px` (tags, inputs pequeños) · `--r: 8px` (default: botones, inputs, data cards) ·
`--r-lg: 12px` (content cards) · `--r-pill: 999px` (pills/CTA redondeados, chips de categoría).

**Sombras (susurradas)** — resting `0 1px 2px rgba(0,0,0,.24)`; hover `0 4px 12px rgba(0,0,0,.32)`;
modal `0 16px 40px rgba(0,0,0,.5)`. En light bajar opacidad a ~5%.

**Motion** — transiciones 150–200ms `ease`; solo `opacity`, `transform`, `background`, `box-shadow`,
`border-color`. Respetar `prefers-reduced-motion`.

---

## 5. Componentes

**Botón primario:** bg `--brand`, texto `--bg` (#0B0E11) 16/600, padding `10px 24px`, radio `--r`,
hover `--brand-bright`, active `--brand-active`, disabled bg `--surface-2` texto `--text-disabled`.

**Botón secundario:** bg transparente, borde `1px --border`, texto `--text`; hover borde `--brand`.

**Card (agente/skill):** bg `--surface`, borde `1px --border`, radio `--r-lg`, padding 16–24; hover:
borde `--brand` + sombra hover. Header con logo/avatar del agente, título `H3`, tags de categoría (pill
12/600 sobre `--surface-2`), y fila de métricas con `tabular-nums` (score, APR, win-rate, PnL con
`--up`/`--down`).

**Tabs (Agents / Skills):** underline `2px --brand` en el activo; inactivo `--text-2`.

**Chips de categoría:** Rebalancing · Grid · Yield · Health Factor — pill `--r-pill`, `--surface-2`,
texto `--text-2`; activo texto `--bg` sobre `--brand`.

**Input / buscador:** bg `--surface-2`, borde `1px --border`→`--brand` en focus, radio `--r`,
placeholder `--text-3`.

**Nav (sticky, ~64px):** bg `--bg` con borde inferior `--border`; logo BNB (marca amarilla) izquierda;
CTA pill amarillo derecha. Respetar reglas de logo (§7).

**Badges de estado:** `● Live` verde `--up`, `Testnet` `--text-3`, `Risk/Liquidation` `--down`.

---

## 6. Patrones específicos del producto

- **Grid del marketplace:** 3 col (desktop) → 2 (768px) → 1 (600px), gap 24.
- **Data Quality visible:** cada agente muestra datos reales de 8004scan (reputación, tx, PnL) con
  numerales tabulares — es criterio de juzgado, hazlo protagonista visual.
- **IVL como listing normal:** aparece en tab Agents (Rebalancing) y tab Skills como cualquier otro
  listing — **sin insignia ni gradiente especial**. El código no lo trata distinto; se destaca solo por
  mérito (score/demanda), nunca hardcodeado.
- **Score meter:** medidor 0–100 (`scoreTone`, `app/app/lib/score.ts`); ≥70 `--up`, 40–69 `--brand`,
  <40 `--down`. Nunca inventar la escala de color fuera de estos cortes.

---

## 7. Uso del logo BNB (obligatorio)

- **No modificar** el logo (sin outline, sombras, gradientes, ni deformar). Usar variante amarilla como
  primaria; mono solo si el contraste lo exige.
- **Clear space** = altura del logomark en cada lado. Tamaños mín: logomark 15px, lockup horizontal 97px,
  vertical 70px.
- Usar lenguaje **"Built on BNB Chain" / "Powered by"** — no implicar endorsement. Requiere aprobación
  para uso oficial (relevante si ganamos la adopción).

---

## 8. Accesibilidad
- Contraste AA mínimo; el par crítico `--brand` sobre `--bg` va con texto oscuro.
- No comunicar solo con color: verde/rojo acompañados de signo (+/−), flecha o etiqueta.
- Touch targets ≥ 44×44px. Foco visible con `--focus`.

## 9. Do / Don't
- ✅ Amarillo escaso y con propósito · superficies para jerarquía · numerales tabulares en datos.
- ❌ Amarillo como fondo de secciones · verde/rojo decorativos · sombras pesadas · degradados chillones ·
  blanco sobre amarillo · modificar el logo BNB.

## 10. Implementación (Remix + Cloudflare)
- Tokens como CSS variables en `app/root` (`:root` light + `:root[data-theme="dark"]` / media query).
  Dark es el default del producto.
- IBM Plex Sans/Mono self-hosted en `app/` (woff2), no CDN.
- Tailwind opcional: mapear estos tokens a `theme.extend.colors` (`brand`, `bg`, `surface`, `up`, `down`…)
  para no hardcodear hex en componentes.

---

# DESIGN.md v2 — Marketplace "App Store" (extiende v1, no lo reemplaza)

> v1 (§1–§10) sigue vigente: paleta, tipografía, amarillo sagrado y escaso, verde/rojo solo datos,
> numerales tabulares, reglas de logo. v2 añade el **layout tipo App Store**, glassmorfismo sutil,
> acentos por aisle, tokens de charts y las **plantillas por categoría**. Tokens en `app/app/app.css`.

## 11. Layout — shell de dos columnas
- **AppShell** en todas las páginas: **sidebar fijo** (~260px desktop) + **contenido** (máx 1200px).
  Móvil: el sidebar colapsa a un drawer (botón hamburguesa en un top-bar delgado).
- **Sidebar** (`.glass` opcional sobre `--bg`): logo BNB arriba; buscador; sección **Discover**;
  lista de **aisles** (Trading · DeFi · NFT · RWA · Infra · Payments · Social) con su `glyph` y, al
  activo, texto `--text` + barra `--brand` a la izquierda (amarillo escaso = estado activo); separador;
  bloque **"Categorías obligatorias"** con las 4 ★ (Rebalancing · Grid · Yield · Health) siempre visibles.
- **Contenido**: hero/banner arriba, luego bloques grandes y colecciones. Grid del marketplace igual
  que v1 (3→2→1 col, gap 24) pero con **toggle grid/list**.

## 12. Hero / video banner (bloque grande)
- Slot de **video** self-hosted (mp4/webm, loop, muted, `playsinline`, `poster`), radio `--r-lg`,
  overlay de texto legible (gradiente inferior). Respetar `prefers-reduced-motion` (pausar).
- **Fallback sin asset**: clase `.hero-anim` (gradiente marca en deriva lenta) + título editorial.
  Nunca dejar el bloque vacío. El amarillo aparece solo como glow sutil (`--hero-glow`), no como fondo.
- Copy editorial en **sentence case**, activo y concreto (skill de escritura): nombra lo que el usuario
  hace ("Descubre agentes que rebalancean tu LP"), no jerga de sistema.

## 13. Glassmorfismo (sutil, controlado)
- Tokens: `--glass-bg`, `--glass-border`, `--glass-blur`; utilidad `.glass`. **Solo** en bloques grandes,
  hero, sidebar flotante y overlays — nunca en cards de datos densas (romperían la legibilidad numérica).
- Reconcilia la "sombra susurrada" de v1: el glass es **additivo y escaso**; la elevación sigue siendo
  por color de superficie. No apilar glass sobre glass. Verificar contraste AA del texto sobre glass.

## 14. Acentos por aisle (sutiles, no compiten con el amarillo)
- `--accent-{trading,defi,nft,rwa,infra,payments,social}` (definidos en `app.css`). Uso permitido:
  glyph del sidebar, subrayado/borde de encabezado de sección, punto de categoría. **Prohibido** como
  fondo de bloques o como sustituto del amarillo de marca. El amarillo mantiene su monopolio en CTA/activo.

## 15. Charts (SVG puro, sin deps) — reglas dataviz
- **Forma según el trabajo del dato**; el color va al final. Paleta categórica en `--series-1..8`
  (validada con el script del skill dataviz: pasa banda de luminosidad, CVD y contraste sobre el surface
  oscuro) + `--series-neutral` para "Cash/otros".
- **Reservado**: `--up`/`--down` son **polaridad/estado**, nunca un "series 4". PnL, cambios y flechas
  usan up/down; identidad categórica (slices de allocation, barras de protocolo) usa `--series-*` en
  **orden fijo** (nunca cíclico; el 9º elemento va a "Otros").
- **Marks**: líneas 2px, extremos redondeados 4px anclados a la baseline, gap de 2px entre rellenos,
  markers ≥8px; grid/ejes recesivos (`--border`/`--text-3`). Leyenda presente con ≥2 series; etiqueta
  directa selectiva (no un número en cada punto). Texto de datos con tokens de texto, no con el color de
  la serie. Un subconjunto de la paleta se **re-valida** en su página antes de shippear (WS2.2).
- Componentes: `AreaChart`/`Sparkline` (equity), `Donut` (allocation), `Gauge` (health factor),
  `BarCompare` (APY). Todos con hover/tooltip por defecto y estado de tabla accesible.

## 16. Plantillas por categoría (`categoryTemplate()` en `lib/taxonomy.ts`)
Cada tipo de plantilla fija los KPIs/charts/acento de la **card** y del **detalle**, para que Trading no
se vea igual que Yield. Mapeo `TemplateKind` → contenido:
| Template | KPIs primarios | Chart(s) | Acento |
|---|---|---|---|
| `trading` (Grid★, DCA, Momentum…) | Win rate · PnL · Volumen · #trades | Equity area + trades | trading |
| `clmm` (Rebalancing★) | Score · Reviews · Portfolio · Rango (live desde el endpoint) | ScoreMeter | defi |
| `yield` (Yield★, Lending, LST) | APY · TVL · Protocolo | BarCompare | defi |
| `health` (Health★) | Health factor · Dist. liquidación · Colateral | Gauge | defi |
| `nft` | Floor · Volumen · Holdings | Sparkline floor | nft |
| `rwa` | Tipo activo · Respaldo · Yield | — | rwa |
| `services` (Infra/Payments/Social) | Services/skills · x402 · Uptime · Freshness | — | por aisle |

## 17. Detalle de agente = dashboard (product page + monitoring)
Orden de paneles (algunos dependen de la plantilla). Cada panel **rotula su fuente** (Data Quality honesto):
1. **Header**: nombre, publisher/owner (avatar/ENS si hay), chips de categoría, badges verified/x402,
   **rank badge** (8004scan), estado `● Live`/`Testnet`. Glass permitido aquí.
2. **KPI row** (`KpiTile`, template-driven): valores onchain con `tabular-nums`. Lo derivado
   (equity/PnL/win-rate) lleva nota **"since indexed"**; lo estimado nunca se presenta como exacto.
3. **Charts**: Equity curve (área) + Asset allocation (donut, suma 100%) — del indexer onchain.
4. **Recent trades** (swaps onchain, con link a la tx) + **Live logs** (actividad A2A / feed de tx).
5. **Reputación**: score breakdown real (dimensiones 8004scan) · rank/network_rank · health · freshness ·
   **resumen de reviews** (avg + conteo; la lista de reviews es futura, no inventar autores).
6. **Services & skills**: endpoint A2A/MCP · skills ERC-8183 · x402.
7. **Hire CTA** (x402 — se cablea en Fase 3). Sidebar sticky con ScoreMeter + botón.

## 18. Honestidad de datos (criterio de juzgado "Data Quality")
- Badge de fuente en cada dato: `8004scan` (● live), `onchain` (indexer), `curated` (seed fallback).
  Sin proxy/indexer → seed, nunca en blanco. (El marketplace **no** consume `api.zvlint.com`: IVL es un
  listing más, sin fuente de datos propia en el código.)
- No presentar estimaciones como PnL real exacto; rotular "since indexed" / "aprox.". Donut = balances
  reales × precio (CMC); si falta precio de un token, marcarlo, no omitirlo del total en silencio.

---

# DESIGN.md v3 — Marketplace "mission control" (extiende v2)

> Salto a marketplace de primera categoría: hero panorámico con slideshow+video, tarjetas de categoría con
> fondo propio, rail de Trending por **demanda propia** (views+hires), glass de 3 tiers. Firma: **liveness
> de sala de control** — dato en vivo, pulsos, números que fluyen. Tokens/utilidades en `app/app/app.css`.

## 19. Glass — 3 tiers (obligatorio usar la clase correcta)
- `.glass-frost` — panel de texto del hero, overlays, command-K (blur 28 + saturate, borde .10, **inner
  top highlight**, sombra hero). `.glass-panel` — rail de trending, cards elevadas, sidebar (blur 16).
  `.glass-hair` — chips/pills/toggles (blur 8). Regla: **máx 2 capas** de glass apiladas; texto sobre frost
  siempre AA; el frost del hero lleva además gradiente de legibilidad negro→transparente bajo el texto.
- Glass **solo** en bloques grandes/overlays/chrome; **nunca** en data-cards densas de números.

## 20. Profundidad y glow
- Fondo `body` = campo cinematográfico estático (radiales marca+azul muy tenues). `.glow-brand` (amarillo
  8–14%) **solo** en hero, insignia destacada y activo. Elevación por capas: bg→surface→panel→frost→modal.
- `.grad-{aisle}` = gradiente oscuro tintado con el accent del aisle, para el fondo de `CategoryTile`.

## 21. Motion (tokens `--ease-out-expo`, `--dur-*`; siempre reduced-motion)
- Utilidades: `.reveal`/`.reveal-in` (scroll-reveal), `.shimmer` (skeleton, **sin spinners**), `.live-dot`
  (pulso 2s), `.kenburns` (hero 8s). Hero: cross-fade 700ms + Ken Burns + parallax del frost. Datos:
  count-up + pulse al actualizar. Hover: lift 2–3px + glow. Tilt ≤3° solo en tiles/slides. FLIP en el rail.

## 22. Layout marketplace (Discover)
Sidebar (glass-panel) · **MarketplaceChrome** (pills aisle · red BSC · Agents/Skills/Tokens · rango ·
grid/list · sort, sticky) · **HeroCarousel panorámico full-width** · **CategoryTiles** (fondo propio) ·
main = `CollectionCarousel` ×4★ + por aisle **con `TrendingRail` derecho sticky (al bajar del hero)** ·
`LiveTicker` al pie. <1280px: rail → carril horizontal; móvil → acordeón.

## 23. Componentes nuevos (ver spec completo en el plan v3)
`HeroCarousel`/`HeroSlide` (video+frost+dots+progreso), `CategoryTile` (fondo por aisle), `TrendingRail`/
`TrendingRow` (demanda: rank, métrica, Δ% real, sparkline), `MarketplaceChrome`, `CollectionCarousel`,
`AgentCard` refino template-driven + `AgentRow`, `LiveTicker`, `SearchCommand` (⌘K), `Skeleton`/`EmptyState`/
`Tooltip`/`Toast`. Cada uno: propósito · anatomía · estados · datos · motion · responsive · a11y.

## 24. Trending por demanda propia (honesto)
Trending = **views + hires** que contamos nosotros (worker analítica + KV por buckets de tiempo). El %change
y el movimiento de rank son **reales** (data de primera mano). Sin datos suficientes → "nuevo"/omitir delta,
nunca inventar. Badge de fuente `demanda`. (Los tokens BSC del tab "Tokens" usan CMC, con %change real.)

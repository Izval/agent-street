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
- Gradiente de marca permitido y escaso: `radial-gradient(#F0B90B, #FCD535)` para hero/insignia flagship.

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
- **Flagship IVL:** insignia con gradiente de marca sutil; badge "Rebalancing". Aparece en tab Agents y
  tab Skills.
- **Score IVL:** medidor 0–100; ≥70 `--up`, 40–69 `--brand`, <40 `--down`. Nunca inventar la escala de
  color fuera de estos cortes.

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

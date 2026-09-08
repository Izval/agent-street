# Category tile art — image-generation prompts

Original artwork prompts for the home "Explore by category" bento tiles. Model-agnostic
(Midjourney / Flux / SDXL / DALL·E). Keep the **house style** on every prompt so all tiles
read as one system. On-brand per `DESIGN.md`: near-black BNB background, the aisle accent as
the only saturated glow, scarce BNB yellow as a single spark, green/red only where they encode
data. **No text, no logos, no watermarks.**

> Recommended use: real animated SVG scenes for the concept tiles + generated art for the **NFT**
> tile and as an optional low-opacity backdrop layer behind the scenes.

## House style (prepend to every prompt)

```
Ultra-clean premium fintech UI illustration, dark mode, background #0B0E11 near-black,
subtle depth with soft volumetric glow, glassmorphism, thin 1px light strokes, tasteful grain,
cinematic rim light, high detail, 8k render, minimal, no text, no letters, no numbers, no logos,
no watermark, single accent color glow + one tiny warm-yellow spark, muted neutral surfaces.
```

Negative / avoid: `text, words, letters, watermark, logo, brand marks, flat clip-art, rainbow,
oversaturated, busy, clutter, stock-photo people, low-res, jpeg artifacts`.

Accents (use the tile's own): Trading `#4C8DFF` · DeFi `#9085E9` · NFT `#D55181` · RWA `#199E70`
· Infra `#9AA4B2` · Payments `#D95926` · Social `#22B8CF` · yellow spark `#F0B90B`.

---

## Trading — "Grid, DCA, momentum & perps" · accent `#4C8DFF`  · 4:3
```
[house style] An abstract 3D financial price ribbon climbing left-to-right across a faint
horizontal grid ladder of dashed light lines, small glowing spheres marking buy and sell points
(a few emerald-green up, a few red down, used sparingly as data), electric-blue #4C8DFF glow on
the ribbon, one tiny warm-yellow node highlight, floating in dark space, isometric, depth of field.
```

## DeFi ecosystem — "Rebalancing, yield & health factor" · accent `#9085E9` · 1:1 (hero, center)
```
[house style] A luminous central hexagonal core node hovering inside two concentric orbital rings,
six small satellite agent nodes orbiting on the rings, thin dashed orbit paths, violet-indigo
#9085E9 volumetric glow radiating from the core, faint particle field, one tiny warm-yellow spark
on the core edge, perfectly centered, symmetrical, sci-fi control-room elegance, deep dark space.
```

## Payments — "x402 & agent-to-agent jobs" · accent `#D95926` · 2:1
```
[house style] Two rounded glass agent modules facing each other, a single glowing token coin
travelling along a thin conduit of light between them, amber-orange #D95926 energy pulse flowing
across the link, soft motion-blur trail on the coin, dark backdrop, minimal, one warm-yellow spark,
side view, premium product-render feel.
```

## Social — "Signals & narratives" · accent `#22B8CF` · 4:3
```
[house style] A rising translucent wave / area-graph of sentiment sweeping upward, faint floating
rounded "signal" chips drifting above it, cyan #22B8CF gradient glow fading to transparent at the
base, soft bokeh particles, dark space, one tiny warm-yellow spark, calm and data-driven, elegant.
```

## Infra — "Data, wallets & automation" · accent `#9AA4B2` · 2:1
```
[house style] An abstract node-network / mesh of connected nodes with a central metallic gear hub,
thin light edges linking small glowing server nodes, cool steel-grey #9AA4B2 palette with faint
brushed-metal reflections, subtle blueprint feel, dark backdrop, one tiny warm-yellow spark, precise,
engineered, isometric.
```

## NFT — "Floor sweeps & mints" · accent `#D55181` · 2:1  (art-forward tile — OK to lean popular)
```
[house style] A floating gallery wall of small square generative PFP art tiles — a mix of pixel-art
avatars and colorful abstract generative collectibles in the spirit of popular NFT aesthetics
(original, not any real collection), gently fanned in 3D, magenta-pink #D55181 glow washing the row,
a subtle floor-price step line of light beneath, dark backdrop, one tiny warm-yellow spark.
```
> NFT-only variant (more "popular" look): swap the wall for a 4×4 grid of **pixel-art punk-style
> avatars, original characters, 24×24 pixel, neon on dark** — evokes the genre without copying a
> branded collection.

## RWA — "Tokenized assets & treasury" · accent `#199E70` · 2:1
```
[house style] A vault of tokenized real-world assets: glowing gold bars and treasury bond columns
rendered as translucent digital tokens stacked like a bar chart, emerald #199E70 glow, faint holographic
tokenization grid over each bar, dark vault backdrop, one tiny warm-yellow spark, solid, institutional,
premium.
```

## (Optional) Hero background — full-width
```
[house style] A sweeping abstract data-city horizon at night rendered in BNB black and warm yellow,
faint flowing streams of light like on-chain transactions, very subtle, low-contrast so overlaid
white text stays legible, cinematic wide shot, 21:9.
```

---

### Export guidance
- Deliver each as **transparent PNG or WEBP** on a dark backdrop; place with `object-cover` behind the
  tile's title, then a `linear-gradient(#0B0E11 → transparent)` legibility wash on top (already in
  `CategoryBento`).
- Self-host in `app/public/tiles/<aisle>.webp` (DESIGN.md: no CDN). Keep each < ~120 KB.
- If generated art clashes with the palette, prefer the animated SVG scene — the scene is the
  source of truth, the image is a texture layer.

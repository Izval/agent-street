/**
 * portfolio.$slug.og — dynamic OG/Twitter card image for a portfolio.
 *
 * A resource route (no component) that renders a 1200×630 PNG: the member agent
 * roster (real portraits, initials fallback), the name, creator, and first-party
 * signals, on-brand (DESIGN.md). Wired into `portfolio.tsx` meta() as
 * `twitter:card=summary_large_image` so an X/Twitter share shows the real set.
 *
 * Why hand-built SVG + resvg (no Satori): Cloudflare's workerd forbids compiling
 * wasm from bytes at runtime and Satori's bundle trips on `import.meta.url` there.
 * resvg's wasm is imported as an ES module (compiled at load, allowed); the fixed
 * 1200×630 layout is small enough to lay out by hand. Member images are fetched
 * with a timeout and inlined as data URIs; anything unresolved falls back to a
 * seeded initial tile, so the card never breaks.
 */

import { env } from "cloudflare:workers";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
// Imported as an ES module → workerd compiles it at load (runtime byte-compile
// is forbidden).
import resvgWasm from "../og/resvg.wasm";
import { IBM_PLEX_REGULAR_B64, IBM_PLEX_SEMIBOLD_B64, b64ToBytes } from "../og/fonts";

import type { Route } from "./+types/portfolio.og";
import { createAgentsClient, type Agent } from "../lib/agents";
import { getRecipe, resolveRecipe, resolveUserPortfolio } from "../lib/portfolios";
import { createPortfoliosClient } from "../lib/portfolios-client";

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#0B0E11";
const BRAND = "#F0B90B";
const TEXT = "#EAECEF";
const MUTED = "#848E9C";
const TILE_ACCENTS = ["#22314e", "#2c2144", "#173a41", "#312747", "#123232"];

let resvgReady: Promise<void> | null = null;
let ttfCache: Uint8Array[] | null = null;

async function ensureResvg(): Promise<void> {
  if (!resvgReady) {
    resvgReady = Promise.resolve(initWasm(resvgWasm)).catch(() => {
      /* already initialized in this isolate — ignore */
    });
  }
  await resvgReady;
}

/** Fonts are embedded (base64) — the worker can't self-fetch its own assets. */
function loadFonts(): Uint8Array[] {
  if (!ttfCache) {
    ttfCache = [b64ToBytes(IBM_PLEX_REGULAR_B64), b64ToBytes(IBM_PLEX_SEMIBOLD_B64)];
  }
  return ttfCache;
}

function initial(name: string) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fetch a member image and inline it as a data URI (png/jpeg only — svg is unsafe here). */
async function toDataUri(url: string | undefined, ms = 2500): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!/(png|jpe?g)/.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:${type.split(";")[0]};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const TW = 150; // tile width
const TH = 200; // tile height
const STEP = 116; // horizontal step (overlap)

/** One roster tile as SVG (rounded image via clipPath, or a seeded initial). */
function tileSvg(agent: Agent, uri: string | null, i: number): string {
  const x = 64 + i * STEP;
  const y = 150;
  const bg = TILE_ACCENTS[i % TILE_ACCENTS.length];
  const clip = `tc${i}`;
  const inner = uri
    ? `<image x="${x}" y="${y}" width="${TW}" height="${TH}" preserveAspectRatio="xMidYMid slice" href="${uri}" clip-path="url(#${clip})"/>`
    : `<text x="${x + TW / 2}" y="${y + TH / 2 + 26}" font-size="72" font-weight="600" fill="#FFFFFF" text-anchor="middle" font-family="IBM Plex Sans">${esc(
        initial(agent.name),
      )}</text>`;
  return `
    <clipPath id="${clip}"><rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="20"/></clipPath>
    <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="20" fill="${bg}" stroke="${BG}" stroke-width="6"/>
    ${inner}
    <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="20" fill="none" stroke="${BG}" stroke-width="6"/>`;
}

export async function loader({ params }: Route.LoaderArgs) {
  const agents = createAgentsClient({ baseUrl: env.PROXY_8004_URL, fetcher: env.PROXY_8004 });

  const recipe = getRecipe(params.slug);
  let portfolio;
  if (recipe) {
    portfolio = await resolveRecipe(recipe, agents);
  } else {
    const userPf = await createPortfoliosClient({
      baseUrl: env.PORTFOLIOS_URL,
      fetcher: env.PORTFOLIOS,
    }).get(params.slug);
    if (!userPf) throw new Response("Not found", { status: 404 });
    portfolio = await resolveUserPortfolio(userPf, agents);
  }

  const members = portfolio.agents.slice(0, 5);
  const uris = await Promise.all(members.map((m) => toDataUri(m.imageUrl)));

  const count = portfolio.aggregate.count;
  const avg = portfolio.aggregate.avgScore;
  const likes = portfolio.stats?.likes ?? null;
  const creatorLabel = portfolio.creator?.address
    ? (portfolio.creator.label ??
      `${portfolio.creator.address.slice(0, 6)}…${portfolio.creator.address.slice(-4)}`)
    : null;

  const metaBits = [
    `${count} agents`,
    likes != null ? `${likes} likes` : null,
    avg != null ? `avg score ${avg.toFixed(1)}` : null,
  ].filter(Boolean) as string[];

  const roster = members.map((m, i) => tileSvg(m, uris[i], i)).join("");
  const tag = recipe ? "CURATED PORTFOLIO" : "PORTFOLIO";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
    <rect x="0" y="0" width="${WIDTH}" height="4" fill="${BRAND}"/>
    <text x="64" y="92" font-size="30" font-weight="600" font-family="IBM Plex Sans" fill="${TEXT}" letter-spacing="1">AGENT<tspan fill="${BRAND}">—</tspan>STREET</text>
    <text x="${WIDTH - 64}" y="90" font-size="20" font-weight="600" font-family="IBM Plex Sans" fill="${MUTED}" text-anchor="end" letter-spacing="2">${tag}</text>
    ${roster}
    <text x="64" y="440" font-size="66" font-weight="600" font-family="IBM Plex Sans" fill="${TEXT}">${esc(portfolio.name)}</text>
    <text x="64" y="492" font-size="28" font-family="IBM Plex Sans" fill="${MUTED}">${esc(metaBits.join("   ·   "))}</text>
    ${creatorLabel ? `<text x="64" y="572" font-size="24" font-family="IBM Plex Sans" fill="${MUTED}">by ${esc(creatorLabel)}</text>` : ""}
    <text x="${WIDTH - 64}" y="572" font-size="24" font-weight="600" font-family="IBM Plex Sans" fill="${BRAND}" text-anchor="end">Built on BNB Chain</text>
  </svg>`;

  await ensureResvg();
  const fonts = loadFonts();
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { fontBuffers: fonts, defaultFontFamily: "IBM Plex Sans", loadSystemFonts: false },
  })
    .render()
    .asPng();

  return new Response(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

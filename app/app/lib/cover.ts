/**
 * cover.ts — abstract cover art, deterministic and network-free (DESIGN.md v3).
 *
 * Generates backgrounds (a mesh of radial-gradients + dark BNB base) from a `seed`
 * and an aisle `accent`. Replaces stock images "for now": zero files, zero fetch,
 * on-brand (scarce yellow, dark-first). Swappable in the future for real
 * photos/illustrations without touching the components that consume it.
 *
 * SSR-safe: pure functions (no `window`), producing `React.CSSProperties` with
 * `backgroundImage` for identical rendering on server and client.
 */

import type { CSSProperties } from "react";
import { AISLES, aisleOf, type Aisle, type Category } from "./taxonomy";

const BASE = "#0b0e11";

/** djb2 hash → stable unsigned integer (same seed ⇒ same art). */
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic pseudorandom sequence from a seed integer. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

/** Accent (CSS token) of the aisle. */
export function accentForAisle(aisle: Aisle | null | undefined): string {
  return AISLES.find((a) => a.id === aisle)?.accent ?? "var(--brand)";
}

/** Accent derived from a category (via its aisle). */
export function accentForCategory(cat: Category | null | undefined): string {
  return accentForAisle(cat ? aisleOf(cat) : null);
}

/**
 * Abstract cover style. `accent` tints the mesh; `seed` fixes positions.
 * A couple of "blobs" use the accent; others use cool neutral tints to add
 * depth without oversaturating (the brand yellow is reserved for CTA/active).
 */
export function coverStyle(seed: string, accent = "var(--brand)"): CSSProperties {
  const next = rng(hash(seed));
  const NEUTRALS = ["#1b2b4a", "#241a3a", "#12333a", "#2a2140", "#0f2a2f"];

  const blobs: string[] = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = Math.round(next() * 100);
    const y = Math.round(next() * 100);
    const size = 45 + Math.round(next() * 55); // 45%–100%
    // 2 of 4 blobs use the accent (color-mix with black so it doesn't shout).
    const useAccent = i < 2;
    const color = useAccent
      ? `color-mix(in srgb, ${accent} ${40 + Math.round(next() * 25)}%, transparent)`
      : `color-mix(in srgb, ${NEUTRALS[Math.floor(next() * NEUTRALS.length)]} 70%, transparent)`;
    blobs.push(
      `radial-gradient(${size}% ${size}% at ${x}% ${y}%, ${color}, transparent 70%)`,
    );
  }

  // Linear base sweep (hashed direction) over the BNB background.
  const angle = Math.round(next() * 360);
  blobs.push(
    `linear-gradient(${angle}deg, color-mix(in srgb, ${accent} 12%, ${BASE}), ${BASE} 72%)`,
  );

  return { backgroundImage: blobs.join(", "), backgroundColor: BASE };
}

/**
 * AgentBackdrop — the "impacted" page background for an agent profile.
 *
 * Layers the agent's own photo, large and blurred, tinted by the category accent,
 * behind the hero — the same image-forward feel as the home subcategory tiles. It
 * is top-anchored and fades into the page background so the data tables lower
 * down stay perfectly legible. Mirrors the layering of AgentCard + HeroCarousel.
 *
 * Honest/robust: the sharp source never flashes broken — `useImageLoad` reveals
 * the photo only once it genuinely loads; underneath, a deterministic
 * `coverStyle` mesh (seeded by id, tinted by accent) and the category bento art
 * guarantee a rich background even when the agent has no photo. SSR-safe.
 */

import { coverStyle } from "../../lib/cover";
import { useImageLoad } from "../../lib/useImageLoad";

export function AgentBackdrop({
  imageUrl,
  accent,
  seed,
  category,
}: {
  imageUrl?: string | null;
  /** Category accent CSS var (e.g. "var(--accent-liquidity)"). */
  accent: string;
  /** Stable seed for the fallback mesh (the agent id). */
  seed: string;
  /** Category id → selects the bento art fallback (`/img/bento/<category>.avif`). */
  category?: string | null;
}) {
  const { ok: showImg, imgProps } = useImageLoad(imageUrl);
  const bento = category ? `/img/bento/${category}.avif` : null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] overflow-hidden"
    >
      {/* 1 — deterministic on-brand base (also the no-image art). */}
      <div className="absolute inset-0" style={coverStyle(seed, accent)} />

      {/* 2 — category bento art, blurred: rich backdrop that matches the home. */}
      {bento && (
        <img
          src={bento}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl"
        />
      )}

      {/* 3 — the agent's own photo, large + blurred (the protagonist aura). */}
      {imageUrl && (
        <img
          {...imgProps}
          src={imageUrl}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full scale-125 object-cover blur-3xl transition-opacity duration-700 ${
            showImg ? "opacity-60" : "opacity-0"
          }`}
        />
      )}

      {/* 4 — category tint wash so the whole field reads on-brand. */}
      <div
        className="absolute inset-0"
        style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}
      />

      {/* 5 — scarce brand glow (top-right). */}
      <div className="glow-brand absolute -right-24 -top-24 h-80 w-80" />

      {/* 6 — top legibility + fade into the page background at the bottom. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,14,17,0.25) 0%, rgba(11,14,17,0.5) 52%, var(--bg) 100%)",
        }}
      />
    </div>
  );
}

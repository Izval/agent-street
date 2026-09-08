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
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[860px] overflow-hidden"
    >
      {/* 1 — deterministic on-brand base (also the no-image art). */}
      <div className="absolute inset-0" style={coverStyle(seed, accent)} />

      {/* 2 — category bento art, blurred: rich backdrop that matches the home.
             Only as the fallback when the agent has NO photo — when it does, the
             photo itself drives the hero and the bento would only muddy it. */}
      {bento && !imageUrl && (
        <img
          src={bento}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl"
        />
      )}

      {/* 3 — the agent's own photo, large + blurred: the protagonist aura, used
             as the hero's background exactly like the home category slideshow.
             Anchored to the top so the face colors bleed across the whole field. */}
      {imageUrl && (
        <img
          {...imgProps}
          src={imageUrl}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full scale-110 object-cover object-top blur-2xl transition-opacity duration-700 ${
            showImg ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* 4 — category tint wash so the whole field reads on-brand (kept light so
             the agent's own photo colour still leads). */}
      <div
        className="absolute inset-0"
        style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)` }}
      />

      {/* 5 — scarce brand glow (top-right). */}
      <div className="glow-brand absolute -right-24 -top-24 h-80 w-80" />

      {/* 6 — light top scrim + fade into the page background at the bottom, kept
             gentle so the blurred photo stays visible across the field (like
             the home category slideshow) while lower content stays legible. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,14,17,0.08) 0%, rgba(11,14,17,0.18) 48%, rgba(11,14,17,0.5) 78%, var(--bg) 100%)",
        }}
      />
    </div>
  );
}

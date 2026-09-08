/**
 * CategoryHero — fixed (non-carousel) hero for a category page.
 *
 * Full-bleed banner: breaks out of the content column to span the whole
 * viewport width (no side gutters, no card frame) and shows the SAME cover used
 * on the home bento tile (`/img/bento/<id>.avif`). Height is capped so the
 * banner stays cinematic rather than tall — `object-cover` trims only the empty
 * vertical space, the horizontal composition reads full width. Eyebrow · title ·
 * subtitle sit bottom-left, aligned to the page content column.
 *
 * SSR-safe: pure render, no effects, no `window`.
 */

import { coverStyle } from "../lib/cover";

export function CategoryHero({
  eyebrow,
  title,
  subtitle,
  /** Full-bleed cover image (AVIF), e.g. `/img/bento/liquidity.avif`. */
  image,
  accent,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: string;
  accent?: string;
}) {
  return (
    <section
      aria-label={title}
      // Full-bleed: pull out to the viewport edges regardless of the parent's
      // max-width + padding. `-mt-6 md:-mt-8` cancels the content column's top
      // padding so the banner sits flush under the header.
      className="relative left-1/2 -mt-6 w-screen -translate-x-1/2 select-none md:-mt-8"
    >
      <div className="relative flex h-[380px] flex-col justify-end overflow-hidden bg-bg sm:h-[480px] lg:h-[620px]">
        {/* Cover media (biased slightly low so the subject stays in frame).
            Absolute layers stack in DOM order above the container background;
            no negative z-index (the section's transform makes it a stacking
            context, which would drop -z layers behind the opaque background). */}
        {image ? (
          <img
            src={image}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "50% 62%" }}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={coverStyle(title, accent)}
          />
        )}

        {/* Legibility scrim — confined to the bottom strip so it only darkens
            behind the text, leaving the cover clear. Sits above the cover,
            below the text. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.32) 40%, transparent 100%)",
          }}
        />

        {/* Text, aligned to the page content column. */}
        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-6 md:px-8 md:pb-9 lg:pb-11">
          <div className="max-w-[54ch]">
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                {eyebrow}
              </div>
            )}
            <h1 className="mt-1.5 text-2xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2.5 line-clamp-2 max-w-[46ch] text-sm text-white/80 md:text-base">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

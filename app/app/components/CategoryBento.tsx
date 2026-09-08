/**
 * CategoryBento — editorial subcategory tile backed by a full-bleed AVIF image.
 *
 * Bento-grid lineage (asymmetric mosaic): each tile shows a title + caption at
 * top-left over a subcategory-specific image (a glass "scene" rendered offline as
 * AVIF), instead of a procedural SVG. A top legibility wash keeps the title
 * readable; a hover accent glow adds motion. On-brand per DESIGN.md: the category
 * accent lights only the glow, scarce yellow untouched.
 *
 * SSR-safe: reduced-motion + pointer tilt live in effects/handlers; the initial
 * render never touches `window`. `featured` gets a larger title. `category` is
 * optional — it only selects the `grad-*` fallback behind the image, so tiles
 * without an category (e.g. Skills) render fine.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

export function CategoryBento({
  to,
  label,
  caption,
  image,
  category,
  accent,
  count,
  featured = false,
  beamIndex,
  className = "",
}: {
  to: string;
  label: string;
  caption: string;
  /** Full-bleed background image (AVIF), e.g. `/img/bento/trading.avif`. */
  image: string;
  /** Optional category id — selects the `grad-*` fallback tint behind the image. */
  category?: string;
  accent: string;
  count?: number;
  featured?: boolean;
  /** Position in the explorer-beam tour (staggers when this tile lights up). */
  beamIndex?: number;
  className?: string;
}) {
  const [reduced, setReduced] = useState(false);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; lift: boolean }>({
    rx: 0,
    ry: 0,
    lift: false,
  });
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 2, ry: px * 2, lift: true });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0, lift: false });

  const transform = reduced
    ? undefined
    : `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${
        tilt.lift ? -3 : 0
      }px)`;

  return (
    <Link
      ref={ref}
      to={to}
      onPointerMove={onPointerMove}
      onPointerLeave={onLeave}
      aria-label={`${label}${count != null ? `, ${count} subcategories` : ""}`}
      className={
        "group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] p-5 shadow-[var(--elev-1)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:shadow-[var(--elev-2)] " +
        (category ? "grad-" + category : "bg-[var(--surface-2)]") +
        " " +
        className
      }
      style={
        {
          "--accent": accent,
          ...(beamIndex != null ? { "--beam-i": beamIndex } : {}),
          transform,
          willChange: "transform",
        } as React.CSSProperties
      }
    >
      {/* Full-bleed image fills the tile, sitting behind the text. A subtle
          zoom on hover adds life without motion when reduced-motion is set. */}
      <img
        src={image}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-90 transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />

      {/* Top legibility wash so the title reads over the image. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, #0b0e11 82%, transparent) 0%, color-mix(in srgb, #0b0e11 30%, transparent) 45%, transparent 100%)",
        }}
      />

      {/* Accent glow on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 60%)",
        }}
      />

      {/* Two explorer lines tour the tiles from opposite sides (offset by half
          the loop), so the whole grid is traced every ~10s. Each takes the
          tile's focus color (--accent). */}
      <span aria-hidden className="bento-beam pointer-events-none" />
      <span aria-hidden className="bento-beam bento-beam--b pointer-events-none" />

      {/* Title block, top-left. */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={
              "font-bold leading-tight tracking-tight text-[var(--text)] " +
              (featured ? "text-2xl" : "text-lg")
            }
          >
            {label}
          </h3>
          <p className="mt-1 text-[13px] font-medium text-[var(--text-3)]">
            {caption}
          </p>
        </div>
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-[var(--text-3)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--text)]"
        >
          →
        </span>
      </div>
    </Link>
  );
}

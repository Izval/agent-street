/**
 * CategoryTile — highly visual subcategory bento (DESIGN.md v3 §5.4, Apple Arcade lineage).
 *
 * Background = full-bleed abstract art (`coverStyle`), translucent glyph and large name.
 * At rest it shows NO data: it's a whole subcategory, not a metrics card.
 * On hover it discreetly reveals (fade-up) the agent count and subtypes, with
 * lift + tilt ≤3°. `featured` spans 2 columns. Accessible card-link.
 *
 * SSR-safe: tilt (pointer) and reduced-motion detection live in handlers/effects;
 * the initial state doesn't touch `window`.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { coverStyle } from "../lib/cover";

export function CategoryTile({
  to,
  label,
  glyph,
  count,
  subtypes,
  accent,
  categoryId,
  featured = false,
}: {
  to: string;
  label: string;
  glyph?: string;
  count?: number;
  subtypes?: string[];
  accent?: string;
  categoryId?: string;
  featured?: boolean;
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
    setTilt({ rx: -py * 3, ry: px * 3, lift: true });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0, lift: false });

  const transform = reduced
    ? undefined
    : `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${
        tilt.lift ? -4 : 0
      }px)`;

  return (
    <Link
      ref={ref}
      to={to}
      onPointerMove={onPointerMove}
      onPointerLeave={onLeave}
      aria-label={`${label}${count != null ? `, ${count} subcategories` : ""}`}
      className={
        "group relative flex min-h-[188px] flex-col justify-end overflow-hidden rounded-2xl p-5 shadow-[var(--elev-1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:shadow-[var(--elev-2)] " +
        (featured ? "sm:col-span-2 sm:min-h-[220px]" : "")
      }
      style={{ ...coverStyle(categoryId ?? label, accent), transform, willChange: "transform" }}
    >
      {/* Large translucent glyph. */}
      {glyph && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-5 select-none text-[8rem] leading-none opacity-[0.14] transition-opacity duration-200 group-hover:opacity-[0.22]"
          style={{ color: accent ?? "var(--text)" }}
        >
          {glyph}
        </span>
      )}

      {/* Bottom legibility gradient. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.18) 45%, transparent 100%)",
        }}
      />

      {/* Accent glow on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 80% at 50% 120%, color-mix(in srgb, ${
            accent ?? "var(--brand)"
          } 26%, transparent), transparent 70%)`,
        }}
      />

      {/* Content. Name always visible; discreet data on hover. */}
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold tracking-tight text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
            {label}
          </h3>
          <span
            aria-hidden
            className="text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white"
          >
            →
          </span>
        </div>

        {/* Revealed on hover: fade-up of count + subtypes. */}
        <div className="mt-1.5 max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:max-h-24 group-hover:opacity-100 group-focus-visible:max-h-24 group-focus-visible:opacity-100">
          {count != null && (
            <div className="text-[12px] font-medium text-white/75">
              <span className="tnum">{count}</span> subcategories
            </div>
          )}
          {subtypes && subtypes.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {subtypes.slice(0, 4).map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Link>
  );
}

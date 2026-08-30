/**
 * PromoBanner — wide announcement / featured banner (DESIGN.md v3, Steam "Explore
 * Your Discovery Queue" lineage). Abstract-art background, white text, the whole
 * banner is a link. Optional `pill` (short label like "FEATURED").
 * SSR-safe (no effects).
 */

import { Link } from "react-router";
import { coverStyle } from "../lib/cover";

export function PromoBanner({
  to,
  title,
  subtitle,
  pill,
  accent,
  cover,
  live = false,
}: {
  to: string;
  title: string;
  subtitle?: string;
  pill?: string;
  accent?: string;
  cover?: string;
  live?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-[132px] items-center overflow-hidden rounded-2xl p-6 shadow-[var(--elev-1)] transition-shadow duration-200 hover:shadow-[var(--elev-2)] md:p-8"
      style={coverStyle(cover ?? title, accent)}
    >
      {/* Legibilidad: oscurecer la izquierda donde va el texto. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0) 80%)",
        }}
      />
      <div className="relative max-w-[58ch]">
        <div className="flex items-center gap-2">
          {pill && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bg"
              style={{ backgroundColor: accent ?? "var(--brand)" }}
            >
              {pill}
            </span>
          )}
          {live && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
              Live
            </span>
          )}
        </div>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)] md:text-2xl">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1.5 line-clamp-2 text-sm text-white/80 md:text-base">
            {subtitle}
          </p>
        )}
      </div>
      <span
        aria-hidden
        className="relative ml-auto hidden shrink-0 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white sm:block"
      >
        →
      </span>
    </Link>
  );
}

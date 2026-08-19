/**
 * CategoryTile — tile grande de categoría con fondo propio (DESIGN.md v3 §5.4).
 *
 * Fondo = gradiente propio del aisle (`.grad-{aisleId}`) o derivado del `accent`,
 * con glyph grande translúcido; contenido en `.glass-hair`: label, nº de agentes,
 * mini-lista de subtipos y flecha. Hover: lift + tilt ≤3° + brillo. `featured`
 * ocupa 2 columnas. Card-link accesible.
 *
 * SSR-safe: el tilt (pointer) y la detección de reduced-motion viven en handlers
 * y efectos de cliente; el estado inicial no toca `window`.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

const KNOWN_AISLES = new Set([
  "trading",
  "defi",
  "nft",
  "rwa",
  "infra",
  "payments",
  "social",
]);

export function CategoryTile({
  to,
  label,
  glyph,
  count,
  subtypes,
  accent,
  aisleId,
  featured = false,
}: {
  to: string;
  label: string;
  glyph?: string;
  count?: number;
  subtypes?: string[];
  accent?: string;
  aisleId?: string;
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

  const hasGrad = aisleId && KNOWN_AISLES.has(aisleId);
  const bgStyle: React.CSSProperties | undefined =
    !hasGrad && accent
      ? {
          backgroundImage: `linear-gradient(140deg, color-mix(in srgb, ${accent} 22%, #0b0e11), #0b0e11 70%)`,
        }
      : undefined;

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
      aria-label={`${label}${count != null ? `, ${count} agentes` : ""}`}
      className={
        "group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-lg p-5 shadow-[var(--elev-1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:shadow-[var(--elev-2)] " +
        (hasGrad ? `grad-${aisleId} ` : "bg-surface ") +
        (featured ? "sm:col-span-2" : "")
      }
      style={{ ...bgStyle, transform, willChange: "transform" }}
    >
      {/* Glyph grande translúcido. */}
      {glyph && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-4 select-none text-[7rem] leading-none opacity-[0.10] transition-opacity duration-200 group-hover:opacity-[0.18]"
          style={{ color: accent ?? "var(--text)" }}
        >
          {glyph}
        </span>
      )}

      {/* Brillo del accent en hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 80% at 50% 120%, color-mix(in srgb, ${
            accent ?? "var(--brand)"
          } 22%, transparent), transparent 70%)`,
        }}
      />

      {/* Contenido en glass-hair. */}
      <div className="glass-hair relative rounded-lg px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-text">{label}</h3>
          <span
            aria-hidden
            className="text-text-2 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
          >
            →
          </span>
        </div>
        {count != null && (
          <div className="mt-0.5 text-[12px] font-medium text-text-2">
            <span className="tnum">{count}</span> agentes
          </div>
        )}
        {subtypes && subtypes.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {subtypes.slice(0, 4).map((s) => (
              <li
                key={s}
                className="rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-text-2"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

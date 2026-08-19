/**
 * Card — wrapper reutilizable con borde/radio (DESIGN.md §5, v2 §13).
 * Variante `glass` (solo bloques grandes/hero/overlays, nunca data cards densas).
 * `accent` pinta una barra superior sutil por aisle (no fondo → no compite con el amarillo).
 */

import type { CSSProperties, ReactNode } from "react";

export function Card({
  glass = false,
  accent,
  className = "",
  style,
  children,
}: {
  glass?: boolean;
  /** Token de acento por aisle, p.ej. `var(--accent-defi)`. */
  accent?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "relative overflow-hidden rounded-lg " +
        (glass ? "glass" : "border border-border bg-surface") +
        (className ? " " + className : "")
      }
      style={style}
    >
      {accent && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: accent }}
        />
      )}
      {children}
    </div>
  );
}

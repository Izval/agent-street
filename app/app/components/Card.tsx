/**
 * Card — reusable wrapper with border/radius (DESIGN.md §5, v2 §13).
 * `glass` variant (only large blocks/hero/overlays, never dense data cards).
 * `accent` paints a subtle top bar per category (no background → doesn't compete with the yellow).
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
  /** Accent token per category, e.g. `var(--accent-trading)`. */
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

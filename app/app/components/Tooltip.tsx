/**
 * Tooltip — burbuja `.glass-hair` en hover/focus (plan §5.11). SSR-safe:
 * estado inicial cerrado, sin portales ni acceso a `window` en render.
 * A11y: `role="tooltip"` + `aria-describedby`; se muestra también con foco de
 * teclado y se cierra con Escape.
 */

import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

type Side = "top" | "bottom" | "left" | "right";

const POS: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export interface TooltipProps {
  /** Contenido de la burbuja. */
  label: ReactNode;
  /** El disparador (debe poder recibir foco para a11y de teclado). */
  children: ReactNode;
  side?: Side;
  className?: string;
}

export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Escape" && open) setOpen(false);
  }

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDown={onKeyDown}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={`glass-hair pointer-events-none absolute z-50 whitespace-nowrap rounded-[6px] px-2 py-1 text-xs font-medium text-text shadow-[var(--elev-1)] transition-opacity duration-[var(--dur-micro)] ${POS[side]} ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * EmptyState — vacío honesto con voz de interfaz (DESIGN.md v3 §21; plan §5.11).
 * Dice QUÉ hacer, sin disculpas ni cifras inventadas. SSR-safe (markup puro).
 */

import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  hint?: string;
  /** Glyph/ícono translúcido opcional (carácter o nodo). */
  icon?: ReactNode;
  /** CTA opcional (Link/botón que el padre inyecta). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg px-6 py-10 text-center ${className}`}
    >
      {icon != null && (
        <div aria-hidden className="text-2xl text-text-3 opacity-70">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-text">{title}</p>
      {hint != null && (
        <p className="max-w-[36ch] text-xs text-text-3">{hint}</p>
      )}
      {action != null && <div className="mt-2">{action}</div>}
    </div>
  );
}

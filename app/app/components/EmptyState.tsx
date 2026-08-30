/**
 * EmptyState — honest empty state with an interface voice (DESIGN.md v3 §21; plan §5.11).
 * Says WHAT to do, with no apologies or made-up figures. SSR-safe (pure markup).
 */

import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  hint?: string;
  /** Optional translucent glyph/icon (character or node). */
  icon?: ReactNode;
  /** Optional CTA (Link/button injected by the parent). */
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

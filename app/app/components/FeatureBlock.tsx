/**
 * FeatureBlock — large editorial card to highlight an agent/collection
 * (DESIGN.md v2 §12–§14). Subtle glass + category accent (bar + eyebrow),
 * sentence-case copy. Subtle hover (elevation via color/border, not a heavy shadow).
 */

import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

export function FeatureBlock({
  eyebrow,
  title,
  description,
  to,
  accent,
  media,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  to: string;
  /** Category accent token, e.g. `var(--accent-trading)`. */
  accent?: string;
  /** Optional visual slot (image/illustration/badge). */
  media?: ReactNode;
}) {
  const accentStyle: CSSProperties | undefined = accent
    ? { color: accent }
    : undefined;
  return (
    <Link
      to={to}
      className="group glass relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-lg p-6 transition-all hover:-translate-y-0.5 hover:border-brand focus-visible:border-brand"
    >
      {accent && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: accent }}
        />
      )}
      {media && (
        <div className="pointer-events-none absolute inset-0 opacity-70">
          {media}
        </div>
      )}
      <div className="relative">
        {eyebrow && (
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={accentStyle}
          >
            {eyebrow}
          </div>
        )}
        <h3 className="max-w-[36ch] text-xl font-bold leading-tight text-text">
          {title}
        </h3>
        {description && (
          <p className="mt-2 max-w-[52ch] text-sm text-text-2">{description}</p>
        )}
      </div>
      <div className="relative mt-4 text-sm font-semibold text-text-2 transition-colors group-hover:text-brand">
        Explore →
      </div>
    </Link>
  );
}

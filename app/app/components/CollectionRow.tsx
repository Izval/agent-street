/**
 * CollectionRow — header (title + "See all →") over a horizontal scrollable
 * rail of children (DESIGN.md v2 §11). General signature: wraps any
 * card/tile. `accent` underlines the header (aisle accent, §14) without a background.
 */

import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

export function CollectionRow({
  title,
  seeAllTo,
  accent,
  children,
}: {
  title: string;
  seeAllTo?: string;
  /** Aisle accent token, e.g. `var(--accent-trading)`. */
  accent?: string;
  children: ReactNode;
}) {
  const headStyle: CSSProperties | undefined = accent
    ? { borderColor: accent }
    : undefined;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          className={
            "text-lg font-bold text-text" +
            (accent ? " border-l-2 pl-2.5" : "")
          }
          style={headStyle}
        >
          {title}
        </h2>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className="shrink-0 text-sm font-semibold text-text-2 transition-colors hover:text-brand"
          >
            See all →
          </Link>
        )}
      </div>
      {/* Horizontal rail: scroll-snap, no loud scrollbar. Each child sets its own width. */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {children}
      </div>
    </section>
  );
}

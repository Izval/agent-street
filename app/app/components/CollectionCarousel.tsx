/**
 * CollectionCarousel — horizontal scroll-snap row (DESIGN.md v3 §5.6).
 *
 * Header (title + accent bar + "See all →"), an `overflow-x-auto snap-x` track
 * of children (AgentCards), arrows that appear on hover and scroll one
 * page, and edge fades that disappear at the ends.
 *
 * Conceptually replaces `CollectionRow`; does NOT delete it. SSR-safe: the scroll
 * state (to show/hide arrows and fades) is computed in client effects.
 */

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

export function CollectionCarousel({
  title,
  seeAllTo,
  accent,
  children,
}: {
  title: string;
  seeAllTo?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update, children]);

  const page = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const items = Children.toArray(children);

  return (
    <section className="group/coll relative">
      {/* Header. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-4 w-1 rounded-[999px]"
            style={{ background: accent ?? "var(--brand)" }}
          />
          <h2 className="text-lg font-semibold text-text">{title}</h2>
        </div>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className="shrink-0 text-sm font-semibold text-text-2 transition-colors hover:text-brand"
          >
            See all →
          </Link>
        )}
      </div>

      {/* Track + fades + arrows. */}
      <div className="relative">
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label={title}
        >
          {items.map((child, i) => (
            <div
              key={i}
              role="listitem"
              className="w-[288px] shrink-0 snap-start"
            >
              {child}
            </div>
          ))}
        </div>

        {/* Edge fades. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg to-transparent transition-opacity duration-200"
          style={{ opacity: canLeft ? 1 : 0 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent transition-opacity duration-200"
          style={{ opacity: canRight ? 1 : 0 }}
        />

        {/* Arrows (appear on hover; disabled at the ends). */}
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={!canLeft}
          aria-label="Scroll left"
          className="glass-hair absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[999px] text-text opacity-0 transition-opacity duration-200 hover:text-brand focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover/coll:opacity-100"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={!canRight}
          aria-label="Scroll right"
          className="glass-hair absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[999px] text-text opacity-0 transition-opacity duration-200 hover:text-brand focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover/coll:opacity-100"
        >
          ›
        </button>
      </div>
    </section>
  );
}

/**
 * FeaturedRail — row of featured banner cards (DESIGN.md v3, Steam
 * "Discounts & Events" lineage). Reuses CollectionCarousel for the horizontal
 * scroll and the arrows. Each FeatureCard is a cover banner with a label + title.
 * Sample (placeholder) data injected by the home page. SSR-safe.
 */

import { Link } from "react-router";
import { CollectionCarousel } from "./CollectionCarousel";
import { coverStyle } from "../lib/cover";

export interface FeatureItem {
  id: string;
  to: string;
  title: string;
  subtitle?: string;
  pill?: string;
  accent?: string;
  cover?: string;
  /** Optional real image (e.g. an agent avatar) shown as the card cover. */
  imageSrc?: string;
}

function FeatureCard({ item }: { item: FeatureItem }) {
  return (
    <Link
      to={item.to}
      className="group relative flex h-[176px] flex-col justify-end overflow-hidden rounded-xl p-4 shadow-[var(--elev-1)] transition-shadow duration-200 hover:shadow-[var(--elev-2)]"
      style={coverStyle(item.cover ?? item.title, item.accent)}
    >
      {/* Real cover image (agent avatar) over the on-brand art fallback. */}
      {item.imageSrc && (
        <img
          src={item.imageSrc}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      )}
      {item.pill && (
        <span
          className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-bg"
          style={{ backgroundColor: item.accent ?? "var(--brand)" }}
        >
          {item.pill}
        </span>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)",
        }}
      />
      <div className="relative">
        <h3 className="text-base font-bold leading-tight text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
          {item.title}
        </h3>
        {item.subtitle && (
          <p className="mt-1 line-clamp-1 text-[12px] text-white/80">
            {item.subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}

export function FeaturedRail({
  title,
  items,
  accent,
}: {
  title: string;
  items: FeatureItem[];
  accent?: string;
}) {
  if (!items.length) return null;
  return (
    <CollectionCarousel title={title} accent={accent}>
      {items.map((it) => (
        <FeatureCard key={it.id} item={it} />
      ))}
    </CollectionCarousel>
  );
}

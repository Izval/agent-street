/**
 * LaunchTicker — "new launches" marquee (DESIGN.md v3, financial ticker
 * lineage). Horizontal looping strip with the latest indexed agents: name
 * + score + `NEW` badge, faint separators, tabular numerals. Each item
 * links to the agent. Pauses on hover; no animation under `prefers-reduced-motion`
 * (falls back to static horizontal scroll).
 *
 * Prop-driven (no fetch). SSR-safe: no `window` access; the animation is CSS
 * (`ticker-scroll` in app.css). The list is duplicated for a seamless loop.
 */

import { Link } from "react-router";

export interface LaunchItem {
  id: string;
  name: string;
  category?: string | null;
  score?: number;
}

function TickerItem({ item }: { item: LaunchItem }) {
  return (
    <Link
      to={`/agent/${encodeURIComponent(item.id)}`}
      className="group flex shrink-0 items-center gap-2 px-4 text-xs"
    >
      <span className="font-semibold text-white transition-colors group-hover:text-brand">
        {item.name}
      </span>
      {item.score != null && (
        <span className="tnum font-semibold text-white/70">{item.score}</span>
      )}
      <span className="rounded-[999px] bg-brand/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand">
        New
      </span>
    </Link>
  );
}

export function LaunchTicker({ items }: { items: LaunchItem[] }) {
  if (!items.length) return null;
  // Duplicate the list so the loop shows no "seam".
  const loop = [...items, ...items];

  return (
    <div
      role="region"
      aria-label="New launches"
      className="ticker-mask group relative flex min-w-0 items-center overflow-hidden"
    >
      <div className="ticker-track flex items-center whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <div key={`${item.id}-${i}`} className="flex items-center">
            <TickerItem item={item} />
            <span aria-hidden className="text-white/25">
              ·
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

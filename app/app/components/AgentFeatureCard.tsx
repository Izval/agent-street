/**
 * AgentFeatureCard — featured agent banner (App Store "Apps We Love" lineage).
 *
 * Cover art on top (`coverStyle` tinted by the aisle accent) and, BELOW the
 * art, the text: uppercase eyebrow, agent name and a subtitle line.
 * The whole thing is a link to `/agent/:id`. Meant to live inside a
 * `CollectionCarousel` (horizontal scroll-snap). SSR-safe (no effects).
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { coverStyle } from "../lib/cover";

export function AgentFeatureCard({
  agent,
  accent,
  eyebrow,
}: {
  agent: Agent;
  accent?: string;
  eyebrow: string;
}) {
  const isLive = agent.source === "8004scan";

  return (
    <Link
      to={`/agent/${encodeURIComponent(agent.id)}`}
      aria-label={agent.name}
      className="group flex w-full flex-col gap-3"
    >
      {/* Cover art. */}
      <div
        className="relative h-[168px] overflow-hidden rounded-xl shadow-[var(--elev-1)] transition-shadow duration-200 group-hover:shadow-[var(--elev-2)] sm:h-[196px]"
        style={coverStyle(agent.id, accent)}
      >
        {agent.imageUrl && (
          <img
            src={agent.imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {isLive && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/90 backdrop-blur-md">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
            Live
          </span>
        )}
      </div>

      {/* Text below the art. */}
      <div className="min-w-0 px-0.5">
        <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">
          {eyebrow}
        </div>
        <h3 className="mt-0.5 truncate text-base font-bold text-text transition-colors group-hover:text-brand">
          {agent.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-text-3">
          {agent.description || agent.categoryLabel || "Agent on BNB Chain"}
        </p>
      </div>
    </Link>
  );
}

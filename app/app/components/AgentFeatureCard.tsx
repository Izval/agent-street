/**
 * AgentFeatureCard — featured agent banner (App Store "Apps We Love" lineage).
 *
 * Cover art on top (`coverStyle` tinted by the category accent) and, BELOW the
 * art, the text: uppercase eyebrow, agent name and a subtitle line.
 * The whole thing is a link to `/agent/:id`. Meant to live inside a
 * `CollectionCarousel` (horizontal scroll-snap). SSR-safe (no effects).
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { agentHref } from "../lib/agents";
import { coverStyle } from "../lib/cover";
import { useImageLoad } from "../lib/useImageLoad";

export function AgentFeatureCard({
  agent,
  accent,
  eyebrow,
}: {
  agent: Agent;
  accent?: string;
  eyebrow: string;
}) {
  const { ok, imgProps } = useImageLoad(agent.imageUrl);
  return (
    <Link
      to={agentHref(agent)}
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
            {...imgProps}
            src={agent.imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
              ok ? "opacity-100" : "opacity-0"
            }`}
          />
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
          {agent.description || agent.subcategoryLabel || "Agent on BNB Chain"}
        </p>
      </div>
    </Link>
  );
}

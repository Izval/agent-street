/**
 * AgentListItem — compact list row (App Store "Best New Apps and
 * Updates" lineage). Square icon + name + one subtitle line + "View" button.
 *
 * Meant for a multi-column grid (row-major). The whole row links to
 * `/agent/:id`; "View" is the visual affordance for the action (secondary; yellow
 * is reserved for the text hover). SSR-safe (no effects). Real data from 8004scan.
 */

import { Link } from "react-router";
import type { Agent } from "../lib/agents";
import { aisleOf, AISLES } from "../lib/taxonomy";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function AgentListItem({ agent }: { agent: Agent }) {
  const aisle = agent.category ? aisleOf(agent.category) : null;
  const accent = AISLES.find((a) => a.id === aisle)?.accent ?? "var(--brand)";
  const isLive = agent.source === "8004scan";
  const subtitle =
    agent.description?.trim() || agent.categoryLabel || "Agent on BNB Chain";

  return (
    <Link
      to={`/agent/${encodeURIComponent(agent.id)}`}
      className="group flex items-center gap-3.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface sm:gap-4"
    >
      {/* Square icon. Initials as the base; the image overlays it and, if it
          fails to load, hides so the initials remain (no broken icon). */}
      <span
        aria-hidden
        className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 text-sm font-bold text-text-2"
        style={{
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)`,
        }}
      >
        {initials(agent.name)}
        {agent.imageUrl && (
          <img
            src={agent.imageUrl}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </span>

      {/* Name + subtitle. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-text">
            {agent.name}
          </span>
          {isLive && (
            <span className="live-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-up" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-text-3">{subtitle}</p>
      </div>

      {/* Action. */}
      <span className="shrink-0 rounded-full bg-surface-2 px-4 py-1.5 text-xs font-bold text-text-2 transition-colors group-hover:text-brand">
        View
      </span>
    </Link>
  );
}

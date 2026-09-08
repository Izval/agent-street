/**
 * AgentCard — collectible "FIFA-style" agent card (DESIGN.md v3 §5.7).
 *
 * Portrait, image-first: the agent's image is the protagonist, filling nearly
 * the whole upper area edge-to-edge (object-cover). A blurred, scaled copy of
 * the SAME image sits behind it, so the card gets a color aura derived from the
 * image itself — no canvas / color extraction, SSR-safe. Under everything, the
 * deterministic `coverStyle` base (seeded by id, tinted by category) guarantees
 * on-brand art when there's no image.
 *
 * Face is minimal: a bottom info band with the name and a compact
 * `★ stars · N reviews` line on the left, and the reputation (on-chain score,
 * toned) in the bottom-right corner. No `Live`, no `x402`, no metrics strip —
 * the identity IS the card.
 *
 * Hover reveals the category + description IN-CARD (a scrim fading over the
 * image) — no side popover, so scanning a horizontal carousel never triggers a
 * floating panel. Pure CSS `group-hover`: instant, light, no JS/timers/portal.
 */

import type { Agent } from "../lib/agents";
import { agentHref } from "../lib/agents";
import { Link } from "react-router";
import { accentForSubcategory, coverStyle } from "../lib/cover";
import { useImageLoad } from "../lib/useImageLoad";
import { scoreTone } from "../lib/score";
import { SaveButton } from "./SaveButton";

const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

function initial(name: string) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

export function AgentCard({
  agent,
  featured = false,
  // Kept for signature compatibility; the FIFA face intentionally omits it.
  demandSpark: _demandSpark,
}: {
  agent: Agent;
  featured?: boolean;
  demandSpark?: number[];
}) {
  const accent = accentForSubcategory(agent.subcategory);
  const tint = featured ? "var(--brand)" : accent;
  // Category-tinted but mostly dark, so the description stays readable: the base
  // is ~20% accent over the near-black bg, fading to transparent toward the top.
  const dark = `color-mix(in srgb, ${tint} 20%, var(--bg))`;
  const hoverGradient = `linear-gradient(to top, ${dark} 0%, ${dark} 32%, color-mix(in srgb, ${dark} 72%, transparent) 72%, transparent 100%)`;
  const rating = Number.isFinite(agent.score) ? Math.round(agent.score) : null;
  const ratingTone = rating != null ? TONE_TEXT[scoreTone(agent.score)] : "text-text";
  const { ok: showImg, imgProps } = useImageLoad(agent.imageUrl);

  const snapshot = {
    id: agent.id,
    name: agent.name,
    subcategory: agent.subcategory,
    subcategoryLabel: agent.subcategoryLabel,
    score: agent.score,
    imageUrl: agent.imageUrl,
    source: agent.source,
  };

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-20">
        <SaveButton agent={snapshot} variant="icon" />
      </div>
      <Link
        to={agentHref(agent)}
        aria-label={agent.name}
        className={
          "group relative flex aspect-[3/4] min-w-0 flex-col overflow-hidden rounded-xl ring-1 ring-border/60 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-1 hover:shadow-[var(--elev-2)] " +
          (featured ? "ring-brand/50" : "")
        }
      >
        {/* Layer 0 — deterministic on-brand base (also the no-image art). */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={coverStyle(agent.id || agent.name, accent)}
        />

        {/* Accent top border (brand on featured). */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-px opacity-80"
          style={{ background: featured ? "var(--brand)" : accent }}
        />

        {/* Top — the protagonist, large: the image fills nearly the whole
            upper area (object-cover, edge to edge). The initial fallback is
            always present; the sharp image is mounted (so it can load) and
            revealed only once it genuinely loads — a broken image never
            appears. A copy of the same image, blurred and scaled, provides
            the color aura beneath it. */}
        <div className="relative z-0 min-h-0 flex-1">
          {showImg && (
            <img
              aria-hidden
              src={agent.imageUrl ?? undefined}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
            />
          )}
          <span
            aria-hidden
            className={`absolute inset-0 grid place-items-center text-6xl font-black text-white/90 transition-opacity duration-300 ${
              showImg ? "opacity-0" : "opacity-100"
            }`}
            style={coverStyle(agent.name || agent.id, accent)}
          >
            {initial(agent.name)}
          </span>
          {agent.imageUrl && (
            <img
              {...imgProps}
              src={agent.imageUrl}
              alt=""
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-cover transition-[transform,opacity] duration-300 group-hover:scale-[1.04] ${
                showImg ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
          {/* Vignette so the image melts into the info band below. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/20 to-transparent"
          />
        </div>

        {/* Hover reveal — category + description. Spans the FULL card so its
            opaque base merges seamlessly with the info band (no strip of image
            left showing); the gradient fades toward the top so the upper part
            of the image stays visible. Sits above the image, below the info
            band. Instant, light, CSS-only. */}
        <div
          className="pointer-events-none absolute inset-0 z-[8] flex flex-col justify-end gap-2.5 px-3.5 pb-[4rem] opacity-0 transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] [transform:translateY(6px)] group-hover:pointer-events-auto group-hover:opacity-100 group-hover:[transform:translateY(0)]"
          style={{ background: hoverGradient }}
        >
          {agent.subcategoryLabel && (
            <span
              className="self-start rounded-[999px] px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color: featured ? "var(--brand)" : accent,
                background: "color-mix(in srgb, currentColor 16%, transparent)",
              }}
            >
              {agent.subcategoryLabel}
            </span>
          )}
          <p className="line-clamp-6 text-[13px] leading-relaxed text-text-2">
            {agent.description || "ERC-8004 agent on BNB Chain."}
          </p>
        </div>

        {/* Bottom band — name + stars/reviews (left), reputation (right). */}
        <div className="relative z-10 flex items-end justify-between gap-2 p-3.5 pt-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold text-text">
              {agent.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-text-2">
              <span className="tnum inline-flex items-center gap-1">
                <span aria-hidden className="text-brand">
                  ★
                </span>
                {agent.stars}
              </span>
              <span aria-hidden className="text-text-3">
                ·
              </span>
              <span className="tnum">
                {agent.feedbacks} {agent.feedbacks === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
          {/* Reputation (on-chain score) — bottom-right corner. */}
          <div className="shrink-0 text-right leading-none">
            <div
              className={`tnum text-4xl font-extrabold tracking-tight ${ratingTone}`}
              style={{ textShadow: "0 1px 12px rgba(0,0,0,0.55)" }}
            >
              {rating ?? "—"}
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-text-3">
              Reputation
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

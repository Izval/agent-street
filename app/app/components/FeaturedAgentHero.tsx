/**
 * FeaturedAgentHero — the home's headline "agent of the week" banner.
 *
 * A single agent, presented large and cinematic. The whole surface takes ITS
 * colours: a big, blurred copy of the agent's own image is the background (the
 * "blur of its colours" aura, same trick as AgentCard/AgentBackdrop), washed with
 * the category accent so the block reads on-brand. The sharp portrait, name, role,
 * reputation and a clear Hire CTA sit on top of a left-to-right legibility scrim.
 *
 * Which agent lands here is decided upstream (lib/featuredAgent.ts) — an editorial
 * schedule that falls back to weekly merit rotation. This component only renders
 * whatever agent it's given; it has no per-agent branches. SSR-safe.
 */

import { Link } from "react-router";

import type { Agent } from "../lib/agents";
import { agentHref, hireHref } from "../lib/agents";
import { coverStyle } from "../lib/cover";
import { getProfileMeta } from "../lib/profile";
import { scoreTone } from "../lib/score";
import { useImageLoad } from "../lib/useImageLoad";

const TONE_TEXT: Record<"up" | "brand" | "down", string> = {
  up: "text-up",
  brand: "text-brand",
  down: "text-down",
};

function initial(name: string) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

export function FeaturedAgentHero({
  agent,
  eyebrow = "Featured agent",
}: {
  agent: Agent;
  /** Small label over the name (e.g. "Featured agent · this week"). */
  eyebrow?: string;
}) {
  const meta = getProfileMeta(agent);
  const accent = meta.accent;
  const href = agentHref(agent);
  const { ok: showImg, imgProps } = useImageLoad(agent.imageUrl);
  const rating = Number.isFinite(agent.score) ? Math.round(agent.score) : null;
  const ratingTone = rating != null ? TONE_TEXT[scoreTone(agent.score)] : "text-text";

  return (
    <section
      aria-label={`Featured agent: ${agent.name}`}
      className="relative isolate overflow-hidden rounded-2xl ring-1 ring-border/60 shadow-[var(--elev-2)]"
      style={coverStyle(agent.id || agent.name, accent)}
    >
      {/* ── Colour aura: the agent's own image, huge + blurred, spanning the WHOLE
             block (anchored right so the portrait on the left reads against darker
             pixels). This is what makes every featured agent look different — the
             block is painted in its palette. ── */}
      {agent.imageUrl && showImg && (
        <img
          aria-hidden
          src={agent.imageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-110 object-cover object-right opacity-65 blur-2xl"
        />
      )}

      {/* Accent wash + a right-anchored accent glow so the aura reads as the
          category colour even when the source image is pale (e.g. a white logo),
          instead of washing out to grey. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(120% 140% at 100% 50%, color-mix(in srgb, ${accent} 40%, transparent), transparent 60%)`,
          mixBlendMode: "soft-light",
        }}
      />

      {/* Legibility scrim: dark on the left where the text lives, clearing toward
          the right so the larger aura still reads as the agent's own image. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(100deg, rgba(11,14,17,0.9) 0%, rgba(11,14,17,0.62) 40%, rgba(11,14,17,0.12) 75%, rgba(11,14,17,0) 100%)",
        }}
      />

      {/* Bottom grounding fade so the block seats into the dark page. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/3"
        style={{
          background:
            "linear-gradient(to top, rgba(11,14,17,0.6), rgba(11,14,17,0))",
        }}
      />

      {/* Scarce accent glow, top-left, for depth. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 -z-10 h-64 w-64 opacity-60"
        style={{
          background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${accent} 45%, transparent), transparent 70%)`,
          filter: "blur(8px)",
        }}
      />

      <div className="relative flex min-h-[220px] flex-col gap-5 p-5 sm:p-7 lg:min-h-[300px] lg:flex-row lg:items-center lg:gap-8 lg:p-9">
        {/* Portrait — the protagonist. Sharp logo/photo, revealed only once it
            genuinely loads; a coverStyle initial stands in otherwise. */}
        <Link
          to={href}
          aria-label={agent.name}
          className="group relative block h-28 w-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-[var(--elev-hero)] sm:h-32 sm:w-32 lg:h-44 lg:w-44"
        >
          <span
            aria-hidden
            className={`absolute inset-0 grid place-items-center text-5xl font-black text-white/90 transition-opacity duration-300 ${
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
              className={`absolute inset-0 h-full w-full object-cover transition-[transform,opacity] duration-300 group-hover:scale-105 ${
                showImg ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </Link>

        {/* Identity + copy. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-bg"
              style={{ backgroundColor: accent }}
            >
              {eyebrow}
            </span>
            {agent.chainId === 56 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
                Live on BSC
              </span>
            )}
          </div>

          <h2 className="mt-2.5 truncate text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-3xl">
            <Link to={href} className="transition-colors hover:text-white/90">
              {agent.name}
            </Link>
          </h2>

          <p className="mt-1.5 line-clamp-3 max-w-[56ch] text-sm leading-relaxed text-white/75 sm:text-[15px]">
            {meta.role}
            {agent.description ? ` — ${agent.description}` : "."}
          </p>

          {/* Real reputation meta only (no invented figures). */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] font-medium text-white/70">
            {agent.subcategoryLabel && (
              <span
                className="rounded-[999px] px-2 py-0.5 font-semibold"
                style={{
                  color: accent,
                  background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                }}
              >
                {agent.subcategoryLabel}
              </span>
            )}
            <span className="tnum inline-flex items-center gap-1">
              <span aria-hidden className="text-brand">
                ★
              </span>
              {agent.stars}
            </span>
            <span aria-hidden className="text-white/30">
              ·
            </span>
            <span className="tnum">
              {agent.feedbacks} {agent.feedbacks === 1 ? "review" : "reviews"}
            </span>
          </div>
        </div>

        {/* Reputation + actions. */}
        <div className="flex shrink-0 items-center justify-between gap-5 lg:flex-col lg:items-end lg:justify-center lg:gap-4">
          <div className="text-right leading-none">
            <div
              className={`tnum text-4xl font-extrabold tracking-tight sm:text-5xl ${ratingTone}`}
              style={{ textShadow: "0 1px 16px rgba(0,0,0,0.6)" }}
            >
              {rating ?? "—"}
            </div>
            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
              Reputation
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to={href}
              className="rounded-[8px] border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              View agent
            </Link>
            <Link
              to={hireHref(agent.id, agent.chainId)}
              className="rounded-[8px] bg-brand px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
            >
              Hire →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

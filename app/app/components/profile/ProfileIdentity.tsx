/**
 * ProfileIdentity — the image-forward identity panel (LEFT of the profile hero).
 *
 * The agent's image is the protagonist, exactly like the home AgentCard: it fills
 * a tall portrait block edge-to-edge (object-cover) with a blurred copy of the same
 * image behind it for a color aura, over a deterministic on-brand base that also
 * serves as the no-image art. Name · role · badges · publisher sit in a band that
 * melts up from the image, then the primary Hire CTA + Save.
 *
 * Marketplace-general: no listing is special-cased — everything comes from the
 * agent record + its category accent (meta).
 */

import { Link } from "react-router";

import { hireHref } from "../../lib/agents";
import type { AgentDetail } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { short } from "../../lib/profile";
import { coverStyle } from "../../lib/cover";
import { useImageLoad } from "../../lib/useImageLoad";
import { SaveButton } from "../SaveButton";
import { LiveBadge, TestnetBadge } from "../Badge";

function initial(name: string) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

export function ProfileIdentity({
  detail,
  meta,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
}) {
  const { agent } = detail;
  const { ok: showImg, imgProps } = useImageLoad(agent.imageUrl);
  const owner =
    agent.ownerUsername ??
    agent.ownerEns ??
    short(agent.agentWallet ?? agent.ownerAddress);

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
    <div className="metal-frost relative flex h-full flex-col overflow-hidden">
      {/* ── The protagonist: big portrait image, edge-to-edge. Fills the row
          height (flex-1) so the photo and the About panel beside it stay the
          same height — one integrated surface, no dead space. A floor keeps it
          tall when the description is short. ── */}
      <div className="relative min-h-[340px] w-full flex-1">
        {/* Layer 0 — deterministic on-brand base (also the no-image art). */}
        <span aria-hidden className="absolute inset-0" style={coverStyle(agent.id || agent.name, meta.accent)} />

        {/* Blurred copy of the same image → color aura from the image itself. */}
        {showImg && (
          <img
            aria-hidden
            src={agent.imageUrl ?? undefined}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
          />
        )}

        {/* Initial fallback (always mounted; hidden once the sharp image loads). */}
        <span
          aria-hidden
          className={`absolute inset-0 grid place-items-center text-7xl font-black text-white/90 transition-opacity duration-300 ${
            showImg ? "opacity-0" : "opacity-100"
          }`}
          style={coverStyle(agent.name || agent.id, meta.accent)}
        >
          {initial(agent.name)}
        </span>

        {/* Sharp image — revealed only once it genuinely loads. */}
        {agent.imageUrl && (
          <img
            {...imgProps}
            src={agent.imageUrl}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              showImg ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Save — floating top-right over the image. */}
        <div className="absolute right-3 top-3 z-20">
          <SaveButton agent={snapshot} variant="icon" />
        </div>

        {/* Vignette so the image melts into the identity band below. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/30 to-transparent"
        />

        {/* Identity band — name · role only, anchored to the bottom of the
            image. Category + tags live in the stats rail, not over the photo. */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-4 pb-4">
          <h1
            className="text-[26px] font-bold leading-tight text-text"
            style={{ textShadow: "0 1px 14px rgba(0,0,0,0.7)" }}
          >
            {agent.name}
          </h1>
          <div
            className="text-sm font-semibold"
            style={{ color: meta.accent, textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}
          >
            {meta.role}
          </div>
        </div>
      </div>

      {/* ── Action zone below the image ── */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs">
          {owner ? <span className="text-text-3">by {owner}</span> : <span />}
          {agent.source === "8004scan" ? <LiveBadge /> : <TestnetBadge />}
        </div>
        <Link
          to={hireHref(agent.id, agent.chainId)}
          className="btn-metal mt-1 flex w-full items-center justify-center rounded-[10px] px-6 py-3 text-sm font-semibold text-bg"
        >
          Hire agent →
        </Link>
        <SaveButton agent={snapshot} variant="labeled" />
      </div>
    </div>
  );
}

/**
 * AddToPortfolioButton — the "+" beside the heart on an agent.
 *
 * Stages the agent into the portfolio draft (lib/portfolioDraft.ts) — the same
 * draft the builder (/portfolio/new) reads — and a floating PortfolioDraftPill
 * surfaces "Portfolio (N) → Build". Visually matches SaveButton's icon variant so
 * the heart and the "+" read as a pair. Client-only + reactive; SSR-safe.
 */

import { addToDraft, removeFromDraft, useInDraft } from "../lib/portfolioDraft";
import type { SavedAgent } from "./../lib/saved";

export function AddToPortfolioButton({
  agent,
  className = "",
}: {
  agent: Omit<SavedAgent, "savedAt">;
  className?: string;
}) {
  const inDraft = useInDraft(agent.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        // Cards wrap this in a Link — don't navigate when toggling.
        e.preventDefault();
        e.stopPropagation();
        if (inDraft) removeFromDraft(agent.id);
        else addToDraft(agent);
      }}
      aria-pressed={inDraft}
      aria-label={inDraft ? "Remove from portfolio draft" : "Add to a portfolio"}
      title={inDraft ? "In your portfolio draft" : "Add to a portfolio"}
      className={
        "grid h-8 w-8 place-items-center rounded-full border text-base leading-none transition-colors " +
        (inDraft
          ? "border-brand bg-brand/[0.10] text-brand"
          : "border-border bg-surface-2/80 text-text-3 hover:border-brand hover:text-brand") +
        (className ? ` ${className}` : "")
      }
    >
      <span aria-hidden>{inDraft ? "✓" : "＋"}</span>
    </button>
  );
}

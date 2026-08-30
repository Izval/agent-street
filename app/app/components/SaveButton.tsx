/**
 * SaveButton — toggle an agent into the client-side saved list (lib/saved.ts).
 *
 * Two variants: `icon` (compact heart, for cards) and `labeled` (full-width
 * secondary button, for the hire rail). Accessible via `aria-pressed`. When it
 * lives inside a <Link> (cards), it stops the click from navigating.
 */

import { toggleSaved, useIsSaved, type SavedAgent } from "../lib/saved";

export function SaveButton({
  agent,
  variant = "icon",
  className = "",
}: {
  /** Snapshot to persist (savedAt is filled on insert). */
  agent: Omit<SavedAgent, "savedAt">;
  variant?: "icon" | "labeled";
  className?: string;
}) {
  const saved = useIsSaved(agent.id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved(agent);
  };

  const label = saved ? "Saved" : "Save";
  const heart = saved ? "♥" : "♡";

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save agent"}
        className={
          "flex w-full items-center justify-center gap-2 rounded-[8px] border px-4 py-2.5 text-sm font-semibold transition-colors " +
          (saved
            ? "border-brand/50 bg-brand/10 text-brand hover:bg-brand/15"
            : "border-border text-text-2 hover:border-brand hover:text-text") +
          (className ? " " + className : "")
        }
      >
        <span aria-hidden className="text-base leading-none">
          {heart}
        </span>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save agent"}
      title={saved ? "Saved" : "Save"}
      className={
        "grid h-8 w-8 place-items-center rounded-full border text-base leading-none transition-colors " +
        (saved
          ? "border-brand/50 bg-brand/10 text-brand"
          : "border-border bg-surface-2/80 text-text-3 hover:border-brand hover:text-brand") +
        (className ? " " + className : "")
      }
    >
      <span aria-hidden>{heart}</span>
    </button>
  );
}

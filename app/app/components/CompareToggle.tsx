/**
 * CompareToggle — add/remove an agent from the compare set (lib/compare.ts).
 *
 * A small labeled toggle for the card flyout footer. Mirrors SaveButton: stops the
 * click from navigating when it lives inside a <Link>, and reflects state via
 * aria-pressed. Disabled (with a hint) once COMPARE_MAX is reached and this agent
 * isn't already in the set.
 */

import {
  toggleCompare,
  useInCompare,
  useCompare,
  COMPARE_MAX,
  type CompareAgent,
} from "../lib/compare";

export function CompareToggle({
  agent,
  className = "",
}: {
  agent: CompareAgent;
  className?: string;
}) {
  const inSet = useInCompare(agent.id);
  const list = useCompare();
  const full = !inSet && list.length >= COMPARE_MAX;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (full) return;
    toggleCompare(agent);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={inSet}
      disabled={full}
      title={full ? `Compare holds up to ${COMPARE_MAX}` : inSet ? "Remove from compare" : "Add to compare"}
      className={
        "inline-flex items-center gap-1.5 rounded-[999px] border px-3 py-1 text-[11px] font-semibold transition-colors " +
        (inSet
          ? "border-brand/50 bg-brand/10 text-brand"
          : full
            ? "cursor-not-allowed border-border text-text-3 opacity-60"
            : "border-border text-text-2 hover:border-brand hover:text-text") +
        (className ? " " + className : "")
      }
    >
      <span aria-hidden>⇄</span>
      {inSet ? "In compare" : "Compare"}
    </button>
  );
}

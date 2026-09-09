/**
 * SavePortfolioButton — bookmark a whole portfolio (lib/savedPortfolios.ts).
 *
 * Distinct from the portfolio HEART (a public like counter): this is the private
 * "save it for later" bookmark, the portfolio analogue of SaveButton for agents.
 * Client-only + reactive; SSR-safe. Cards wrap it in a Link, so it stops the
 * click from navigating.
 */

import {
  togglePortfolioSaved,
  useIsPortfolioSaved,
  type SavedPortfolio,
} from "../lib/savedPortfolios";

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 2.5h8a.5.5 0 0 1 .5.5v10.4a.4.4 0 0 1-.62.34L8 11.3l-3.88 2.44A.4.4 0 0 1 3.5 13.4V3a.5.5 0 0 1 .5-.5Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavePortfolioButton({
  portfolio,
  variant = "icon",
  className = "",
}: {
  portfolio: Omit<SavedPortfolio, "savedAt">;
  variant?: "icon" | "labeled";
  className?: string;
}) {
  const saved = useIsPortfolioSaved(portfolio.slug);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePortfolioSaved(portfolio);
  };

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={
          "inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border px-4 text-sm font-semibold transition-colors " +
          (saved
            ? "border-brand/50 bg-brand/[0.06] text-text"
            : "border-border text-text-2 hover:border-brand hover:text-text") +
          (className ? ` ${className}` : "")
        }
      >
        <BookmarkIcon filled={saved} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove bookmark" : "Save portfolio"}
      title={saved ? "Saved" : "Save portfolio"}
      className={
        "grid h-8 w-8 place-items-center rounded-full border leading-none transition-colors " +
        (saved
          ? "border-brand bg-brand/[0.10] text-brand"
          : "border-border bg-surface-2/80 text-text-3 hover:border-brand hover:text-brand") +
        (className ? ` ${className}` : "")
      }
    >
      <BookmarkIcon filled={saved} />
    </button>
  );
}

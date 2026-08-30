/**
 * Skeleton — loading primitives with shimmer (DESIGN.md v3 §21: no spinners).
 * Parameterizable `.shimmer` block + composition variants (card, row).
 * SSR-safe: pure markup, the animation lives in CSS (`.shimmer`, reduced-motion).
 */

type Rounded = "none" | "sm" | "md" | "lg" | "pill" | "full";

const ROUNDED: Record<Rounded, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded",
  lg: "rounded-lg",
  pill: "rounded-[999px]",
  full: "rounded-full",
};

export interface SkeletonProps {
  /** CSS width (px number → px, or any CSS value: "100%", "8rem"). */
  width?: number | string;
  /** CSS height (px number → px, or any CSS value). */
  height?: number | string;
  rounded?: Rounded;
  className?: string;
}

function toCss(v: number | string | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

export function Skeleton({
  width,
  height = 12,
  rounded = "md",
  className = "",
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`shimmer block ${ROUNDED[rounded]} ${className}`}
      style={{ width: toCss(width), height: toCss(height) }}
    />
  );
}

/** Placeholder for an AgentCard (avatar + title + data strip + spark). */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`glass-panel flex flex-col gap-3 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <Skeleton width={40} height={40} rounded="full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton width="70%" height={12} />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton width="33%" height={28} rounded="md" />
        <Skeleton width="33%" height={28} rounded="md" />
        <Skeleton width="33%" height={28} rounded="md" />
      </div>
      <Skeleton width="100%" height={28} rounded="md" />
    </div>
  );
}

/** Placeholder for a dense row (TrendingRow / AgentRow). */
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center gap-3 px-2 py-2.5 ${className}`}
    >
      <Skeleton width={18} height={12} />
      <Skeleton width={28} height={28} rounded="full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton width="60%" height={11} />
        <Skeleton width="35%" height={9} />
      </div>
      <Skeleton width={48} height={12} />
      <Skeleton width={64} height={24} rounded="md" />
    </div>
  );
}

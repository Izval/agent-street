/**
 * Badges de estado y de fuente (DESIGN.md §5, §6).
 * Verde/rojo solo para datos; nunca decorativos.
 */

import type { AgentSource } from "../lib/agents";

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-up">
      <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
      Live
    </span>
  );
}

export function TestnetBadge() {
  return (
    <span className="text-xs font-semibold text-text-3">Testnet</span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="rounded-[999px] bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-2">
      ✓ Verified
    </span>
  );
}

export function X402Badge() {
  return (
    <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-2">
      x402
    </span>
  );
}

/** Honestidad de Data Quality: 8004scan en vivo vs seed curado. */
export function SourceBadge({ source }: { source: AgentSource }) {
  if (source === "8004scan") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-3">
        <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
        8004scan
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-text-3">curated</span>
  );
}

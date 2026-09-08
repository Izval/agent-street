/**
 * Badges de estado y de fuente (DESIGN.md §5, §6).
 * Verde/rojo solo para datos; nunca decorativos.
 */

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

/** A2A endpoint liveness. Data-colored (green up / muted) — never decorative. */
export function EndpointBadge({ live }: { live: boolean }) {
  if (live) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-up">
        <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden />
        Endpoint live
      </span>
    );
  }
  return (
    <span className="rounded-[999px] border border-border px-2 py-0.5 text-xs font-semibold text-text-3">
      Endpoint unreachable
    </span>
  );
}


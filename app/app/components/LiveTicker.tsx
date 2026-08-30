/**
 * LiveTicker — "control room" bottom bar (plan §5.9). Prop-driven: the
 * page passes the data (BNB price, gas, agent count); the component does NOT
 * fetch. `.glass-hair`, `● Live` with `.live-dot`, micro-pulse when the
 * price changes (WAAPI in effect → SSR-safe, respects reduced-motion). Null data is
 * omitted (no noisy "—"). A11y: discreet `role="status"`.
 */

import { useEffect, useRef, useState } from "react";

export interface LiveTickerProps {
  /** BNB price in USD (CMC). null → omitted. */
  bnbPriceUsd?: number | null;
  /** Gas in gwei (RPC). null → omitted. */
  gasGwei?: number | null;
  /** Number of indexed agents. null → omitted. */
  agentCount?: number | null;
  /** true while the BSC indexer is catching up. */
  indexing?: boolean;
}

function Sep() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

const fmtUsd = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LiveTicker({
  bnbPriceUsd,
  gasGwei,
  agentCount,
  indexing = false,
}: LiveTickerProps) {
  const prev = useRef<number | null | undefined>(bnbPriceUsd);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = bnbPriceUsd;
    if (bnbPriceUsd == null || before == null || before === bnbPriceUsd) return;
    setFlash(bnbPriceUsd < before ? "down" : "up");
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [bnbPriceUsd]);

  const flashCls =
    flash === "up" ? "bg-up/15" : flash === "down" ? "bg-down/15" : "bg-transparent";

  return (
    <div
      role="status"
      aria-label="Live BSC network status"
      className="glass-hair sticky bottom-0 z-40 flex items-center gap-2.5 overflow-x-auto px-4 py-2 text-xs text-text-2"
    >
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-up">
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
        Live
      </span>

      {indexing && (
        <>
          <Sep />
          <span className="shrink-0 text-text-3">Indexing BSC</span>
        </>
      )}

      {bnbPriceUsd != null && (
        <>
          <Sep />
          <span className="flex shrink-0 items-center gap-1">
            <span className="text-text-3">BNB</span>
            <span
              className={`tnum rounded px-1 font-semibold text-text transition-colors duration-[var(--dur-std)] ${flashCls}`}
            >
              ${fmtUsd(bnbPriceUsd)}
            </span>
          </span>
        </>
      )}

      {gasGwei != null && (
        <>
          <Sep />
          <span className="flex shrink-0 items-center gap-1">
            <span className="text-text-3">Gas</span>
            <span className="tnum font-semibold text-text">
              {gasGwei.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
            <span className="text-text-3">gwei</span>
          </span>
        </>
      )}

      {agentCount != null && (
        <>
          <Sep />
          <span className="flex shrink-0 items-center gap-1">
            <span className="tnum font-semibold text-text">
              {agentCount.toLocaleString("en-US")}
            </span>
            <span className="text-text-3">agents</span>
          </span>
        </>
      )}
    </div>
  );
}

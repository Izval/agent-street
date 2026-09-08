/**
 * ProfileStats — the secondary metrics rail (RIGHT of the profile hero).
 *
 * Dedicated to the two real charts (usage + reputation), stacked and pinned
 * (no tab switcher). Headline stats and identity facts now lead the About
 * panel; this rail is charts only. Every value is real (8004scan / agent) or "—".
 */

import type { AgentDetail, UsageSeries } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { DashboardChart, type TransactionsPromise } from "./DashboardChart";

export function ProfileStats({
  detail,
  usage,
  transactions,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
  usage: UsageSeries | null;
  /** Streamed onchain feed (see routes/agent.tsx) — the usage chart's Onchain
   *  toggle resolves it lazily; the rail paints without waiting on it. */
  transactions?: TransactionsPromise;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Both charts, stacked 50/50 (usage + reputation) — pinned, no tabs. */}
      <div className="min-h-0 flex-1">
        <DashboardChart detail={detail} usage={usage} transactions={transactions} compact only="usage" />
      </div>
      <div className="min-h-0 flex-1">
        <DashboardChart detail={detail} usage={usage} compact only="reputation" />
      </div>
    </div>
  );
}

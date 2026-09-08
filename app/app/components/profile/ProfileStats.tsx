/**
 * ProfileStats — the secondary metrics rail (RIGHT of the profile hero).
 *
 * Dedicated to the two real charts (usage + reputation), stacked and pinned
 * (no tab switcher). Headline stats and identity facts now lead the About
 * panel; this rail is charts only. Every value is real (8004scan / agent) or "—".
 */

import type { AgentDetail, UsageSeries } from "../../lib/contracts";
import type { ProfileMeta } from "../../lib/profile";
import { DashboardChart } from "./DashboardChart";

export function ProfileStats({
  detail,
  usage,
}: {
  detail: AgentDetail;
  meta: ProfileMeta;
  usage: UsageSeries | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Both charts, stacked 50/50 (usage + reputation) — pinned, no tabs. */}
      <div className="min-h-0 flex-1">
        <DashboardChart detail={detail} usage={usage} compact only="usage" />
      </div>
      <div className="min-h-0 flex-1">
        <DashboardChart detail={detail} usage={usage} compact only="reputation" />
      </div>
    </div>
  );
}

import { env } from "cloudflare:workers";
import { useEffect } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/agent";
import { loadAgentDetail } from "../lib/detail";
import { createTrendingClient } from "../lib/trending";
import { getProfileMeta } from "../lib/profile";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { SaveButton } from "../components/SaveButton";
import { AgentAccessPanel } from "../components/AgentAccessPanel";
import { IdentityHeader } from "../components/profile/IdentityHeader";
import { SpecialtyPanel } from "../components/profile/SpecialtyPanel";
import { HireRail } from "../components/profile/HireRail";
import {
  TrackRecord,
  ReputationSection,
  AllocationSection,
  EquitySection,
  ActivitySection,
  SkillsSection,
} from "../components/profile/sections";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.detail?.agent?.name ?? "Agent"} — Agent-Street` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const detail = await loadAgentDetail(
    {
      proxyUrl: env.PROXY_8004_URL,
      indexerUrl: env.ONCHAIN_INDEXER_URL,
    },
    params.id,
  );
  if (!detail) throw new Response("Not found", { status: 404 });
  return { detail, analyticsUrl: env.ANALYTICS_URL, mcpUrl: env.MCP_URL };
}

export default function AgentDetail({ loaderData }: Route.ComponentProps) {
  const { detail, analyticsUrl, mcpUrl } = loaderData;
  const { agent, services } = detail;
  const meta = getProfileMeta(agent);

  // Count the real visit (first-hand demand → trending engine).
  useEffect(() => {
    createTrendingClient({ baseUrl: analyticsUrl }).event(agent.id, "view");
  }, [agent.id, analyticsUrl]);

  const snapshot = {
    id: agent.id,
    name: agent.name,
    category: agent.category,
    categoryLabel: agent.categoryLabel,
    score: agent.score,
    imageUrl: agent.imageUrl,
    source: agent.source,
  };

  return (
    <AppShell
      activeAisle={detail.aisle ?? undefined}
      activeCategory={agent.category ?? undefined}
    >
      <div className="pb-24 lg:pb-2">
        <div className="py-2">
          <Link
            to={agent.category ? `/category/${agent.category}` : "/"}
            className="text-sm text-text-3 transition-colors hover:text-text"
          >
            ← {agent.categoryLabel ?? "Marketplace"}
          </Link>
        </div>

        <IdentityHeader detail={detail} meta={meta} />

        {/* Mobile: the hire card sits right under the header (CTA at the top). */}
        <div className="mt-4 lg:hidden">
          <HireRail detail={detail} meta={meta} />
        </div>

        {/* Two columns: CV content · sticky hire rail. */}
        <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
            {/* About */}
            <Card className="p-5">
              <p className="text-[15px] leading-relaxed text-text">
                {agent.description || "ERC-8004 agent on BNB Chain."}
              </p>
              <p className="mt-3 text-sm text-text-3">{meta.tagline}</p>
            </Card>

            <SpecialtyPanel detail={detail} meta={meta} />
            <TrackRecord detail={detail} />
            <ReputationSection detail={detail} />

            <div className="grid gap-4 lg:grid-cols-2">
              <AllocationSection detail={detail} />
              <ActivitySection detail={detail} />
            </div>

            <EquitySection detail={detail} />
            <SkillsSection detail={detail} />

            {/* Agent-native access (MCP + direct A2A/ERC-8183). */}
            <AgentAccessPanel
              mcpUrl={mcpUrl}
              agentId={agent.id}
              agentName={agent.name}
              services={services}
              x402Supported={agent.x402Supported}
            />

            {/* Data provenance (Data Quality is a judged criterion). */}
            <p className="text-xs text-text-3">
              Sources: <span className="text-text-2">8004scan</span> (reputation ·
              services) and <span className="text-text-2">onchain indexer</span>{" "}
              (portfolio · trades). Missing data is shown as “—”, never estimated.
            </p>
          </div>

          {/* Desktop: sticky hire rail. */}
          <aside className="hidden lg:block">
            <div className="sticky top-[120px]">
              <HireRail detail={detail} meta={meta} />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile: pinned bottom action bar so Hire is always reachable. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-bg/95 p-3 backdrop-blur lg:hidden">
        <SaveButton agent={snapshot} variant="icon" className="h-11 w-11 shrink-0" />
        <Link
          to={`/hire?agent=${encodeURIComponent(agent.id)}`}
          className="flex flex-1 items-center justify-center rounded-[8px] bg-brand px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
        >
          Hire agent →
        </Link>
      </div>
    </AppShell>
  );
}

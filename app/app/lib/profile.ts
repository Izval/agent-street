/**
 * Profile presentation layer — turns an agent's subcategory into a professional
 * "CV / hire" framing. Keyed on the render TEMPLATE (subcategoryTemplate) for the
 * structure (role, tagline, specialty title, KPI labels) and on the CATEGORY for
 * the accent, per DESIGN.md §16/§17 and the redesign decision "adapt by both".
 *
 * Honesty rule (DESIGN.md §18): KPIs with no real backing in v1 render "—" with
 * a one-line reason. Nothing subcategory-specific is fabricated — see the data
 * inventory: only reputation and conditional onchain data are real.
 */

import type { Agent } from "./agents";
import type { AgentDetail } from "./contracts";
import type { Category, Subcategory, TemplateKind } from "./taxonomy";
import { CATEGORIES, categoryOf, subcategoryTemplate } from "./taxonomy";

// ---------------------------------------------------------------- //
// Formatting helpers (shared across the profile sections)
// ---------------------------------------------------------------- //

export function usd(n: number): string {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  if (n >= 1_000)
    return `$${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function short(addr?: string | null): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

/** "open_or_hold" → "Open / hold". */
export function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOr\b/g, "/");
}

// ---------------------------------------------------------------- //
// Per-template + per-subcategory framing
// ---------------------------------------------------------------- //

export interface ProfileMeta {
  template: TemplateKind;
  category: Category | null;
  /** Accent token for the category (never competes with the brand yellow). */
  accent: string;
  /** The agent's "job title". */
  role: string;
  /** One line: what you're hiring it for. */
  tagline: string;
  /** Heading of the template-driven specialty panel. */
  specialtyTitle: string;
}

const TEMPLATE_META: Record<
  TemplateKind,
  { role: string; tagline: string; specialtyTitle: string }
> = {
  clmm: {
    role: "Concentrated-liquidity range manager",
    tagline: "Hire it to keep a PancakeSwap v3 position in range and rebalancing onchain.",
    specialtyTitle: "Range strategy",
  },
  trading: {
    role: "Automated trading agent",
    tagline: "Hire it to run a systematic strategy across liquid BSC pairs.",
    specialtyTitle: "Strategy",
  },
  yield: {
    role: "Yield optimizer",
    tagline: "Hire it to route capital to the best risk-adjusted yield on BSC.",
    specialtyTitle: "Protocols & strategy",
  },
  health: {
    role: "Health-factor guardian",
    tagline: "Hire it to watch your lending positions and act before liquidation.",
    specialtyTitle: "What it monitors",
  },
  nft: {
    role: "NFT strategist",
    tagline: "Hire it to work NFT floors and mints on BSC.",
    specialtyTitle: "Capabilities",
  },
  rwa: {
    role: "Tokenized-asset agent",
    tagline: "Hire it to manage tokenized real-world exposure.",
    specialtyTitle: "Mandate",
  },
  services: {
    role: "Service agent",
    tagline: "Hire it to plug a composable capability into your workflow.",
    specialtyTitle: "Services & interface",
  },
};

/** Finer role label per specific subcategory (falls back to the template role). */
const ROLE_BY_SUBCATEGORY: Partial<Record<Subcategory, string>> = {
  rebalancing: "Concentrated-liquidity rebalancer",
  "liquidity-pool": "LP management agent",
  grid: "Grid trading agent",
  dca: "DCA accumulation agent",
  momentum: "Momentum trading agent",
  "copy-trade": "Copy-trading agent",
  "market-making": "Market-making agent",
  perps: "Perpetuals trading agent",
  lending: "Lending strategist",
  "liquid-staking": "Liquid-staking router",
  "meme-trading": "Meme trading agent",
  "meme-launch": "Launch sniper",
  "nft-floor": "NFT floor strategist",
  "nft-mint": "Mint sniper",
  "rwa-treasury": "Treasury manager",
  "rwa-assets": "Tokenized-asset agent",
  "payments-x402": "x402 payments agent",
  "payments-jobs": "Job / seller agent",
  "infra-data": "Data & oracle agent",
  "infra-automation": "Automation agent",
  "cyber-audit": "Security audit agent",
  "cyber-monitor": "Threat monitoring agent",
  "cyber-approvals": "Approval hygiene agent",
  "social-signals": "Signals agent",
  "social-narratives": "Narratives agent",
};

export function getProfileMeta(agent: Agent): ProfileMeta {
  const template = subcategoryTemplate(agent.subcategory);
  const category = agent.subcategory ? categoryOf(agent.subcategory) : null;
  const accent = CATEGORIES.find((a) => a.id === category)?.accent ?? "var(--brand)";
  const base = TEMPLATE_META[template];
  const role =
    (agent.subcategory && ROLE_BY_SUBCATEGORY[agent.subcategory]) || base.role;
  return {
    template,
    category,
    accent,
    role,
    tagline: base.tagline,
    specialtyTitle: base.specialtyTitle,
  };
}

// ---------------------------------------------------------------- //
// Track record — template-driven KPI labels, real values or honest "—"
// ---------------------------------------------------------------- //

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

export function getTrackRecord(detail: AgentDetail): Kpi[] {
  const { agent, reputation, metrics, services, portfolio } = detail;
  const template = subcategoryTemplate(agent.subcategory);

  const score =
    reputation?.totalScore != null
      ? reputation.totalScore.toFixed(1)
      : String(agent.score);
  const reviews = String(agent.feedbacks);
  const stars = agent.stars ? `${agent.stars}/5` : "—";
  const freshness =
    reputation?.freshness != null ? String(Math.round(reputation.freshness)) : "—";
  const health =
    reputation?.health != null
      ? String(Math.round(reputation.health))
      : agent.healthScore != null
        ? String(agent.healthScore)
        : "—";
  const nProto = agent.supportedProtocols?.length ?? 0;
  const protoValue = nProto ? String(nProto) : "—";
  const protoHint = nProto ? "supported" : "not listed";
  const pValue = metrics ? usd(metrics.totalUsd) : "—";
  const pHint = portfolio?.source === "onchain" ? "onchain" : "not indexed";
  const nTrades = metrics ? String(metrics.tradeCount) : "—";
  const tHint = metrics?.tradeCount ? "since indexed" : "requires indexer key";

  switch (template) {
    case "clmm":
      return [
        { label: "LP capital", value: pValue, hint: pHint },
        { label: "Repositions", value: nTrades, hint: tHint },
        { label: "Total score", value: score, hint: "8004scan" },
        { label: "Reviews", value: reviews, hint: "feedbacks" },
      ];
    case "trading":
      return [
        { label: "Total score", value: score, hint: "8004scan" },
        { label: "Trades", value: nTrades, hint: tHint },
        { label: "Portfolio", value: pValue, hint: pHint },
        { label: "Win rate", value: "—", hint: "needs NAV history" },
      ];
    case "yield":
      return [
        { label: "Total score", value: score, hint: "8004scan" },
        { label: "Protocols", value: protoValue, hint: protoHint },
        { label: "Best APY", value: "—", hint: "live from endpoint" },
        { label: "Reviews", value: reviews, hint: "feedbacks" },
      ];
    case "health":
      return [
        { label: "Reliability", value: health, hint: "8004scan health" },
        { label: "Total score", value: score, hint: "8004scan" },
        { label: "Health factor", value: "—", hint: "read at hire" },
        { label: "Reviews", value: reviews, hint: "feedbacks" },
      ];
    case "nft":
      return [
        { label: "Total score", value: score, hint: "8004scan" },
        { label: "Floor", value: "—", hint: "not indexed" },
        { label: "Reviews", value: reviews, hint: "feedbacks" },
        { label: "Stars", value: stars, hint: "avg rating" },
      ];
    case "rwa":
      return [
        { label: "Total score", value: score, hint: "8004scan" },
        { label: "Protocols", value: protoValue, hint: protoHint },
        { label: "Yield", value: "—", hint: "not indexed" },
        { label: "Reviews", value: reviews, hint: "feedbacks" },
      ];
    case "services":
    default:
      return [
        {
          label: "Skills",
          value: String(services?.skills.length ?? 0),
          hint: services?.cardLive ? "live card" : "listed",
        },
        { label: "Freshness", value: freshness, hint: "8004scan" },
        { label: "x402", value: agent.x402Supported ? "Yes" : "No", hint: "payments" },
        { label: "Reviews", value: reviews, hint: "feedbacks" },
      ];
  }
}

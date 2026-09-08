/**
 * Footer — modern marketplace mega-footer (DESIGN.md, BNB-native).
 *
 * A wide link matrix (marketplace · subcategories · build) beside a brand block
 * with the live-network status, over a hairline top border and a scarce
 * BNB-yellow corner glow. A large faded wordmark anchors the base, above the
 * legal/attribution row ("Built on BNB Chain"). Rendered once by AppShell, so
 * it is present on every page. SSR-safe: no client state, pure links.
 */

import { Link } from "react-router";
import { CATEGORIES } from "../lib/taxonomy";

interface FooterLink {
  label: string;
  to: string;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Marketplace",
    links: [
      { label: "All agents", to: "/" },
      { label: "Skills", to: "/skills" },
      { label: "Portfolios", to: "/portfolios" },
      { label: "Saved", to: "/saved" },
      { label: "Search", to: "/search" },
    ],
  },
  {
    title: "Categories",
    links: CATEGORIES.map((a) => ({ label: a.label, to: `/category/${a.id}` })),
  },
  {
    title: "Build",
    links: [
      { label: "Build agent", to: "/create" },
      { label: "For agents", to: "/for-agents" },
      { label: "How to hire", to: "/docs/hiring" },
      { label: "Docs", to: "/docs" },
    ],
  },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link
              to={l.to}
              className="text-sm text-text-2 transition-colors hover:text-text"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({
  agentCount,
  network = "BSC",
}: {
  agentCount?: number | null;
  network?: string;
}) {
  return (
    <footer className="relative isolate mt-16 overflow-hidden border-t border-border bg-bg">
      {/* Scarce BNB-yellow glow, spilling from the top-left corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 -z-10 h-80 w-80"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(240,185,11,0.10), rgba(240,185,11,0.03) 45%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-14 md:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.6fr_repeat(3,1fr)] lg:gap-x-10">
          {/* Brand block */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo-mark.svg"
                alt="Agent-Street"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="font-mono text-base font-bold uppercase tracking-[0.08em]">
                Agent<span className="text-brand">-</span>Street
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-2">
              The marketplace to discover, compare and hire ERC-8004 agents and
              composable skills on BNB Chain.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-[999px] border border-border px-2.5 py-1 font-semibold text-text-2">
                <span
                  className="live-dot h-1.5 w-1.5 rounded-full bg-up"
                  aria-hidden
                />
                Live
              </span>
              <span className="text-text-3">{network}</span>
              {agentCount != null && (
                <>
                  <span aria-hidden className="text-border">
                    ·
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="tnum font-semibold text-text">
                      {agentCount.toLocaleString("en-US")}
                    </span>
                    <span className="text-text-3">agents indexed</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Link matrix */}
          {COLUMNS.map((col) => (
            <FooterColumn key={col.title} title={col.title} links={col.links} />
          ))}
        </div>

        {/* Large faded lockup — AGENT on the left, the logo mark in the centre,
            STREET on the right, all sharing one top-to-bottom fade. */}
        <div
          aria-hidden
          className="pointer-events-none mt-12 flex select-none items-center justify-center gap-[clamp(8px,2vw,32px)] overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 0%, black 35%, transparent 92%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 35%, transparent 92%)",
          }}
        >
          <span className="font-mono text-[clamp(32px,8vw,135px)] font-bold uppercase leading-none tracking-[0.02em] text-white/[0.12]">
            Agent
          </span>
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-[clamp(110px,20vw,300px)] w-auto opacity-[0.2]"
          />
          <span className="font-mono text-[clamp(32px,8vw,135px)] font-bold uppercase leading-none tracking-[0.02em] text-white/[0.12]">
            Street
          </span>
        </div>

        {/* Legal / attribution row */}
        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-xs text-text-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Agent-Street. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-brand"
            />
            <span className="font-semibold text-text-2">Built on BNB Chain</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

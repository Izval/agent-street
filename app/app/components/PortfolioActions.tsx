/**
 * PortfolioActions — client island for a portfolio detail page.
 *
 *   - Save all: adds every member to the local saved store (lib/saved.ts).
 *   - Share:    copies the portfolio URL (Web Share / clipboard).
 *   - Copy:     clones the set into the builder draft (agentic copy-trading) and
 *               records a real `copy` event.
 *   - Hire all: guided multi-hire — records the `hire_all` intent and walks each
 *               member through the existing per-agent client-pays flow. Every
 *               payment is a real onchain tx; nothing is batched or faked.
 *
 * Honesty: counters are first-party (we count them); no onchain state is
 * fabricated. Events degrade silently if the portfolios worker is unavailable.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router";
import type { ResolvedPortfolio } from "../lib/portfolios";
import { hireHref } from "../lib/agents";
import { useSavedAgents, toggleSaved, type SavedAgent } from "../lib/saved";
import { createPortfoliosClient } from "../lib/portfolios-client";

const DRAFT_KEY = "agent-street:portfolio:draft:v1";
const SECRET_KEY = (slug: string) => `agent-street:portfolio:secret:${slug}`;
const FOLLOW_KEY = (slug: string) => `agent-street:portfolio:follow:${slug}`;

function toSnapshot(a: ResolvedPortfolio["agents"][number]): SavedAgent {
  return {
    id: a.id,
    name: a.name,
    subcategory: a.subcategory,
    subcategoryLabel: a.subcategoryLabel,
    score: a.score,
    imageUrl: a.imageUrl,
    source: a.source === "seed" ? "seed" : "8004scan",
    savedAt: Date.now(),
  };
}

export function PortfolioActions({
  portfolio,
  portfoliosUrl,
}: {
  portfolio: ResolvedPortfolio;
  portfoliosUrl?: string;
}) {
  const saved = useSavedAgents();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [ownerSecret, setOwnerSecret] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<number>(portfolio.stats?.followers ?? 0);

  // Owner control + follow state: read this browser's local flags on mount.
  useEffect(() => {
    if (portfolio.source !== "user") return;
    try {
      setOwnerSecret(window.localStorage.getItem(SECRET_KEY(portfolio.slug)));
      setFollowing(window.localStorage.getItem(FOLLOW_KEY(portfolio.slug)) === "1");
    } catch {
      setOwnerSecret(null);
    }
  }, [portfolio.source, portfolio.slug]);

  function toggleFollow() {
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) window.localStorage.setItem(FOLLOW_KEY(portfolio.slug), "1");
      else window.localStorage.removeItem(FOLLOW_KEY(portfolio.slug));
    } catch {
      /* storage disabled — the event still records intent */
    }
    void client.event(portfolio.slug, next ? "follow" : "unfollow");
  }

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const unsavedCount = portfolio.agents.filter((a) => !savedIds.has(a.id)).length;
  const allSaved = portfolio.agents.length > 0 && unsavedCount === 0;
  const client = useMemo(() => createPortfoliosClient({ baseUrl: portfoliosUrl }), [portfoliosUrl]);

  function saveAll() {
    for (const a of portfolio.agents) {
      if (savedIds.has(a.id)) continue;
      toggleSaved({
        id: a.id,
        name: a.name,
        subcategory: a.subcategory,
        subcategoryLabel: a.subcategoryLabel,
        score: a.score,
        imageUrl: a.imageUrl,
        source: a.source === "seed" ? "seed" : "8004scan",
      });
    }
  }

  async function share() {
    const url =
      typeof window !== "undefined" ? window.location.href : `/portfolio/${portfolio.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: portfolio.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* dismissed / blocked — no-op */
    }
  }

  function copyToBuilder() {
    const draft = {
      name: `${portfolio.name} (copy)`,
      tagline: portfolio.tagline,
      members: portfolio.agents.map(toSnapshot),
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage disabled — the builder starts empty */
    }
    void client.event(portfolio.slug, "copy");
    navigate("/portfolio/new");
  }

  function startHireAll() {
    setHireOpen(true);
    void client.event(portfolio.slug, "hire_all");
  }

  async function remove() {
    if (!ownerSecret) return;
    setDeleting(true);
    const ok = await client.remove(portfolio.slug, ownerSecret);
    if (ok) {
      try {
        window.localStorage.removeItem(SECRET_KEY(portfolio.slug));
      } catch {
        /* ignore */
      }
      navigate("/portfolios");
      return;
    }
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startHireAll}
          disabled={portfolio.agents.length === 0}
          className="inline-flex min-h-[40px] items-center rounded-[999px] bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright disabled:cursor-default disabled:opacity-60"
        >
          Hire all · {portfolio.agents.length}
        </button>
        <button
          type="button"
          onClick={copyToBuilder}
          disabled={portfolio.agents.length === 0}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text disabled:cursor-default disabled:opacity-60"
        >
          <span aria-hidden>⑃</span>
          Copy &amp; edit
        </button>
        <button
          type="button"
          onClick={saveAll}
          disabled={allSaved}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text disabled:cursor-default disabled:opacity-60"
        >
          <span aria-hidden>♥</span>
          {allSaved ? "All saved" : `Save all${portfolio.agents.length ? ` · ${unsavedCount}` : ""}`}
        </button>
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          <span aria-hidden>↗</span>
          {copied ? "Link copied" : "Share"}
        </button>

        {/* Follow — user portfolios only (first-party interest signal). */}
        {portfolio.source === "user" && (
          <button
            type="button"
            onClick={toggleFollow}
            aria-pressed={following}
            className={
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border px-4 text-sm font-semibold transition-colors " +
              (following
                ? "border-brand/50 bg-brand/[0.06] text-text"
                : "border-border text-text-2 hover:border-brand hover:text-text")
            }
          >
            <span aria-hidden>{following ? "★" : "☆"}</span>
            {following ? "Following" : "Follow"}
            {followers > 0 && <span className="tnum text-text-3">· {followers}</span>}
          </button>
        )}

        {/* Owner-only: delete (this browser holds the publish secret). */}
        {ownerSecret &&
          (confirmDelete ? (
            <span className="ml-auto inline-flex items-center gap-2">
              <span className="text-xs text-text-3">Delete this portfolio?</span>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex min-h-[40px] items-center rounded-[999px] border border-down/50 px-4 text-sm font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-text-3 transition-colors hover:text-text"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex min-h-[40px] items-center rounded-[999px] border border-border px-4 text-sm font-semibold text-text-3 transition-colors hover:border-down/50 hover:text-down"
            >
              Delete
            </button>
          ))}
      </div>

      {/* Guided multi-hire: each agent is paid separately, a real tx per hire. */}
      {hireOpen && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Hire all — step by step</h3>
            <button
              type="button"
              onClick={() => setHireOpen(false)}
              className="text-xs text-text-3 transition-colors hover:text-text"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-text-3">
            Each agent is hired and paid separately from your wallet (a real onchain tx per
            agent). Work through them in order:
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {portfolio.agents.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3"
              >
                <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-bold text-text-2">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">{a.name}</span>
                  {a.subcategoryLabel && (
                    <span className="block truncate text-xs text-text-3">{a.subcategoryLabel}</span>
                  )}
                </span>
                <Link
                  to={hireHref(a.id, a.chainId)}
                  className="inline-flex min-h-[36px] shrink-0 items-center rounded-[999px] bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
                >
                  Hire →
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

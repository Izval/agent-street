/**
 * PortfolioActions — client island for a portfolio detail page.
 *
 *   - Heart:    a public like counter — a per-viewer toggle (localStorage owns
 *               idempotency), the count is shown to everyone.
 *   - Save:     bookmark this portfolio for later (lib/savedPortfolios.ts).
 *   - Share X:  open a prefilled X/Twitter intent (the detail page carries a
 *               visual OG card so the tweet renders the roster).
 *   - Save all: adds every member to the local saved-agents store (lib/saved.ts).
 *   - Copy:     clones the set into the builder draft (agentic copy-trading) and
 *               records a real `copy` event.
 *   - Hire all: guided multi-hire — records the `hire_all` intent and walks each
 *               member through the existing per-agent client-pays flow. Every
 *               payment is a real onchain tx; nothing is batched or faked.
 *   - Owner:    visibility control (Public/Unlisted/Private) + delete — gated by
 *               the device-held owner secret.
 *
 * Data rule: counters are first-party (we count them); no onchain state is
 * fabricated. Events degrade silently if the portfolios worker is unavailable.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router";
import type { ResolvedPortfolio, PortfolioVisibility } from "../lib/portfolios";
import { hireHref } from "../lib/agents";
import { useSavedAgents, toggleSaved, type SavedAgent } from "../lib/saved";
import { createPortfoliosClient } from "../lib/portfolios-client";
import { SavePortfolioButton } from "./SavePortfolioButton";

const DRAFT_KEY = "agent-street:portfolio:draft:v1";
const SECRET_KEY = (slug: string) => `agent-street:portfolio:secret:${slug}`;
const LIKE_KEY = (slug: string) => `agent-street:portfolio:like:${slug}`;

const VIS_OPTIONS: Array<{ value: PortfolioVisibility; label: string; hint: string }> = [
  { value: "public", label: "Public", hint: "Listed everywhere and ranked." },
  { value: "unlisted", label: "Unlisted", hint: "Only reachable with the link." },
  { value: "private", label: "Private", hint: "Only you, on this device." },
];

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
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number>(portfolio.stats?.likes ?? 0);
  const [visibility, setVisibility] = useState<PortfolioVisibility>(
    portfolio.visibility ?? "public",
  );
  const [savingVis, setSavingVis] = useState(false);

  // Owner control + like state: read this browser's local flags on mount.
  useEffect(() => {
    if (portfolio.source !== "user") return;
    try {
      setOwnerSecret(window.localStorage.getItem(SECRET_KEY(portfolio.slug)));
      setLiked(window.localStorage.getItem(LIKE_KEY(portfolio.slug)) === "1");
    } catch {
      setOwnerSecret(null);
    }
  }, [portfolio.source, portfolio.slug]);

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) window.localStorage.setItem(LIKE_KEY(portfolio.slug), "1");
      else window.localStorage.removeItem(LIKE_KEY(portfolio.slug));
    } catch {
      /* storage disabled — the event still records intent */
    }
    void client.event(portfolio.slug, next ? "like" : "unlike");
  }

  async function changeVisibility(next: PortfolioVisibility) {
    if (!ownerSecret || next === visibility) return;
    const prev = visibility;
    setVisibility(next);
    setSavingVis(true);
    const ok = await client.update(portfolio.slug, ownerSecret, { visibility: next });
    setSavingVis(false);
    if (!ok) setVisibility(prev); // revert on failure
  }

  function shareOnX() {
    const url =
      typeof window !== "undefined" ? window.location.href : `/portfolio/${portfolio.slug}`;
    const text = `${portfolio.name} — a portfolio of ${portfolio.agents.length} ERC-8004 agents on BNB Chain`;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    if (typeof window !== "undefined") window.open(intent, "_blank", "noopener,noreferrer");
  }

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const unsavedCount = portfolio.agents.filter((a) => !savedIds.has(a.id)).length;
  const allSaved = portfolio.agents.length > 0 && unsavedCount === 0;
  const client = useMemo(() => createPortfoliosClient({ baseUrl: portfoliosUrl }), [portfoliosUrl]);

  const creatorLabel = portfolio.creator?.address
    ? (portfolio.creator.label ?? `${portfolio.creator.address.slice(0, 6)}…`)
    : null;
  const bookmarkSnapshot = {
    slug: portfolio.slug,
    name: portfolio.name,
    creatorLabel,
    memberCount: portfolio.agents.length,
    coverKey: portfolio.coverKey,
  };

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

        {/* Heart — public like counter (user portfolios). Count always shown. */}
        {portfolio.source === "user" && (
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border px-4 text-sm font-semibold transition-colors " +
              (liked
                ? "border-brand/50 bg-brand/[0.06] text-text"
                : "border-border text-text-2 hover:border-brand hover:text-text")
            }
          >
            <span aria-hidden className={liked ? "text-brand" : ""}>
              {liked ? "♥" : "♡"}
            </span>
            {liked ? "Liked" : "Like"}
            <span className="tnum text-text-3">· {likes}</span>
          </button>
        )}

        {/* Bookmark this portfolio (private, per-device). */}
        <SavePortfolioButton portfolio={bookmarkSnapshot} variant="labeled" />

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

        {/* Share on X — the detail page carries a visual OG card. */}
        <button
          type="button"
          onClick={shareOnX}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[999px] border border-border px-4 text-sm font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
        >
          <span aria-hidden className="font-bold">
            𝕏
          </span>
          Share on X
        </button>

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

      {/* Owner-only: visibility control (device-held secret). */}
      {ownerSecret && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Visibility</h3>
            {savingVis && <span className="text-xs text-text-3">Saving…</span>}
          </div>
          <div className="mt-3 inline-flex rounded-[999px] border border-border p-0.5">
            {VIS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => changeVisibility(o.value)}
                aria-pressed={visibility === o.value}
                className={
                  "min-h-[32px] rounded-[999px] px-3 text-xs font-semibold transition-colors " +
                  (visibility === o.value
                    ? "bg-brand text-bg"
                    : "text-text-2 hover:text-text")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-3">
            {VIS_OPTIONS.find((o) => o.value === visibility)?.hint}
          </p>
        </div>
      )}

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

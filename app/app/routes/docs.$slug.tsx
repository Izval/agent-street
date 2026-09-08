/**
 * /docs/:slug — a single documentation page.
 *
 * Left: the section nav (DocLayout). Right: the page prose plus a
 * "Copy as Markdown" / "View raw" affordance (agent-legible) and prev/next.
 */

import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/docs.$slug";
import { AppShell } from "../components/AppShell";
import { DocLayout } from "../components/DocLayout";
import { NetworkAdder } from "../components/NetworkAdder";
import { getDoc, navWithMeta, prevNext, docHref, docSource } from "../lib/docs";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.doc?.title;
  return [
    { title: title ? `${title} — Agent-Street Docs` : "Docs — Agent-Street" },
    { name: "description", content: loaderData?.doc?.description ?? "" },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  const doc = getDoc(params.slug);
  if (!doc) throw new Response("Not found", { status: 404 });
  const { prev, next } = prevNext(params.slug);
  return {
    doc,
    nav: navWithMeta(),
    prev,
    next,
    source: docSource(params.slug) ?? "",
  };
}

function CopyMarkdown({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        )
      }
      className="inline-flex min-h-[32px] items-center rounded-[999px] border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
    >
      {copied ? "Copied" : "Copy as Markdown"}
    </button>
  );
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  const { doc, nav, prev, next, source } = loaderData;
  return (
    <AppShell>
      <DocLayout nav={nav} activeSlug={doc.slug}>
        <header className="pb-2">
          <h1 className="text-3xl font-bold md:text-4xl">{doc.title}</h1>
          {doc.description && (
            <p className="mt-2 max-w-2xl text-base text-text-2">
              {doc.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyMarkdown text={source} />
            <a
              href={`/raw/docs/${doc.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[32px] items-center rounded-[999px] border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-brand hover:text-text"
            >
              View raw ↗
            </a>
          </div>
        </header>

        {doc.slug === "networks" && <NetworkAdder />}

        <article
          className="doc-prose mt-6"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />

        <nav
          aria-label="Pagination"
          className="mt-12 flex items-stretch justify-between gap-4 border-t border-border pt-6"
        >
          {prev ? (
            <Link
              to={docHref(prev.slug)}
              prefetch="intent"
              className="group flex max-w-[48%] flex-col rounded-lg border border-border px-4 py-3 transition-colors hover:border-brand"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                ← Previous
              </span>
              <span className="mt-0.5 text-sm font-semibold text-text-2 transition-colors group-hover:text-text">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={docHref(next.slug)}
              prefetch="intent"
              className="group flex max-w-[48%] flex-col rounded-lg border border-border px-4 py-3 text-right transition-colors hover:border-brand"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                Next →
              </span>
              <span className="mt-0.5 text-sm font-semibold text-text-2 transition-colors group-hover:text-text">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </DocLayout>
    </AppShell>
  );
}

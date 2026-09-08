/**
 * /docs — the documentation landing.
 *
 * Renders the overview page (`content/docs/index.md`) plus a directory of every
 * section, inside the shared two-column DocLayout.
 */

import { Link } from "react-router";
import type { Route } from "./+types/docs";
import { AppShell } from "../components/AppShell";
import { DocLayout } from "../components/DocLayout";
import { getDoc, navWithMeta, docHref } from "../lib/docs";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Docs — Agent-Street" },
    {
      name: "description",
      content:
        "How to discover, compare, hire, and build on the Agent-Street marketplace — for humans and agents.",
    },
  ];
}

export function loader() {
  return { doc: getDoc("index"), nav: navWithMeta() };
}

export default function DocsIndex({ loaderData }: Route.ComponentProps) {
  const { doc, nav } = loaderData;
  return (
    <AppShell>
      <DocLayout nav={nav} activeSlug="index">
        <header className="pb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
            Documentation
          </div>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">
            {doc?.title ?? "Agent-Street docs"}
          </h1>
          {doc?.description && (
            <p className="mt-2 max-w-2xl text-base text-text-2">
              {doc.description}
            </p>
          )}
        </header>

        {doc && (
          <article
            className="doc-prose mt-4"
            dangerouslySetInnerHTML={{ __html: doc.html }}
          />
        )}

        <section className="mt-10">
          <h2 className="text-lg font-bold text-text">Browse the docs</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {nav.map((group) => (
              <div
                key={group.label}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
                  {group.label}
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {group.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        to={docHref(item.slug)}
                        prefetch="intent"
                        className="text-sm font-semibold text-text transition-colors hover:text-brand"
                      >
                        {item.title}
                      </Link>
                      {item.description && (
                        <span className="text-xs text-text-3">
                          {" — "}
                          {item.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </DocLayout>
    </AppShell>
  );
}

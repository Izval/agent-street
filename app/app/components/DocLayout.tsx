/**
 * DocLayout — two-column documentation shell (DESIGN.md v2 §11).
 *
 * Left: the hand-authored sidebar taxonomy (`navWithMeta()`), active item
 * marked with the scarce --brand left bar. Right: the page content (prose or
 * landing). Sidebar is sticky under the app header on desktop; it stacks on
 * mobile. Rendered inside <AppShell>.
 */

import { Link } from "react-router";
import type { DocNavGroup } from "../lib/docs";
import { docHref } from "../lib/docs";
import { DocSearch } from "./DocSearch";

export function DocLayout({
  nav,
  activeSlug,
  children,
}: {
  nav: DocNavGroup[];
  activeSlug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
        <div className="mb-4">
          <DocSearch />
        </div>
        <nav aria-label="Documentation" className="flex flex-col gap-5">
          {nav.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                {group.label}
              </div>
              <div className="flex flex-col">
                {group.items.map((item) => {
                  const active = item.slug === activeSlug;
                  return (
                    <Link
                      key={item.slug}
                      to={docHref(item.slug)}
                      prefetch="intent"
                      aria-current={active ? "page" : undefined}
                      className={
                        "relative rounded px-2 py-1.5 text-[13px] transition-colors " +
                        (active
                          ? "font-semibold text-text"
                          : "text-text-2 hover:bg-surface-2 hover:text-text")
                      }
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1 left-0 w-0.5 rounded-[999px] bg-brand"
                        />
                      )}
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

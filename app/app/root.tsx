import { env } from "cloudflare:workers";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { createAgentsClient } from "./lib/agents";
import { WalletProvider } from "./components/WalletProvider";

/**
 * Root loader: the persistent novelties feed (latest indexed agents) + the
 * total agent count, so the top NoveltyBar ticker and status cluster stay
 * populated on EVERY route — not just the home page. Cheap: both reads hit the
 * KV-cached 8004-proxy. Failures degrade to empty rather than breaking the page.
 */
export async function loader() {
  const agents = createAgentsClient({
    baseUrl: env.PROXY_8004_URL,
    fetcher: env.PROXY_8004,
  });

  const [total, pool] = await Promise.all([
    agents
      .list({ limit: 1 })
      .then((p) => p.pagination.total)
      .catch(() => null),
    agents.list({ limit: 15 }).catch(() => null),
  ]);

  const latest = (pool?.agents ?? []).slice(0, 15).map((a) => ({
    id: a.id,
    name: a.name,
    subcategory: a.subcategoryLabel,
    score: a.score,
  }));

  return { total, latest };
}

export const links: Route.LinksFunction = () => [
  // AVIF for modern browsers; PNG fallback for the rest (Safari/Firefox).
  { rel: "icon", type: "image/avif", href: "/favicon.avif" },
  { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // Dark is the product's canonical theme (DESIGN.md §1, §10).
    <html lang="en" data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0B0E11" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <Outlet />
    </WalletProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-8 pt-16">
      <h1 className="text-2xl font-bold text-text">{message}</h1>
      <p className="mt-2 text-text-2">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded-lg border border-border bg-surface p-4 text-text-3">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

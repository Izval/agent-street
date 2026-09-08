/**
 * /docs.search.json — the client-side docs search index.
 * Resource route: one JSON array of { slug, title, description, text },
 * fetched once (and cached) by the DocSearch box.
 */

import { buildSearchIndex } from "../lib/docs";

export function loader() {
  return new Response(JSON.stringify(buildSearchIndex()), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

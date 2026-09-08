/**
 * /raw/docs/:slug — the raw Markdown source of one doc page.
 *
 * Resource route (no default export): serves `text/markdown` so an agent can
 * read a page verbatim without parsing HTML. Prefixed with `raw/docs/` (not a
 * `.md` suffix) to keep param matching unambiguous.
 */

import type { LoaderFunctionArgs } from "react-router";
import { docSource } from "../lib/docs";

export function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug as string;
  const source = docSource(slug);
  if (!source) throw new Response("Not found", { status: 404 });
  return new Response(source, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

/**
 * /llms-full.txt — every documentation page's Markdown, concatenated.
 * Resource route; the full corpus for agents that want one fetch.
 */

import type { LoaderFunctionArgs } from "react-router";
import { buildLlmsFullTxt } from "../lib/docs";

export function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  return new Response(buildLlmsFullTxt(origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

/**
 * /llms.txt — the machine-readable documentation index (llms.txt convention).
 * Resource route; links are absolute to the request origin.
 */

import type { LoaderFunctionArgs } from "react-router";
import { buildLlmsTxt } from "../lib/docs";

export function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  return new Response(buildLlmsTxt(origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

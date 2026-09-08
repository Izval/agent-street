// deliverable.ts — generic post-settlement task dispatch.
//
// After a hire's payment verifies, the marketplace POSTs the task to the LISTING'S
// OWN published A2A endpoint and renders whatever artifact it returns. This is the
// normal marketplace interface: it works for any agent and is not conditional on
// the agent being any particular one. Any endpoint access lives here, behind the
// generic seam — the marketplace never calls a specific agent's private engine.
//
// Contract: we POST an A2A `message/send` JSON-RPC call. We accept two response
// shapes and normalize to a HireDeliverable, else return null (honest: the receipt
// stays payment-only). We NEVER fabricate a deliverable.
//
//   (a) simple:  { deliverable: { kind, title, body, links? } }
//   (b) A2A:     { result: { ... text parts ... } }  → a text deliverable

import type { HireDeliverable } from "./x402";

// Agents that compute a real deliverable synchronously (e.g. reading live market
// data + on-chain state) can take several seconds, more so on a scale-to-zero cold
// start. Give them room so the receipt carries the work-product instead of null.
const TIMEOUT_MS = 10000;
const MAX_BYTES = 64 * 1024;

function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function asDeliverable(v: unknown): HireDeliverable | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const kinds = ["text", "range", "link", "json"];
  const kind = typeof o.kind === "string" && kinds.includes(o.kind) ? (o.kind as HireDeliverable["kind"]) : "text";
  const title = typeof o.title === "string" ? o.title.slice(0, 200) : "";
  const body = typeof o.body === "string" ? o.body.slice(0, 4000) : "";
  if (!title && !body) return null;
  let links: HireDeliverable["links"];
  if (Array.isArray(o.links)) {
    links = o.links
      .filter((l): l is { label: unknown; url: unknown } => !!l && typeof l === "object")
      .map((l) => ({ label: String((l as any).label ?? ""), url: String((l as any).url ?? "") }))
      .filter((l) => l.label && isHttpUrl(l.url))
      .slice(0, 6);
    if (!links.length) links = undefined;
  }
  return { kind, title: title || "Result", body, links };
}

/** Best-effort extraction of concatenated text from an A2A result's parts. */
function textFromA2A(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const buckets: unknown[] = [];
  // Common A2A shapes: result.parts, result.artifacts[].parts, result.status.message.parts
  if (Array.isArray(r.parts)) buckets.push(...r.parts);
  if (Array.isArray(r.artifacts)) {
    for (const a of r.artifacts) {
      if (a && typeof a === "object" && Array.isArray((a as any).parts)) buckets.push(...(a as any).parts);
    }
  }
  const msg = (r.status as any)?.message;
  if (msg && Array.isArray(msg.parts)) buckets.push(...msg.parts);
  const texts: string[] = [];
  for (const p of buckets) {
    if (p && typeof p === "object") {
      const part = p as Record<string, unknown>;
      if ((part.kind === "text" || part.type === "text") && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
  }
  return texts.join("\n").slice(0, 4000);
}

/**
 * Dispatch the hired task to the agent's endpoint and normalize the reply.
 * Returns a HireDeliverable, or null on any failure / non-conforming reply.
 */
export async function fetchDeliverable(
  endpoint: string,
  task: string,
  from: string | null,
  agentId: string,
): Promise<HireDeliverable | null> {
  if (!endpoint || !isHttpUrl(endpoint)) return null;
  const payload = {
    jsonrpc: "2.0",
    id: `hire-${Date.now()}`,
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: `${agentId || "agent"}-${Date.now()}`,
        parts: [{ kind: "text", text: task || "Run the hired task." }],
      },
      metadata: { source: "agent-street/hire", from: from || undefined, agentId: agentId || undefined },
    },
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    const parsed = JSON.parse(new TextDecoder().decode(buf)) as Record<string, unknown>;

    // (a) simple contract: top-level or result-nested `deliverable`.
    const direct =
      asDeliverable(parsed.deliverable) ??
      asDeliverable((parsed.result as any)?.deliverable);
    if (direct) return direct;

    // (b) A2A result → text deliverable.
    const text = textFromA2A(parsed.result ?? parsed);
    if (text) return { kind: "text", title: "Agent result", body: text };

    return null;
  } catch {
    return null;
  }
}

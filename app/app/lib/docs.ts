/**
 * docs.ts — the marketplace documentation engine.
 *
 * Markdown-first, agent-legible docs (the reusable pattern from the sibling
 * middleBrick Starlight site, ported to React Router). Every page is one
 * `.md` file under `content/docs/`, inlined at build time via Vite's `?raw`
 * glob. From that single source we render:
 *   - on-brand HTML for humans (`html`, via marked),
 *   - self-contained raw Markdown for agents (`docSource`, `/raw/docs/:slug`),
 *   - an `llms.txt` index + `llms-full.txt` corpus (middleBrick convention).
 *
 * The sidebar taxonomy (`DOCS_NAV`) is hand-authored — the analog of
 * Starlight's `sidebar` array.
 */

import { marked } from "marked";

// Build-time: every doc, as raw text keyed by module path.
const RAW = import.meta.glob("../content/docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type DocMeta = { slug: string; title: string; description: string };
export type Doc = DocMeta & { body: string; html: string };
export type DocNavGroup = { label: string; items: DocMeta[] };

/**
 * Sidebar taxonomy: groups → slugs, in reading order. Slugs must match a file
 * in `content/docs/` (`<slug>.md`). `index` is the `/docs` landing.
 */
const NAV_SLUGS: Array<{ label: string; items: string[] }> = [
  { label: "Getting started", items: ["index", "quickstart", "networks"] },
  {
    label: "Concepts",
    items: ["taxonomy", "agents", "reputation-and-data", "skills", "portfolios"],
  },
  {
    label: "Guides",
    items: ["hiring", "create-agent", "search-browse", "saved-and-me"],
  },
  {
    label: "For agents",
    items: ["for-agents", "mcp-tools", "standards", "public-endpoints"],
  },
  { label: "Reference", items: ["faq"] },
];

/** Flat page order (for prev/next + corpus aggregation). */
const DOC_ORDER: string[] = NAV_SLUGS.flatMap((g) => g.items);

function slugFromPath(p: string): string {
  const m = p.match(/\/([^/]+)\.md$/);
  return m ? m[1] : p;
}

/** Minimal, dependency-free frontmatter parser (title / description only). */
function parseFrontmatter(raw: string): {
  title: string;
  description: string;
  body: string;
} {
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let title = "";
  let description = "";
  let body = raw;
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (!kv) continue;
      let val = kv[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (kv[1] === "title") title = val;
      else if (kv[1] === "description") description = val;
    }
  }
  return { title, description, body: body.replace(/^\s+/, "") };
}

marked.setOptions({ gfm: true, breaks: false });

const DOCS: Record<string, Doc> = {};
for (const [path, raw] of Object.entries(RAW)) {
  const slug = slugFromPath(path);
  const { title, description, body } = parseFrontmatter(raw);
  DOCS[slug] = {
    slug,
    title: title || slug,
    description,
    body,
    html: marked.parse(body) as string,
  };
}

/** The route a slug links to (`index` → the `/docs` landing). */
export function docHref(slug: string): string {
  return slug === "index" ? "/docs" : `/docs/${slug}`;
}

export function getDoc(slug: string): Doc | null {
  return DOCS[slug] ?? null;
}

export function docMeta(slug: string): DocMeta | null {
  const d = DOCS[slug];
  return d ? { slug: d.slug, title: d.title, description: d.description } : null;
}

/** The sidebar taxonomy resolved to real page metadata (skips any missing). */
export function navWithMeta(): DocNavGroup[] {
  return NAV_SLUGS.map((g) => ({
    label: g.label,
    items: g.items
      .map((s) => docMeta(s))
      .filter((m): m is DocMeta => m !== null),
  }));
}

export function prevNext(slug: string): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const i = DOC_ORDER.indexOf(slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? docMeta(DOC_ORDER[i - 1]) : null,
    next: i < DOC_ORDER.length - 1 ? docMeta(DOC_ORDER[i + 1]) : null,
  };
}

/** Self-contained Markdown for one page (title + summary + body). */
export function docSource(slug: string): string | null {
  const d = DOCS[slug];
  if (!d) return null;
  const head = `# ${d.title}\n\n${d.description ? `> ${d.description}\n\n` : ""}`;
  return head + d.body.trimEnd() + "\n";
}

export type DocSearchEntry = {
  slug: string;
  title: string;
  description: string;
  text: string;
};

/** Reduce Markdown to searchable plain text (drops syntax, keeps link text). */
function stripMarkdown(md: string): string {
  return md
    .replace(/```+/g, " ") // code-fence markers (keep the code text — it's searchable)
    .replace(/`/g, " ") // inline-code backticks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/^\s{0,3}[#>\-*+]+\s*/gm, " ") // heading/list/quote markers
    .replace(/[|*~#>]/g, " ") // residual punctuation (keep _ so snake_case stays searchable)
    .replace(/\s+/g, " ")
    .trim();
}

/** Client-side search index: one entry per page, in reading order. */
export function buildSearchIndex(): DocSearchEntry[] {
  const out: DocSearchEntry[] = [];
  for (const slug of DOC_ORDER) {
    const d = DOCS[slug];
    if (!d) continue;
    out.push({
      slug: d.slug,
      title: d.title,
      description: d.description,
      text: stripMarkdown(d.body),
    });
  }
  return out;
}

const INTRO =
  "A marketplace to discover, compare, and hire ERC-8004 AI agents and composable skills on BNB Chain. Built to be driven by agents as easily as by people: every page is available as plain Markdown, and the whole marketplace is drivable over one MCP endpoint.";

/** llms.txt — the machine-readable index (H1 + summary + linked sections). */
export function buildLlmsTxt(origin: string): string {
  const out: string[] = [];
  out.push("# Agent-Street");
  out.push("");
  out.push(`> ${INTRO}`);
  out.push("");
  out.push(`Full text: ${origin}/llms-full.txt`);
  out.push(`Agent surface (MCP): ${origin}/docs/for-agents`);
  out.push(`Raw Markdown per page: ${origin}/raw/docs/<slug>`);
  out.push("");
  for (const group of NAV_SLUGS) {
    out.push(`## ${group.label}`);
    for (const slug of group.items) {
      const m = docMeta(slug);
      if (!m) continue;
      out.push(`- [${m.title}](${origin}${docHref(slug)}): ${m.description}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

/** llms-full.txt — every page's Markdown, concatenated. */
export function buildLlmsFullTxt(origin: string): string {
  const out: string[] = [];
  out.push("# Agent-Street — full documentation");
  out.push("");
  out.push(`> ${INTRO}`);
  out.push("");
  out.push(`Source: ${origin}/docs`);
  for (const slug of DOC_ORDER) {
    const d = DOCS[slug];
    if (!d) continue;
    out.push("");
    out.push("---");
    out.push("");
    out.push(`# ${d.title}`);
    out.push("");
    if (d.description) {
      out.push(`> ${d.description}`);
      out.push("");
    }
    out.push(`URL: ${origin}${docHref(slug)}`);
    out.push("");
    out.push(d.body.trimEnd());
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

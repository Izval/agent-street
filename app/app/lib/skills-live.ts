/**
 * Live skill sources, fetched server-side and merged with the curated tier.
 *
 *   - BNB Chain Skills Hub (github.com/bnb-chain/bnbchain-skills) — the official,
 *     BNB-native registry. Small today, grows via community PRs.
 *   - CryptoSkill Hub (github.com/jiayaoqijia/cryptoskill) — the largest curated
 *     crypto skill registry (~1.9k). We pull the DeFi/finance slice relevant to
 *     this marketplace and map its subcategories onto our taxonomy.
 *
 * Both are ordinary listings — no coupling to IVL, no calls to api.zvlint.com.
 * Any fetch failure degrades to the last good cache, else an empty list, so the
 * marketplace always works from the curated tier alone.
 *
 * SERVER-ONLY: called from route loaders (runs on the Cloudflare Worker), so the
 * cross-origin GitHub fetches have no CORS constraint. To keep SSR loaderData
 * small, the overview loader returns per-subcategory *capped* sections + true totals
 * (see loadSkillSections) rather than the full ~800-item catalog.
 */

import type { Skill, SkillProvider, SkillSource } from "./skills";
import {
  classifySkillSubcategory,
  classifySkillSubcategoryStrict,
  CURATED_SKILLS,
  skillById,
  SOURCE_RANK,
} from "./skills";
import { SUBCATEGORIES, subcategoryLabel, type Subcategory } from "./taxonomy";

const TTL_MS = 60 * 60 * 1000; // 1h

// --- BNB Chain Skills Hub -------------------------------------------------- //

const BNB_REPO = "bnb-chain/bnbchain-skills";
const BNB_TREE_URL = `https://api.github.com/repos/${BNB_REPO}/git/trees/main?recursive=1`;
const bnbRaw = (path: string) =>
  `https://raw.githubusercontent.com/${BNB_REPO}/main/${path}`;
const bnbFolder = (dir: string) =>
  `https://github.com/${BNB_REPO}/tree/main/skills/${dir}`;

let bnbCache: { at: number; skills: Skill[] } | null = null;

interface TreeEntry {
  path: string;
  type: string;
}

/** Parse the leading `--- ... ---` YAML frontmatter into a flat string map. */
function parseFrontmatter(md: string): Record<string, string> {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(md);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

async function fetchBnbHubUncached(): Promise<Skill[]> {
  const res = await fetch(BNB_TREE_URL, {
    headers: { accept: "application/json", "user-agent": "agent-street" },
  });
  if (!res.ok) throw new Error(`github tree ${res.status}`);
  const body = (await res.json()) as { tree?: TreeEntry[] };
  const paths = (body.tree ?? [])
    .filter((t) => t.type === "blob" && /^skills\/[^/]+\/SKILL\.md$/.test(t.path))
    .map((t) => t.path);

  const skills: Skill[] = [];
  for (const path of paths) {
    try {
      const md = await (await fetch(bnbRaw(path))).text();
      const fm = parseFrontmatter(md);
      const dir = path.split("/")[1];
      const name = fm.displayName || fm.name || dir;
      const description = fm.description || "";
      skills.push({
        id: `bnb-${dir}`,
        name,
        provider: "BNB Chain",
        subcategory: classifySkillSubcategory(`${name} ${description}`),
        description,
        protocol: fm.version
          ? `BNB Chain Skills Hub · v${fm.version}`
          : "BNB Chain Skills Hub",
        composableWith: [],
        link: bnbFolder(dir),
        source: "bnb-hub",
        verified: true, // Hub entries pass an AgentGuard security scan.
      });
    } catch {
      // Skip a single unreadable SKILL.md; keep the rest.
    }
  }
  return skills;
}

async function fetchBnbHubSkills(): Promise<Skill[]> {
  if (bnbCache && Date.now() - bnbCache.at < TTL_MS) return bnbCache.skills;
  try {
    const skills = await fetchBnbHubUncached();
    bnbCache = { at: Date.now(), skills };
    return skills;
  } catch {
    return bnbCache?.skills ?? [];
  }
}

// --- CryptoSkill Hub ------------------------------------------------------- //

const CS_JSON_URL =
  "https://raw.githubusercontent.com/jiayaoqijia/cryptoskill/main/docs/skills.json";

/** CryptoSkill subcategories we surface (the DeFi/finance slice). */
const CS_RELEVANT: Record<string, Subcategory> = {
  // source subcategory → fallback taxonomy subcategory when no strong signal in text
  defi: "yield",
  trading: "momentum",
  dex: "market-making",
  exchanges: "market-making",
  analytics: "infra-data",
  payments: "payments-x402",
  wallets: "cyber-monitor",
  "mcp-servers": "infra-automation",
};

/** Title for the small protocol line, from the source subcategory. */
const CS_LABEL: Record<string, string> = {
  defi: "DeFi",
  trading: "Trading",
  dex: "DEX",
  exchanges: "Exchange",
  analytics: "Analytics",
  payments: "Payments",
  wallets: "Wallet",
  "mcp-servers": "MCP server",
};

interface CryptoSkillRaw {
  name: string;
  displayName?: string;
  description?: string;
  subcategory?: string;
  tags?: string[];
  author?: string;
  score?: { total?: number };
}

let csCache: { at: number; skills: Skill[] } | null = null;

async function fetchCryptoSkillUncached(): Promise<Skill[]> {
  const res = await fetch(CS_JSON_URL, {
    headers: { accept: "application/json", "user-agent": "agent-street" },
  });
  if (!res.ok) throw new Error(`cryptoskill ${res.status}`);
  const body = (await res.json()) as { skills?: CryptoSkillRaw[] };
  const rows = body.skills ?? [];

  const out: Skill[] = [];
  for (const r of rows) {
    const srcCat = r.subcategory ?? "";
    const fallback = CS_RELEVANT[srcCat];
    if (!fallback) continue; // outside the DeFi/finance slice we chose
    const text = `${r.displayName ?? ""} ${r.name} ${r.description ?? ""} ${(r.tags ?? []).join(" ")}`;
    const subcategory = classifySkillSubcategoryStrict(text) ?? fallback;
    out.push({
      id: `cs-${r.name}`,
      name: r.displayName || r.name,
      provider: "CryptoSkill Hub",
      subcategory,
      description: r.description || "",
      protocol: CS_LABEL[srcCat] ?? "CryptoSkill Hub",
      composableWith: [],
      link: "https://cryptoskill.org",
      source: "cryptoskill",
      author: r.author && r.author !== "discovered" ? r.author : undefined,
      score: typeof r.score?.total === "number" ? r.score.total : undefined,
    });
  }
  return out;
}

async function fetchCryptoSkillSkills(): Promise<Skill[]> {
  if (csCache && Date.now() - csCache.at < TTL_MS) return csCache.skills;
  try {
    const skills = await fetchCryptoSkillUncached();
    csCache = { at: Date.now(), skills };
    return skills;
  } catch {
    return csCache?.skills ?? [];
  }
}

// --- Merge & query --------------------------------------------------------- //

/** Full catalog: curated (Altana + IVL + CMC) + live BNB Hub + CryptoSkill Hub,
 *  deduped by id. Large (~800+) — used for lookups and section building, not
 *  returned to the client wholesale. */
export async function loadSkills(): Promise<Skill[]> {
  const [bnb, cs] = await Promise.all([
    fetchBnbHubSkills(),
    fetchCryptoSkillSkills(),
  ]);
  const seen = new Set(CURATED_SKILLS.map((s) => s.id));
  const merged = [...CURATED_SKILLS];
  for (const s of [...bnb, ...cs]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    merged.push(s);
  }
  return merged;
}

/** Resolve a skill by id across curated + live sources. */
export async function skillByIdAsync(id: string): Promise<Skill | undefined> {
  const curated = skillById(id);
  if (curated) return curated;
  if (id.startsWith("bnb-")) return (await fetchBnbHubSkills()).find((s) => s.id === id);
  if (id.startsWith("cs-")) return (await fetchCryptoSkillSkills()).find((s) => s.id === id);
  const all = await loadSkills();
  return all.find((s) => s.id === id);
}

// --- Server-side page (SEO-friendly filter/sort/pagination) --------------- //

const BLURB_MAX = 130;
export const SKILLS_PER_PAGE = 24;

const rank = (s: Skill) =>
  SOURCE_RANK[s.source as SkillSource] * 1000 - (s.score ?? 0);

export type SkillSort = "relevance" | "name" | "subcategory";
export const SKILL_SORTS: { value: SkillSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "name", label: "Name A–Z" },
  { value: "subcategory", label: "Subcategory" },
];

/** Lightweight row rendered on the grid (one page's worth). */
export interface SkillListItem {
  id: string;
  name: string;
  subcategory: Subcategory;
  subcategoryLabel: string;
  provider: SkillProvider;
  blurb: string;
  verified: boolean;
}

export interface SkillFacet<T extends string> {
  id: T;
  label: string;
  count: number;
}

/** Parsed, validated query (from the route loader's URL search params). */
export interface SkillPageQuery {
  subcategories: string[];
  providers: string[];
  verifiedOnly: boolean;
  sort: SkillSort;
  page: number;
}

export interface SkillPage {
  items: SkillListItem[];
  /** Page after clamping to the valid range. */
  page: number;
  perPage: number;
  totalPages: number;
  /** Skills matching the active filters (across all pages). */
  filteredTotal: number;
  /** Whole catalog. */
  total: number;
  subcategories: SkillFacet<Subcategory>[];
  providers: SkillFacet<SkillProvider>[];
  selected: {
    subcategories: string[];
    providers: string[];
    verified: boolean;
    sort: SkillSort;
  };
}

function clampBlurb(s: string): string {
  const t = s.trim();
  if (t.length <= BLURB_MAX) return t;
  return t.slice(0, BLURB_MAX).replace(/\s+\S*$/, "") + "…";
}

/** Parse raw URL search params into a validated query. */
export function parseSkillQuery(sp: URLSearchParams): SkillPageQuery {
  const sortRaw = sp.get("sort");
  const sort: SkillSort =
    sortRaw === "name" || sortRaw === "subcategory" ? sortRaw : "relevance";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  return {
    subcategories: sp.getAll("subcategory"),
    providers: sp.getAll("provider"),
    verifiedOnly: sp.get("verified") === "1",
    sort,
    page,
  };
}

/**
 * One page of the catalog, filtered/sorted/paged on the SERVER so each URL
 * (`/skills?subcategory=…&sort=…&page=N`) renders a distinct, crawlable slice.
 * Only that page's rows cross the wire. Facet counts are over the full catalog
 * (stable), so a user can always widen a filter.
 */
export async function loadSkillPage(query: SkillPageQuery): Promise<SkillPage> {
  const all = await loadSkills();

  // Facets over the whole catalog.
  const catCount = new Map<Subcategory, number>();
  const provCount = new Map<SkillProvider, number>();
  for (const s of all) {
    catCount.set(s.subcategory, (catCount.get(s.subcategory) ?? 0) + 1);
    provCount.set(s.provider, (provCount.get(s.provider) ?? 0) + 1);
  }
  const subcategories: SkillFacet<Subcategory>[] = SUBCATEGORIES.filter((c) =>
    catCount.has(c),
  ).map((c) => ({ id: c, label: subcategoryLabel(c), count: catCount.get(c)! }));
  const providers: SkillFacet<SkillProvider>[] = [...provCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, label: id, count }));

  // Filter.
  const catSet = new Set(query.subcategories);
  const provSet = new Set(query.providers);
  let matched = all.filter((s) => {
    if (catSet.size && !catSet.has(s.subcategory)) return false;
    if (provSet.size && !provSet.has(s.provider)) return false;
    if (query.verifiedOnly && !s.verified) return false;
    return true;
  });

  // Sort.
  if (query.sort === "name") {
    matched = matched.slice().sort((a, b) => a.name.localeCompare(b.name));
  } else if (query.sort === "subcategory") {
    matched = matched
      .slice()
      .sort(
        (a, b) =>
          subcategoryLabel(a.subcategory).localeCompare(subcategoryLabel(b.subcategory)) ||
          rank(a) - rank(b),
      );
  } else {
    matched = matched.slice().sort((a, b) => rank(a) - rank(b));
  }

  // Paginate.
  const filteredTotal = matched.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / SKILLS_PER_PAGE));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * SKILLS_PER_PAGE;
  const items: SkillListItem[] = matched
    .slice(start, start + SKILLS_PER_PAGE)
    .map((s) => ({
      id: s.id,
      name: s.name,
      subcategory: s.subcategory,
      subcategoryLabel: subcategoryLabel(s.subcategory),
      provider: s.provider,
      blurb: clampBlurb(s.description),
      verified: Boolean(s.verified),
    }));

  return {
    items,
    page,
    perPage: SKILLS_PER_PAGE,
    totalPages,
    filteredTotal,
    total: all.length,
    subcategories,
    providers,
    selected: {
      subcategories: query.subcategories,
      providers: query.providers,
      verified: query.verifiedOnly,
      sort: query.sort,
    },
  };
}

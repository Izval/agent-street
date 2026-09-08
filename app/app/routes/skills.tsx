import type { Route } from "./+types/skills";
import { loadSkillPage, parseSkillQuery } from "../lib/skills-live";
import { AppShell } from "../components/AppShell";
import { SkillsBrowser } from "../components/SkillsBrowser";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = parseSkillQuery(url.searchParams);
  // Curated (Altana + IVL + CMC) + live BNB Chain Skills Hub + CryptoSkill Hub,
  // filtered/sorted/paged on the server so each URL is a distinct crawlable page.
  const data = await loadSkillPage(query);

  // SEO: self-canonical per page + rel prev/next across the sequence.
  const build = (page: number) => {
    const sp = new URLSearchParams(url.searchParams);
    if (page <= 1) sp.delete("page");
    else sp.set("page", String(page));
    const qs = sp.toString();
    return `${url.origin}${url.pathname}${qs ? `?${qs}` : ""}`;
  };
  const seo = {
    canonical: build(data.page),
    prev: data.page > 1 ? build(data.page - 1) : null,
    next: data.page < data.totalPages ? build(data.page + 1) : null,
  };

  return { data, seo };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const seo = loaderData?.seo;
  const page = loaderData?.data.page ?? 1;
  const title =
    page > 1 ? `Skills — page ${page} — Agent-Street` : "Skills — Agent-Street";
  const tags: Route.MetaDescriptors = [
    { title },
    {
      name: "description",
      content:
        "Discover and hire composable skills for ERC-8004 agents on BNB Chain — execution, yield, monitoring and analysis.",
    },
  ];
  if (seo?.canonical) tags.push({ tagName: "link", rel: "canonical", href: seo.canonical });
  if (seo?.prev) tags.push({ tagName: "link", rel: "prev", href: seo.prev });
  if (seo?.next) tags.push({ tagName: "link", rel: "next", href: seo.next });
  return tags;
}

export default function SkillsPage({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell>
      <SkillsBrowser data={loaderData.data} />
    </AppShell>
  );
}

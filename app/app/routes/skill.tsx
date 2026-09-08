import { Link } from "react-router";

import type { Route } from "./+types/skill";
import { skillByIdAsync } from "../lib/skills-live";
import { categoryOf, subcategoryLabel, type Category } from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.skill?.name ?? "Skill"} — Agent-Street` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const skill = await skillByIdAsync(params.id);
  if (!skill) throw new Response("Not found", { status: 404 });
  return { skill };
}

function hostOf(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return "source";
  }
}

export default function SkillDetail({ loaderData }: Route.ComponentProps) {
  const { skill } = loaderData;
  const category = categoryOf(skill.subcategory);

  return (
    <AppShell
      activeCategory={(category ?? undefined) as Category | undefined}
      activeSubcategory={skill.subcategory}
    >
      <div className="py-2">
        <Link
          to="/skills"
          className="text-sm text-text-3 transition-colors hover:text-text"
        >
          ← Skills
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-2xl font-bold">{skill.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-[999px] bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-2">
              {subcategoryLabel(skill.subcategory)}
            </span>
            <span className="rounded-[999px] bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-2">
              {skill.provider}
            </span>
            <span className="text-xs text-text-3">{skill.protocol}</span>
          </div>

          <p className="mt-6 max-w-2xl text-text-2">{skill.description}</p>

          {skill.composableWith.length > 0 && (
            <>
              <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-text-3">
                Composable with
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {skill.composableWith.map((c) => (
                  <span
                    key={c}
                    className="rounded-[999px] border border-border px-3 py-1 text-xs font-semibold text-text-2"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <div className="text-sm text-text-2">Composable ERC-8183 skill.</div>
            <a
              href={skill.link}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block rounded-[8px] border border-border px-5 py-3 text-center text-sm font-semibold text-text transition-colors hover:border-brand"
            >
              View on {hostOf(skill.link)} ↗
            </a>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

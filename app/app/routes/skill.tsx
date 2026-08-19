import { env } from "cloudflare:workers";
import { Link } from "react-router";

import type { Route } from "./+types/skill";
import { skillById } from "../lib/skills";
import { aisleOf, categoryLabel, type Aisle } from "../lib/taxonomy";
import { createIvlClient } from "../lib/ivl";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { ScoreMeter } from "../components/ScoreMeter";
import { LiveBadge } from "../components/Badge";

const FLAGSHIP_PAIR = "BNB-USDT";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.skill?.name ?? "Skill"} — Agent-Street` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const skill = skillById(params.id);
  if (!skill) throw new Response("Not found", { status: 404 });

  // IVL skill trae score en vivo del motor (Data Quality real).
  let ivlScore: number | null = null;
  if (skill.provider === "IVL") {
    const ivl = createIvlClient({ baseUrl: env.IVL_API_URL });
    ivlScore = await ivl
      .ticks(FLAGSHIP_PAIR)
      .then((t) => t.ivl_score)
      .catch(() => null);
  }
  return { skill, ivlScore };
}

export default function SkillDetail({ loaderData }: Route.ComponentProps) {
  const { skill, ivlScore } = loaderData;
  const aisle = aisleOf(skill.category);

  return (
    <AppShell
      activeAisle={(aisle ?? undefined) as Aisle | undefined}
      activeCategory={skill.category}
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
              {categoryLabel(skill.category)}
            </span>
            <span
              className={
                "rounded-[999px] px-2.5 py-0.5 text-xs font-semibold " +
                (skill.provider === "IVL"
                  ? "bg-brand text-bg"
                  : "bg-surface-2 text-text-2")
              }
            >
              {skill.provider}
            </span>
            <span className="text-xs text-text-3">{skill.protocol}</span>
          </div>

          <p className="mt-6 max-w-2xl text-text-2">{skill.description}</p>

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
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            {ivlScore != null ? (
              <ScoreMeter
                score={ivlScore}
                label={`IVL score · ${FLAGSHIP_PAIR}`}
                size="lg"
              />
            ) : (
              <div className="text-sm text-text-2">
                Skill componible ERC-8183.
              </div>
            )}
            <a
              href={skill.link}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block rounded-[8px] border border-border px-5 py-3 text-center text-sm font-semibold text-text transition-colors hover:border-brand"
            >
              Ver en {skill.provider === "IVL" ? "api.zvlint.com" : "Altana"} ↗
            </a>
            {skill.provider === "IVL" && (
              <div className="mt-3 flex justify-center">
                <LiveBadge />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

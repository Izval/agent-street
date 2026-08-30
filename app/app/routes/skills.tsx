import type { Route } from "./+types/skills";
import { SKILLS } from "../lib/skills";
import {
  AISLES,
  CATEGORIES,
  aisleOf,
  categoryLabel,
  type Category,
} from "../lib/taxonomy";
import { AppShell } from "../components/AppShell";
import { SkillCard } from "../components/SkillCard";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Skills — Agent-Street" }];
}

export default function SkillsPage() {
  // Categories present among the skills, in taxonomy order.
  const cats = CATEGORIES.filter((c) => SKILLS.some((s) => s.category === c));

  return (
    <AppShell>
      <header className="py-2">
        <h1 className="text-3xl font-bold md:text-4xl">
          Composable <span className="text-brand">skills</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-2">
          Modules an agent plugs in via ERC-8183 — execution, yield, monitoring
          and range quality, composable into any agent.
        </p>
      </header>

      {/* Grouped by category — same diversity treatment as Agents */}
      {cats.map((c: Category) => {
        const items = SKILLS.filter((s) => s.category === c);
        const aisle = aisleOf(c);
        const accent = aisle
          ? AISLES.find((a) => a.id === aisle)?.accent
          : undefined;
        return (
          <section key={c} className="mt-10">
            <h2
              className={"text-lg font-bold text-text" + (accent ? " border-l-2 pl-2.5" : "")}
              style={accent ? { borderColor: accent } : undefined}
            >
              {categoryLabel(c)}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <SkillCard key={s.id} skill={s} />
              ))}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}

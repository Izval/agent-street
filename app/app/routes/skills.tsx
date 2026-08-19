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
import { FeatureBlock } from "../components/FeatureBlock";
import { SkillCard } from "../components/SkillCard";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Skills — Agent-Street" }];
}

export default function SkillsPage() {
  const flagship = SKILLS.find((s) => s.flagship);
  // Categorías presentes entre las skills, en el orden de la taxonomía.
  const cats = CATEGORIES.filter((c) => SKILLS.some((s) => s.category === c));

  return (
    <AppShell>
      <header className="py-2">
        <h1 className="text-3xl font-bold md:text-4xl">
          Skills <span className="text-brand">componibles</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-2">
          Módulos que un agente enchufa vía ERC-8183. IVL es el cerebro del
          rebalanceo; las skills de Altana cubren ejecución, yield y monitoreo.
        </p>
      </header>

      {/* Flagship destacado */}
      {flagship && (
        <div className="mt-6">
          <FeatureBlock
            to={`/skill/${flagship.id}`}
            eyebrow="Flagship · score en vivo"
            title={flagship.name}
            description={flagship.description}
            accent="var(--accent-defi)"
          />
        </div>
      )}

      {/* Agrupado por categoría — mismo trato de diversidad que Agents */}
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

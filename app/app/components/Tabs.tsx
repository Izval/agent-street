/**
 * Tabs Agents / Skills (DESIGN.md §5): underline 2px --brand en el activo.
 */

import { Link } from "react-router";

const TABS = [
  { id: "agents", label: "Agents", to: "/" },
  { id: "skills", label: "Skills", to: "/skills" },
] as const;

export function Tabs({ active }: { active: "agents" | "skills" }) {
  return (
    <nav className="flex gap-6 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.id}
          to={t.to}
          className={
            "-mb-px border-b-2 pb-3 font-semibold transition-colors " +
            (t.id === active
              ? "border-brand text-text"
              : "border-transparent text-text-2 hover:text-text")
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

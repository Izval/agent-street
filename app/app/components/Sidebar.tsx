/**
 * Sidebar — navegación primaria del shell App Store (DESIGN.md v2 §11).
 * Logo BNB (reusa markup de Nav) · buscador (Form GET → /search) · Discover ·
 * aisles (AISLES, glyph con acento) · separador · bloque Obligatorias (★).
 * Estado activo = texto --text + barra izquierda --brand (amarillo escaso).
 */

import { Form, Link, NavLink } from "react-router";
import {
  AISLES,
  REQUIRED_CATEGORIES,
  categoryLabel,
  type Aisle,
  type Category,
} from "../lib/taxonomy";

const ITEM_BASE =
  "relative flex min-h-[44px] items-center gap-3 rounded pl-3 pr-2 text-sm transition-colors";

function ActiveBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-1.5 left-0 w-0.5 rounded-[999px] bg-brand"
    />
  );
}

export function Sidebar({
  activeAisle,
  activeCategory,
}: {
  activeAisle?: Aisle;
  activeCategory?: Category;
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className="flex h-full flex-col gap-5 p-4"
    >
      {/* Logo BNB (marca amarilla, §7) */}
      <Link to="/" className="flex items-center gap-2 px-1">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand font-bold text-bg">
          A
        </span>
        <span className="text-lg font-bold tracking-tight">
          Agent<span className="text-brand">-</span>Street
        </span>
      </Link>

      {/* Buscador → /search?q= (react-router Form, GET) */}
      <Form method="get" action="/search" role="search">
        <input
          type="search"
          name="q"
          placeholder="Buscar agentes y skills"
          aria-label="Buscar agentes y skills"
          className="min-h-[44px] w-full rounded bg-surface-2 px-3 text-sm text-text placeholder:text-text-3 outline-none transition-colors focus:border focus:border-brand"
        />
      </Form>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {/* Discover */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            ITEM_BASE +
            (isActive
              ? " font-semibold text-text"
              : " text-text-2 hover:bg-surface-2 hover:text-text")
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <ActiveBar />}
              <span aria-hidden className="w-4 text-center text-base">
                ✦
              </span>
              Discover
            </>
          )}
        </NavLink>

        {/* Aisles */}
        <div className="mt-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Aisles
        </div>
        {AISLES.map((a) => {
          const active = activeAisle === a.id;
          return (
            <Link
              key={a.id}
              to={`/aisle/${a.id}`}
              aria-current={active ? "page" : undefined}
              className={
                ITEM_BASE +
                (active
                  ? " font-semibold text-text"
                  : " text-text-2 hover:bg-surface-2 hover:text-text")
              }
            >
              {active && <ActiveBar />}
              <span
                aria-hidden
                className="w-4 text-center text-base"
                style={{ color: a.accent }}
              >
                {a.glyph}
              </span>
              {a.label}
            </Link>
          );
        })}

        {/* Separador */}
        <div className="my-3 border-t border-border" />

        {/* Obligatorias (★) — Agent Diversity siempre visible */}
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Obligatorias
        </div>
        {REQUIRED_CATEGORIES.map((c) => {
          const active = activeCategory === c;
          return (
            <Link
              key={c}
              to={`/category/${c}`}
              aria-current={active ? "page" : undefined}
              className={
                ITEM_BASE +
                (active
                  ? " font-semibold text-text"
                  : " text-text-2 hover:bg-surface-2 hover:text-text")
              }
            >
              {active && <ActiveBar />}
              <span aria-hidden className="w-4 text-center text-brand">
                ★
              </span>
              {categoryLabel(c)}
            </Link>
          );
        })}
      </div>

      <div className="px-1 text-[11px] text-text-3">Built on BNB Chain</div>
    </nav>
  );
}

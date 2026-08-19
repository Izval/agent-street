/**
 * MarketplaceChrome — barra de filtros sticky (linaje OpenSea · plan §5.2).
 * Fila 1: pills de aisle (All → /, cada aisle → /aisle/:id) con scroll horizontal.
 * Fila 2: chip de red BSC (estático) + segmented controls (Agents/Skills/Tokens,
 * rango 1h/24h/7d, grid/list, sort) que editan los search params de la ruta.
 *
 * Loader-driven: los valores actuales llegan por props (del loader); cada control
 * escribe el search param correspondiente (useSearchParams). Las pills de aisle
 * son <Link> (navegación de ruta). Sticky con blur reforzado al pegarse
 * (IntersectionObserver sobre un sentinel → SSR-safe, sólo en efecto).
 * A11y: role="radiogroup"/"radio" con navegación por flechas (roving tabindex).
 */

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { KeyboardEvent, ReactNode } from "react";
import { AISLES, type Aisle } from "../lib/taxonomy";
import type { TrendingWindow } from "../lib/contracts";

type Tab = "agents" | "skills" | "tokens";
type View = "grid" | "list";
type Sort = "trending" | "score" | "new" | "portfolio";

export interface MarketplaceChromeProps {
  activeAisle?: Aisle;
  view?: View;
  onViewChange?: (v: View) => void;
  tab?: Tab;
  window?: TrendingWindow;
  sort?: Sort;
  className?: string;
}

// ---- Segmented control (radiogroup + roving tabindex) ----------------- //

interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Etiqueta accesible si `label` no es texto (p.ej. un glyph). */
  srLabel?: string;
}

function Segmented<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next].value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="glass-hair inline-flex items-center gap-0.5 rounded-[999px] p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.srLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`rounded-[999px] px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "bg-brand text-bg" : "text-text-2 hover:text-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Sticky "stuck" detection (SSR-safe) ------------------------------ //

function useStuck() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: [1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { sentinelRef, stuck };
}

// ---- Component -------------------------------------------------------- //

const AISLE_PILLS: { id: Aisle; label: string }[] = AISLES.map((a) => ({
  id: a.id,
  label: a.label,
}));

const TAB_OPTS: SegOption<Tab>[] = [
  { value: "agents", label: "Agents" },
  { value: "skills", label: "Skills" },
  { value: "tokens", label: "Tokens" },
];
const WINDOW_OPTS: SegOption<TrendingWindow>[] = [
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];
const VIEW_OPTS: SegOption<View>[] = [
  { value: "grid", label: "▦", srLabel: "Vista de cuadrícula" },
  { value: "list", label: "≣", srLabel: "Vista de lista" },
];
const SORT_OPTS: SegOption<Sort>[] = [
  { value: "trending", label: "Trending" },
  { value: "score", label: "Score" },
  { value: "new", label: "Nuevos" },
  { value: "portfolio", label: "Portfolio" },
];

export function MarketplaceChrome({
  activeAisle,
  view: viewProp,
  onViewChange,
  tab: tabProp,
  window: windowProp,
  sort: sortProp,
  className = "",
}: MarketplaceChromeProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sentinelRef, stuck } = useStuck();

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(searchParams);
    next.set(key, val);
    setSearchParams(next, { preventScrollReset: true });
  }

  const tab = tabProp ?? ((searchParams.get("tab") as Tab | null) ?? "agents");
  const view = viewProp ?? ((searchParams.get("view") as View | null) ?? "grid");
  const win =
    windowProp ?? ((searchParams.get("window") as TrendingWindow | null) ?? "24h");
  const sort = sortProp ?? ((searchParams.get("sort") as Sort | null) ?? "trending");

  const pillCls = (active: boolean) =>
    `shrink-0 rounded-[999px] px-3 py-1 text-sm font-medium transition-colors ${
      active
        ? "glass-hair bg-brand text-bg"
        : "glass-hair text-text-2 hover:text-text"
    }`;

  return (
    <>
      {/* Sentinel: cuando sale de vista, la barra está "pegada". */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        className={`sticky top-0 z-30 flex flex-col gap-2.5 py-2.5 transition-shadow duration-[var(--dur-std)] ${
          stuck ? "glass-panel -mx-2 px-2 shadow-[var(--elev-2)]" : ""
        } ${className}`}
      >
        {/* Fila 1: pills de aisle */}
        <nav
          aria-label="Filtrar por aisle"
          className="flex items-center gap-2 overflow-x-auto pb-0.5"
        >
          <Link
            to="/"
            aria-current={!activeAisle ? "page" : undefined}
            className={pillCls(!activeAisle)}
          >
            All
          </Link>
          {AISLE_PILLS.map((a) => (
            <Link
              key={a.id}
              to={`/aisle/${a.id}`}
              aria-current={activeAisle === a.id ? "page" : undefined}
              className={pillCls(activeAisle === a.id)}
            >
              {a.label}
            </Link>
          ))}
        </nav>

        {/* Fila 2: red + toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-hair inline-flex items-center gap-1.5 rounded-[999px] px-2.5 py-1 text-xs font-semibold text-text-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
            BSC
          </span>

          <Segmented
            ariaLabel="Tipo de listado"
            value={tab}
            options={TAB_OPTS}
            onChange={(v) => setParam("tab", v)}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Ventana de tiempo"
              value={win}
              options={WINDOW_OPTS}
              onChange={(v) => setParam("window", v)}
            />
            <Segmented
              ariaLabel="Orden"
              value={sort}
              options={SORT_OPTS}
              onChange={(v) => setParam("sort", v)}
            />
            <Segmented
              ariaLabel="Densidad de vista"
              value={view}
              options={VIEW_OPTS}
              onChange={(v) => (onViewChange ? onViewChange(v) : setParam("view", v))}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * AppShell — layout de dos columnas del marketplace (DESIGN.md v2 §11).
 * Desktop (≥1024px): sidebar fijo ~260px + contenido (máx 1200px, padding).
 * Móvil (<1024px): sidebar colapsa a drawer con hamburguesa en un top-bar delgado.
 * SSR-safe: el estado del drawer arranca cerrado; nada de acceso a window en render.
 */

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import type { Aisle, Category } from "../lib/taxonomy";

export function AppShell({
  children,
  activeAisle,
  activeCategory,
}: {
  children: React.ReactNode;
  activeAisle?: Aisle;
  activeCategory?: Category;
}) {
  const [open, setOpen] = useState(false);

  // Cerrar con Escape + bloquear scroll del body mientras el drawer está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-bg text-text lg:flex">
      {/* Sidebar fijo (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 overflow-y-auto border-r border-border lg:block">
        <Sidebar activeAisle={activeAisle} activeCategory={activeCategory} />
      </aside>

      {/* Top-bar delgado (solo móvil) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir navegación"
          aria-expanded={open}
          className="grid h-11 w-11 -ml-2 place-items-center rounded text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
        >
          <span aria-hidden className="text-xl leading-none">
            ☰
          </span>
        </button>
        <span className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-bg">
            A
          </span>
          <span className="font-bold tracking-tight">
            Agent<span className="text-brand">-</span>Street
          </span>
        </span>
      </header>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navegación"
            className="glass absolute inset-y-0 left-0 w-[260px] max-w-[82vw] overflow-y-auto border-r border-border"
          >
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar navegación"
                className="grid h-11 w-11 place-items-center rounded text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
              >
                <span aria-hidden className="text-lg leading-none">
                  ✕
                </span>
              </button>
            </div>
            <div onClick={() => setOpen(false)}>
              <Sidebar
                activeAisle={activeAisle}
                activeCategory={activeCategory}
              />
            </div>
          </div>
        </div>
      )}

      {/* Contenido */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

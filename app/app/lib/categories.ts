/**
 * Shim de compatibilidad → la fuente de verdad es ahora `lib/taxonomy.ts`.
 *
 * Durante la transición a la taxonomía de 2 niveles (v2), este módulo sigue
 * exponiendo `Category`, `CATEGORIES` y `CATEGORY_LABELS` limitados a las 4
 * categorías OBLIGATORIAS del hackathon, para no romper los componentes/rutas
 * existentes. El código nuevo debe importar de `taxonomy.ts`.
 */

import {
  REQUIRED_CATEGORIES,
  categoryLabel,
  type Category as TaxCategory,
} from "./taxonomy";

export type Category = TaxCategory;

/** Solo las 4 obligatorias (compat). El código nuevo usa `AISLES`/`CATEGORY_DEFS`. */
export const CATEGORIES: Category[] = REQUIRED_CATEGORIES;

export const CATEGORY_LABELS = Object.fromEntries(
  REQUIRED_CATEGORIES.map((c) => [c, categoryLabel(c)]),
) as Record<Category, string>;

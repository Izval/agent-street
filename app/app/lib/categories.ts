/**
 * Compatibility shim → the source of truth is now `lib/taxonomy.ts`.
 *
 * During the transition to the 2-level taxonomy (v2), this module still exposes
 * `Category`, `CATEGORIES` and `CATEGORY_LABELS` limited to the 4 MANDATORY
 * hackathon categories, so as not to break existing components/routes. New code
 * should import from `taxonomy.ts`.
 */

import {
  REQUIRED_CATEGORIES,
  categoryLabel,
  type Category as TaxCategory,
} from "./taxonomy";

export type Category = TaxCategory;

/** Only the 4 mandatory ones (compat). New code uses `AISLES`/`CATEGORY_DEFS`. */
export const CATEGORIES: Category[] = REQUIRED_CATEGORIES;

export const CATEGORY_LABELS = Object.fromEntries(
  REQUIRED_CATEGORIES.map((c) => [c, categoryLabel(c)]),
) as Record<Category, string>;

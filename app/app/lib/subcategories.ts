/**
 * Compatibility shim → the source of truth is now `lib/taxonomy.ts`.
 *
 * During the transition to the 2-level taxonomy (v2), this module still exposes
 * `Subcategory`, `SUBCATEGORIES` and `SUBCATEGORY_LABELS` limited to the 4 MANDATORY
 * hackathon subcategories, so as not to break existing components/routes. New code
 * should import from `taxonomy.ts`.
 */

import {
  REQUIRED_SUBCATEGORIES,
  subcategoryLabel,
  type Subcategory as TaxSubcategory,
} from "./taxonomy";

export type Subcategory = TaxSubcategory;

/** Only the 4 mandatory ones (compat). New code uses `CATEGORIES`/`SUBCATEGORY_DEFS`. */
export const SUBCATEGORIES: Subcategory[] = REQUIRED_SUBCATEGORIES;

export const SUBCATEGORY_LABELS = Object.fromEntries(
  REQUIRED_SUBCATEGORIES.map((c) => [c, subcategoryLabel(c)]),
) as Record<Subcategory, string>;

/**
 * De sex kategorierna som motsvarar csv_2026/*.csv (slug = categorySlug efter laddning).
 */
export const PLAYABLE_CATEGORY_SLUGS = [
  "allmanbildning",
  "geografi",
  "historia",
  "noje",
  "personer",
  "sport",
] as const;

export type PlayableCategorySlug = (typeof PLAYABLE_CATEGORY_SLUGS)[number];

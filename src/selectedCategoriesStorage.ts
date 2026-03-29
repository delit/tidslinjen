import {
  PLAYABLE_CATEGORY_SLUGS,
  type PlayableCategorySlug,
} from "./playableCategories";

const STORAGE_KEY = "tidslinjen_selected_category_slugs";

function isPlayableSlug(s: string): s is PlayableCategorySlug {
  return (PLAYABLE_CATEGORY_SLUGS as readonly string[]).includes(s);
}

export function loadSelectedCategorySlugs(): PlayableCategorySlug[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...PLAYABLE_CATEGORY_SLUGS];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...PLAYABLE_CATEGORY_SLUGS];
    const next = arr.filter(
      (x): x is PlayableCategorySlug =>
        typeof x === "string" && isPlayableSlug(x)
    );
    if (next.length === 0) return [...PLAYABLE_CATEGORY_SLUGS];
    return next;
  } catch {
    return [...PLAYABLE_CATEGORY_SLUGS];
  }
}

export function saveSelectedCategorySlugs(slugs: PlayableCategorySlug[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}

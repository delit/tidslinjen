import type { EventCard } from "./types";
import { categoryPillLabel, categorySlug } from "./categoryUtils";

export type CategoryCountRow = {
  slug: string;
  label: string;
  count: number;
};

/** Räknar frågor per kategori (normaliserat slug) från laddade kort. */
export function buildCategoryCounts(events: EventCard[]): CategoryCountRow[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const s = categorySlug(e.category);
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  const rows: CategoryCountRow[] = [...map.entries()].map(([slug, count]) => ({
    slug,
    label: categoryPillLabel(slug),
    count,
  }));
  rows.sort((a, b) => a.label.localeCompare(b.label, "sv"));
  return rows;
}

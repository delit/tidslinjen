import { categorySlug } from "./categoryUtils";
import type { EventCard } from "./types";

/** Endast kort vars kategori (slug) finns i `selected`. */
export function filterEventsByCategorySlugs(
  events: EventCard[],
  selected: ReadonlySet<string>
): EventCard[] {
  if (selected.size === 0) return [];
  return events.filter((e) => selected.has(categorySlug(e.category)));
}

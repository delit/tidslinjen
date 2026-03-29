import {
  BookOpen,
  Clock,
  Clapperboard,
  Globe,
  MapPin,
  Music,
  Smartphone,
  Trophy,
  Tv,
  User,
  type LucideIcon,
} from "lucide-react";

/**
 * Normaliserar en kategori-sträng till en stabil slug som används i CSS och logik.
 * Hanterar både gamla CSV-kategorier och nya 2026-kategorier.
 */
export function categorySlug(category: string): string {
  const c = (category || "").toLowerCase().trim();

  // Nya 2026-kategorier
  if (c.includes("allmän") || c.includes("allman")) return "allmanbildning";
  if (c.includes("geografi")) return "geografi";
  if (c.includes("histor")) return "historia";
  if (c.includes("nöje") || c.includes("noje")) return "noje";

  // Gamla kategorier (bakåtkompatibilitet)
  if (c.includes("sport")) return "sport";
  if (c.includes("musik")) return "musik";
  if (c.includes("plat")) return "platser";
  if (c.includes("pryl")) return "prylar";
  if (c.includes("underh")) return "underhallning";

  // "personer" matchar båda gammal och ny
  if (c.includes("person")) return "personer";

  return "default";
}

/** Kort etikett på kategori-pillen. */
export function categoryPillLabel(category: string): string {
  const s = categorySlug(category);
  const map: Record<string, string> = {
    allmanbildning: "Allmänbildning",
    geografi:       "Geografi",
    historia:       "Historia",
    noje:           "Nöje",
    sport:          "Sport",
    musik:          "Musik",
    platser:        "Platser",
    prylar:         "Prylar",
    personer:       "Personer",
    underhallning:  "Underhållning",
    default:        "Övrigt",
  };
  return map[s] ?? map.default;
}

const ICONS: Record<string, LucideIcon> = {
  allmanbildning: BookOpen,
  geografi:       Globe,
  historia:       Clock,
  noje:           Clapperboard,
  sport:          Trophy,
  musik:          Music,
  platser:        MapPin,
  prylar:         Smartphone,
  personer:       User,
  underhallning:  Tv,
  default:        Clock,
};

export function CategoryIcon({ category }: { category: string }) {
  const slug = categorySlug(category);
  const Icon = ICONS[slug] ?? ICONS.default;
  return <Icon className="cat-svg" size={20} strokeWidth={2} aria-hidden />;
}

/** Ikon för en normaliserad kategori-slug (t.ex. inställningar 3×2-rutnät). */
export function CategoryIconBySlug({ slug }: { slug: string }) {
  const Icon = ICONS[slug] ?? ICONS.default;
  return <Icon className="cat-svg" size={22} strokeWidth={2} aria-hidden />;
}

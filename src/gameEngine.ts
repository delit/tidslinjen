/**
 * Spellogik (port från js/game.js) — samma regler som vanilla Tidslinjen.
 */
import type { EventCard } from "./types";

/** Gamla CSV-filer (event,year,category,description). */
export const CSV_FILES_LEGACY = [
  "csv/sport.csv",
  "csv/musik.csv",
  "csv/platser.csv",
  "csv/prylar.csv",
  "csv/personer.csv",
  "csv/underhallning.csv",
] as const;

/** Nya CSV-filer (category,question,year). */
export const CSV_FILES_2026 = [
  "csv_2026/allmanbildning.csv",
  "csv_2026/geografi.csv",
  "csv_2026/historia.csv",
  "csv_2026/noje.csv",
  "csv_2026/personer.csv",
  "csv_2026/sport.csv",
] as const;

export function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

/**
 * Parsar ett år-värde som kan vara:
 *   - Ett positivt heltal:  "1969"   → 1969
 *   - Ett f.Kr.-år:         "2500 f.Kr."  → -2500
 * Returnerar NaN om det inte går att tolka.
 */
export function parseYear(raw: string): number {
  const s = raw.trim();
  // Matcha "2500 f.Kr.", "323 f.kr.", "323 F.KR." osv.
  const bceMatch = s.match(/^(\d+)\s*f\.?\s*kr\.?$/i);
  if (bceMatch) return -parseInt(bceMatch[1], 10);
  const plain = parseInt(s.replace(/\s/g, ""), 10);
  return plain;
}

/** Formaterar ett år-tal för visning: negativa tal → "2500 f.Kr." */
export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} f.Kr.`;
  return String(year);
}

export function parseCSV(text: string): EventCard[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Stöd för båda format:
  //   Gammalt: event, year, category, description
  //   Nytt:    category, question, year
  const idx = {
    event:       header.indexOf("event") >= 0 ? header.indexOf("event") : header.indexOf("question"),
    year:        header.indexOf("year"),
    category:    header.indexOf("category"),
    description: header.indexOf("description"),
  };
  if (idx.event < 0 || idx.year < 0) return [];

  const rows: EventCard[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCSVLine(lines[r]);
    if (cells.length < 2) continue;
    const year = parseYear(cells[idx.year] || "");
    if (Number.isNaN(year)) continue;
    rows.push({
      event:       cells[idx.event] || "",
      year,
      category:    idx.category >= 0 ? cells[idx.category] || "" : "",
      description: idx.description >= 0 ? cells[idx.description] || "" : "",
    });
  }
  return rows;
}

export async function loadAllEvents(): Promise<EventCard[]> {
  const all: EventCard[] = [];
  // Ladda enbart de nya 2026-filerna (ersätter de gamla)
  for (const path of CSV_FILES_2026) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const text = await res.text();
      all.push(...parseCSV(text));
    } catch {
      /* nätverk / fil */
    }
  }
  return all;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleInPlaceSeeded<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Samma ordning för alla som delar samma RNG (t.ex. daglig seed). */
export function pickAnchorSeeded(
  events: EventCard[],
  rng: () => number
): EventCard | null {
  if (!events.length) return null;
  const i = Math.floor(rng() * events.length);
  return events[i];
}

export function buildDeckSeeded(
  events: EventCard[],
  excludeKeys: Set<string>,
  rng: () => number
): EventCard[] {
  const pool = events.filter((e) => !excludeKeys.has(eventKey(e)));
  return shuffleInPlaceSeeded(pool.slice(), rng);
}

export function insertAt(timeline: EventCard[], card: EventCard, insertIndex: number): EventCard[] {
  const next = timeline.slice();
  next.splice(insertIndex, 0, card);
  return next;
}

export function isPlacementCorrect(
  timelineBefore: EventCard[],
  newCard: EventCard,
  insertIndex: number
): boolean {
  const merged = insertAt(timelineBefore, newCard, insertIndex);
  const n = merged.length;
  const newPos = insertIndex;

  for (let i = 0; i < n - 1; i++) {
    if (merged[i].year > merged[i + 1].year) return false;
  }

  if (merged.some((c) => c !== newCard && c.year === newCard.year)) {
    const sameYearIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (merged[i].year === newCard.year) sameYearIdx.push(i);
    }
    const adjacentToSame = sameYearIdx.some((idx) => Math.abs(idx - newPos) === 1);
    if (!adjacentToSame) return false;
  }

  return true;
}

export function eventKey(e: EventCard): string {
  return `${e.year}|${e.event}|${e.category}`;
}

export function pickAnchor(events: EventCard[]): EventCard | null {
  if (!events.length) return null;
  const i = Math.floor(Math.random() * events.length);
  return events[i];
}

export function buildDeck(events: EventCard[], excludeKeys: Set<string>): EventCard[] {
  const pool = events.filter((e) => !excludeKeys.has(eventKey(e)));
  return shuffleInPlace(pool.slice());
}

/** Samma som vanilla `drawNext`: poppar från deck tills ett oanvänt kort hittas. */
export function drawNext(deck: EventCard[], usedIds: Set<string>): { card: EventCard | null; deck: EventCard[] } {
  const next = deck.slice();
  while (next.length) {
    const c = next.pop()!;
    if (!usedIds.has(eventKey(c))) return { card: c, deck: next };
  }
  return { card: null, deck: next };
}

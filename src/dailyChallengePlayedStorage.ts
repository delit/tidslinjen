import { getStockholmDateString } from "./stockholmDate";

const KEY = "tidslinjen_daily_challenge_played_date";

/** YYYY-MM-DD (Stockholm) när användaren senast startade dagens utmaning. */
export function getDailyChallengePlayedDateKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markDailyChallengePlayedForDate(dateKey: string): void {
  try {
    localStorage.setItem(KEY, dateKey);
  } catch {
    /* ignore */
  }
}

export function hasPlayedDailyChallengeToday(): boolean {
  const saved = getDailyChallengePlayedDateKey();
  const today = getStockholmDateString();
  return saved === today;
}

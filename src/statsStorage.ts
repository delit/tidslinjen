const STORAGE_GAME_OVER = "tidslinjen_gameover_stats";
const STORAGE_DAILY_STREAK = "tidslinjen_daily_streak";

function localYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Skillnad i kalenderdagar mellan a och b (b ska vara "idag"); a,b är YYYY-MM-DD lokalt. */
function daysBetweenYmd(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const ta = Date.UTC(ya, ma - 1, da);
  const tb = Date.UTC(yb, mb - 1, db);
  return Math.round((tb - ta) / 86400000);
}

export type DailyStreakState = {
  /** Senaste dag då en runda räknades (YYYY-MM-DD lokalt). */
  lastCountedDate: string;
  streak: number;
};

function loadDailyStreakState(): DailyStreakState {
  try {
    const raw = localStorage.getItem(STORAGE_DAILY_STREAK);
    if (!raw) return { lastCountedDate: "", streak: 0 };
    const o = JSON.parse(raw) as Partial<DailyStreakState>;
    return {
      lastCountedDate:
        typeof o.lastCountedDate === "string" ? o.lastCountedDate : "",
      streak:
        typeof o.streak === "number" && Number.isFinite(o.streak) && o.streak >= 0
          ? Math.floor(o.streak)
          : 0,
    };
  } catch {
    return { lastCountedDate: "", streak: 0 };
  }
}

function saveDailyStreakState(s: DailyStreakState): void {
  localStorage.setItem(STORAGE_DAILY_STREAK, JSON.stringify(s));
}

/**
 * Anropas när en spelrunda avslutas (över-skärm). Högst en räkning per kalenderdag.
 * Ökar serien om gårdagen redan var med, annars börjar om vid 1 (eller första gången).
 */
export function recordDailyStreakPlay(): void {
  const today = localYmd();
  const s = loadDailyStreakState();

  if (s.lastCountedDate === today) {
    return;
  }

  if (!s.lastCountedDate) {
    saveDailyStreakState({ lastCountedDate: today, streak: 1 });
    return;
  }

  const diff = daysBetweenYmd(s.lastCountedDate, today);
  if (diff === 1) {
    saveDailyStreakState({
      lastCountedDate: today,
      streak: s.streak + 1,
    });
  } else {
    saveDailyStreakState({ lastCountedDate: today, streak: 1 });
  }
}

/** Aktuell daglig streak för visning (0 om serien brutits). */
export function getDailyStreak(): number {
  const s = loadDailyStreakState();
  if (!s.lastCountedDate) return 0;
  const today = localYmd();
  const diff = daysBetweenYmd(s.lastCountedDate, today);
  if (diff === 0) return s.streak;
  if (diff === 1) return s.streak;
  return 0;
}

export type GameOverStatEntry = {
  score: number;
  durationMs: number;
  at: string;
};

export function loadGameOverStats(): GameOverStatEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_GAME_OVER);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is GameOverStatEntry =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as GameOverStatEntry).score === "number" &&
        typeof (x as GameOverStatEntry).durationMs === "number"
    );
  } catch {
    return [];
  }
}

export function appendGameOverStat(score: number, durationMs: number): void {
  const list = loadGameOverStats();
  list.push({
    score,
    durationMs: Math.max(0, Math.round(durationMs)),
    at: new Date().toISOString(),
  });
  localStorage.setItem(
    STORAGE_GAME_OVER,
    JSON.stringify(list.slice(-500))
  );
}

export function getGameOverAggregates(): {
  count: number;
  avgScore: number;
  avgDurationMs: number;
} {
  const list = loadGameOverStats();
  const n = list.length;
  if (n === 0) {
    return { count: 0, avgScore: 0, avgDurationMs: 0 };
  }
  const sumScore = list.reduce((a, e) => a + e.score, 0);
  const sumDur = list.reduce((a, e) => a + e.durationMs, 0);
  return {
    count: n,
    avgScore: sumScore / n,
    avgDurationMs: sumDur / n,
  };
}

export function clearGameOverStats(): void {
  localStorage.removeItem(STORAGE_GAME_OVER);
}

export function clearDailyStreakStorage(): void {
  localStorage.removeItem(STORAGE_DAILY_STREAK);
}

export function clearAllStatisticsStorage(): void {
  clearGameOverStats();
  clearDailyStreakStorage();
}

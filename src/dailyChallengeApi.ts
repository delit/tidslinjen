import { getSupabase, isSupabaseConfigured } from "./supabaseClient";
import { DAILY_PLAYER_NAME_MAX } from "./dailyChallengeConstants";

export type DailyLeaderboardRow = {
  player_name: string;
  score: number;
  created_at: string;
};

const LEADERBOARD_CACHE_TTL_MS = 20_000;

const leaderboardCache = new Map<
  string,
  { rows: DailyLeaderboardRow[]; expiresAtMs: number }
>();

export type FetchDailyLeaderboardOptions = {
  forceRefresh?: boolean;
};

export async function fetchDailyLeaderboard(
  challengeDate: string,
  options?: FetchDailyLeaderboardOptions
): Promise<DailyLeaderboardRow[]> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh) {
    const cached = leaderboardCache.get(challengeDate);
    if (cached && Date.now() < cached.expiresAtMs) {
      return cached.rows;
    }
  }

  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("daily_scores")
    .select("player_name,score,created_at")
    .eq("challenge_date", challengeDate)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) {
    console.warn("daily_scores fetch", error.message);
    return [];
  }

  const rows = (data ?? []) as DailyLeaderboardRow[];
  leaderboardCache.set(challengeDate, {
    rows,
    expiresAtMs: Date.now() + LEADERBOARD_CACHE_TTL_MS,
  });
  return rows;
}

export type SubmitDailyResult = "ok" | "duplicate" | "config" | "error";

export type SubmitDailyScoreOutcome = {
  result: SubmitDailyResult;
  /** Kort tekniskt fel (t.ex. RLS) för felsökning – visas sparsamt i UI. */
  detail?: string;
};

/** Invalidera cache efter lyckad ändring av topplistan. */
export function invalidateDailyLeaderboardCache(challengeDate?: string): void {
  if (!challengeDate) {
    leaderboardCache.clear();
    return;
  }
  leaderboardCache.delete(challengeDate);
}

const CLIENT_SUBMIT_MIN_GAP_MS = 2000;
const CLIENT_SUBMIT_WINDOW_MS = 10 * 60 * 1000;
const CLIENT_SUBMIT_MAX_PER_WINDOW = 12;
const clientSubmitTimestamps: number[] = [];

function tryConsumeClientSubmitSlot(): boolean {
  const now = Date.now();
  while (
    clientSubmitTimestamps.length > 0 &&
    now - clientSubmitTimestamps[0]! > CLIENT_SUBMIT_WINDOW_MS
  ) {
    clientSubmitTimestamps.shift();
  }
  if (clientSubmitTimestamps.length >= CLIENT_SUBMIT_MAX_PER_WINDOW) {
    return false;
  }
  const last = clientSubmitTimestamps[clientSubmitTimestamps.length - 1];
  if (last !== undefined && now - last < CLIENT_SUBMIT_MIN_GAP_MS) {
    return false;
  }
  clientSubmitTimestamps.push(now);
  return true;
}

let warnedDirectDailyInsertFallback = false;

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  const c = err.code != null ? String(err.code) : "";
  if (c === "23505") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("unique") && m.includes("violat");
}

type EdgeSubmitPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
};

function parseEdgeSubmitPayload(data: unknown): SubmitDailyScoreOutcome | null {
  if (!data || typeof data !== "object") return null;
  const d = data as EdgeSubmitPayload;
  if (d.ok === true) {
    return { result: "ok" };
  }
  if (d.code === "duplicate") {
    return { result: "duplicate" };
  }
  if (d.code === "rate_limit") {
    return {
      result: "error",
      detail:
        d.message ??
        "För många försök. Vänta en stund och försök igen.",
    };
  }
  if (d.code === "method") {
    return { result: "error", detail: "Ogiltig begäran." };
  }
  if (d.code === "validation" || d.code === "json") {
    return { result: "error", detail: "Ogiltiga värden." };
  }
  if (d.code === "server_config" || d.code === "db") {
    return {
      result: "error",
      detail: d.message ?? "Kunde inte spara.",
    };
  }
  if (d.ok === false) {
    return { result: "error", detail: d.message ?? "Kunde inte spara." };
  }
  return null;
}

async function submitDailyScoreDirect(
  challengeDate: string,
  player_name: string,
  score: number
): Promise<SubmitDailyScoreOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { result: "config" };
  }
  const { error } = await sb.from("daily_scores").insert({
    challenge_date: challengeDate,
    player_name,
    score,
  });
  if (!error) {
    return { result: "ok" };
  }
  if (isUniqueViolation(error)) {
    return { result: "duplicate" };
  }
  const detail =
    [error.message, error.hint].filter(Boolean).join(" — ") || "Okänt fel";
  console.warn("daily_scores insert", error);
  return { result: "error", detail };
}

export async function submitDailyScore(
  challengeDate: string,
  rawName: string,
  score: number
): Promise<SubmitDailyScoreOutcome> {
  if (!isSupabaseConfigured()) {
    return { result: "config" };
  }
  const sb = getSupabase();
  if (!sb) {
    return { result: "config" };
  }
  const player_name = rawName.trim().slice(0, DAILY_PLAYER_NAME_MAX);
  if (!player_name.length) {
    return { result: "error", detail: "Tomt namn" };
  }

  if (!tryConsumeClientSubmitSlot()) {
    return {
      result: "error",
      detail: "Vänta några sekunder innan nästa försök.",
    };
  }

  const forceDirect =
    import.meta.env.VITE_FORCE_DIRECT_DAILY_INSERT === "true";

  let outcome: SubmitDailyScoreOutcome;

  if (!forceDirect) {
    const { data, error } = await sb.functions.invoke("submit-daily-score", {
      body: {
        challenge_date: challengeDate,
        player_name,
        score,
      },
    });

    if (!error && data != null) {
      const parsed = parseEdgeSubmitPayload(data);
      if (parsed) {
        outcome = parsed;
      } else {
        if (import.meta.env.DEV && !warnedDirectDailyInsertFallback) {
          warnedDirectDailyInsertFallback = true;
          console.warn(
            "[Tidslinjen] Oväntat svar från submit-daily-score — använder direkt tabell-insert."
          );
        }
        outcome = await submitDailyScoreDirect(
          challengeDate,
          player_name,
          score
        );
      }
    } else {
      if (import.meta.env.DEV && !warnedDirectDailyInsertFallback) {
        warnedDirectDailyInsertFallback = true;
        console.warn(
          "[Tidslinjen] Edge Function submit-daily-score otillgänglig — använder direkt tabell-insert. Deploy: supabase functions deploy submit-daily-score"
        );
      }
      outcome = await submitDailyScoreDirect(
        challengeDate,
        player_name,
        score
      );
    }
  } else {
    outcome = await submitDailyScoreDirect(
      challengeDate,
      player_name,
      score
    );
  }

  if (outcome.result === "ok" || outcome.result === "duplicate") {
    invalidateDailyLeaderboardCache(challengeDate);
  }

  return outcome;
}

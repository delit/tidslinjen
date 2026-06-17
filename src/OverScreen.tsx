import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Home, Loader2, RotateCcw } from "lucide-react";
import { useChronosGame } from "./ChronosGameContext";
import { playClick } from "./sound";
import {
  fetchDailyLeaderboard,
  submitDailyScore,
  type DailyLeaderboardRow,
} from "./dailyChallengeApi";
import { getSupabaseConfigMessage, isSupabaseConfigured } from "./supabaseClient";
import { DAILY_PLAYER_NAME_MAX } from "./dailyChallengeConstants";

export function OverScreen() {
  const { state, playAgain, goStart } = useChronosGame();
  const won = state.won === true;
  const isDaily = state.gameMode === "daily" && state.dailyDateKey;
  const challengeDate = state.dailyDateKey ?? "";

  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "sending" | "ok" | "duplicate" | "error" | "config"
  >("idle");
  const [submitErrorDetail, setSubmitErrorDetail] = useState<string | null>(
    null
  );

  const refreshLeaderboard = useCallback(
    async (forceRefresh = false) => {
      if (!challengeDate) return;
      setLeaderboardLoading(true);
      try {
        const rows = await fetchDailyLeaderboard(challengeDate, {
          forceRefresh,
        });
        setLeaderboard(rows);
      } finally {
        setLeaderboardLoading(false);
      }
    },
    [challengeDate]
  );

  useEffect(() => {
    if (!isDaily) return;
    void refreshLeaderboard(false);
  }, [isDaily, refreshLeaderboard]);

  const handleSubmitScore = useCallback(async () => {
    if (!challengeDate) return;
    const trimmed = playerName.trim().slice(0, DAILY_PLAYER_NAME_MAX);
    if (!trimmed.length) return;
    setSubmitStatus("sending");
    setSubmitErrorDetail(null);
    const { result, detail } = await submitDailyScore(
      challengeDate,
      trimmed,
      state.score
    );
    if (result === "ok") {
      setSubmitStatus("ok");
      setPlayerName(trimmed);
      await refreshLeaderboard(true);
    } else if (result === "duplicate") {
      setSubmitStatus("duplicate");
      await refreshLeaderboard(true);
    } else if (result === "config") {
      setSubmitStatus("config");
    } else {
      setSubmitStatus("error");
      setSubmitErrorDetail(detail ?? null);
    }
  }, [challengeDate, playerName, state.score, refreshLeaderboard]);

  const dateLabel =
    challengeDate.length === 10
      ? new Date(challengeDate + "T12:00:00").toLocaleDateString("sv-SE", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : challengeDate;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="over-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="relative z-10 w-full max-w-md max-h-[min(92vh,720px)] overflow-y-auto scrollbar-hide rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/92 via-blue-950/88 to-indigo-950/90 p-8 shadow-2xl backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10 sm:p-10 text-center"
      >
        <h2
          id="over-title"
          className="text-white text-3xl sm:text-4xl font-headline font-bold mb-1 tracking-tight"
        >
          {isDaily ? "Dagens utmaning" : won ? "Klarade spelet!" : "Game Over"}
        </h2>
        {isDaily && (
          <p className="text-slate-400 text-sm font-medium mb-2 capitalize">
            {dateLabel}
          </p>
        )}
        <p className="text-slate-300 mb-2 font-medium text-lg">
          Poäng:{" "}
          <span className="font-headline font-bold text-coral">
            {state.score}
          </span>
        </p>
        {won && !isDaily ? (
          <p className="text-slate-400 mb-8 font-medium text-sm">
            Du klarade alla kort.
          </p>
        ) : won && isDaily ? (
          <p className="text-slate-400 mb-6 font-medium text-sm">
            Du klarade alla kort.
          </p>
        ) : (
          <div className="mb-6" aria-hidden />
        )}

        {isDaily && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Dagens topplista
              </p>
              {leaderboardLoading && (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-coral"
                  aria-hidden
                />
              )}
            </div>
            {!isSupabaseConfigured() && (
              <p className="text-xs text-amber-200/90 mb-3">
                {getSupabaseConfigMessage()}
              </p>
            )}
            {leaderboard.length === 0 && !leaderboardLoading ? (
              <p className="text-sm text-slate-500 py-1">
                Inga resultat ännu idag.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.map((row, i) => (
                  <li
                    key={`${row.player_name}-${i}-${row.score}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-headline tabular-nums text-slate-500 w-5">
                        {i + 1}.
                      </span>
                      <span className="truncate text-slate-200">
                        {row.player_name}
                      </span>
                    </span>
                    <span className="shrink-0 font-headline font-semibold text-coral tabular-nums">
                      {row.score} p
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-4 pt-3 border-t border-white/10">
              <label
                htmlFor="daily-player-name"
                className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5"
              >
                Smeknamn (max {DAILY_PLAYER_NAME_MAX} tecken)
              </label>
              <input
                id="daily-player-name"
                type="text"
                maxLength={DAILY_PLAYER_NAME_MAX}
                value={playerName}
                disabled={submitStatus === "ok" || submitStatus === "sending"}
                onChange={(e) => {
                  setPlayerName(
                    e.target.value.slice(0, DAILY_PLAYER_NAME_MAX)
                  );
                  if (
                    submitStatus === "duplicate" ||
                    submitStatus === "error"
                  ) {
                    setSubmitStatus("idle");
                    setSubmitErrorDetail(null);
                  }
                }}
                placeholder="t.ex. TidslinjenFan"
                className="w-full rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-coral/50 focus:outline-none focus:ring-1 focus:ring-coral/40 disabled:opacity-60"
                autoComplete="off"
              />
              <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">
                Använd ett smeknamn, inte ditt riktiga namn. Första registreringen för ett namn gäller för dagen.
              </p>
              {submitStatus === "duplicate" && (
                <p className="mt-2 text-xs text-amber-200/95">
                  Det namnet är redan registrerat idag med ett annat resultat.
                </p>
              )}
              {submitStatus === "ok" && (
                <p className="mt-2 text-xs text-emerald-300/95">
                  Resultat registrerat.
                </p>
              )}
              {submitStatus === "error" && (
                <p className="mt-2 text-xs text-rose-300/95 text-left leading-snug">
                  Kunde inte spara.{" "}
                  {submitErrorDetail ? (
                    <span className="block mt-1 text-slate-400 font-mono text-[11px] break-words">
                      {submitErrorDetail}
                    </span>
                  ) : (
                    "Försök igen."
                  )}
                </p>
              )}
              {submitStatus === "config" && (
                <p className="mt-2 text-xs text-slate-400">
                  Lägg till Supabase-nycklar i miljön för att skicka in.
                </p>
              )}
              <button
                type="button"
                disabled={
                  submitStatus === "sending" ||
                  submitStatus === "ok" ||
                  !playerName.trim().length ||
                  !isSupabaseConfigured()
                }
                onClick={() => void handleSubmitScore()}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-coral/90 font-headline text-sm font-bold text-white hover:bg-coral disabled:opacity-40 disabled:pointer-events-none"
              >
                {submitStatus === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Skickar…
                  </>
                ) : (
                  "Skicka till topplistan"
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {!isDaily && (
            <button
              type="button"
              onClick={() => void playAgain()}
              className="flex h-14 w-full items-center justify-center gap-2 bg-coral text-white rounded-2xl font-headline font-bold text-lg hover:bg-[#ff6a3d] transition-all active:scale-[0.98] shadow-[0_10px_30px_rgba(255,127,80,0.25)]"
            >
              <RotateCcw
                className="h-5 w-5 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
              Spela igen
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playClick();
              goStart();
            }}
            className="flex h-14 w-full items-center justify-center gap-2 bg-white/10 text-white rounded-2xl font-headline font-bold text-lg hover:bg-white/15 transition-all active:scale-[0.98] border border-white/12"
          >
            <Home className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Till huvudmenyn
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


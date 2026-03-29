import { useCallback, useEffect, useState } from "react";
import { Heart, Loader2, Play, Timer, Trophy, X } from "lucide-react";
import { playClick } from "./sound";
import {
  fetchDailyLeaderboard,
  type DailyLeaderboardRow,
} from "./dailyChallengeApi";

type DailyChallengeModalProps = {
  onClose: () => void;
  onStart: () => void;
  /** Dagens datum (Stockholm) för topplistan */
  challengeDate: string;
  /** Om användaren redan startat dagens utmaning idag */
  alreadyPlayed: boolean;
};

type Panel = "intro" | "leaderboard";

const settingsStyleBtn =
  "flex h-14 min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-3 font-headline font-semibold text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/18 hover:bg-white/[0.09] active:scale-[0.99]";

export function DailyChallengeModal({
  onClose,
  onStart,
  challengeDate,
  alreadyPlayed,
}: DailyChallengeModalProps) {
  const [panel, setPanel] = useState<Panel>("intro");
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [blockedHint, setBlockedHint] = useState(false);

  const loadBoard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const rows = await fetchDailyLeaderboard(challengeDate);
      setLeaderboard(rows);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [challengeDate]);

  useEffect(() => {
    if (panel === "leaderboard") {
      void loadBoard();
    }
  }, [panel, loadBoard]);

  const handleStartClick = () => {
    if (alreadyPlayed) {
      setBlockedHint(true);
      return;
    }
    playClick();
    onStart();
  };

  const dateTitle =
    challengeDate.length === 10
      ? new Date(challengeDate + "T12:00:00").toLocaleDateString("sv-SE", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : challengeDate;

  return (
    <div
      id="daily-challenge-intro-modal"
      className="fixed inset-0 z-[110] flex items-center justify-center p-5 bg-black/50 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-challenge-intro-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Stäng"
        onClick={() => {
          playClick();
          onClose();
        }}
      />
      <div className="relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/95 via-blue-950/90 to-indigo-950/92 p-6 shadow-2xl ring-1 ring-inset ring-white/10 sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2
            id="daily-challenge-intro-title"
            className="font-headline min-w-0 truncate text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            {panel === "leaderboard" ? "Dagens topplista" : "Dagens utmaning"}
          </h2>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/18 hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label="Stäng"
            onClick={() => {
              playClick();
              onClose();
            }}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {panel === "leaderboard" ? (
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-2">
            <p className="text-center text-[13px] text-slate-500 mb-4 capitalize">
              {dateTitle}
            </p>
            {leaderboardLoading ? (
              <div className="flex justify-center py-8">
                <Loader2
                  className="h-8 w-8 animate-spin text-coral"
                  aria-hidden
                />
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-6">
                Inga resultat ännu idag.
              </p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((row, i) => (
                  <li
                    key={`${row.player_name}-${i}-${row.score}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-headline tabular-nums text-slate-500 w-6">
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
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-2">
            <p className="text-left text-[15px] leading-relaxed text-slate-300 sm:text-base mb-5">
              Alla som spelar{" "}
              <span className="text-white font-headline font-semibold">samma dag</span>{" "}
              får samma blandning av frågor. Du spelar tills dina liv är slut. Lyckas du
              hamna på topplistan?
            </p>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/14 bg-white/[0.07] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <Heart
                  className="h-6 w-6 text-coral mb-0.5"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="font-headline text-[36px] sm:text-[40px] font-bold tabular-nums leading-none text-white">
                  5
                </span>
                <span className="text-[11px] font-headline font-semibold uppercase tracking-[0.18em] text-slate-400">
                  liv
                </span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/14 bg-white/[0.07] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <Timer
                  className="h-6 w-6 text-coral mb-0.5"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="font-headline text-[36px] sm:text-[40px] font-bold tabular-nums leading-none text-white">
                  20
                </span>
                <span className="text-center text-[11px] font-headline font-semibold uppercase tracking-[0.18em] text-slate-400">
                  sekunder
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`${settingsStyleBtn} min-w-0`}
                onClick={() => {
                  playClick();
                  setPanel("leaderboard");
                }}
              >
                <Trophy className="h-5 w-5 shrink-0 text-slate-300" strokeWidth={2} aria-hidden />
                <span className="truncate">Topplistan</span>
              </button>
              <button
                type="button"
                className={`flex h-14 min-h-[3.5rem] min-w-0 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-coral px-3 font-headline font-semibold text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all hover:bg-[#ff6a3d] active:scale-[0.99] ${
                  alreadyPlayed ? "opacity-50 cursor-not-allowed" : ""
                }`}
                aria-disabled={alreadyPlayed}
                onClick={handleStartClick}
              >
                <Play className="h-5 w-5 shrink-0 text-white" strokeWidth={2} aria-hidden />
                <span className="truncate">Spela</span>
              </button>
            </div>

            {blockedHint && alreadyPlayed && (
              <p
                className="mt-4 text-left text-[13px] leading-snug text-amber-200/95"
                role="status"
              >
                Du har redan spelat dagens utmaning. Nästa omgång finns efter midnatt
                (svensk tid).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

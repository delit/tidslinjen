import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Heart,
  HelpCircle,
  LayoutGrid,
  Timer,
  Trash2,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import packageJson from "../package.json";
import { useChronosGame } from "./ChronosGameContext";
import { GameScreen } from "./GameScreen";
import { HowToPlayModal } from "./HowToPlayModal";
import { DailyChallengeModal } from "./DailyChallengeModal";
import { hasPlayedDailyChallengeToday } from "./dailyChallengePlayedStorage";
import { getStockholmDateString } from "./stockholmDate";
import { MeshBackground } from "./MeshBackground";
import { OverScreen } from "./OverScreen";
import { StartScreen } from "./StartScreen";
import {
  CategoryIcon,
  CategoryIconBySlug,
  categoryPillLabel,
  categorySlug,
} from "./categoryUtils";
import { buildCategoryCounts, type CategoryCountRow } from "./categoryCounts";
import { ALLOWED_LIVES } from "./allowedLives";
import { PLAYABLE_CATEGORY_SLUGS } from "./playableCategories";
import { formatSvDecimal, formatSvInteger } from "./formatSvNumber";
import { formatYear, loadAllEvents } from "./gameEngine";
import { getDailyStreak, getGameOverAggregates } from "./statsStorage";
import {
  TIMER_SECONDS_MAX,
  TIMER_SECONDS_MIN,
} from "./timerSettingsStorage";
import { playClick, soundEnabled } from "./sound";

const STORAGE_SOUND = "tidslinjen_sound";


function formatAvgDurationMs(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${s.toString().padStart(2, "0")} s`;
}

export function ChronosApp() {
  const {
    state,
    settingsOpen,
    setSettingsOpen,
    highscoresOpen,
    setHighscoresOpen,
    statsOpen,
    setStatsOpen,
    howToPlayOpen,
    setHowToPlayOpen,
    openHowToPlay,
    dailyIntroOpen,
    closeDailyIntroOnly,
    confirmDailyIntroAndStart,
    detailBoardIndex,
    setDetailBoardIndex,
    highscores,
    openHighscores,
    openStatistics,
    selectLives,
    selectedCategorySlugs,
    toggleCategorySlug,
    clearHighscores,
    clearStatistics,
    questionTimerEnabled,
    setQuestionTimerEnabled,
    questionTimerSeconds,
    setQuestionTimerSeconds,
  } = useChronosGame();

  const [, bumpSound] = useReducer((n) => n + 1, 0);

  /** När Högsta poäng/Statistik öppnats från inställningar: stäng child → visa settings igen. */
  const returnToSettingsAfterChildModalRef = useRef(false);

  const closeHighscoresModal = useCallback(() => {
    setHighscoresOpen(false);
    if (returnToSettingsAfterChildModalRef.current) {
      returnToSettingsAfterChildModalRef.current = false;
      setSettingsOpen(true);
    }
  }, [setHighscoresOpen, setSettingsOpen]);

  const closeStatsModal = useCallback(() => {
    setStatsOpen(false);
    if (returnToSettingsAfterChildModalRef.current) {
      returnToSettingsAfterChildModalRef.current = false;
      setSettingsOpen(true);
    }
  }, [setStatsOpen, setSettingsOpen]);

  const closeHowToPlayModal = useCallback(() => {
    setHowToPlayOpen(false);
    if (returnToSettingsAfterChildModalRef.current) {
      returnToSettingsAfterChildModalRef.current = false;
      setSettingsOpen(true);
    }
  }, [setHowToPlayOpen, setSettingsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detailBoardIndex !== null) {
        setDetailBoardIndex(null);
        return;
      }
      if (highscoresOpen) {
        closeHighscoresModal();
        return;
      }
      if (statsOpen) {
        closeStatsModal();
        return;
      }
      if (dailyIntroOpen) {
        closeDailyIntroOnly();
        return;
      }
      if (howToPlayOpen) {
        closeHowToPlayModal();
        return;
      }
      returnToSettingsAfterChildModalRef.current = false;
      setSettingsOpen(false);
      setHighscoresOpen(false);
      setStatsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    detailBoardIndex,
    highscoresOpen,
    statsOpen,
    howToPlayOpen,
    dailyIntroOpen,
    closeDailyIntroOnly,
    closeHighscoresModal,
    closeStatsModal,
    closeHowToPlayModal,
    setHowToPlayOpen,
    setSettingsOpen,
    setHighscoresOpen,
    setStatsOpen,
    setDetailBoardIndex,
  ]);

  const boardCard =
    detailBoardIndex !== null ? state.timeline[detailBoardIndex] : null;

  const closeModals = () => {
    returnToSettingsAfterChildModalRef.current = false;
    setSettingsOpen(false);
    setHighscoresOpen(false);
    setStatsOpen(false);
    setHowToPlayOpen(false);
    setDetailBoardIndex(null);
  };

  const closeDetailOnly = () => {
    setDetailBoardIndex(null);
  };

  const toggleSound = () => {
    playClick();
    localStorage.setItem(STORAGE_SOUND, soundEnabled() ? "off" : "on");
    bumpSound();
  };

  const openHighscoresFromSettings = () => {
    returnToSettingsAfterChildModalRef.current = true;
    setSettingsOpen(false);
    openHighscores();
  };

  const openStatisticsFromSettings = () => {
    returnToSettingsAfterChildModalRef.current = true;
    openStatistics();
  };

  const openHowToPlayFromSettings = () => {
    returnToSettingsAfterChildModalRef.current = true;
    setSettingsOpen(false);
    openHowToPlay();
  };

  const [statsCategoryRows, setStatsCategoryRows] = useState<
    CategoryCountRow[] | null
  >(null);
  const [livesPickerOpen, setLivesPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [timerPickerOpen, setTimerPickerOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) {
      setLivesPickerOpen(false);
      setCategoryPickerOpen(false);
      setTimerPickerOpen(false);
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (!statsOpen) {
      setStatsCategoryRows(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const ev = await loadAllEvents();
      if (!cancelled) setStatsCategoryRows(buildCategoryCounts(ev));
    })();
    return () => {
      cancelled = true;
    };
  }, [statsOpen]);

  const topScores = highscores.slice(0, 5);
  const isStart = state.screen === "start";

  return (
    <div
      data-app-scroll
      className={
        isStart
          ? "relative flex min-h-0 flex-1 flex-col items-center w-full max-w-[100vw] justify-center overflow-x-hidden overflow-y-hidden overscroll-x-none overscroll-y-none scrollbar-hide text-slate-100"
          : "relative flex min-h-0 flex-1 flex-col items-center w-full max-w-[100vw] touch-pan-y justify-start overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain scrollbar-hide text-slate-100 scroll-pt-[7.5rem]"
      }
    >
      <MeshBackground />

      <div
        className={
          isStart
            ? "w-full max-w-[500px] shrink-0 mx-auto h-full min-h-0 flex flex-col overflow-hidden relative z-10"
            : "w-full max-w-[500px] shrink-0 mx-auto min-h-min flex flex-col relative z-10"
        }
      >
        {state.screen === "start" && <StartScreen />}
        {state.screen === "game" && <GameScreen />}
        {state.screen === "over" && <OverScreen />}
      </div>

      {detailBoardIndex !== null && boardCard && (
        <div
          id="detail-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-year"
          aria-describedby="detail-modal-question"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Stäng"
            onClick={closeDetailOnly}
          />
          <div className="relative z-10 w-full max-w-md overflow-visible rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/92 via-blue-950/88 to-indigo-950/90 px-8 pb-10 pt-5 shadow-2xl backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10 sm:px-10">
            <button
              type="button"
              className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/18 hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Stäng"
              data-close-modal
              onClick={() => {
                playClick();
                closeDetailOnly();
              }}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>

            <div className="flex flex-col items-center text-center">
              <p
                id="detail-modal-year"
                className="font-headline text-4xl sm:text-5xl font-bold text-coral tracking-tight mb-3 mt-0.5"
              >
                {formatYear(boardCard.year)}
              </p>
              <p
                id="detail-modal-question"
                className="font-question text-[18px] leading-snug text-slate-200 max-w-prose"
                style={{ fontWeight: 350 }}
              >
                {boardCard.event}
              </p>

              {state.pending && (
                <div
                  id="detail-place-actions"
                  className="mt-8 w-full rounded-2xl border border-white/12 bg-white/[0.06] p-5 text-center flex flex-col items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                    Nästa kort
                  </p>
                  <p
                    id="detail-pending-preview"
                    className="font-question text-[15px] leading-snug text-slate-200 text-center max-w-prose"
                    style={{ fontWeight: 350 }}
                  >
                    {state.pending.event}
                  </p>
                </div>
              )}
            </div>

            <div
              className={`cat-pill cat-pill--${categorySlug(boardCard.category)} pointer-events-none absolute bottom-0 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 translate-y-1/2 items-center gap-2`}
            >
              <span className="text-white [&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0">
                <CategoryIcon category={boardCard.category} />
              </span>
              <span>{categoryPillLabel(boardCard.category)}</span>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          id="settings-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Stäng"
            onClick={closeModals}
          />
          <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/92 via-blue-950/88 to-indigo-950/90 p-6 shadow-2xl backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="settings-title"
                className="font-headline text-2xl font-bold tracking-tight text-white sm:text-3xl"
              >
                Inställningar
              </h2>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/18 hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Stäng"
                onClick={() => {
                  playClick();
                  closeModals();
                }}
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex h-12 min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.06] pl-4 pr-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span
                  id="settings-sound-label"
                  className="min-w-0 flex flex-1 items-center gap-2.5 font-headline text-sm font-semibold text-white sm:text-base"
                >
                  <Volume2
                    className="h-5 w-5 shrink-0 opacity-90"
                    strokeWidth={2}
                    aria-hidden
                  />
                  Ljud
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled()}
                  aria-labelledby="settings-sound-label"
                  id="toggle-sound"
                  onClick={toggleSound}
                  className={`relative h-9 w-[3.5rem] shrink-0 overflow-hidden rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                    soundEnabled()
                      ? "bg-coral shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      : "bg-white/10 border border-white/10"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
                      soundEnabled() ? "translate-x-[1.5rem]" : "translate-x-0"
                    }`}
                  />
                  <span className="sr-only">
                    {soundEnabled() ? "Ljud på" : "Ljud av"}
                  </span>
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <button
                  type="button"
                  id="btn-toggle-lives-picker"
                  className="flex h-12 min-h-12 w-full items-center justify-between gap-2 px-4 font-headline text-sm font-semibold text-white transition-colors hover:bg-white/[0.04] active:bg-white/[0.06] sm:text-base"
                  aria-expanded={livesPickerOpen}
                  onClick={() => {
                    playClick();
                    setLivesPickerOpen((v) => !v);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Heart
                      className="h-5 w-5 shrink-0 opacity-90"
                      strokeWidth={2}
                      aria-hidden
                    />
                    Välj antal liv
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      livesPickerOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
                {livesPickerOpen && (
                  <div className="border-t border-white/10 px-2.5 pb-2 pt-0.5">
                    <div className="flex flex-nowrap items-stretch gap-1.5 pt-1.5">
                      {ALLOWED_LIVES.map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            playClick();
                            selectLives(num);
                          }}
                          className={`flex h-10 min-h-10 min-w-0 flex-1 basis-0 items-center justify-center rounded-xl border font-headline text-base font-bold transition-all duration-150 ${
                            state.selectedLives === num
                              ? "border-coral bg-coral text-white shadow-lg"
                              : "border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <button
                  type="button"
                  id="btn-toggle-category-picker"
                  className="flex h-12 min-h-12 w-full items-center justify-between gap-2 px-4 font-headline text-sm font-semibold text-white transition-colors hover:bg-white/[0.04] active:bg-white/[0.06] sm:text-base"
                  aria-expanded={categoryPickerOpen}
                  onClick={() => {
                    playClick();
                    setCategoryPickerOpen((v) => !v);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <LayoutGrid
                      className="h-5 w-5 shrink-0 opacity-90"
                      strokeWidth={2}
                      aria-hidden
                    />
                    Välj kategorier
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      categoryPickerOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
                {categoryPickerOpen && (
                  <div className="border-t border-white/10 px-2.5 pb-3 pt-1.5">
                    <div className="grid grid-cols-3 gap-2">
                      {PLAYABLE_CATEGORY_SLUGS.map((slug) => {
                        const on = selectedCategorySlugs.includes(slug);
                        return (
                          <button
                            key={slug}
                            type="button"
                            onClick={() => {
                              playClick();
                              toggleCategorySlug(slug);
                            }}
                            className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center transition-all duration-150 ${
                              on
                                ? "border-coral bg-coral/15 text-white shadow-[0_0_12px_rgba(255,127,80,0.2)]"
                                : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.07]"
                            }`}
                            aria-pressed={on}
                            aria-label={categoryPillLabel(slug)}
                          >
                            <span
                              className={on ? "text-white" : "text-slate-500"}
                            >
                              <CategoryIconBySlug slug={slug} />
                            </span>
                            <span className="max-w-full truncate px-0.5 text-[9px] font-headline font-semibold leading-tight sm:text-[10px]">
                              {categoryPillLabel(slug)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">
                      Endast frågor från valda kategorier används i spelet.
                    </p>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <button
                  type="button"
                  id="btn-toggle-timer-picker"
                  className="flex h-12 min-h-12 w-full items-center justify-between gap-2 px-4 font-headline text-sm font-semibold text-white transition-colors hover:bg-white/[0.04] active:bg-white/[0.06] sm:text-base"
                  aria-expanded={timerPickerOpen}
                  onClick={() => {
                    playClick();
                    setTimerPickerOpen((v) => !v);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Timer
                      className="h-5 w-5 shrink-0 opacity-90"
                      strokeWidth={2}
                      aria-hidden
                    />
                    Timer
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      timerPickerOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
                {timerPickerOpen && (
                  <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-2">
                    <div className="flex w-full items-center justify-between gap-3">
                      <span
                        id="settings-timer-enabled-label"
                        className="font-headline text-xs font-semibold text-slate-200 sm:text-sm"
                      >
                        Timer på
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={questionTimerEnabled}
                        aria-labelledby="settings-timer-enabled-label"
                        id="toggle-question-timer"
                        onClick={() => {
                          playClick();
                          setQuestionTimerEnabled(!questionTimerEnabled);
                        }}
                        className={`relative h-9 w-[3.5rem] shrink-0 overflow-hidden rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                          questionTimerEnabled
                            ? "bg-coral shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                            : "border border-white/10 bg-white/10"
                        }`}
                      >
                        <span
                          className={`pointer-events-none absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
                            questionTimerEnabled
                              ? "translate-x-[1.5rem]"
                              : "translate-x-0"
                          }`}
                        />
                        <span className="sr-only">
                          {questionTimerEnabled ? "Timer på" : "Timer av"}
                        </span>
                      </button>
                    </div>
                    <div
                      className={
                        questionTimerEnabled ? "" : "pointer-events-none opacity-45"
                      }
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label
                          htmlFor="question-timer-seconds"
                          className="text-[10px] font-headline font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Sekunder per fråga
                        </label>
                        <span className="font-headline text-sm font-bold tabular-nums text-coral">
                          {questionTimerSeconds}s
                        </span>
                      </div>
                      <input
                        id="question-timer-seconds"
                        type="range"
                        min={TIMER_SECONDS_MIN}
                        max={TIMER_SECONDS_MAX}
                        step={1}
                        value={questionTimerSeconds}
                        onChange={(e) => {
                          setQuestionTimerSeconds(
                            Number(e.target.value)
                          );
                        }}
                        className="timer-seconds-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-coral"
                      />
                      <p className="mt-1.5 text-center text-[10px] leading-snug text-slate-500">
                        Om tiden tar slut innan du placerat kortet förlorar du
                        ett liv.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid w-full grid-cols-3 gap-2">
                <button
                  type="button"
                  id="btn-open-highscores"
                  className="flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/18 hover:bg-white/[0.09] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Högsta poäng"
                  onClick={() => {
                    playClick();
                    openHighscoresFromSettings();
                  }}
                >
                  <Trophy className="h-5 w-5 opacity-90" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  id="btn-open-statistics"
                  className="flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/18 hover:bg-white/[0.09] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Statistik"
                  onClick={() => {
                    playClick();
                    openStatisticsFromSettings();
                  }}
                >
                  <BarChart3 className="h-5 w-5 opacity-90" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  id="btn-settings-how-to-play"
                  className="flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/18 hover:bg-white/[0.09] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Så spelar du"
                  onClick={() => {
                    playClick();
                    openHowToPlayFromSettings();
                  }}
                >
                  <HelpCircle
                    className="h-5 w-5 opacity-90"
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              </div>
            </div>

            <p className="mt-6 flex flex-nowrap items-center justify-center gap-3 text-center text-[10px] leading-relaxed text-slate-500/70 sm:gap-4">
              <span>Versionnummer: {packageJson.version}</span>
              <span>Skapad av: Adam Arvidsson</span>
            </p>
          </div>
        </div>
      )}

      {highscoresOpen && (
        <div
          id="highscores-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="highscores-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Stäng"
            onClick={() => closeHighscoresModal()}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/92 via-blue-950/88 to-indigo-950/90 p-8 shadow-2xl backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10 sm:p-10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2
                id="highscores-title"
                className="font-headline text-2xl font-bold tracking-tight text-white sm:text-3xl"
              >
                Högsta poäng
              </h2>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Rensa highscore-lista"
                  onClick={() => {
                    playClick();
                    if (
                      !window.confirm(
                        "Ta bort alla sparade highscore-poster? Detta går inte att ångra."
                      )
                    )
                      return;
                    clearHighscores();
                  }}
                >
                  <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/18 hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Stäng"
                  onClick={() => {
                    playClick();
                    closeHighscoresModal();
                  }}
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-4 leading-snug">
              Dina fem bästa rundor
            </p>

            {topScores.length > 0 && (
              <div
                className="mb-1.5 grid grid-cols-[minmax(0,1fr)_2.75rem_3.75rem] items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                id="highscore-list-head"
              >
                <span>Datum</span>
                <span className="text-center">Liv</span>
                <span className="text-right">Poäng</span>
              </div>
            )}
            <ul
              id="highscore-list"
              className="space-y-2 text-sm max-h-[45vh] overflow-y-auto scrollbar-hide pr-1"
            >
              {!topScores.length ? (
                <li className="text-slate-500 py-3">Inga resultat ännu.</li>
              ) : (
                topScores.map((h, i) => {
                  const d = new Date(h.date);
                  const dateStr = d.toLocaleDateString("sv-SE", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <li
                      key={`${i}-${h.date}-${h.score}-${h.startingLives}`}
                      className="grid grid-cols-[minmax(0,1fr)_2.75rem_3.75rem] items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-slate-300"
                    >
                      <span className="min-w-0 truncate">{dateStr}</span>
                      <span className="text-center font-headline text-sm font-semibold tabular-nums text-slate-200">
                        {h.startingLives}
                      </span>
                      <span className="text-right font-headline font-semibold tabular-nums text-coral">
                        {h.score} p
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}

      {statsOpen && (
        <div
          id="statistics-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="statistics-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Stäng"
            onClick={() => closeStatsModal()}
          />
          <div className="relative z-10 flex w-full max-w-md max-h-[min(92vh,720px)] flex-col overflow-x-hidden overflow-y-auto scrollbar-hide rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/92 via-blue-950/88 to-indigo-950/90 p-8 shadow-2xl backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10 sm:p-10">
            <div className="flex shrink-0 items-center justify-between gap-2 mb-2">
              <h2
                id="statistics-title"
                className="font-headline text-2xl font-bold tracking-tight text-white sm:text-3xl"
              >
                Statistik
              </h2>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Rensa all statistik"
                  onClick={() => {
                    playClick();
                    if (
                      !window.confirm(
                        "Nollställ spelstatistik och daglig streak? Detta går inte att ångra."
                      )
                    )
                      return;
                    clearStatistics();
                  }}
                >
                  <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/18 hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  aria-label="Stäng"
                  onClick={() => {
                    playClick();
                    closeStatsModal();
                  }}
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
            {(() => {
              const agg = getGameOverAggregates();
              const streakDays = getDailyStreak();
              return (
                <div className="mb-6 shrink-0 overflow-hidden rounded-2xl border border-white/12">
                  <table className="w-full text-xs sm:text-sm">
                    <tbody>
                      <tr className="border-b border-white/10 bg-white/[0.04]">
                        <td className="px-4 py-3 font-medium leading-snug text-slate-300">
                          Antal spel
                        </td>
                        <td className="px-4 py-3 text-right font-headline text-sm font-semibold tabular-nums text-coral">
                          {formatSvInteger(agg.count)}
                        </td>
                      </tr>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium leading-snug text-slate-300">
                          Snitt rätt per omgång
                        </td>
                        <td className="px-4 py-3 text-right font-headline text-sm font-semibold tabular-nums text-coral">
                          {agg.count > 0
                            ? formatSvDecimal(agg.avgScore, 1, 1)
                            : "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-white/10 bg-white/[0.04]">
                        <td className="px-4 py-3 font-medium leading-snug text-slate-300">
                          Snitt tid per omgång
                        </td>
                        <td className="px-4 py-3 text-right font-headline text-sm font-semibold tabular-nums text-coral">
                          {agg.count > 0
                            ? formatAvgDurationMs(agg.avgDurationMs)
                            : "—"}
                        </td>
                      </tr>
                      <tr className="bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium leading-snug text-slate-300">
                          Daglig streak
                        </td>
                        <td className="px-4 py-3 text-right font-headline text-sm font-semibold tabular-nums text-coral">
                          {streakDays > 0 ? formatSvInteger(streakDays) : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5 shrink-0">
              Frågor per kategori
            </p>
            <div className="shrink-0 overflow-hidden rounded-2xl border border-white/12">
              <div className="pb-4 sm:pb-5">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.06] text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 sm:text-[10px]">
                      <th className="px-2 py-1.5 font-headline sm:px-2.5 sm:py-2">
                        Kategori
                      </th>
                      <th className="px-2 py-1.5 text-right font-headline sm:px-2.5 sm:py-2">
                        Antal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsCategoryRows === null ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-2 py-2.5 text-slate-500 sm:px-2.5 sm:py-3"
                        >
                          Laddar...
                        </td>
                      </tr>
                    ) : statsCategoryRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-2 py-2.5 text-slate-500 sm:px-2.5 sm:py-3"
                        >
                          Inga frågor kunde laddas.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {statsCategoryRows.map((row, index) => (
                          <tr
                            key={row.slug}
                            className={`border-b border-white/10 ${
                              index % 2 === 0
                                ? "bg-white/[0.04]"
                                : "bg-white/[0.02]"
                            }`}
                          >
                            <td className="px-2 py-1.5 font-medium leading-snug text-slate-300 sm:px-2.5 sm:py-2">
                              {row.label}
                            </td>
                            <td className="px-2 py-1.5 text-right font-headline text-sm font-semibold tabular-nums text-slate-200 sm:px-2.5 sm:py-2">
                              {formatSvInteger(row.count)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-white/20 bg-white/[0.07]">
                          <td className="px-2 py-1.5 font-headline font-semibold leading-snug text-slate-200 sm:px-2.5 sm:py-2">
                            Totalt
                          </td>
                          <td className="px-2 py-1.5 text-right font-headline text-sm font-bold tabular-nums text-coral sm:px-2.5 sm:py-2">
                            {formatSvInteger(
                              statsCategoryRows.reduce((s, r) => s + r.count, 0)
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {dailyIntroOpen && (
        <DailyChallengeModal
          challengeDate={getStockholmDateString()}
          alreadyPlayed={hasPlayedDailyChallengeToday()}
          onClose={closeDailyIntroOnly}
          onStart={() => confirmDailyIntroAndStart()}
        />
      )}

      {howToPlayOpen && (
        <HowToPlayModal onClose={closeHowToPlayModal} />
      )}
    </div>
  );
}

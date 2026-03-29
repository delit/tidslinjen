import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  chronosReducer,
  createInitialState,
  type ChronosState,
} from "./chronosReducer";
import {
  buildDeck,
  buildDeckSeeded,
  drawNext,
  eventKey,
  isPlacementCorrect,
  loadAllEvents,
  pickAnchor,
  pickAnchorSeeded,
} from "./gameEngine";
import { filterEventsByCategorySlugs } from "./filterEventsByCategories";
import type { PlayableCategorySlug } from "./playableCategories";
import { PLAYABLE_CATEGORY_SLUGS } from "./playableCategories";
import {
  loadSelectedCategorySlugs,
  saveSelectedCategorySlugs,
} from "./selectedCategoriesStorage";
import {
  playClick,
  playCorrect,
  playWrong,
  primeAudioContext,
} from "./sound";
import type { EventCard } from "./types";
import {
  loadTimerEnabled,
  loadTimerSeconds,
  saveTimerEnabled,
  saveTimerSeconds,
} from "./timerSettingsStorage";
import {
  appendGameOverStat,
  clearAllStatisticsStorage,
  recordDailyStreakPlay,
} from "./statsStorage";
import type { AllowedLives } from "./allowedLives";
import {
  DAILY_CHALLENGE_LIVES,
  DAILY_CHALLENGE_TIMER_SECONDS,
} from "./dailyChallengeConstants";
import {
  hasPlayedDailyChallengeToday,
  markDailyChallengePlayedForDate,
} from "./dailyChallengePlayedStorage";
import { createSeededRng, hashStringToSeed } from "./seededRandom";
import { getStockholmDateString } from "./stockholmDate";

const STORAGE_HS = "tidslinjen_highscores";

export type HighscoreEntry = {
  date: string;
  score: number;
  startingLives: number;
};

/** Högre poäng först; vid lika poäng färre startliv först (svårare). */
function compareHighscores(a: HighscoreEntry, b: HighscoreEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.startingLives - b.startingLives;
}

function sortHighscoreList(list: HighscoreEntry[]): HighscoreEntry[] {
  return [...list].sort(compareHighscores);
}

function loadHighscores(): HighscoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_HS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as HighscoreEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHighscores(list: HighscoreEntry[]): void {
  localStorage.setItem(STORAGE_HS, JSON.stringify(list.slice(0, 20)));
}

function recordHighscore(score: number, startLives: number): void {
  const entry: HighscoreEntry = {
    date: new Date().toISOString(),
    score,
    startingLives: startLives,
  };
  const list = sortHighscoreList([...loadHighscores(), entry]);
  saveHighscores(list);
}

export type WrongDockAnimPhase = "idle" | "shake" | "exit";

type ChronosContextValue = {
  state: ChronosState;
  announcer: string;
  wrongDockAnimPhase: WrongDockAnimPhase;
  detailBoardIndex: number | null;
  setDetailBoardIndex: (i: number | null) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  highscoresOpen: boolean;
  setHighscoresOpen: (open: boolean) => void;
  statsOpen: boolean;
  setStatsOpen: (open: boolean) => void;
  howToPlayOpen: boolean;
  setHowToPlayOpen: (open: boolean) => void;
  openHowToPlay: () => void;
  highscores: HighscoreEntry[];
  refreshHighscores: () => void;
  selectLives: (lives: AllowedLives) => void;
  startGame: () => Promise<void>;
  /** Returnerar true om kortet placerades rätt (pending rensas). */
  tryPlace: (insertIndex: number) => boolean;
  goStart: () => void;
  playAgain: () => Promise<void>;
  openSettings: () => void;
  openHighscores: () => void;
  openStatistics: () => void;
  selectedCategorySlugs: PlayableCategorySlug[];
  toggleCategorySlug: (slug: PlayableCategorySlug) => void;
  clearHighscores: () => void;
  clearStatistics: () => void;
  questionTimerEnabled: boolean;
  setQuestionTimerEnabled: (enabled: boolean) => void;
  questionTimerSeconds: number;
  setQuestionTimerSeconds: (seconds: number) => void;
  /** Vid timeout: samma som fel placering; returnerar kort för fel-overlay. */
  expireQuestionTimer: () => EventCard | null;
  /** Efter fel-overlay när sista livet gick: gå till Game Over-skärmen. */
  finalizeLossAfterWrongOverlay: () => void;
  /** Dagens utmaning: tvingad timer oberoende av inställningar. */
  effectiveQuestionTimerEnabled: boolean;
  effectiveQuestionTimerSeconds: number;
  dailyIntroOpen: boolean;
  beginDailyChallengeFlow: () => void;
  closeDailyIntroOnly: () => void;
  confirmDailyIntroAndStart: () => void;
};

const ChronosContext = createContext<ChronosContextValue | null>(null);

export function useChronosGame(): ChronosContextValue {
  const v = useContext(ChronosContext);
  if (!v) throw new Error("useChronosGame outside ChronosGameProvider");
  return v;
}

export function ChronosGameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    chronosReducer,
    undefined,
    createInitialState
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Fördröjning innan nästa frågekort visas efter rätt svar (ms). */
  const REVEAL_NEXT_CARD_MS = 580;
  const revealNextCardTimeoutRef = useRef(0);

  const [announcer, setAnnouncer] = useState("");
  const [wrongDockAnimPhase, setWrongDockAnimPhase] =
    useState<WrongDockAnimPhase>("idle");
  const wrongDockPhaseRef = useRef<WrongDockAnimPhase>("idle");
  wrongDockPhaseRef.current = wrongDockAnimPhase;

  const [detailBoardIndex, setDetailBoardIndex] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highscoresOpen, setHighscoresOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [dailyIntroOpen, setDailyIntroOpen] = useState(false);
  const [highscores, setHighscores] = useState<HighscoreEntry[]>(() =>
    sortHighscoreList(loadHighscores())
  );

  const [statsNonce, setStatsNonce] = useState(0);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<
    PlayableCategorySlug[]
  >(() => loadSelectedCategorySlugs());
  const selectedCategorySlugsRef = useRef(selectedCategorySlugs);
  selectedCategorySlugsRef.current = selectedCategorySlugs;

  const [questionTimerEnabled, setQuestionTimerEnabledState] = useState(
    () => loadTimerEnabled()
  );
  const [questionTimerSeconds, setQuestionTimerSecondsState] = useState(
    () => loadTimerSeconds()
  );

  const setQuestionTimerEnabled = useCallback((enabled: boolean) => {
    saveTimerEnabled(enabled);
    setQuestionTimerEnabledState(enabled);
  }, []);

  const setQuestionTimerSeconds = useCallback((seconds: number) => {
    saveTimerSeconds(seconds);
    setQuestionTimerSecondsState(loadTimerSeconds());
  }, []);

  const expireQuestionTimer = useCallback((): EventCard | null => {
    const s = stateRef.current;
    if (!s.pending || wrongDockPhaseRef.current !== "idle") return null;
    const card = s.pending;
    playWrong();
    setAnnouncer("Tiden är slut.");
    const hadAtLeastTwoLives = s.lives >= 2;
    dispatch({ type: "WRONG_FEEDBACK" });
    if (hadAtLeastTwoLives) {
      setWrongDockAnimPhase("shake");
    }
    return card;
  }, []);

  const finalizeLossAfterWrongOverlay = useCallback(() => {
    const s = stateRef.current;
    if (s.screen !== "game" || s.lives !== 0 || s.won === true) return;
    dispatch({ type: "END_GAME", won: false });
  }, []);

  const gameSessionStartMsRef = useRef(0);
  const prevScreenForStatsRef = useRef(state.screen);

  useEffect(() => {
    const prev = prevScreenForStatsRef.current;
    if (prev !== "over" && state.screen === "over") {
      recordDailyStreakPlay();
    }
    if (
      prev === "game" &&
      state.screen === "over" &&
      state.won === false
    ) {
      const durationMs = Date.now() - gameSessionStartMsRef.current;
      appendGameOverStat(state.score, durationMs);
    }
    prevScreenForStatsRef.current = state.screen;
  }, [state.screen, state.won, state.score]);

  /** Väntar medan overlay-kortet visas, sedan byt kort. */
  useEffect(() => {
    if (wrongDockAnimPhase !== "shake") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Matchar overlay-timingen: overlay visar ~2400ms, nytt kort dyker upp lite efter.
    const ms = reduce ? 400 : 2400;
    const t = window.setTimeout(() => setWrongDockAnimPhase("exit"), ms);
    return () => window.clearTimeout(t);
  }, [wrongDockAnimPhase]);

  useEffect(() => {
    if (wrongDockAnimPhase !== "exit") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const ms = reduce ? 200 : 400;
    const t = window.setTimeout(() => {
      dispatch({ type: "PLACE_WRONG_FINISH" });
      setWrongDockAnimPhase("idle");
    }, ms);
    return () => window.clearTimeout(t);
  }, [wrongDockAnimPhase]);

  const refreshHighscores = useCallback(() => {
    setHighscores(sortHighscoreList(loadHighscores()));
  }, []);

  const wasOverRef = useRef(false);
  useEffect(() => {
    const over = state.screen === "over";
    if (over && !wasOverRef.current && state.gameMode !== "daily") {
      recordHighscore(state.score, state.startLives);
      refreshHighscores();
    }
    wasOverRef.current = over;
  }, [
    state.screen,
    state.score,
    state.startLives,
    state.gameMode,
    refreshHighscores,
  ]);

  useEffect(() => {
    if (!announcer) return;
    const t = window.setTimeout(() => setAnnouncer(""), 900);
    return () => window.clearTimeout(t);
  }, [announcer]);

  useEffect(() => {
    if (state.flashBoardIndex === null) return;
    const okMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 320
      : 1400;
    const t = window.setTimeout(() => dispatch({ type: "CLEAR_FLASH" }), okMs);
    return () => window.clearTimeout(t);
  }, [state.flashBoardIndex]);

  useEffect(() => {
    return () => {
      window.clearTimeout(revealNextCardTimeoutRef.current);
    };
  }, []);

  const selectLives = useCallback((lives: AllowedLives) => {
    dispatch({ type: "SELECT_LIVES", lives });
  }, []);

  const toggleCategorySlug = useCallback((slug: PlayableCategorySlug) => {
    setSelectedCategorySlugs((prev) => {
      const set = new Set(prev);
      if (set.has(slug)) {
        if (set.size <= 1) return prev;
        set.delete(slug);
      } else {
        set.add(slug);
      }
      const next = PLAYABLE_CATEGORY_SLUGS.filter((s) => set.has(s));
      saveSelectedCategorySlugs(next);
      return next;
    });
  }, []);

  const clearHighscores = useCallback(() => {
    localStorage.setItem(STORAGE_HS, JSON.stringify([]));
    refreshHighscores();
  }, [refreshHighscores]);

  const clearStatistics = useCallback(() => {
    clearAllStatisticsStorage();
    setStatsNonce((n) => n + 1);
  }, []);

  const startGame = useCallback(async () => {
    window.clearTimeout(revealNextCardTimeoutRef.current);
    revealNextCardTimeoutRef.current = 0;
    const s = stateRef.current;
    let events = await loadAllEvents();
    events = filterEventsByCategorySlugs(
      events,
      new Set(selectedCategorySlugsRef.current)
    );
    if (!events.length) {
      window.alert(
        "Inga frågor i valda kategorier, eller kunde inte ladda CSV. Kontrollera att public/csv_2026/ finns och att minst en kategori är vald."
      );
      return;
    }

    primeAudioContext();

    const used = new Set<string>();
    const anchor = pickAnchor(events);
    used.add(eventKey(anchor));
    const deckBuilt = buildDeck(events, used);
    const { card: pending, deck } = drawNext(deckBuilt, used);

    dispatch({
      type: "START_FULL",
      allEvents: events,
      timeline: [anchor],
      pending,
      deck,
      usedIds: used,
      startLives: s.selectedLives,
      gameMode: "normal",
      dailyDateKey: null,
    });
    gameSessionStartMsRef.current = Date.now();
    setDetailBoardIndex(null);
    setSettingsOpen(false);
    setHighscoresOpen(false);
    setStatsOpen(false);
    setHowToPlayOpen(false);
    setDailyIntroOpen(false);
    setWrongDockAnimPhase("idle");
  }, []);

  const startDailyGame = useCallback(async () => {
    if (hasPlayedDailyChallengeToday()) {
      return;
    }
    window.clearTimeout(revealNextCardTimeoutRef.current);
    revealNextCardTimeoutRef.current = 0;
    let events = await loadAllEvents();
    events = filterEventsByCategorySlugs(
      events,
      new Set(PLAYABLE_CATEGORY_SLUGS)
    );
    if (!events.length) {
      window.alert(
        "Inga frågor kunde laddas. Kontrollera att public/csv_2026/ finns."
      );
      return;
    }

    primeAudioContext();

    const challengeDate = getStockholmDateString();
    const rng = createSeededRng(hashStringToSeed(challengeDate));
    const used = new Set<string>();
    const anchor = pickAnchorSeeded(events, rng);
    if (!anchor) return;
    used.add(eventKey(anchor));
    const deckBuilt = buildDeckSeeded(events, used, rng);
    const { card: pending, deck } = drawNext(deckBuilt, used);

    dispatch({
      type: "START_FULL",
      allEvents: events,
      timeline: [anchor],
      pending,
      deck,
      usedIds: used,
      startLives: DAILY_CHALLENGE_LIVES,
      gameMode: "daily",
      dailyDateKey: challengeDate,
    });
    markDailyChallengePlayedForDate(challengeDate);
    gameSessionStartMsRef.current = Date.now();
    setDetailBoardIndex(null);
    setSettingsOpen(false);
    setHighscoresOpen(false);
    setStatsOpen(false);
    setHowToPlayOpen(false);
    setDailyIntroOpen(false);
    setWrongDockAnimPhase("idle");
  }, []);

  const beginDailyChallengeFlow = useCallback(() => {
    setDailyIntroOpen(true);
  }, []);

  const closeDailyIntroOnly = useCallback(() => {
    playClick();
    setDailyIntroOpen(false);
  }, []);

  const confirmDailyIntroAndStart = useCallback(() => {
    setDailyIntroOpen(false);
    void startDailyGame();
  }, [startDailyGame]);

  const tryPlace = useCallback((insertIndex: number): boolean => {
    const s = stateRef.current;
    if (!s.pending) return false;
    if (wrongDockPhaseRef.current !== "idle") return false;
    setDetailBoardIndex(null);

    const ok = isPlacementCorrect(s.timeline, s.pending, insertIndex);
    if (ok) {
      playCorrect();
      setAnnouncer("Rätt placerat.");
      setWrongDockAnimPhase("idle");
      window.clearTimeout(revealNextCardTimeoutRef.current);
      dispatch({ type: "PLACE_OK_INSERT", insertIndex });
      const revealDelayMs = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
        ? 200
        : REVEAL_NEXT_CARD_MS;
      revealNextCardTimeoutRef.current = window.setTimeout(() => {
        revealNextCardTimeoutRef.current = 0;
        dispatch({ type: "PLACE_OK_REVEAL_NEXT" });
      }, revealDelayMs);
      return true;
    }

    playWrong();
    setAnnouncer("Fel plats.");

    dispatch({ type: "WRONG_FEEDBACK" });
    if (s.lives > 1) {
      setWrongDockAnimPhase("shake");
    }
    return false;
  }, []);

  const goStart = useCallback(() => {
    playClick();
    window.clearTimeout(revealNextCardTimeoutRef.current);
    revealNextCardTimeoutRef.current = 0;
    setWrongDockAnimPhase("idle");
    dispatch({ type: "GO_START" });
    setDetailBoardIndex(null);
    setSettingsOpen(false);
    setHighscoresOpen(false);
    setStatsOpen(false);
    setHowToPlayOpen(false);
    setDailyIntroOpen(false);
  }, []);

  const openHowToPlay = useCallback(() => {
    setHowToPlayOpen(true);
  }, []);

  const playAgain = useCallback(async () => {
    playClick();
    if (stateRef.current.gameMode === "daily") {
      await startDailyGame();
    } else {
      await startGame();
    }
  }, [startGame, startDailyGame]);

  const openSettings = useCallback(() => {
    playClick();
    setSettingsOpen(true);
  }, []);

  const openHighscores = useCallback(() => {
    playClick();
    refreshHighscores();
    setHighscoresOpen(true);
  }, [refreshHighscores]);

  const openStatistics = useCallback(() => {
    playClick();
    setSettingsOpen(false);
    setStatsOpen(true);
  }, []);

  const effectiveQuestionTimerEnabled =
    state.gameMode === "daily" ? true : questionTimerEnabled;
  const effectiveQuestionTimerSeconds =
    state.gameMode === "daily"
      ? DAILY_CHALLENGE_TIMER_SECONDS
      : questionTimerSeconds;

  const value = useMemo<ChronosContextValue>(
    () => ({
      state,
      announcer,
      wrongDockAnimPhase,
      detailBoardIndex,
      setDetailBoardIndex,
      settingsOpen,
      setSettingsOpen,
      highscoresOpen,
      setHighscoresOpen,
      statsOpen,
      setStatsOpen,
      howToPlayOpen,
      setHowToPlayOpen,
      openHowToPlay,
      highscores,
      refreshHighscores,
      selectLives,
      startGame,
      tryPlace,
      goStart,
      playAgain,
      openSettings,
      openHighscores,
      openStatistics,
      selectedCategorySlugs,
      toggleCategorySlug,
      clearHighscores,
      clearStatistics,
      questionTimerEnabled,
      setQuestionTimerEnabled,
      questionTimerSeconds,
      setQuestionTimerSeconds,
      expireQuestionTimer,
      finalizeLossAfterWrongOverlay,
      effectiveQuestionTimerEnabled,
      effectiveQuestionTimerSeconds,
      dailyIntroOpen,
      beginDailyChallengeFlow,
      closeDailyIntroOnly,
      confirmDailyIntroAndStart,
    }),
    [
      state,
      announcer,
      wrongDockAnimPhase,
      detailBoardIndex,
      settingsOpen,
      highscoresOpen,
      statsOpen,
      howToPlayOpen,
      highscores,
      statsNonce,
      refreshHighscores,
      selectLives,
      startGame,
      tryPlace,
      goStart,
      playAgain,
      openSettings,
      openHighscores,
      openStatistics,
      selectedCategorySlugs,
      toggleCategorySlug,
      clearHighscores,
      clearStatistics,
      questionTimerEnabled,
      setQuestionTimerEnabled,
      questionTimerSeconds,
      setQuestionTimerSeconds,
      expireQuestionTimer,
      finalizeLossAfterWrongOverlay,
      effectiveQuestionTimerEnabled,
      effectiveQuestionTimerSeconds,
      dailyIntroOpen,
      beginDailyChallengeFlow,
      closeDailyIntroOnly,
      confirmDailyIntroAndStart,
    ]
  );

  return (
    <ChronosContext.Provider value={value}>{children}</ChronosContext.Provider>
  );
}

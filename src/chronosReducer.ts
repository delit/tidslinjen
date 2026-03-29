import { normalizeSelectedLives, isAllowedLives } from "./allowedLives";
import type { EventCard } from "./types";
import {
  drawNext,
  eventKey,
  insertAt,
  isPlacementCorrect,
} from "./gameEngine";

export type Screen = "start" | "game" | "over";

export type GameMode = "normal" | "daily";

export type ChronosState = {
  screen: Screen;
  allEvents: EventCard[];
  loaded: boolean;
  timeline: EventCard[];
  pending: EventCard | null;
  deck: EventCard[];
  usedIds: Set<string>;
  score: number;
  lives: number;
  startLives: number;
  selectedLives: number;
  won: boolean | null;
  /** Räknas upp vid varje fel svar så UI kan trigga feedback (unikt beroende). */
  wrongPulse: number;
  flashBoardIndex: number | null;
  /** Det sista kortet som orsakade Game Over (om lives når 0). */
  lastWrongCard: EventCard | null;
  gameMode: GameMode;
  /** YYYY-MM-DD (Stockholm) när gameMode === "daily". */
  dailyDateKey: string | null;
};

export function createInitialState(): ChronosState {
  return {
    screen: "start",
    allEvents: [],
    loaded: false,
    timeline: [],
    pending: null,
    deck: [],
    usedIds: new Set(),
    score: 0,
    lives: 0,
    startLives: 5,
    selectedLives: 5,
    won: null,
    wrongPulse: 0,
    flashBoardIndex: null,
    lastWrongCard: null,
    gameMode: "normal",
    dailyDateKey: null,
  };
}

export type ChronosAction =
  | { type: "SELECT_LIVES"; lives: number }
  | {
      type: "START_FULL";
      allEvents: EventCard[];
      timeline: EventCard[];
      pending: EventCard | null;
      deck: EventCard[];
      usedIds: Set<string>;
      startLives: number;
      gameMode?: GameMode;
      dailyDateKey?: string | null;
    }
  /** Placera kort på tidslinjen; nästa frågekort kommer via PLACE_OK_REVEAL_NEXT (fördröjd i UI). */
  | { type: "PLACE_OK_INSERT"; insertIndex: number }
  | { type: "PLACE_OK_REVEAL_NEXT" }
  /** Direkt vid fel: -1 liv, wrongPulse, pending kvar tills dock-animationen är klar. */
  | { type: "WRONG_FEEDBACK" }
  /** Efter skaka+exit: byt pending-kort (liv redan uppdaterat). */
  | { type: "PLACE_WRONG_FINISH" }
  | { type: "END_GAME"; won: boolean }
  | { type: "GO_START" }
  | { type: "CLEAR_FLASH" };

export function chronosReducer(
  state: ChronosState,
  action: ChronosAction
): ChronosState {
  switch (action.type) {
    case "SELECT_LIVES":
      if (!isAllowedLives(action.lives)) return state;
      return { ...state, selectedLives: action.lives };

    case "START_FULL":
      return {
        ...state,
        screen: "game",
        allEvents: action.allEvents,
        loaded: true,
        startLives: action.startLives,
        lives: action.startLives,
        score: 0,
        timeline: action.timeline,
        pending: action.pending,
        deck: action.deck,
        usedIds: action.usedIds,
        won: null,
        wrongPulse: 0,
        flashBoardIndex: null,
        lastWrongCard: null,
        gameMode: action.gameMode ?? "normal",
        dailyDateKey:
          action.gameMode === "daily"
            ? (action.dailyDateKey ?? null)
            : null,
      };

    case "PLACE_OK_INSERT": {
      const p = state.pending;
      if (!p) return state;
      const ok = isPlacementCorrect(state.timeline, p, action.insertIndex);
      if (!ok) return state;
      const tl = insertAt(state.timeline, p, action.insertIndex);
      const used = new Set(state.usedIds);
      used.add(eventKey(p));
      return {
        ...state,
        timeline: tl,
        usedIds: used,
        score: state.score + 1,
        pending: null,
        flashBoardIndex: action.insertIndex,
        wrongPulse: 0,
      };
    }

    case "PLACE_OK_REVEAL_NEXT": {
      if (state.pending !== null) return state;
      if (state.screen !== "game") return state;
      const { card, deck } = drawNext(state.deck, state.usedIds);
      const gameOverWin = !card;
      return {
        ...state,
        pending: card,
        deck,
        screen: gameOverWin ? "over" : state.screen,
        won: gameOverWin ? true : state.won,
      };
    }

    case "WRONG_FEEDBACK": {
      const p = state.pending;
      if (!p) return state;
      const used = new Set(state.usedIds);
      used.add(eventKey(p));
      const newLives = Math.max(0, state.lives - 1);

      if (newLives === 0) {
        return {
          ...state,
          usedIds: used,
          pending: null,
          lives: 0,
          wrongPulse: state.wrongPulse + 1,
          /** Game Over visas efter fel-overlayn (samma som vid andra fel) — inte direkt. */
          screen: "game",
          won: false,
          lastWrongCard: p,
        };
      }

      return {
        ...state,
        usedIds: used,
        lives: newLives,
        wrongPulse: state.wrongPulse + 1,
        pending: p,
      };
    }

    case "PLACE_WRONG_FINISH": {
      const p = state.pending;
      if (!p) return state;
      const used = new Set(state.usedIds);
      const { card, deck } = drawNext(state.deck, used);
      const gameOverWin = !card;
      return {
        ...state,
        pending: card,
        deck,
        screen: gameOverWin ? "over" : state.screen,
        won: gameOverWin ? true : state.won,
      };
    }

    case "END_GAME":
      return {
        ...state,
        screen: "over",
        won: action.won,
        pending: null,
      };

    case "GO_START":
      return {
        ...createInitialState(),
        allEvents: state.allEvents,
        loaded: state.loaded,
        selectedLives: normalizeSelectedLives(state.selectedLives),
        gameMode: "normal",
        dailyDateKey: null,
      };

    case "CLEAR_FLASH":
      return { ...state, flashBoardIndex: null };

    default:
      return state;
  }
}

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValue,
} from "motion/react";
import { animate } from "motion";
import { ArrowDown, ArrowUp, Hand, Home, Settings, XCircle } from "lucide-react";
import type { EventCard } from "./types";
import { useChronosGame } from "./ChronosGameContext";
import {
  CategoryIcon,
  categoryPillLabel,
  categorySlug,
} from "./categoryUtils";
import { eventKey, formatYear } from "./gameEngine";
import { playClick, playTimerUrgent } from "./sound";

/** Legacy: en gång visat → räknas som max (inga fler hints). */
const LEGACY_FIRST_CARD_DRAG_HINT = "tidslinjen_seen_first_card_drag_hint";
const STORAGE_DRAG_HINT_DISMISS_COUNT = "tidslinjen_first_card_drag_hint_dismiss_count";
/** Hint visas de tre första gångerna spelet startas; därefter aldrig. */
const DRAG_HINT_MAX_SHOWS = 3;

function getDragHintDismissCount(): number {
  try {
    if (localStorage.getItem(LEGACY_FIRST_CARD_DRAG_HINT) === "1") {
      localStorage.removeItem(LEGACY_FIRST_CARD_DRAG_HINT);
      localStorage.setItem(
        STORAGE_DRAG_HINT_DISMISS_COUNT,
        String(DRAG_HINT_MAX_SHOWS)
      );
      return DRAG_HINT_MAX_SHOWS;
    }
    const raw = localStorage.getItem(STORAGE_DRAG_HINT_DISMISS_COUNT);
    const n = raw == null ? 0 : parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return DRAG_HINT_MAX_SHOWS;
  }
}

function recordDragHintDismissed(): void {
  try {
    const next = Math.min(
      getDragHintDismissCount() + 1,
      DRAG_HINT_MAX_SHOWS
    );
    localStorage.setItem(STORAGE_DRAG_HINT_DISMISS_COUNT, String(next));
  } catch {
    /* ignore */
  }
}

/** Ingen hint alls (t.ex. prefers-reduced-motion). */
function markDragHintFullySeen(): void {
  try {
    localStorage.removeItem(LEGACY_FIRST_CARD_DRAG_HINT);
    localStorage.setItem(
      STORAGE_DRAG_HINT_DISMISS_COUNT,
      String(DRAG_HINT_MAX_SHOWS)
    );
  } catch {
    /* ignore */
  }
}

/** Viewport-Y för mittersta punkten på varje tidslinjekort (getBoundingClientRect). */
function computeDragInsertIndex(
  clientX: number,
  clientY: number,
  cardCenterYs: number[]
): number | null {
  const centerX = window.innerWidth / 2;
  const horizontalThreshold = 200;
  if (Math.abs(clientX - centerX) > horizontalThreshold) return null;
  let foundIndex = cardCenterYs.length;
  for (let i = 0; i < cardCenterYs.length; i++) {
    if (clientY < cardCenterYs[i]) {
      foundIndex = i;
      break;
    }
  }
  return foundIndex;
}

export function GameScreen() {
  const {
    state,
    tryPlace,
    setDetailBoardIndex,
    openSettings,
    goStart,
    announcer,
    wrongDockAnimPhase,
    effectiveQuestionTimerEnabled,
    effectiveQuestionTimerSeconds,
    expireQuestionTimer,
    finalizeLossAfterWrongOverlay,
  } = useChronosGame();

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [dockSnap, setDockSnap] = useState(0);
  const [livesLostAnim, setLivesLostAnim] = useState(false);
  const [returnZoneActive, setReturnZoneActive] = useState(false);
  const [returnGradientArmed, setReturnGradientArmed] = useState(false);
  const inReturnZoneRef = useRef(false);
  const returnGradientArmedRef = useRef(false);
  /** Måste lämna returzonen minst en gång så lila gradient inte triggas vid första lyft från dock. */
  const leftReturnZoneOnceRef = useRef(false);

  /** Overlay visas vid fel svar: kortet renderas vid drop-positionen med rätt år. */
  type WrongOverlay = EventCard & { dropY: number };
  const [wrongOverlay, setWrongOverlay] = useState<WrongOverlay | null>(null);
  const [wrongOverlayExiting, setWrongOverlayExiting] = useState(false);
  const pendingRef = useRef(state.pending);
  pendingRef.current = state.pending;

  /**
   * isPlacing: true from the moment the user releases the card (in the same React
   * render as setDragOverIndex/setReturnGradientArmed) until the rAF completes and
   * tryPlace has fired. This hides the dock card BEFORE the double-rAF delay so
   * no intermediate renders can show the card at full-scale or at the dock position.
   */
  const [isPlacing, setIsPlacing] = useState(false);
  const [questionTimerRemaining, setQuestionTimerRemaining] = useState(1);

  const [showFirstCardDragHint, setShowFirstCardDragHint] = useState(() => {
    if (typeof window === "undefined") return false;
    if (getDragHintDismissCount() >= DRAG_HINT_MAX_SHOWS) return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      markDragHintFullySeen();
      return false;
    }
    return true;
  });

  /** Max en localStorage-ökning per spelstart (undviker dubbelräkning timeout + drag i samma sekund). */
  const dragHintCountedThisMountRef = useRef(false);

  const dismissFirstCardDragHint = useCallback(() => {
    setShowFirstCardDragHint((prev) => {
      if (!prev) return prev;
      if (!dragHintCountedThisMountRef.current) {
        dragHintCountedThisMountRef.current = true;
        recordDragHintDismissed();
      }
      return false;
    });
  }, []);

  const timelineRef = useRef<HTMLDivElement>(null);
  /** Vertikal mittpunkt per kort i viewport (px), samma rum som PointerEvent.clientY. */
  const cardMidpoints = useRef<number[]>([]);
  const lastIndex = useRef<number | null>(null);
  /** Ackumulerad scroll önskad från kant-drag; töms max ~2px/ruta så Android inte “springer iväg”. */
  const scrollAccum = useRef(0);
  const appScrollElRef = useRef<HTMLElement | null>(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragPointerDown = useRef<{ x: number; y: number } | null>(null);
  const pointerDraggingRef = useRef(false);
  const dragPlaceCommitted = useRef(false);
  const lastPointerClient = useRef({ x: 0, y: 0 });

  const layoutTween = {
    type: "tween" as const,
    duration: 0.22,
    ease: [0.25, 0.1, 0.25, 1] as const,
  };

  const slotTween = {
    type: "tween" as const,
    duration: 0.18,
    ease: [0.25, 0.1, 0.25, 1] as const,
  };

  useEffect(() => {
    if (state.flashBoardIndex === null) return;
    setGlowActive(true);
    const t = window.setTimeout(() => setGlowActive(false), 1100);
    return () => window.clearTimeout(t);
  }, [state.flashBoardIndex]);

  useEffect(() => {
    if (state.wrongPulse === 0) {
      setLivesLostAnim(false);
      return;
    }
    setLivesLostAnim(true);
    const t = window.setTimeout(() => setLivesLostAnim(false), 360);
    return () => window.clearTimeout(t);
  }, [state.wrongPulse]);

  const refreshMidpoints = useCallback(() => {
    const root = timelineRef.current;
    if (!root) return;
    const cardElements = root.querySelectorAll(".timeline-card");
    cardMidpoints.current = Array.from(cardElements).map((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
  }, []);

  useEffect(() => {
    let animationFrame: number;
    const MAX_SCROLL_PER_FRAME = 5;
    const scrollLoop = () => {
      const root = appScrollElRef.current;
      if (root && isDragging) {
        let a = scrollAccum.current;
        if (a !== 0) {
          if (Math.abs(a) <= MAX_SCROLL_PER_FRAME) {
            root.scrollTop += a;
            scrollAccum.current = 0;
          } else {
            const step = Math.sign(a) * MAX_SCROLL_PER_FRAME;
            root.scrollTop += step;
            scrollAccum.current = a - step;
          }
          refreshMidpoints();
        }
      } else if (!isDragging) {
        scrollAccum.current = 0;
      }
      animationFrame = requestAnimationFrame(scrollLoop);
    };
    animationFrame = requestAnimationFrame(scrollLoop);
    return () => cancelAnimationFrame(animationFrame);
  }, [isDragging, refreshMidpoints]);

  useEffect(() => {
    if (!isDragging) return;
    const root = timelineRef.current?.closest(
      "[data-app-scroll]"
    ) as HTMLElement | null;
    if (!root) return;
    const onScroll = () => refreshMidpoints();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [isDragging, refreshMidpoints]);

  useEffect(() => {
    refreshMidpoints();
  }, [state.timeline, refreshMidpoints]);

  // Overlay: visa 2400ms → börja exit-animation → försvinn. Rensa också om spelet tar slut.
  useEffect(() => {
    if (!wrongOverlay) return;
    setWrongOverlayExiting(false);
    const showT = window.setTimeout(() => setWrongOverlayExiting(true), 2400);
    const hideT = window.setTimeout(() => {
      setWrongOverlay(null);
      setWrongOverlayExiting(false);
      finalizeLossAfterWrongOverlay();
    }, 2800);
    return () => {
      window.clearTimeout(showT);
      window.clearTimeout(hideT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongOverlay?.event, wrongOverlay?.dropY, finalizeLossAfterWrongOverlay]);

  useEffect(() => {
    if (state.screen !== "game") {
      setWrongOverlay(null);
      setWrongOverlayExiting(false);
    }
  }, [state.screen]);

  const beginDockDrag = () => {
    if (!state.pending) return;
    appScrollElRef.current =
      (timelineRef.current?.closest(
        "[data-app-scroll]"
      ) as HTMLElement | null) ?? null;
    setIsDragging(true);
    inReturnZoneRef.current = false;
    setReturnZoneActive(false);
    returnGradientArmedRef.current = false;
    setReturnGradientArmed(false);
    leftReturnZoneOnceRef.current = false;
    refreshMidpoints();
    lastIndex.current = null;
  };

  const applyDragAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!state.pending) return;

      const vv = window.visualViewport;
      const visibleH = vv?.height ?? window.innerHeight;
      const visibleY =
        vv != null ? clientY - (vv.offsetTop ?? 0) : clientY;
      /** Övre band + “tak” (nära y=0 i synlig viewport) ger extra scroll. */
      const ceiling = 40;
      const edgeTop = 150;
      const edgeBot = 100;
      const perPulse = 4.6;
      const ceilingBoost = 8;

      let scrollAdd = 0;
      if (visibleY < edgeTop) {
        scrollAdd -= ((edgeTop - visibleY) / edgeTop) * perPulse;
      }
      if (visibleY < ceiling) {
        scrollAdd -= ((ceiling - visibleY) / ceiling) * ceilingBoost;
      }
      if (visibleY > visibleH - edgeBot) {
        scrollAdd +=
          ((visibleY - (visibleH - edgeBot)) / edgeBot) * perPulse;
      }

      if (scrollAdd === 0) {
        scrollAccum.current = 0;
      } else {
        scrollAccum.current += scrollAdd;
        scrollAccum.current = Math.max(-34, Math.min(34, scrollAccum.current));
      }

      refreshMidpoints();

      const centerX = window.innerWidth / 2;
      const returnHalfWidth = 118;
      const returnStripPx = 118;
      const inReturnZone =
        visibleY > visibleH - returnStripPx &&
        Math.abs(clientX - centerX) <= returnHalfWidth;

      if (!inReturnZone) {
        leftReturnZoneOnceRef.current = true;
      }

      /** Arm gradient först efter att zon lämnats och kortet lyfts tydligt (undviker flash vid första drag från dock). */
      const LIFT_PX = 56;
      if (
        leftReturnZoneOnceRef.current &&
        dragY.get() < -LIFT_PX &&
        !returnGradientArmedRef.current
      ) {
        returnGradientArmedRef.current = true;
        setReturnGradientArmed(true);
      }

      if (inReturnZone) {
        inReturnZoneRef.current = true;
        setReturnZoneActive(true);
        setDragOverIndex(null);
        lastIndex.current = null;
        return;
      }
      inReturnZoneRef.current = false;
      setReturnZoneActive(false);

      const foundIndex = computeDragInsertIndex(
        clientX,
        clientY,
        cardMidpoints.current
      );

      if (foundIndex === null) {
        setDragOverIndex(null);
        lastIndex.current = null;
        return;
      }

      if (foundIndex !== lastIndex.current) {
        lastIndex.current = foundIndex;
        setDragOverIndex(foundIndex);
      }
    },
    [refreshMidpoints, state.pending]
  );

  const springBackToDock = useCallback(() => {
    const spring = { type: "spring" as const, stiffness: 520, damping: 36 };
    void Promise.all([
      animate(dragX, 0, spring),
      animate(dragY, 0, spring),
    ]).then(() => {
      setDockSnap((n) => n + 1);
    });
  }, [dragX, dragY]);

  const commitDragAt = useCallback(
    (clientX: number, clientY: number) => {
      if (dragPlaceCommitted.current) return;
      dragPlaceCommitted.current = true;
      pointerDraggingRef.current = false;
      // Do NOT call setIsDragging(false) here for the placement path – it must be
      // batched with tryPlace in the rAF to prevent an intermediate render where
      // isDragging=false and pending still exists, causing a full-size dock flash.
      scrollAccum.current = 0;
      setDragOverIndex(null);
      lastIndex.current = null;
      returnGradientArmedRef.current = false;
      setReturnGradientArmed(false);
      leftReturnZoneOnceRef.current = false;

      const origin = dragPointerDown.current;
      dragPointerDown.current = null;

      const MIN_DRAG_PX = 36;
      if (
        origin &&
        Math.hypot(clientX - origin.x, clientY - origin.y) < MIN_DRAG_PX
      ) {
        inReturnZoneRef.current = false;
        setReturnZoneActive(false);
        setIsDragging(false);
        springBackToDock();
        return;
      }

      if (inReturnZoneRef.current) {
        inReturnZoneRef.current = false;
        setReturnZoneActive(false);
        setIsDragging(false);
        springBackToDock();
        return;
      }

      // Hide the dock card IMMEDIATELY (same render as the pointer-release state
      // cleanup). This prevents any intermediate renders during the double-rAF delay
      // from showing the card at full scale or at an unexpected position.
      setIsPlacing(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refreshMidpoints();
          const idx = computeDragInsertIndex(
            clientX,
            clientY,
            cardMidpoints.current
          );
          if (idx === null) {
            // Dropped outside timeline: spring back visibly.
            setIsPlacing(false);
            setIsDragging(false);
            setReturnZoneActive(false);
            springBackToDock();
            return;
          }

          // setIsPlacing(false), setIsDragging(false) and tryPlace's dispatches all
          // land in the same React batch → single render with correct final state.
          setIsPlacing(false);
          setIsDragging(false);
          setReturnZoneActive(false);
          const placedCorrect = tryPlace(idx);

          if (!placedCorrect) {
            const p = pendingRef.current;
            if (p) {
              const clampedY = Math.max(
                100,
                Math.min(clientY, window.innerHeight - 220)
              );
              setWrongOverlay({ ...p, dropY: clampedY });
            }
          }
        });
      });
    },
    [refreshMidpoints, tryPlace, springBackToDock]
  );

  const onDockPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      e.button !== 0 ||
      !state.pending ||
      wrongDockAnimPhase !== "idle"
    ) {
      return;
    }
    e.preventDefault();
    dismissFirstCardDragHint();
    dragX.stop();
    dragY.stop();
    dragPlaceCommitted.current = false;
    dragPointerDown.current = { x: e.clientX, y: e.clientY };
    lastPointerClient.current = { x: e.clientX, y: e.clientY };
    pointerDraggingRef.current = true;
    dragX.set(0);
    dragY.set(0);
    e.currentTarget.setPointerCapture(e.pointerId);
    beginDockDrag();
  };

  const onDockPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerDraggingRef.current || !dragPointerDown.current) return;
    e.preventDefault();
    lastPointerClient.current = { x: e.clientX, y: e.clientY };
    const o = dragPointerDown.current;
    dragX.set(e.clientX - o.x);
    dragY.set(e.clientY - o.y);
    applyDragAt(e.clientX, e.clientY);
  };

  const endDockPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerDraggingRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* redan släppt */
    }
    const { x, y } = lastPointerClient.current;
    commitDragAt(x, y);
  };

  const onDockLostPointerCapture = () => {
    if (dragPlaceCommitted.current) return;
    const o = dragPointerDown.current;
    if (!o) return;
    const cx = o.x + dragX.get();
    const cy = o.y + dragY.get();
    commitDragAt(cx, cy);
  };

  const timeline = state.timeline;
  const pending = state.pending;

  /** År-hjälp ovan/under utplacerat kort; samma tre starter som drag-hint, försvinner först när man börjar dra. */
  const showTimelineDirHints =
    showFirstCardDragHint && !isDragging && timeline.length > 0;
  const dirHintYearTop = timeline[0]?.year;
  const dirHintYearBottom = timeline[timeline.length - 1]?.year;

  // After a correct placement, pending becomes null and the card is removed from the
  // DOM. Reset the motion values here (after commit) so they are at 0 when the next
  // card renders. Never reset while dragging to avoid interrupting an active drag.
  const pendingKey = pending ? eventKey(pending) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setIsPlacing(false); // safety cleanup after pending changes
    if (!isDragging) {
      dragX.set(0);
      dragY.set(0);
    }
  }, [pendingKey]); // intentionally omitting dragX/dragY/isDragging – stable refs

  // For wrong placements: reset drag motion values after wrongDockAnimPhase="shake"
  // fires. At that point the dock is already hidden, so no visual snap occurs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrongDockAnimPhase === "shake") {
      dragX.set(0);
      dragY.set(0);
    }
  }, [wrongDockAnimPhase]); // intentionally omitting dragX/dragY – stable motion values

  useEffect(() => {
    if (
      !effectiveQuestionTimerEnabled ||
      state.screen !== "game" ||
      !pending ||
      wrongDockAnimPhase !== "idle" ||
      isPlacing
    ) {
      setQuestionTimerRemaining(1);
      return;
    }

    const durationMs = effectiveQuestionTimerSeconds * 1000;
    const start = Date.now();
    setQuestionTimerRemaining(1);

    let lastStressAt = 0;
    let done = false;
    let raf = 0;

    const loop = () => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, durationMs - elapsed);
      const ratio = durationMs > 0 ? left / durationMs : 0;
      flushSync(() => {
        setQuestionTimerRemaining(ratio);
      });

      if (left > 0 && left <= 5000) {
        const now = Date.now();
        const minGap =
          left <= 400 ? 380 : left <= 1200 ? 480 : 650;
        if (now - lastStressAt >= minGap) {
          lastStressAt = now;
          playTimerUrgent(ratio, left);
        }
      }

      if (left <= 0) {
        if (!done) {
          done = true;
          const card = expireQuestionTimer();
          if (card) {
            const clampedY = Math.max(
              100,
              Math.min(window.innerHeight - 220, window.innerHeight - 160)
            );
            setWrongOverlay({ ...card, dropY: clampedY });
          }
        }
        return;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [
    pendingKey,
    effectiveQuestionTimerEnabled,
    effectiveQuestionTimerSeconds,
    wrongDockAnimPhase,
    isPlacing,
    state.screen,
    expireQuestionTimer,
  ]);

  const showQuestionTimerBar =
    effectiveQuestionTimerEnabled &&
    pending &&
    state.screen === "game" &&
    questionTimerRemaining > 0 &&
    wrongDockAnimPhase === "idle" &&
    !isPlacing;

  return (
    <div className="relative w-full min-h-screen">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcer}
      </p>

      {showQuestionTimerBar && (
        <motion.div
          className="pointer-events-none fixed left-1/2 z-[60] w-full max-w-[500px] -translate-x-1/2 px-6"
          initial={false}
          animate={{
            top: isDragging
              ? "env(safe-area-inset-top, 0px)"
              : "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
          }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="relative h-3.5 w-full overflow-hidden rounded-full border border-white/15 bg-black/55 shadow-[inset_0_2px_4px_rgba(0,0,0,0.55)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(questionTimerRemaining * 100)}
            aria-label="Tid kvar för att placera kortet"
          >
            {/* Bredd = kvar tid; orange fäst till höger så färgen krymper åt vänster när tiden tar slut */}
            <div
              className={`absolute right-0 top-0 h-full overflow-hidden rounded-r-full bg-coral will-change-[width] ${
                questionTimerRemaining <= 0.2 ? "animate-pulse" : ""
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, questionTimerRemaining * 100))}%`,
                transformOrigin: "right center",
                transition: "none",
                boxShadow:
                  questionTimerRemaining <= 0.2
                    ? "0 0 14px rgba(255, 127, 80, 0.6)"
                    : "0 0 10px rgba(255, 127, 80, 0.35)",
              }}
            />
          </div>
        </motion.div>
      )}

      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/10 z-0 pointer-events-none" />

      <AnimatePresence>
        {glowActive && (
          <motion.div
            key="line-glow"
            initial={{ top: "-20%", opacity: 0 }}
            animate={{
              top: ["-20%", "120%"],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 -translate-x-1/2 w-1.5 h-[30vh] bg-gradient-to-b from-transparent via-white/60 to-transparent z-20 blur-md pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.header
        className="fixed top-0 w-full max-w-[500px] z-50 flex items-center justify-between px-6 h-14 glass border-t-0 border-x-0 border-b border-white/10 rounded-b-2xl"
        style={{
          left: "50%",
          pointerEvents: isDragging ? "none" : "auto",
        }}
        animate={{
          x: "-50%",
          y: isDragging ? "-100%" : 0,
          opacity: isDragging ? 0 : 1,
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          type="button"
          onClick={() => {
            playClick();
            goStart();
          }}
          className="active:scale-90 transition-transform p-2 rounded-full hover:bg-white/5"
          aria-label="Till start"
        >
          <Home className="w-5 h-5 text-slate-300" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col items-center gap-1">
          {state.gameMode === "daily" && (
            <span className="text-[9px] font-headline font-semibold uppercase tracking-[0.2em] text-coral/90">
              Dagens utmaning
            </span>
          )}
          <h1 className="font-headline font-bold tracking-[0.12em] text-xs sm:text-sm text-slate-300 uppercase">
            {state.score} poäng
          </h1>
          <div
            className={`flex min-h-[6px] gap-1.5 ${livesLostAnim ? "animate-lives-lost" : ""}`}
            aria-label={
              state.startLives === 0
                ? "Ett försök – första fel avslutar spelet"
                : "Liv kvar"
            }
          >
            {state.startLives === 0 ? (
              <motion.div
                key="single-chance"
                className="h-2 w-2 rounded-full bg-coral shadow-[0_0_10px_rgba(255,127,80,0.65)]"
                aria-hidden
                animate={
                  livesLostAnim
                    ? { scale: [1, 1.45, 1], opacity: [1, 0.35, 1] }
                    : false
                }
                transition={{ duration: 0.38, ease: "easeOut" }}
              />
            ) : (
              Array.from({ length: state.startLives }, (_, i) => {
                const alive = i < state.lives;
                return (
                  <motion.div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                      alive
                        ? "bg-coral shadow-[0_0_8px_rgba(255,127,80,0.5)]"
                        : "bg-slate-700"
                    }`}
                    animate={
                      livesLostAnim && !alive && i === state.lives
                        ? { scale: [1, 1.55, 1], opacity: [1, 0.35, 1] }
                        : false
                    }
                    transition={{ duration: 0.38, ease: "easeOut" }}
                  />
                );
              })
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="active:scale-90 transition-transform p-2 rounded-full hover:bg-white/5"
          aria-label="Inställningar"
        >
          <Settings className="w-5 h-5 text-slate-300" strokeWidth={1.5} />
        </button>
      </motion.header>

      <main className="mt-[7.5rem] px-8 relative flex-grow pb-80 z-10 w-full max-w-[500px] mx-auto">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-32 timeline-line pointer-events-none" />

        <LayoutGroup>
          <div
            ref={timelineRef}
            className="flex flex-col items-center gap-4 relative"
          >
            {/* Fast höjd: undviker layout-hopp när drag startar/slutar (scroll vid överkant vid behov). */}
            <div
              className="w-72 shrink-0 pointer-events-none"
              style={{ height: "clamp(5rem, 18vh, 11rem)" }}
              aria-hidden
            />
            <AnimatePresence>
              {showTimelineDirHints && dirHintYearTop != null && (
                <motion.div
                  key="timeline-dir-hint-up"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none z-[15] w-72 shrink-0 rounded-2xl border border-white/12 bg-white/[0.07] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm"
                  role="note"
                >
                  <div className="flex gap-3 text-left font-question text-[12px] leading-snug text-slate-200/95 sm:text-[13px]">
                    <ArrowUp
                      className="mt-0.5 h-6 w-6 shrink-0 text-coral"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <p>
                      <span className="font-semibold text-white/95">Tidigare</span>
                      {" än "}
                      <span className="font-headline tabular-nums text-coral">
                        {formatYear(dirHintYearTop)}
                      </span>
                      {" — mindre årtal, släpp "}
                      <span className="text-white/90">ovanför</span>
                      {" kortet."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {timeline.map((event, index) => (
              <Fragment key={eventKey(event)}>
                <motion.div
                  initial={false}
                  animate={{
                    height: dragOverIndex === index ? (isDragging ? 60 : 50) : 0,
                    opacity: dragOverIndex === index ? 1 : 0,
                    marginBottom: dragOverIndex === index ? 16 : 0,
                  }}
                  transition={slotTween}
                  className="w-72 rounded-xl bg-white/5 overflow-hidden"
                />
                <motion.div
                  layout
                  layoutId={eventKey(event)}
                  transition={{ layout: layoutTween }}
                  className={`timeline-card relative w-72 py-2.5 px-16 rounded-2xl flex flex-col items-center shadow-lg cursor-pointer ${
                    state.flashBoardIndex === index
                      ? "ring-2 ring-coral ring-offset-2 ring-offset-midnight"
                      : ""
                  } ${index % 2 === 0 ? "glass-sapphire" : "glass-amethyst"}`}
                >
                  <button
                    type="button"
                    className="w-full flex flex-col items-center bg-transparent border-0 p-0 cursor-pointer"
                    onClick={() => {
                      playClick();
                      setDetailBoardIndex(index);
                    }}
                  >
                    <span className="font-headline font-semibold text-white text-xl tracking-wider">
                      {formatYear(event.year)}
                    </span>
                  </button>
                </motion.div>
              </Fragment>
            ))}
            {/* Samma flex-rad som drop-luckan ovanför första kortet — annars blir ett extra gap-4 mellan övre hint och kort men inte mellan kort och nedre hint. */}
            {showTimelineDirHints && (
              <div
                className="pointer-events-none h-0 min-h-0 w-72 shrink-0 overflow-hidden rounded-xl"
                aria-hidden
              />
            )}
            <AnimatePresence>
              {showTimelineDirHints && dirHintYearBottom != null && (
                <motion.div
                  key="timeline-dir-hint-down"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none z-[15] w-72 shrink-0 rounded-2xl border border-white/12 bg-white/[0.07] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm"
                  role="note"
                >
                  <div className="flex gap-3 text-left font-question text-[12px] leading-snug text-slate-200/95 sm:text-[13px]">
                    <ArrowDown
                      className="mt-0.5 h-6 w-6 shrink-0 text-coral"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <p>
                      <span className="font-semibold text-white/95">Senare</span>
                      {" än "}
                      <span className="font-headline tabular-nums text-coral">
                        {formatYear(dirHintYearBottom)}
                      </span>
                      {" — större årtal, släpp "}
                      <span className="text-white/90">nedanför</span>
                      {" kortet."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={false}
              animate={{
                height:
                  dragOverIndex === timeline.length ? (isDragging ? 60 : 50) : 0,
                opacity: dragOverIndex === timeline.length ? 1 : 0,
                marginTop: dragOverIndex === timeline.length ? 16 : 0,
              }}
              transition={slotTween}
              className="w-72 rounded-xl bg-white/5 overflow-hidden"
            />
          </div>
        </LayoutGroup>
      </main>

      {/* ── Dock: döljs under fel-animation, under placing, och under overlay ── */}
      <section className="fixed bottom-8 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 px-6">
        <AnimatePresence>
          {pending && state.screen === "game" && wrongDockAnimPhase === "idle" && !isPlacing ? (
            <motion.div
              key={eventKey(pending)}
              initial={{ y: -32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <motion.div
                key={dockSnap}
                style={{
                  x: dragX,
                  y: dragY,
                  transformOrigin: "50% 50%",
                  zIndex: isDragging ? 100 : undefined,
                  cursor: isDragging ? "grabbing" : undefined,
                }}
                animate={{
                  scale: isDragging ? 0.6 : 1,
                  rotate: isDragging ? -2 : 0,
                  boxShadow: isDragging
                    ? "0 28px 56px rgba(0,0,0,0.28)"
                    : "none",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                onPointerDown={onDockPointerDown}
                onPointerMove={onDockPointerMove}
                onPointerUp={endDockPointer}
                onPointerCancel={endDockPointer}
                onLostPointerCapture={onDockLostPointerCapture}
                className={`glass-white relative flex touch-none select-none flex-col items-center overflow-visible rounded-[2rem] px-8 pb-8 pt-7 ${
                  !isDragging ? "cursor-grab" : "cursor-default"
                }`}
              >
                {showFirstCardDragHint && !isDragging && (
                  <motion.div
                    className="pointer-events-none absolute inset-x-0 bottom-0 top-10 z-[25] flex items-center justify-end pr-5 sm:pr-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-hidden
                  >
                    <motion.div
                      animate={{ y: [0, -32, 0] }}
                      transition={{
                        duration: 1.35,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Hand
                        className="h-14 w-14 text-slate-900/70 drop-shadow-md"
                        strokeWidth={1.35}
                        aria-hidden
                      />
                    </motion.div>
                  </motion.div>
                )}
                {!isDragging && (
                  <div
                    className={`cat-pill cat-pill--${categorySlug(pending.category)} pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2`}
                    aria-hidden
                  >
                    <span className="text-white [&_svg]:h-3.5 [&_svg]:w-3.5">
                      <CategoryIcon category={pending.category} />
                    </span>
                    <span>{categoryPillLabel(pending.category)}</span>
                  </div>
                )}
                <div className="relative flex w-full flex-col items-center">
                  <div className="w-full text-center">
                    <h2
                      className="font-question text-[18px] leading-snug tracking-normal text-slate-900"
                      style={{ fontWeight: 350 }}
                    >
                      {pending.event}
                    </h2>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : state.screen === "game" ? (
            <motion.div
              key="dock-gap"
              initial={false}
              animate={{ opacity: 0 }}
              className="pointer-events-none min-h-[8.5rem] w-full"
              aria-hidden
            />
          ) : null}
        </AnimatePresence>
      </section>

      {/* ── Fel-svar overlay: visas vid drop-positionen på tidslinjen ── */}
      <AnimatePresence>
        {wrongOverlay && (
          <motion.div
            key={`wrong-${wrongOverlay.event}`}
            className="pointer-events-none fixed left-1/2 z-[95] w-full max-w-[460px] -translate-x-1/2 px-6"
            style={{ top: wrongOverlay.dropY - 90 }}
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={
              wrongOverlayExiting
                ? { opacity: 0, scale: 0.94, y: -14 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={
              wrongOverlayExiting
                ? { duration: 0.3, ease: [0.4, 0, 1, 1] }
                : { type: "spring", stiffness: 560, damping: 34 }
            }
          >
            {/* Shake-wrapper: FEL-badge + kortets kropp skakar tillsammans */}
            <motion.div
              className="relative"
              animate={
                wrongOverlayExiting
                  ? {}
                  : { x: [0, -11, 11, -8, 8, -5, 5, -2, 2, 0] }
              }
              transition={{ duration: 0.5, delay: 0.06, ease: "easeOut" }}
            >
              {/* FEL-badge – sitter ovanpå kortet, skakar med */}
              <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-coral px-4 py-1.5 shadow-lg">
                <XCircle className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                <span className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  Fel!
                </span>
              </div>

              <div className="glass-white flex flex-col items-center overflow-visible rounded-[2rem] px-8 pb-7 pt-7">
                {/* Rätt år – ovanför frågetexten */}
                <div className="mb-4 flex flex-col items-center gap-0.5">
                  <span className="font-headline text-6xl font-bold leading-none tracking-tight text-orange-500">
                    {formatYear(wrongOverlay.year)}
                  </span>
                  <span className="font-headline text-[9px] font-bold uppercase tracking-[0.18em] text-slate-900/60">
                    Rätt år
                  </span>
                </div>

                {/* Frågetext */}
                <p
                  className="w-full text-center font-question text-[15px] leading-snug text-slate-900"
                  style={{ fontWeight: 350 }}
                >
                  {wrongOverlay.event}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {pending && isDragging && returnZoneActive && returnGradientArmed && (
        <div
          className="fixed inset-x-0 bottom-0 z-[85] pointer-events-none h-[min(42vh,220px)] bg-gradient-to-t from-violet-600/32 via-indigo-950/22 to-transparent transition-opacity duration-200"
          aria-hidden
        />
      )}
    </div>
  );
}

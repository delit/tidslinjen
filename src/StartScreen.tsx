import { motion } from "motion/react";
import { CalendarDays, HelpCircle, History, Play, Settings } from "lucide-react";
import { useChronosGame } from "./ChronosGameContext";
import { playClick } from "./sound";

const settingsRowBtn =
  "flex h-14 min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-3 font-headline font-semibold text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/18 hover:bg-white/[0.09] active:scale-[0.99]";

export function StartScreen() {
  const { startGame, openSettings, openHowToPlay, beginDailyChallengeFlow } =
    useChronosGame();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 min-h-0 flex-col items-center justify-between px-6 text-center overflow-hidden relative z-10 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]"
    >
      {/* Vertikal tidslinje med puls */}
      <div className="start-timeline" aria-hidden>
        <div className="start-timeline-bg" />
        <div className="start-timeline-pulse" />
      </div>

      {/* Topp: logo + titel + beskrivning */}
      <div className="relative z-10 flex flex-col items-center gap-4 shrink min-h-0 mt-20">
        <div className="-translate-y-2">
          <motion.div
            animate={{ rotate: [0, 4, -4, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            className="w-[52px] h-[52px] bg-coral rounded-[15px] flex items-center justify-center shadow-[0_0_14px_rgba(255,127,80,0.28)]"
          >
            <History className="w-7 h-7 text-white" strokeWidth={1.75} />
          </motion.div>
        </div>

        <h1 className="text-white leading-[.9] tracking-[-0.04em]" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>
          <span className="text-[54px]">TIDS</span>
          <span className="block text-[54px] text-coral">LINJEN</span>
        </h1>

        <p className="font-question text-[15px] font-light text-white/55 leading-[1.65] max-w-[min(92vw,320px)] sm:text-[17px]">
          <span className="block whitespace-nowrap">
            Sätt händelserna i korrekt ordning
          </span>
          <span className="block">- dra rätt årtal till tidslinjen.</span>
        </p>
      </div>

      {/* Botten: starta + snabbåtgärder */}
      <div className="relative z-10 w-full max-w-sm flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => {
            playClick();
            void startGame();
          }}
          className="flex min-h-[3.25rem] items-center justify-center gap-2.5 px-4 py-[18px] rounded-[14px] bg-coral hover:bg-[#ff6a3d] transition-all duration-150 active:scale-[0.97] shadow-lg"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25">
            <Play
              className="ml-[3px] h-4 w-4 fill-current text-white"
              strokeWidth={0}
            />
          </div>
          <span className="font-question text-[17px] font-bold text-white">
            Starta spel
          </span>
        </button>

        <div className="grid w-full grid-cols-4 gap-2.5">
          <button
            type="button"
            className={`${settingsRowBtn} col-span-1`}
            aria-label="Inställningar"
            onClick={() => {
              playClick();
              openSettings();
            }}
          >
            <Settings className="h-5 w-5 shrink-0 text-slate-300" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={`${settingsRowBtn} col-span-1`}
            aria-label="Så spelar du"
            onClick={() => {
              playClick();
              openHowToPlay();
            }}
          >
            <HelpCircle className="h-5 w-5 shrink-0 text-slate-300" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={`${settingsRowBtn} col-span-2 min-w-0 px-3 max-[410px]:gap-1.5 max-[410px]:px-2`}
            aria-label="Dagens utmaning"
            onClick={() => {
              playClick();
              beginDailyChallengeFlow();
            }}
          >
            <CalendarDays
              className="h-5 w-5 shrink-0 text-slate-300"
              strokeWidth={2}
              aria-hidden
            />
            <span className="min-w-0 whitespace-nowrap text-center font-body text-[15px] font-normal leading-snug text-slate-300 max-[410px]:text-[12px] sm:text-base">
              Dagens utmaning
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

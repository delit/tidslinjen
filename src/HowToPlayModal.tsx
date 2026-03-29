import { motion, useReducedMotion } from "motion/react";
import { Hand, X } from "lucide-react";
import { playClick } from "./sound";

type HowToPlayModalProps = {
  onClose: () => void;
};

export function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      id="how-to-play-modal"
      className="fixed inset-0 z-[110] flex items-center justify-center p-5 bg-black/50 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
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
      <div className="relative z-10 flex w-full max-w-md max-h-[min(90vh,640px)] flex-col overflow-hidden rounded-[2.5rem] border border-white/12 bg-gradient-to-br from-slate-950/95 via-blue-950/90 to-indigo-950/92 px-6 pb-4 pt-6 shadow-2xl ring-1 ring-inset ring-white/10 sm:px-7 sm:pb-5 sm:pt-7">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
          <h2
            id="how-to-play-title"
            className="font-headline text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            Så spelar du
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

        <div className="max-h-[calc(min(90vh,640px)-6.5rem)] overflow-y-auto scrollbar-hide pb-3 sm:max-h-[calc(min(90vh,640px)-7rem)] sm:pb-4">
          <ul className="space-y-3 text-left text-[15px] leading-relaxed text-slate-300 sm:text-base">
            <li>
              <span className="font-headline font-semibold text-white">
                Frågekort.
              </span>{" "}
              Du får ett kort med en händelse – men inte årtalet. Målet är att
              bygga en korrekt tidslinje.
            </li>
            <li>
              <span className="font-headline font-semibold text-white">
                Dra vertikalt.
              </span>{" "}
              Ta tag i frågekortet längst ner och dra det mot mitten av skärmen.
              Släpp det{" "}
              <span className="text-coral">ovanför</span> eller{" "}
              <span className="text-coral">nedanför</span> ett befintligt årtal –
              där du tror att händelsen ska ligga i tiden.
            </li>
            <li>
              Rätt placering ger poäng och nästa kort. Fel placering tar ett liv;
              när liv är slut är omgången över.
            </li>
          </ul>

          <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:mt-6">
            Så här väljer du plats
          </p>
          <div className="relative mx-auto mt-3.5 mb-2 h-[200px] w-full max-w-[260px] overflow-visible rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:mb-3">
            <div
              className="pointer-events-none absolute left-1/2 top-6 bottom-10 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/25 to-transparent"
              aria-hidden
            />
            <div className="pointer-events-none absolute left-1/2 top-[26%] z-[1] flex -translate-x-1/2 flex-col items-center gap-1">
              <span className="rounded-md border border-white/10 bg-slate-900/90 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-coral shadow-sm">
                1848
              </span>
            </div>
            <div className="pointer-events-none absolute left-1/2 top-[58%] z-[1] flex -translate-x-1/2 flex-col items-center gap-1">
              <span className="rounded-md border border-white/10 bg-slate-900/90 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-coral shadow-sm">
                1914
              </span>
            </div>

            <motion.div
              className="absolute left-1/2 z-[2] w-[min(200px,calc(100%-1rem))] -translate-x-1/2 rounded-xl border-2 border-coral/70 bg-gradient-to-br from-slate-900 to-slate-950 py-2 pl-2 pr-7 text-left shadow-[0_8px_28px_rgba(255,127,80,0.22)]"
              initial={false}
              animate={
                reduceMotion
                  ? { top: "42%" }
                  : {
                      /* Börjar längst ned (dock), går uppåt längs linjen, sedan tillbaka ned */
                      top: ["76%", "42%", "14%", "42%", "62%", "76%"],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 9,
                      repeat: Infinity,
                      ease: "easeInOut",
                      times: [0, 0.2, 0.38, 0.52, 0.72, 1],
                    }
              }
            >
              <p className="font-headline text-[11px] font-bold uppercase tracking-wide text-white/90">
                Frågekort
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-slate-400">
                Dra upp eller ner längs linjen
              </p>
              <motion.div
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
                aria-hidden
                animate={
                  reduceMotion
                    ? { y: 0, opacity: 0.35 }
                    : {
                        y: [0, -6, 0, 6, 0],
                        opacity: [0.28, 0.42, 0.35, 0.42, 0.28],
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
              >
                <Hand
                  className="h-8 w-8 text-white/50"
                  strokeWidth={1.35}
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

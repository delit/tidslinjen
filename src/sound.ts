const STORAGE_SOUND = "tidslinjen_sound";

let audioCtx: AudioContext | null = null;

export function soundEnabled(): boolean {
  return localStorage.getItem(STORAGE_SOUND) !== "off";
}

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Anropa efter t.ex. Starta spel så Web Audio får resume (krävs ofta på iOS). */
export function primeAudioContext(): void {
  if (!soundEnabled()) return;
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

function beep(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.08
): void {
  if (!soundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

/** Ljus “succé”-arpeggio (G5 → B5 → D6), skiljer sig från gamla C5/E5. */
export function playCorrect(): void {
  beep(783.99, 0.09, "sine", 0.072);
  window.setTimeout(() => beep(987.77, 0.1, "sine", 0.062), 48);
  window.setTimeout(() => beep(1174.66, 0.12, "sine", 0.052), 98);
}

export function playWrong(): void {
  beep(180, 0.2, "triangle", 0.12);
}

export function playClick(): void {
  beep(400, 0.04, "sine", 0.04);
}

/**
 * Påminnelse under sista sekunderna av timern. Sinuston, tydlig men inte skärande.
 * Web Audio kräver ofta resume() efter användarinteraktion — väntar på den innan pip.
 */
export function playTimerUrgent(
  remainingRatio: number,
  _leftMs?: number
): void {
  if (!soundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = Math.max(0, Math.min(1, remainingRatio));
  const freq = 380 + (1 - t) * 160;
  const gain = 0.065 + (1 - t) * 0.055;

  const fire = () => {
    beep(freq, 0.072, "sine", Math.min(0.14, gain));
  };

  if (ctx.state === "suspended") {
    void ctx.resume().then(() => {
      fire();
    });
  } else {
    fire();
  }
}

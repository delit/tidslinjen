const KEY_ENABLED = "tidslinjen_timer_enabled";
const KEY_SECONDS = "tidslinjen_timer_seconds";

export const TIMER_SECONDS_MIN = 3;
export const TIMER_SECONDS_MAX = 30;
export const TIMER_SECONDS_DEFAULT = 15;

export function loadTimerEnabled(): boolean {
  try {
    return localStorage.getItem(KEY_ENABLED) === "1";
  } catch {
    return false;
  }
}

export function saveTimerEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_ENABLED, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadTimerSeconds(): number {
  try {
    const n = Number.parseInt(localStorage.getItem(KEY_SECONDS) ?? "", 10);
    if (Number.isFinite(n) && n >= TIMER_SECONDS_MIN && n <= TIMER_SECONDS_MAX) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return TIMER_SECONDS_DEFAULT;
}

export function saveTimerSeconds(seconds: number): void {
  const c = Math.min(
    TIMER_SECONDS_MAX,
    Math.max(TIMER_SECONDS_MIN, Math.round(seconds))
  );
  try {
    localStorage.setItem(KEY_SECONDS, String(c));
  } catch {
    /* ignore */
  }
}

/** Tillåtna värden för antal liv (inställning + start av spel). */
export const ALLOWED_LIVES = [0, 3, 5, 7, 9] as const;

export type AllowedLives = (typeof ALLOWED_LIVES)[number];

export function isAllowedLives(n: number): n is AllowedLives {
  return (ALLOWED_LIVES as readonly number[]).includes(n);
}

/** Om sparad state har gammalt värde (t.ex. 1–5) → sätt säkert standard. */
export function normalizeSelectedLives(n: number): AllowedLives {
  if (isAllowedLives(n)) return n;
  return 5;
}

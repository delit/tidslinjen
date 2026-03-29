/**
 * Klienten ska endast använda Project URL + anon/publishable-nyckel.
 * Service role får aldrig ligga i Vite (VITE_*) eller i webbläsaren.
 */

const SERVICE_ROLE_SUBSTRINGS = [
  "service_role",
  "SERVICE_ROLE",
  "service-role",
] as const;

export function isLikelyServiceRoleKey(key: string): boolean {
  const t = key.trim();
  if (!t) return false;
  for (const s of SERVICE_ROLE_SUBSTRINGS) {
    if (t.includes(s)) return true;
  }
  return false;
}

export function isValidSupabaseProjectUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith("https://")) return false;
  try {
    const host = new URL(u).hostname;
    return host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/** Anropas när Supabase-klient skapas. Loggar varningar i dev vid misstänkta värden. */
export function warnIfUnsafeSupabaseClientEnv(
  url: string,
  anonKey: string
): void {
  if (!import.meta.env.DEV) return;
  if (anonKey && isLikelyServiceRoleKey(anonKey)) {
    console.error(
      "[Tidslinjen] VITE_SUPABASE_ANON_KEY verkar vara en service role-nyckel. Använd endast publishable/anon från Project Settings → API."
    );
  }
  if (url && !isValidSupabaseProjectUrl(url)) {
    console.warn(
      "[Tidslinjen] VITE_SUPABASE_URL förväntas vara https://<ref>.supabase.co"
    );
  }
}

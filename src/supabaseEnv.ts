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

/** Project URL utan /rest/v1/ eller avslutande /. */
export function normalizeSupabaseProjectUrl(url: string): string {
  let u = url.trim();
  if (!u) return u;
  u = u.replace(/\/rest\/v1\/?$/i, "");
  u = u.replace(/\/+$/, "");
  return u;
}

export function isValidSupabaseProjectUrl(url: string): boolean {
  const u = normalizeSupabaseProjectUrl(url);
  if (!u.startsWith("https://")) return false;
  try {
    const host = new URL(u).hostname;
    return host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/** Anon/publishable — inte Project URL eller service role. */
export function isValidSupabaseAnonKey(key: string): boolean {
  const k = key.trim();
  if (!k || k.length < 20) return false;
  if (k.includes(".supabase.co") || k.startsWith("http")) return false;
  if (k.startsWith("eyJ")) return true;
  if (k.startsWith("sb_publishable_")) return true;
  return false;
}

export type SupabaseConfigIssue =
  | "missing"
  | "bad_url"
  | "bad_key"
  | "key_is_url";

export function getSupabaseConfigIssue(
  url: string,
  anonKey: string
): SupabaseConfigIssue | null {
  const u = url.trim();
  const k = anonKey.trim();
  if (!u || !k) return "missing";
  if (!isValidSupabaseProjectUrl(u)) return "bad_url";
  if (k === u || k.includes(".supabase.co")) return "key_is_url";
  if (!isValidSupabaseAnonKey(k)) return "bad_key";
  return null;
}

/** Anropas när Supabase-klient skapas. Loggar varningar i dev vid misstänkta värden. */
export function warnIfUnsafeSupabaseClientEnv(
  url: string,
  anonKey: string
): void {
  if (!import.meta.env.DEV) return;
  const issue = getSupabaseConfigIssue(url, anonKey);
  if (issue === "key_is_url") {
    console.error(
      "[Tidslinjen] VITE_SUPABASE_ANON_KEY är samma som Project URL. Använd anon/publishable-nyckeln från Project Settings → API."
    );
  } else if (issue === "bad_key") {
    console.error(
      "[Tidslinjen] VITE_SUPABASE_ANON_KEY ser ogiltig ut. Använd anon/publishable från Project Settings → API."
    );
  }
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

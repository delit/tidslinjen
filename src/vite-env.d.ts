/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Sätt till "true" för att hoppa över Edge Function och skriva direkt mot tabellen (t.ex. dev). */
  readonly VITE_FORCE_DIRECT_DAILY_INSERT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

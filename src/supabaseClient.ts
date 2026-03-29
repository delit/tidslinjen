import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { warnIfUnsafeSupabaseClientEnv } from "./supabaseEnv";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    warnIfUnsafeSupabaseClientEnv(url, key);
    client = createClient(url, key);
  }
  return client;
}

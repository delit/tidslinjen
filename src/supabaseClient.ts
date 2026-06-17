import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseConfigIssue,
  warnIfUnsafeSupabaseClientEnv,
} from "./supabaseEnv";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigIssue(url, key) === null;
}

export function getSupabaseConfigMessage(): string | null {
  switch (getSupabaseConfigIssue(url, key)) {
    case "missing":
      return "Topplistan kräver Supabase (VITE_SUPABASE_URL och ANON-nyckel).";
    case "key_is_url":
      return "ANON-nyckeln är fel: du har angett Project URL istället för anon/publishable-nyckeln.";
    case "bad_key":
      return "ANON-nyckeln är ogiltig. Kopiera anon/publishable från Supabase → Project Settings → API.";
    case "bad_url":
      return "Supabase-URL är ogiltig (förväntas https://<ref>.supabase.co).";
    default:
      return null;
  }
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

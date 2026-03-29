-- ═══════════════════════════════════════════════════════════════════════════
-- VIKTIGT: Klistra ALDRIG in filvägen (t.ex. Design/ny design/...) i SQL Editor.
-- Öppna denna fil i Cursor, markera ALLT från "create table" nedåt ELLER hela filen
-- (alla rader som börjar med -- eller är SQL), men INTE en Windows-sökväg som första rad.
-- ═══════════════════════════════════════════════════════════════════════════
-- Rate limit + säker insert via Edge: supabase/functions/submit-daily-score (deploy med CLI).
-- Valfritt: efter deploy, kör sql/daily_scores_edge_lockdown.sql för att stänga direkt anon-INSERT.
-- Kör i Supabase → SQL Editor (hela filen första gången).
-- Om du redan skapat tabellen men "Kunde inte spara" → kör bara sektionen
-- "UPPDATERA RLS OCH RÄTTIGHETER" längst ned.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.daily_scores (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null,
  player_name text not null,
  player_name_key text generated always as (lower(trim(player_name))) stored,
  score int not null check (score >= 0 and score <= 100000),
  created_at timestamptz not null default now(),
  constraint daily_scores_name_len check (char_length(trim(player_name)) between 1 and 15),
  constraint daily_scores_unique_player unique (challenge_date, player_name_key)
);

alter table public.daily_scores enable row level security;

-- Läs för alla (topplista i appen)
drop policy if exists "daily_scores_select_all" on public.daily_scores;
create policy "daily_scores_select_all"
  on public.daily_scores for select
  using (true);

-- Infoga: tillåt dagens eller gårdagens datum i Stockholm (undviker kant vid midnatt
-- mellan spelstart och när man skickar in resultat).
drop policy if exists "daily_scores_insert_stockholm_today" on public.daily_scores;
create policy "daily_scores_insert_stockholm_today"
  on public.daily_scores for insert
  with check (
    challenge_date >= (timezone('Europe/Stockholm', now()))::date - interval '1 day'
    and challenge_date <= (timezone('Europe/Stockholm', now()))::date
  );

-- Anon-nyckeln (webbläsaren) måste få läsa/skriva explicit i vissa projekt.
grant usage on schema public to anon, authenticated;
grant select, insert on table public.daily_scores to anon, authenticated;

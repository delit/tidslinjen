-- ═══════════════════════════════════════════════════════════════════════════
-- VALFRITT (produktion): när Edge Function submit-daily-score är deployad och
-- klienten skickar inskick via den funktionen kan du ta bort direkt INSERT för
-- anon och endast tillåta läsning. Då kan inte någon kringgå rate limit via
-- direkt PostgREST mot tabellen.
--
-- Kör INTE detta förrän Edge Function fungerar och du testat inskick.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "daily_scores_insert_stockholm_today" on public.daily_scores;

revoke insert on table public.daily_scores from anon;

-- authenticated behåller insert om du använder inloggning (just nu används inte).
-- revoke insert on table public.daily_scores from authenticated;

/**
 * Supabase Edge Function: rate limit + insert med service role (RLS kringgås).
 *
 * Deploy: supabase functions deploy submit-daily-score
 * (I projektet måste SUPABASE_SERVICE_ROLE_KEY finnas automatiskt i Edge-miljön.)
 *
 * CORS: tillåt din webbplats i produktion om du vill begränsa origin.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_SUBMITS_PER_IP_PER_HOUR = 25;

type Bucket = number[];
const rateBuckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const arr = rateBuckets.get(ip) ?? [];
  const pruned = arr.filter((t) => now - t < RATE_WINDOW_MS);
  pruned.push(now);
  rateBuckets.set(ip, pruned);
  return pruned.length <= MAX_SUBMITS_PER_IP_PER_HOUR;
}

function stockholmTodayParts(): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const d0 = new Date();
    return {
      y: d0.getUTCFullYear(),
      m: d0.getUTCMonth() + 1,
      d: d0.getUTCDate(),
    };
  }
  return { y, m, d };
}

function ymdIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Föregående kalenderdag (samma logik som datum-strängar i RLS). */
function prevCalendarDay(y: number, m: number, d: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, code: "method" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: "rate_limit",
        message:
          "För många försök från samma nätverk. Vänta upp till en timme och försök igen.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: {
    challenge_date?: string;
    player_name?: string;
    score?: number;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, code: "json" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const challenge_date = typeof body.challenge_date === "string" ? body.challenge_date.trim() : "";
  const player_name =
    typeof body.player_name === "string" ? body.player_name.trim() : "";
  const score = typeof body.score === "number" ? body.score : NaN;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(challenge_date)) {
    return new Response(JSON.stringify({ ok: false, code: "validation" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (player_name.length < 1 || player_name.length > 15) {
    return new Response(JSON.stringify({ ok: false, code: "validation" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!Number.isFinite(score) || score < 0 || score > 100_000) {
    return new Response(JSON.stringify({ ok: false, code: "validation" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { y, m, d } = stockholmTodayParts();
  const maxStr = ymdIso(y, m, d);
  const prev = prevCalendarDay(y, m, d);
  const minStr = ymdIso(prev.y, prev.m, prev.d);
  const allowed = challenge_date >= minStr && challenge_date <= maxStr;
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, code: "validation" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, code: "server_config" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey);
  const { error } = await admin.from("daily_scores").insert({
    challenge_date,
    player_name,
    score,
  });

  if (!error) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const msg = error.message ?? "";
  if (
    msg.includes("duplicate") ||
    msg.includes("unique") ||
    (error as { code?: string }).code === "23505"
  ) {
    return new Response(JSON.stringify({ ok: false, code: "duplicate" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: false, code: "db", message: msg }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

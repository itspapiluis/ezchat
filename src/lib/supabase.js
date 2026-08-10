// ============================================================
// EZChat · Single shared Supabase client
// ============================================================
// The app used to call createClient() in THREE places (App.jsx,
// staff/shared.js, lib/prod.js). Each call opens its own realtime
// websocket and its own auth instance — wasted egress plus the
// "Multiple GoTrueClient instances detected" console warning.
// Every module now imports this one client.
// ============================================================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If the environment variables are missing at BUILD time, createClient() gets an
// invalid URL and throws "Failed to construct 'URL'" on boot — which React turns
// into a BLANK WHITE SCREEN with no explanation. This happened when the app was
// redeployed on a machine/Vercel project where VITE_SUPABASE_URL wasn't set.
// Fail loudly and clearly instead, so the cause is obvious.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !/^https:\/\//.test(SUPABASE_URL)) {
  const msg = "Configuration error: Supabase environment variables are missing. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel " +
    "(Project → Settings → Environment Variables), then redeploy.";
  document.body.innerHTML =
    '<div style="font-family:sans-serif;max-width:520px;margin:60px auto;padding:24px;' +
    'background:#151510;color:#e8e0d0;border:1px solid #C9A84C;border-radius:12px;line-height:1.6">' +
    '<h2 style="color:#C9A84C;margin:0 0 10px">EZChat — Setup needed</h2>' +
    '<p style="margin:0">' + msg + '</p></div>';
  throw new Error(msg);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // EZChat has no Supabase logins — guests are anonymous and staff use PINs.
  // Persisting/refreshing a session we never create is pure overhead.
  auth: { persistSession: false, autoRefreshToken: false },
  // NOTE: deliberately NOT throttling realtime eventsPerSecond. Typing
  // indicators broadcast on every keystroke; a low cap silently drops them
  // on a busy night. The library default (10/s) is correct here.
});

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // EZChat has no Supabase logins — guests are anonymous and staff use PINs.
  // Persisting/refreshing a session we never create is pure overhead.
  auth: { persistSession: false, autoRefreshToken: false },
  // NOTE: deliberately NOT throttling realtime eventsPerSecond. Typing
  // indicators broadcast on every keystroke; a low cap silently drops them
  // on a busy night. The library default (10/s) is correct here.
});

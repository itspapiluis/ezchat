// Separate Supabase client used ONLY by /hr.
// The shared client in src/lib/supabase.js has persistSession:false, which would
// log HR out on every refresh. That shared client is left untouched; this one
// keeps its own session under its own storage key so the two never collide.
import { createClient } from "@supabase/supabase-js";

export const hrSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "ezchat-hr-auth",
    },
  }
);

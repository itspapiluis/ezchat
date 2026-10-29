// True only when the database says online reservations are switched ON.
// Fails CLOSED: on any error the Reserve buttons simply stay hidden.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

export function useReservationsEnabled() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data, error } = await Promise.race([
          supabase.rpc("reservation_enabled"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
        ]);
        if (!dead && !error && data === true) setOn(true);
      } catch (_) { /* stay hidden */ }
    })();
    return () => { dead = true; };
  }, []);
  return on;
}

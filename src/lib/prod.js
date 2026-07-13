// ============================================================
// EZChat · Phase 7 — Production utilities
// Error logging + client-side rate limiting
// ============================================================
import { supabase } from "./supabase.js";

// ── Error logging ─────────────────────────────────────────────────────────────
// Fire-and-forget. Never throws, never blocks the UI.
let errCount = 0;
const ERR_CAP = 20; // per page-load, so a render loop can't flood the DB

export async function logError(context, error, meta = {}) {
  try {
    if (errCount++ >= ERR_CAP) return;
    const msg = error?.message || String(error || "unknown");
    // Ignore noise we can't act on
    if (/ResizeObserver|Script error|Load failed/i.test(msg)) return;

    await supabase.from("error_logs").insert({
      context,
      message: msg.slice(0, 500),
      stack: (error?.stack || "").slice(0, 2000),
      meta,
      user_id: meta.user_id || null,
      table_id: meta.table_id || null,
      user_agent: navigator.userAgent.slice(0, 200),
    });
  } catch (_) {
    /* logging must never break the app */
  }
}

// Catches crashes we never explicitly wrapped
export function installErrorHandlers(getCtx = () => ({})) {
  window.addEventListener("error", (e) => {
    logError("window.onerror", e.error || new Error(e.message), getCtx());
  });
  window.addEventListener("unhandledrejection", (e) => {
    logError("unhandledRejection", e.reason, getCtx());
  });
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Limits, tuned for a busy bar night:
export const LIMITS = {
  message: { max: 12, window: 30 },  // 12 chat messages / 30s
  dm:      { max: 10, window: 30 },  // 10 DMs / 30s
  image:   { max: 3,  window: 120 }, // 3 photos / 2 min
  order:   { max: 5,  window: 60 },  // 5 order submits / min
  join:    { max: 5,  window: 300 }, // 5 join attempts / 5 min
};

// Cheap local pre-check so we don't even hit the network on obvious spam
const localHits = {};
function localAllows(action, max, window) {
  const now = Date.now();
  const arr = (localHits[action] = (localHits[action] || []).filter(
    (t) => now - t < window * 1000
  ));
  if (arr.length >= max) return false;
  arr.push(now);
  return true;
}

// Returns true if ALLOWED, false if rate-limited.
export async function rateLimit(key, action) {
  const cfg = LIMITS[action];
  if (!cfg) return true;

  if (!localAllows(action, cfg.max, cfg.window)) return false;

  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: String(key || "anon"),
      p_action: action,
      p_max: cfg.max,
      p_window: cfg.window,
    });
    if (error) return true; // fail open — never lock out a paying guest
    return data !== false;
  } catch (_) {
    return true;
  }
}

// ── Staff PIN verification (server-side, PIN never enters the bundle) ─────────
export async function verifyStaffPin(role, pin) {
  try {
    const { data, error } = await supabase.rpc("verify_staff_pin", {
      p_role: role,
      p_pin: pin,
    });
    if (error) {
      logError("verifyStaffPin", error, { role });
      return false;
    }
    return data === true;
  } catch (e) {
    logError("verifyStaffPin", e, { role });
    return false;
  }
}

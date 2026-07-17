// ============================================================
// EZChat · Phase 7 — Production utilities
// Error logging + client-side rate limiting
// ============================================================
import { useState, useEffect } from "react";
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

// ── PHASE 8: connection awareness ────────────────────────────────────────────
// A venue's wifi WILL blip mid-service. Before this, an order would just fail
// silently and nobody — guest or staff — would know the app had gone deaf.
// This exposes one honest boolean: are we actually connected right now?

export function useConnection(){
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [realtime, setRealtime] = useState(true);

  useEffect(()=>{
    const up = ()=>setOnline(true);
    const down = ()=>setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);

    // Watch the realtime socket itself — the browser can be "online" while the
    // websocket is dead, which is the failure mode that actually bites.
    const ch = supabase.channel("conn-probe")
      .subscribe(status=>{
        if(status === "SUBSCRIBED") setRealtime(true);
        if(status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"){
          setRealtime(false);
        }
      });

    return()=>{
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      supabase.removeChannel(ch);
    };
  },[]);

  return { connected: online && realtime, online, realtime };
}

// ── PHASE 11: void authorisation ─────────────────────────────────────────────
// Voids remove money from a bill (or write off stock). They now require a PIN
// that is SEPARATE from any login PIN — so it can be handed to a trusted senior
// without giving away admin access.
export async function verifyVoidPin(pin){
  try{
    const {data,error} = await supabase.rpc("verify_void_pin",{p_pin:pin});
    if(error) return false;
    return data === true;
  }catch(_){ return false; }
}

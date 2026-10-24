// Attendance gate: wraps the Kitchen / Bar / Cashier / Server screens.
//
//  * DORMANT unless attendance_settings.gate_enabled = true in the database.
//  * FAILS OPEN: if the database can't be reached, or anything here goes wrong,
//    the staff screen opens normally. A gate problem must never stop service.
//  * When ON: a person signs in with their own name + PIN. If they are not
//    clocked in yet, the selfie clock-in happens right there. A small
//    "End shift" button then stays in the corner of the screen.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import ClockPage from "./ClockPage.jsx";
import {
  getAttendanceSession, setAttendanceSession, clearAttendanceSession,
  applyServerName, clearServerName,
} from "./session.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const SURFACE = "#151510";
const BORDER = "#2a2a20";

// Never wait forever on the network.
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export default function AttendanceGate({ children }) {
  const navigate = useNavigate();

  // A remembered sign-in lets the screen open immediately; it is re-checked in the background.
  const [session, setSession] = useState(() => {
    const s = getAttendanceSession();
    if (s) applyServerName(s.serverName || s.name);
    return s;
  });
  const [status, setStatus] = useState(session ? "on" : "checking"); // checking | on | off
  const [panel, setPanel] = useState(false);
  const [ending, setEnding] = useState(null); // null | { step: "warn", tables } | { step: "clock" }

  // ── is the gate switched on? ───────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data, error } = await withTimeout(supabase.rpc("attendance_gate_enabled"), 5000);
        if (dead) return;
        if (error) throw error;
        if (data === true) {
          setStatus("on");
        } else {
          // Gate is off: forget any leftover sign-in so the old Server name picker is back.
          if (getAttendanceSession()) { clearAttendanceSession(); clearServerName(); }
          setSession(null);
          setStatus("off");
        }
      } catch (_) {
        if (dead) return;
        // Can't tell. Never lock staff out: keep an existing sign-in, otherwise open the screen.
        setStatus((s) => (s === "on" ? "on" : "off"));
      }
    })();
    return () => { dead = true; };
  }, []);

  // ── still clocked in? (also catches a shift HR closed, or one past 14 hours) ──
  const verify = useCallback(async () => {
    const s = getAttendanceSession();
    if (!s) return;
    try {
      const { data, error } = await withTimeout(supabase.rpc("attendance_on_shift", { p_staff: s.staff_id }), 5000);
      if (error) return; // can't tell: keep working
      if (data === false) { clearAttendanceSession(); clearServerName(); setSession(null); }
    } catch (_) { /* network trouble: keep working */ }
  }, []);

  useEffect(() => {
    if (status !== "on" || !session) return undefined;
    verify();
    const id = setInterval(verify, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") verify(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, session, verify]);

  // ── sign in (after the ClockPage flow succeeds) ────────────────────────────
  async function handleSignedIn(r) {
    let serverName = r.name;
    try {
      const { data } = await withTimeout(supabase.rpc("attendance_server_name", { p_staff: r.staff_id }), 4000);
      if (data) serverName = data;
    } catch (_) { /* fall back to the attendance name */ }
    const s = { staff_id: r.staff_id, name: r.name, serverName };
    setAttendanceSession(s);
    applyServerName(serverName);
    setSession(s);
  }

  // ── end shift ──────────────────────────────────────────────────────────────
  async function startEnd() {
    setPanel(false);
    let tables = [];
    try {
      const { data } = await withTimeout(supabase.rpc("attendance_open_tabs", { p_staff: session.staff_id }), 4000);
      if (Array.isArray(data)) tables = data;
    } catch (_) { /* warning is optional */ }
    setEnding(tables.length ? { step: "warn", tables } : { step: "clock" });
  }

  function handleEnded() {
    clearAttendanceSession();
    clearServerName();
    setSession(null);
    setEnding(null);
    navigate("/staff");
  }

  function switchPerson() {
    setPanel(false);
    clearAttendanceSession();
    clearServerName();
    setSession(null);
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (status === "checking") {
    return <div style={{ position: "fixed", inset: 0, background: "#080808" }} />;
  }
  if (status === "on" && !session) {
    return <ClockPage mode="gate" onComplete={handleSignedIn} />;
  }

  // Same shape whether the gate is on or off, so the screen underneath is never remounted.
  return (
    <>
      {children}
      {status === "on" && session && (
        <>
          <div style={{ position: "fixed", left: 10, bottom: 10, zIndex: 150, fontFamily: "Inter, sans-serif" }}>
            {panel && (
              <div style={{ marginBottom: 6, padding: 8, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, display: "grid", gap: 6, minWidth: 170, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
                <button onClick={startEnd}
                  style={{ padding: "9px 12px", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: "#080808" }}>
                  End shift
                </button>
                <button onClick={switchPerson}
                  style={{ padding: "8px 12px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, color: "#aaa", fontSize: 12, cursor: "pointer" }}>
                  Not me (does not clock out)
                </button>
              </div>
            )}
            <button onClick={() => setPanel((p) => !p)}
              style={{ padding: "5px 11px", background: SURFACE, border: `1px solid ${GOLD}`, borderRadius: 999, color: GOLD, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: 0.92 }}>
              {session.name}
            </button>
          </div>

          {ending && ending.step === "warn" && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter, sans-serif" }}>
              <div style={{ width: "100%", maxWidth: 340, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22, color: "#e8e0d0" }}>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: "#fcd34d" }}>You still have open tables</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>{ending.tables.join(", ")}</div>
                <div style={{ fontSize: 12.5, color: "#999", marginBottom: 18, lineHeight: 1.5 }}>
                  These tabs are still open. Tell the next person, or settle them first. You can still end your shift.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button onClick={() => setEnding({ step: "clock" })}
                    style={{ padding: 13, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: "#080808" }}>
                    End shift anyway
                  </button>
                  <button onClick={() => setEnding(null)}
                    style={{ padding: 12, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, color: "#aaa", fontSize: 14, cursor: "pointer" }}>
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}

          {ending && ending.step === "clock" && (
            <ClockPage
              mode="end"
              fixedStaff={{ id: session.staff_id, name: session.name }}
              onComplete={handleEnded}
              onCancel={() => setEnding(null)}
            />
          )}
        </>
      )}
    </>
  );
}

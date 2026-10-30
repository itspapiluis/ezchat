// /hr : HR login, shifts review, staff management, Excel export.
// Uses its OWN Supabase client (hrClient.js) so the shared client is untouched.
import { useCallback, useEffect, useMemo, useState } from "react";
import { hrSupabase as sb } from "./hrClient.js";
import { BUCKET, fmtDateTime, fmtDay, fmtTime, manilaDate, pairShifts, ts } from "./util.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";

const ui = {
  page: {
    position: "fixed", inset: 0, overflowY: "auto", background: BG, color: "#e8e0d0",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif", WebkitOverflowScrolling: "touch",
  },
  wrap: { maxWidth: 1000, margin: "0 auto", padding: "16px 16px 80px" },
  card: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 10 },
  input: {
    padding: "10px 12px", fontSize: 14, background: SURFACE2, border: `1px solid ${BORDER}`,
    borderRadius: 8, color: "#e8e0d0", outline: "none", boxSizing: "border-box",
  },
  gold: {
    padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer",
    background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: "#080808",
  },
  ghost: {
    padding: "9px 14px", fontSize: 13, background: "transparent", border: `1px solid ${BORDER}`,
    borderRadius: 8, color: "#ccc", cursor: "pointer",
  },
  label: { fontSize: 10, color: GOLD_DIM, letterSpacing: 1, display: "block", marginBottom: 4 },
  err: {
    background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171",
    borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12,
  },
  ok: {
    background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399",
    borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12,
  },
};

const isFlag = (f) => f !== "Still on shift";
const flagStyle = (f) => {
  const base = { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid", whiteSpace: "nowrap" };
  if (f === "Still on shift") return { ...base, color: "#F59E0B", borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)" };
  if (/entered by HR/.test(f)) return { ...base, color: GOLD, borderColor: GOLD_DIM, background: "rgba(201,168,76,0.08)" };
  return { ...base, color: "#F87171", borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)" };
};

// ── root ─────────────────────────────────────────────────────────────────────
export default function HRPage() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [tab, setTab] = useState("shifts");

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={{ ...ui.page, display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>Loading...</div>;
  }
  if (!session) return <Login />;

  return (
    <div style={ui.page}>
      <div style={ui.wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>EasyCart HR</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: "#666" }}>{session.user.email}</div>
          <button style={ui.ghost} onClick={() => sb.auth.signOut()}>Log out</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["shifts", "Shifts"], ["staff", "Staff"]].map(([v, l]) => (
            <button
              key={v} onClick={() => setTab(v)}
              style={{ ...ui.ghost, ...(tab === v ? { borderColor: GOLD, color: GOLD, background: "rgba(201,168,76,0.08)" } : {}) }}
            >{l}</button>
          ))}
        </div>
        {tab === "shifts" ? <ShiftsTab /> : <StaffTab />}
      </div>
    </div>
  );
}

// ── login ────────────────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr("Wrong email or password.");
  }

  return (
    <div style={{ ...ui.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ ...ui.card, width: "100%", maxWidth: 360, padding: 24 }}>
        <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: GOLD, marginBottom: 4 }}>EasyCart HR</div>
        <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 20 }}>Attendance dashboard</div>
        {err && <div style={ui.err}>{err}</div>}
        <label style={ui.label}>EMAIL</label>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...ui.input, width: "100%", marginBottom: 14 }} />
        <label style={ui.label}>PASSWORD</label>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...ui.input, width: "100%", marginBottom: 18 }} />
        <button type="submit" disabled={busy || !email || !password} style={{ ...ui.gold, width: "100%", padding: 13, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ── shifts ───────────────────────────────────────────────────────────────────
function ShiftsTab() {
  const [from, setFrom] = useState(manilaDate(Date.now() - 6 * 864e5));
  const [to, setTo] = useState(manilaDate(Date.now()));
  const [staffFilter, setStaffFilter] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [logs, setLogs] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null);
  const [fix, setFix] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const start = new Date(`${from}T00:00:00+08:00`).getTime();
    const end = new Date(`${to}T00:00:00+08:00`).getTime();
    // Load a day of padding each side so shifts that cross midnight pair correctly.
    const { data, error } = await sb.rpc("attendance_hr_logs", {
      p_from: new Date(start - 864e5).toISOString(),
      p_to: new Date(end + 2 * 864e5).toISOString(),
    });
    if (error) {
      setErr(/forbidden/i.test(error.message) ? "This account has no HR access. Ask the owner to add it." : "Could not load logs.");
      setLoading(false);
      return;
    }
    setLogs(data || []);
    const paths = (data || []).filter((l) => l.selfie_path).map((l) => l.selfie_path);
    if (paths.length) {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
      const map = {};
      (signed || []).forEach((s) => { if (s.signedUrl) map[s.path] = s.signedUrl; });
      setUrls(map);
    } else {
      setUrls({});
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const staffOptions = useMemo(() => {
    const m = new Map();
    logs.forEach((l) => m.set(l.staff_id, l.staff_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const shifts = useMemo(
    () =>
      pairShifts(logs).filter(
        (s) =>
          s.date >= from && s.date <= to &&
          (!staffFilter || s.staff_id === staffFilter) &&
          (!flaggedOnly || s.flags.some(isFlag))
      ),
    [logs, from, to, staffFilter, flaggedOnly]
  );

  async function exportXlsx() {
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;
    const rows = shifts.map((s) => ({
      Staff: s.staff_name,
      "Shift date": s.date,
      "Clock in": s.inLog ? fmtDateTime(s.inLog.logged_at) : "",
      "Clock out": s.outLog ? fmtDateTime(s.outLog.logged_at) : "",
      Hours: s.hours == null ? "" : Number(s.hours.toFixed(2)),
      "In distance (m)": s.inLog && s.inLog.distance_m != null ? Math.round(s.inLog.distance_m) : "",
      "Out distance (m)": s.outLog && s.outLog.distance_m != null ? Math.round(s.outLog.distance_m) : "",
      Flags: s.flags.join("; "),
    }));
    const raw = logs
      .filter((l) => {
        const d = manilaDate(l.logged_at);
        return d >= from && d <= to && (!staffFilter || l.staff_id === staffFilter);
      })
      .map((l) => ({
        Staff: l.staff_name,
        Type: l.type === "in" ? "IN" : "OUT",
        "Server time (Manila)": fmtDateTime(l.logged_at),
        Latitude: l.lat ?? "",
        Longitude: l.lng ?? "",
        "Accuracy (m)": l.accuracy_m == null ? "" : Math.round(l.accuracy_m),
        "Distance from bar (m)": l.distance_m == null ? "" : Math.round(l.distance_m),
        "HR correction": l.is_correction ? "Yes" : "",
        Note: l.note || "",
      }));
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
    const ws2 = XLSX.utils.json_to_sheet(raw);
    ws2["!cols"] = [{ wch: 22 }, { wch: 6 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 13 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Shifts");
    XLSX.utils.book_append_sheet(wb, ws2, "Raw logs");
    XLSX.writeFile(wb, `attendance_${from}_to_${to}.xlsx`);
  }

  return (
    <div>
      <div style={{ ...ui.card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label style={ui.label}>FROM</label><input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} style={ui.input} /></div>
        <div><label style={ui.label}>TO</label><input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} style={ui.input} /></div>
        <div style={{ maxWidth: "100%" }}>
          <label style={ui.label}>STAFF</label>
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} style={{ ...ui.input, maxWidth: "100%" }}>
            <option value="">Everyone</option>
            {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <label style={{ fontSize: 13, color: "#ccc", display: "flex", alignItems: "center", gap: 6, paddingBottom: 10 }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} /> Flagged only
        </label>
        <div style={{ flex: 1 }} />
        <button style={ui.ghost} onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        <button style={{ ...ui.gold, opacity: shifts.length ? 1 : 0.5 }} disabled={!shifts.length} onClick={exportXlsx}>Export Excel</button>
      </div>

      {err && <div style={ui.err}>{err}</div>}
      {!err && !loading && shifts.length === 0 && (
        <div style={{ textAlign: "center", color: "#555", padding: 40, fontSize: 14 }}>No shifts in this range.</div>
      )}

      {shifts.map((s, i) => {
        const needsFix = !s.outLog || !s.inLog;
        return (
          <div key={`${s.staff_id}-${(s.inLog || s.outLog).id}-${i}`} style={ui.card}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.staff_name}</div>
              <div style={{ fontSize: 12, color: "#777" }}>{fmtDay(s.date)}</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{s.hours == null ? "-" : `${s.hours.toFixed(2)} h`}</div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <PunchBlock label="IN" log={s.inLog} urls={urls} onView={setView} />
              <PunchBlock label="OUT" log={s.outLog} urls={urls} onView={setView} />
            </div>
            {(s.flags.length > 0 || needsFix) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                {s.flags.map((f) => <span key={f} style={flagStyle(f)}>{f}</span>)}
                {needsFix && (
                  <button
                    style={{ ...ui.ghost, padding: "4px 10px", fontSize: 12, marginLeft: "auto" }}
                    onClick={() => setFix({
                      staff_id: s.staff_id, staff_name: s.staff_name, type: s.inLog ? "out" : "in",
                      after: s.inLog ? s.inLog.logged_at : null,     // an OUT must come after this IN
                      before: s.outLog ? s.outLog.logged_at : null,  // an IN must come before this OUT
                    })}
                  >Fix</button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {view && <PhotoModal log={view} url={urls[view.selfie_path]} onClose={() => setView(null)} />}
      {fix && <FixModal fix={fix} onClose={() => setFix(null)} onSaved={() => { setFix(null); load(); }} />}
    </div>
  );
}

function PunchBlock({ label, log, urls, onView }) {
  const box = { width: 64, height: 64, borderRadius: 8, background: SURFACE2, border: `1px solid ${BORDER}`, objectFit: "cover", flexShrink: 0 };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 170 }}>
      {log && log.selfie_path && urls[log.selfie_path] ? (
        <img src={urls[log.selfie_path]} alt="" loading="lazy" onClick={() => onView(log)} style={{ ...box, cursor: "pointer" }} />
      ) : (
        <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#555", textAlign: "center" }}>
          {log ? (log.is_correction ? "HR entry" : "No photo") : "-"}
        </div>
      )}
      <div>
        <div style={{ fontSize: 10, color: GOLD_DIM, letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{log ? fmtTime(log.logged_at) : "Missing"}</div>
        {log && log.distance_m != null && <div style={{ fontSize: 11, color: "#666" }}>{Math.round(log.distance_m)} m from bar</div>}
      </div>
    </div>
  );
}

function PhotoModal({ log, url, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: "100%" }}>
        {url ? <img src={url} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} /> : <div style={{ color: "#777" }}>Photo not available.</div>}
        <div style={{ ...ui.card, marginTop: 10, fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700 }}>{log.staff_name} - CLOCK {log.type.toUpperCase()}</div>
          <div>Server time: {fmtDateTime(log.logged_at)}</div>
          {log.lat != null
            ? <div>GPS: {log.lat.toFixed(5)}, {log.lng.toFixed(5)} (+/-{Math.round(log.accuracy_m)} m), {Math.round(log.distance_m)} m from bar</div>
            : <div style={{ color: "#F87171" }}>No GPS recorded</div>}
          {log.note && <div>Note: {log.note}</div>}
        </div>
        <button style={{ ...ui.ghost, width: "100%", marginTop: 4 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function FixModal({ fix, onClose, onSaved }) {
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!at) { setErr("Pick the date and time."); return; }
    if (note.trim().length < 3) { setErr("A note is required."); return; }
    const when = new Date(`${at}:00+08:00`);
    if (Number.isNaN(when.getTime())) { setErr("That date and time is not valid."); return; }
    if (fix.after && when <= ts(fix.after)) { setErr(`A clock-out must be after the clock-in (${fmtDateTime(fix.after)}).`); return; }
    if (fix.before && when >= ts(fix.before)) { setErr(`A clock-in must be before the clock-out (${fmtDateTime(fix.before)}).`); return; }
    setBusy(true); setErr("");
    const { error } = await sb.rpc("attendance_hr_add_correction", {
      p_staff: fix.staff_id, p_type: fix.type,
      p_at: when.toISOString(), p_note: note.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message || "Could not save."); return; }
    onSaved();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...ui.card, width: "100%", maxWidth: 380, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Add missing clock {fix.type.toUpperCase()}</div>
        <div style={{ fontSize: 12, color: "#777", marginBottom: 14 }}>{fix.staff_name}. The original logs stay as they are; this adds a marked HR entry.</div>
        {err && <div style={ui.err}>{err}</div>}
        <label style={ui.label}>CORRECT DATE AND TIME (MANILA)</label>
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} style={{ ...ui.input, width: "100%", marginBottom: 12 }} />
        <label style={ui.label}>REASON (REQUIRED)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Forgot to clock out, confirmed by manager" style={{ ...ui.input, width: "100%", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...ui.ghost, flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...ui.gold, flex: 1, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── staff ────────────────────────────────────────────────────────────────────
function StaffTab() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [isServer, setIsServer] = useState(false);
  const [flags, setFlags] = useState(null); // { staffId: true/false }, or null if attendance-servers.sql has not been run

  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("attendance_hr_staff");
    if (error) setErr(/forbidden/i.test(error.message) ? "This account has no HR access." : "Could not load staff.");
    else setRows(data || []);
    const f = await sb.rpc("attendance_hr_server_flags");
    if (f.error) { setFlags(null); } else {
      const m = {};
      (f.data || []).forEach((x) => { m[x.id] = !!x.is_server; });
      setFlags(m);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setErr(""); setOk("");
    const n = name.trim();
    if (!n) { setErr("Enter a name."); return; }
    if (rows.some((r) => r.name.trim().toLowerCase() === n.toLowerCase())) {
      if (!window.confirm(`A staff member named "${n}" already exists. Staff pick their name from a list, so two identical names will be confusing. Add anyway?`)) return;
    }
    setBusy(true);
    let error;
    if (flags) {
      ({ error } = await sb.rpc("attendance_hr_add_staff", { p_name: n, p_pin: pin, p_is_server: isServer }));
    } else if (isServer) {
      error = { message: "Server option is not set up yet. Run attendance-servers.sql in Supabase first." };
    } else {
      ({ error } = await sb.rpc("attendance_hr_create_staff", { p_name: n, p_pin: pin }));
    }
    setBusy(false);
    if (error) { setErr(error.message || "Could not add."); return; }
    setOk(`${n} added${isServer ? " as a server" : ""}. Give them their PIN privately.`);
    setName(""); setPin(""); setIsServer(false);
    load();
  }

  async function resetPin(r) {
    const p = window.prompt(`New 6-digit PIN for ${r.name}:`);
    if (!p) return;
    setErr(""); setOk("");
    const { error } = await sb.rpc("attendance_hr_set_pin", { p_staff: r.id, p_pin: p.trim() });
    if (error) setErr(error.message || "Could not reset PIN.");
    else setOk(`PIN reset for ${r.name}.`);
  }

  async function toggleServer(r) {
    setErr(""); setOk("");
    const next = !flags[r.id];
    const { error } = await sb.rpc("attendance_hr_set_server", { p_staff: r.id, p_server: next });
    if (error) setErr("Could not update.");
    else { setOk(next ? `${r.name} is now a server.` : `${r.name} is no longer a server.`); load(); }
  }

  async function toggle(r) {
    setErr(""); setOk("");
    const { error } = await sb.rpc("attendance_hr_set_active", { p_staff: r.id, p_active: !r.active });
    if (error) setErr("Could not update.");
    else load();
  }

  async function remove(r) {
    setErr(""); setOk("");
    if (!window.confirm(`Delete ${r.name}'s account?\n\nThis cannot be undone. If they have attendance records you will be asked again.`)) return;
    const first = await sb.rpc("attendance_hr_delete_staff", { p_staff: r.id, p_with_history: false });
    if (first.error) { setErr("Could not delete. The delete option may not be set up yet (run attendance-delete.sql in Supabase)."); return; }
    let res = first.data;
    if (res && res.ok === false && res.error === "has_history") {
      const typed = window.prompt(`${r.name} has ${res.logs} attendance record${res.logs === 1 ? "" : "s"}.\n\nTo keep the history, cancel and use Deactivate instead.\n\nTo delete the account AND all its records for good, type DELETE below.`);
      if (typed !== "DELETE") { setOk("Nothing was deleted."); return; }
      const second = await sb.rpc("attendance_hr_delete_staff", { p_staff: r.id, p_with_history: true });
      if (second.error) { setErr("Could not delete."); return; }
      res = second.data;
    }
    if (res && res.ok) { setOk(`${r.name} was deleted.`); load(); }
    else setErr("Could not delete.");
  }

  return (
    <div>
      <form onSubmit={add} style={{ ...ui.card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 180px" }}>
          <label style={ui.label}>NAME</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ ...ui.input, width: "100%" }} />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={ui.label}>6-DIGIT PIN</label>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="e.g. 482915" style={{ ...ui.input, width: "100%" }} />
        </div>
        {flags && (
          <label style={{ fontSize: 13, color: "#ccc", display: "flex", alignItems: "center", gap: 6, paddingBottom: 10 }}>
            <input type="checkbox" checked={isServer} onChange={(e) => setIsServer(e.target.checked)} /> Works as server
          </label>
        )}
        <button type="submit" disabled={busy} style={{ ...ui.gold, opacity: busy ? 0.6 : 1 }}>Add staff</button>
      </form>
      <div style={{ fontSize: 12, color: "#777", margin: "-2px 2px 12px", lineHeight: 1.5 }}>
        {flags
          ? "Tick \"Works as server\" for anyone who takes tables. They are added to the Server list automatically."
          : "Servers: type the name exactly as it appears in your Server list, so their tables link up."}
      </div>
      {err && <div style={ui.err}>{err}</div>}
      {ok && <div style={ui.ok}>{ok}</div>}
      {rows.length === 0 && !err && <div style={{ textAlign: "center", color: "#555", padding: 30, fontSize: 14 }}>No staff yet. Add the first one above.</div>}
      {rows.map((r) => (
        <div key={r.id} style={{ ...ui.card, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: r.active ? 1 : 0.55 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: r.active ? "#34D399" : "#777" }}>
              {r.active ? "Active" : "Inactive"}{flags && flags[r.id] ? " · Server" : ""}
            </div>
          </div>
          {flags && (
            <button style={{ ...ui.ghost, ...(flags[r.id] ? { borderColor: GOLD, color: GOLD } : {}) }} onClick={() => toggleServer(r)}>
              {flags[r.id] ? "Server ✓" : "Make server"}
            </button>
          )}
          <button style={ui.ghost} onClick={() => resetPin(r)}>Reset PIN</button>
          <button style={ui.ghost} onClick={() => toggle(r)}>{r.active ? "Deactivate" : "Activate"}</button>
          <button style={{ ...ui.ghost, color: "#F87171", borderColor: "rgba(248,113,113,0.35)" }} onClick={() => remove(r)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

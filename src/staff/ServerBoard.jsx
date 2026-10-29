// Admin > Server board: who is on duty, who covers which tables.
// Servers still pick their own tables on their own screen; the admin can do the same here.
// Both write to the same `server_assignments` table, so they always agree.
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, TABLE_LIST } from "./shared.js";

const GOLD = "#C9A84C", PINK = "#F472B6", GREEN = "#4ADE80", AMBER = "#F59E0B", RED = "#F87171";
const SURFACE = "#0F0F0F", ROW = "#151510", BORDER = "#241E10";

const btn = { padding: "5px 12px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "Inter,sans-serif" };
const fmtSince = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };

export default function ServerBoard() {
  const [servers, setServers] = useState([]);
  const [asg, setAsg] = useState([]);          // [{server_id, table_id}]
  const [duty, setDuty] = useState(null);      // { [server_id]: row } or null when server_duty() is not installed
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);   // server id whose table grid is open
  const [pick, setPick] = useState(null);         // unassigned table the admin tapped
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, a, d] = await Promise.all([
        supabase.from("servers").select("*").order("name"),
        supabase.from("server_assignments").select("server_id,table_id"),
        supabase.rpc("server_duty"),
      ]);
      if (s.error) throw s.error;
      if (a.error) throw a.error;
      setServers(s.data || []);
      setAsg(a.data || []);
      if (d.error || !Array.isArray(d.data)) setDuty(null);
      else { const m = {}; d.data.forEach((r) => { m[r.server_id] = r; }); setDuty(m); }
      setErr("");
    } catch (e) {
      setErr("Could not load the server board. Check the connection and tap Refresh.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const id = setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  const active = useMemo(() => servers.filter((s) => s.active), [servers]);
  const byId = useMemo(() => { const m = {}; servers.forEach((s) => { m[s.id] = s; }); return m; }, [servers]);
  const order = (t) => { const i = TABLE_LIST.indexOf(t); return i < 0 ? 999 : i; };

  // owners: table -> active servers that cover it
  const owners = useMemo(() => {
    const m = {};
    asg.forEach((r) => { const sv = byId[r.server_id]; if (sv && sv.active) (m[r.table_id] = m[r.table_id] || []).push(sv); });
    return m;
  }, [asg, byId]);
  const tablesOf = (id) => asg.filter((r) => r.server_id === id).map((r) => r.table_id).sort((x, y) => order(x) - order(y));
  const unassigned = TABLE_LIST.filter((t) => !(owners[t] && owners[t].length));
  const onDutyCount = duty ? active.filter((s) => duty[s.id] && duty[s.id].on_duty).length : null;

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { setErr("That did not save. Please try again."); }
    await load();
    setBusy(false);
  };

  const assign = (sv, t) => run(async () => {
    const r = await supabase.from("server_assignments").insert({ server_id: sv.id, table_id: t });
    if (r.error && r.error.code !== "23505") throw r.error;
  });
  const unassign = (sv, t) => run(async () => {
    const r = await supabase.from("server_assignments").delete().eq("server_id", sv.id).eq("table_id", t);
    if (r.error) throw r.error;
  });
  const move = (sv, t) => run(async () => {
    const d = await supabase.from("server_assignments").delete().eq("table_id", t).neq("server_id", sv.id);
    if (d.error) throw d.error;
    const r = await supabase.from("server_assignments").insert({ server_id: sv.id, table_id: t });
    if (r.error && r.error.code !== "23505") throw r.error;
  });
  const tapTable = (sv, t) => {
    const mine = tablesOf(sv.id).includes(t);
    if (mine) return unassign(sv, t);
    const others = (owners[t] || []).filter((o) => o.id !== sv.id);
    if (others.length === 0) return assign(sv, t);
    if (window.confirm(`${t} is covered by ${others.map((o) => o.name).join(", ")}.\nMove it to ${sv.name}?`)) return move(sv, t);
  };
  const toggleActive = (sv) => run(async () => {
    const r = await supabase.from("servers").update({ active: !sv.active }).eq("id", sv.id);
    if (r.error) throw r.error;
  });
  const remove = (sv) => {
    if (!window.confirm(`Remove "${sv.name}" for good?\n\nTheir table assignments are removed too. "Turn off" is safer, it keeps everything.`)) return;
    run(async () => {
      const r = await supabase.from("servers").delete().eq("id", sv.id);
      if (r.error) throw r.error;
      setEditing(null);
    });
  };
  const addName = () => {
    const n = newName.trim();
    if (!n) return;
    run(async () => {
      const r = await supabase.from("servers").insert({ name: n });
      if (r.error) throw r.error;
      setNewName("");
    });
  };

  const pill = (sv) => {
    if (!sv.active) return { t: "off", c: "#666", bg: "rgba(255,255,255,0.04)" };
    const d = duty && duty[sv.id];
    if (!duty) return null;
    if (!d || !d.linked) return { t: "no HR account", c: "#888", bg: "rgba(255,255,255,0.04)" };
    if (d.on_duty) return { t: `On duty${d.since ? " · since " + fmtSince(d.since) : ""}`, c: GREEN, bg: "rgba(74,222,128,0.10)" };
    return { t: "Not clocked in", c: AMBER, bg: "rgba(245,158,11,0.10)" };
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 11, color: PINK, letterSpacing: 1 }}>SERVER BOARD</div>
        <button onClick={load} disabled={busy} style={btn}>↻ Refresh</button>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
        Who is on duty and who covers which tables. Servers can pick their own tables on their screen; you can set or change them here.
        Add or remove staff in HR (tick “Works as server”).
      </div>

      {err && <div style={{ fontSize: 12, color: RED, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{err}</div>}

      {loaded && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {duty && <span style={{ fontSize: 12, color: GREEN, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 20, padding: "4px 12px" }}>On duty {onDutyCount} of {active.length}</span>}
          <span style={{ fontSize: 12, color: unassigned.length ? AMBER : GREEN, background: unassigned.length ? "rgba(245,158,11,0.08)" : "rgba(74,222,128,0.08)", border: `1px solid ${unassigned.length ? "rgba(245,158,11,0.25)" : "rgba(74,222,128,0.2)"}`, borderRadius: 20, padding: "4px 12px" }}>
            {unassigned.length ? `${unassigned.length} tables without a server` : "All tables covered"}
          </span>
        </div>
      )}

      {!loaded ? (
        <div style={{ fontSize: 13, color: "#555", padding: "12px 0" }}>Loading…</div>
      ) : servers.length === 0 ? (
        <div style={{ fontSize: 13, color: "#555", padding: "12px 0" }}>No servers yet. In HR, add staff and tick “Works as server”.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {servers.map((sv) => {
            const mine = tablesOf(sv.id);
            const p = pill(sv);
            const open = editing === sv.id;
            const d = duty && duty[sv.id];
            return (
              <div key={sv.id} style={{ background: ROW, border: `1px solid ${open ? PINK : BORDER}`, borderRadius: 10, padding: "10px 12px", opacity: sv.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, color: "#e8e0d0", fontWeight: 600 }}>{sv.name}</span>
                  {p && <span style={{ fontSize: 11, color: p.c, background: p.bg, borderRadius: 20, padding: "2px 10px" }}>{p.t}</span>}
                  <span style={{ flex: 1 }} />
                  {sv.active && <button onClick={() => { setEditing(open ? null : sv.id); setPick(null); }} style={{ ...btn, color: PINK, borderColor: "rgba(244,114,182,0.35)" }}>{open ? "Done" : "Edit tables"}</button>}
                  <button onClick={() => toggleActive(sv)} disabled={busy} style={btn}>{sv.active ? "Turn off" : "Turn on"}</button>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {mine.length === 0
                    ? <span style={{ fontSize: 12, color: "#555" }}>No tables yet</span>
                    : mine.map((t) => <span key={t} style={{ fontSize: 11.5, color: PINK, background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.3)", borderRadius: 6, padding: "2px 8px" }}>{t}</span>)}
                </div>
                {sv.active && d && d.linked && !d.on_duty && mine.length > 0 && (
                  <div style={{ fontSize: 11.5, color: AMBER, marginTop: 6 }}>⚠ Not clocked in but holds {mine.length} table{mine.length > 1 ? "s" : ""}. Reassign if they are not here.</div>
                )}

                {open && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11.5, color: "#777", marginBottom: 8 }}>
                      Tap a table to add or remove it. <span style={{ color: PINK }}>Pink</span> = {sv.name}. <span style={{ color: AMBER }}>Amber</span> = covered by someone else (tap to move it here).
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {TABLE_LIST.map((t) => {
                        const isMine = mine.includes(t);
                        const others = (owners[t] || []).filter((o) => o.id !== sv.id);
                        const c = isMine ? PINK : others.length ? AMBER : "#888";
                        return (
                          <button key={t} disabled={busy} onClick={() => tapTable(sv, t)} title={others.length ? "Covered by " + others.map((o) => o.name).join(", ") : ""}
                            style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "Inter,sans-serif", color: c, fontWeight: isMine ? 700 : 400,
                              background: isMine ? "rgba(244,114,182,0.15)" : "transparent", border: `1px solid ${isMine ? PINK : others.length ? "rgba(245,158,11,0.5)" : BORDER}` }}>
                            {t}{others.length > 0 && <span style={{ fontSize: 9.5, marginLeft: 4, opacity: 0.8 }}>{others[0].name.split(" ")[0]}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ textAlign: "right", marginTop: 10 }}>
                      <button onClick={() => remove(sv)} disabled={busy} style={{ ...btn, color: RED, borderColor: "rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)" }}>Remove server</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loaded && unassigned.length > 0 && active.length > 0 && (
        <div style={{ marginTop: 12, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: AMBER, letterSpacing: 1, marginBottom: 8 }}>TABLES WITHOUT A SERVER</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unassigned.map((t) => (
              <button key={t} onClick={() => setPick(pick === t ? null : t)}
                style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "Inter,sans-serif", color: pick === t ? "#150a10" : AMBER, background: pick === t ? AMBER : "transparent", border: "1px solid rgba(245,158,11,0.45)" }}>{t}</button>
            ))}
          </div>
          {pick && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Give <b style={{ color: "#e8e0d0" }}>{pick}</b> to:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...active].sort((a, b) => ((duty && duty[b.id] && duty[b.id].on_duty) ? 1 : 0) - ((duty && duty[a.id] && duty[a.id].on_duty) ? 1 : 0)).map((sv) => {
                  const on = duty && duty[sv.id] && duty[sv.id].on_duty;
                  return (
                    <button key={sv.id} disabled={busy} onClick={async () => { await assign(sv, pick); setPick(null); }}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontFamily: "Inter,sans-serif", color: on ? GREEN : "#bbb", background: "transparent", border: `1px solid ${on ? "rgba(74,222,128,0.4)" : BORDER}` }}>
                      {on ? "● " : ""}{sv.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>Add a name manually (not in HR)</summary>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} placeholder="Server's name…"
            onKeyDown={(e) => { if (e.key === "Enter") addName(); }}
            style={{ flex: 1, padding: "9px 12px", background: ROW, border: `1px solid ${BORDER}`, borderRadius: 9, color: "#e8e0d0", fontSize: 14, fontFamily: "Inter,sans-serif" }} />
          <button onClick={addName} disabled={busy} style={{ padding: "9px 16px", background: PINK, border: "none", borderRadius: 9, color: "#150a10", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Add</button>
        </div>
      </details>
    </div>
  );
}

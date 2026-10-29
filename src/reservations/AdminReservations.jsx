// "Reservations" tab inside the Admin panel (/?admin=1).
// Shows who booked what (name, phone, table, time), and lets staff mark Arrived / No-show / Cancel / Move table,
// add a booking taken by phone, and switch online reservations on or off.
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminPin, setAdminPin, clearAdminPin } from "./adminSession.js";
import {
  adminList, adminSet, adminMove, adminCreate, adminSetEnabled, getEnabled, getConfig,
  errText, fmtTime, fmtDateShort, fmtDateLong, fmtPhone, SLOTS,
} from "./api.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";

const STATUS = {
  booked: { text: "Booked", color: "#60A5FA" },
  arrived: { text: "Arrived", color: "#FBBF24" },
  no_show: { text: "No-show", color: "#F87171" },
  cancelled: { text: "Cancelled", color: "#777" },
  expired: { text: "Expired", color: "#A78BFA" },
};

const field = { padding: "10px 12px", fontSize: 14, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, color: "#e8e0d0", outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" };
const gold = { padding: "9px 14px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: "#080808", fontFamily: "Inter, sans-serif" };
const ghost = { padding: "8px 12px", fontSize: 12.5, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, color: "#ccc", cursor: "pointer", fontFamily: "Inter, sans-serif" };

const isoToday = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n, 12));
  return t.toISOString().slice(0, 10);
};
const monthEnd = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
};

export default function AdminReservations() {
  const [pin, setPin] = useState(getAdminPin());
  const [pinIn, setPinIn] = useState("");
  const [date, setDate] = useState(isoToday());
  const [range, setRange] = useState("day"); // day | month
  const [rows, setRows] = useState([]);
  const [tables, setTables] = useState([]);
  const [enabled, setEnabled] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(null);
  const [adding, setAdding] = useState(false);

  const from = date;
  const to = range === "day" ? date : monthEnd(date);

  const load = useCallback(async () => {
    if (!pin) return;
    setLoading(true);
    const r = await adminList(pin, from, to);
    setLoading(false);
    if (!r.ok) {
      if (r.error === "forbidden") { clearAdminPin(); setPin(""); setMsg("Wrong admin PIN."); }
      else setMsg(errText(r.error));
      return;
    }
    setMsg("");
    setRows(r.data || []);
  }, [pin, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!pin) return undefined;
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    return () => clearInterval(id);
  }, [pin, load]);
  useEffect(() => {
    (async () => {
      const [e, c] = await Promise.all([getEnabled(), getConfig()]);
      if (e.ok) setEnabled(e.data === true);
      if (c.ok) setTables(c.data.tables || []);
    })();
  }, []);

  async function act(fn, okMsg) {
    setMsg("");
    const r = await fn();
    if (!r.ok) { setMsg(r.error === "forbidden" ? "Wrong admin PIN." : errText(r.error)); if (r.error === "forbidden") { clearAdminPin(); setPin(""); } return false; }
    if (r.data && r.data.ok === false) { setMsg(errText(r.data.error)); return false; }
    if (okMsg) setMsg(okMsg);
    load();
    return true;
  }

  const counts = useMemo(() => {
    const c = { booked: 0, arrived: 0, no_show: 0, cancelled: 0, expired: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.guest_name, r.phone, r.code, r.table_id].some((x) => String(x).toLowerCase().includes(s)));
  }, [rows, q]);

  const byDate = useMemo(() => {
    const m = new Map();
    shown.forEach((r) => { if (!m.has(r.res_date)) m.set(r.res_date, []); m.get(r.res_date).push(r); });
    return [...m.entries()];
  }, [shown]);

  if (!pin) {
    return (
      <div style={{ maxWidth: 360, margin: "30px auto", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Admin PIN needed</div>
        <div style={{ fontSize: 12.5, color: "#777", marginBottom: 14 }}>Reservations include guests' phone numbers, so the PIN is checked again.</div>
        <input type="password" inputMode="numeric" maxLength={6} value={pinIn} onChange={(e) => setPinIn(e.target.value.replace(/\D/g, ""))} placeholder="••••••"
          style={{ ...field, width: "100%", textAlign: "center", letterSpacing: 6, fontSize: 20, marginBottom: 12 }} />
        <button style={{ ...gold, width: "100%", padding: 12 }} disabled={pinIn.length < 6} onClick={() => { setAdminPin(pinIn); setPin(pinIn); setPinIn(""); }}>Open</button>
        {msg && <div style={{ color: "#F87171", fontSize: 13, marginTop: 10 }}>{msg}</div>}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* online switch */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Online reservations: <span style={{ color: enabled ? "#34D399" : "#F87171" }}>{enabled === null ? "…" : enabled ? "ON" : "OFF"}</span></div>
          <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>When ON, guests see "Reserve a Table" on the landing page.</div>
        </div>
        <button style={ghost} disabled={enabled === null} onClick={async () => { const ok = await act(() => adminSetEnabled(pin, !enabled)); if (ok) setEnabled(!enabled); }}>
          {enabled ? "Turn OFF" : "Turn ON"}
        </button>
      </div>

      {/* date controls */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button style={ghost} onClick={() => setDate(addDays(date, range === "day" ? -1 : -30))} aria-label="Previous">←</button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
        <button style={ghost} onClick={() => setDate(addDays(date, range === "day" ? 1 : 30))} aria-label="Next">→</button>
        <button style={ghost} onClick={() => setDate(isoToday())}>Today</button>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}` }}>
          {[["day", "Day"], ["month", "To month end"]].map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} style={{ padding: "8px 12px", border: "none", fontSize: 12.5, cursor: "pointer", background: range === k ? "rgba(201,168,76,0.15)" : "transparent", color: range === k ? GOLD : "#999", fontFamily: "Inter, sans-serif" }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button style={gold} onClick={() => setAdding(true)}>+ New booking</button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, margin: "4px 2px 8px" }}>
        {range === "day" ? fmtDateLong(date) : `${fmtDateShort(date)} to ${fmtDateShort(to)}`}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {Object.entries(STATUS).map(([k, v]) => (
          <span key={k} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: `1px solid ${v.color}55`, color: v.color }}>{v.text} {counts[k] || 0}</span>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, code or table" style={{ ...field, width: "100%", marginBottom: 12 }} />

      {msg && <div role="status" style={{ background: "rgba(201,168,76,0.08)", border: `1px solid ${GOLD_DIM}`, color: GOLD_LIGHT, borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      {loading && rows.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: 30 }}>Loading…</div>}
      {!loading && shown.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: 36, fontSize: 14 }}>No reservations {q ? "match your search" : "for this period"}.</div>}

      {byDate.map(([d, list]) => (
        <div key={d} style={{ marginBottom: 14 }}>
          {range === "month" && <div style={{ fontSize: 12, color: GOLD, letterSpacing: 1, margin: "6px 2px" }}>{fmtDateShort(d).toUpperCase()}</div>}
          {list.map((r) => {
            const st = STATUS[r.status] || STATUS.booked;
            const live = r.status === "booked";
            return (
              <div key={r.id} data-testid="res-row" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${st.color}`, borderRadius: 12, padding: 12, marginBottom: 8, opacity: r.status === "cancelled" ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 78, fontSize: 17, fontWeight: 800, color: GOLD_LIGHT }}>{r.table_id}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtTime(r.res_time)}</div>
                  <div style={{ fontSize: 12.5, color: "#999" }}>{r.guests} guests</div>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: st.color, border: `1px solid ${st.color}55`, borderRadius: 999, padding: "3px 10px" }}>{st.text}</span>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 14, alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{r.guest_name}</span>
                  <a href={`tel:${r.phone}`} style={{ color: "#8ab4ff", textDecoration: "none" }}>{fmtPhone(r.phone)}</a>
                  <span style={{ fontFamily: "monospace", color: "#777", fontSize: 12.5 }}>#{r.code}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {(live || r.status === "expired") && <button style={{ ...ghost, borderColor: "#FBBF2466", color: "#FBBF24" }} onClick={() => act(() => adminSet(pin, r.id, "arrived"))}>Arrived</button>}
                  {live && <button style={{ ...ghost, color: "#F87171" }} onClick={() => act(() => adminSet(pin, r.id, "no_show"))}>No-show</button>}
                  {live && <button style={ghost} onClick={() => setMoving(r)}>Move table</button>}
                  {live && <button style={ghost} onClick={() => { if (window.confirm(`Cancel ${r.guest_name}'s booking for ${r.table_id}?`)) act(() => adminSet(pin, r.id, "cancelled")); }}>Cancel</button>}
                  {!live && r.status !== "expired" && <button style={ghost} onClick={() => act(() => adminSet(pin, r.id, "booked"), "Booking restored.")}>Undo</button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {moving && <MoveDialog row={moving} tables={tables} onClose={() => setMoving(null)} onMove={async (t) => { const ok = await act(() => adminMove(pin, moving.id, t), `Moved to ${t}.`); if (ok) setMoving(null); }} />}
      {adding && <NewBooking tables={tables} defaultDate={date} onClose={() => setAdding(false)} onSave={async (b) => { const ok = await act(() => adminCreate(pin, b), "Booking added."); if (ok) setAdding(false); }} />}
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function MoveDialog({ row, tables, onClose, onMove }) {
  const [t, setT] = useState("");
  return (
    <Modal onClose={onClose} title={`Move ${row.guest_name}`}>
      <div style={{ fontSize: 13, color: "#999", marginBottom: 10 }}>Now on {row.table_id} · {row.guests} guests</div>
      <select value={t} onChange={(e) => setT(e.target.value)} style={{ ...field, width: "100%", marginBottom: 14 }}>
        <option value="">Choose a table…</option>
        {tables.filter((x) => x.table_id !== row.table_id && x.capacity >= row.guests).map((x) => <option key={x.table_id} value={x.table_id}>{x.label} (up to {x.capacity})</option>)}
      </select>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...ghost, flex: 1 }} onClick={onClose}>Back</button>
        <button style={{ ...gold, flex: 1, opacity: t ? 1 : 0.4 }} disabled={!t} onClick={() => onMove(t)}>Move</button>
      </div>
    </Modal>
  );
}

function NewBooking({ tables, defaultDate, onClose, onSave }) {
  const [b, setB] = useState({ date: defaultDate < isoToday() ? isoToday() : defaultDate, time: "19:00", table: "", name: "", phone: "", guests: 2 });
  const set = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const ok = b.table && b.name.trim().length >= 2 && b.phone.replace(/\D/g, "").length >= 10 && b.guests >= 1;
  return (
    <Modal onClose={onClose} title="New booking (phone / walk-up)">
      <div style={{ display: "grid", gap: 10 }}>
        <input type="date" value={b.date} min={isoToday()} onChange={(e) => e.target.value && set("date", e.target.value)} style={{ ...field, colorScheme: "dark" }} />
        <select value={b.time} onChange={(e) => set("time", e.target.value)} style={field}>{SLOTS.map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}</select>
        <select value={b.table} onChange={(e) => set("table", e.target.value)} style={field}>
          <option value="">Table…</option>
          {tables.filter((t) => t.capacity >= b.guests).map((t) => <option key={t.table_id} value={t.table_id}>{t.label} (up to {t.capacity})</option>)}
        </select>
        <input type="number" min={1} max={15} value={b.guests} onChange={(e) => set("guests", Math.max(1, Math.min(15, Number(e.target.value) || 1)))} style={field} placeholder="Guests" />
        <input value={b.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Guest name" style={field} />
        <input value={b.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d+ ]/g, ""))} inputMode="tel" placeholder="Mobile number" style={field} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={{ ...ghost, flex: 1 }} onClick={onClose}>Back</button>
        <button style={{ ...gold, flex: 1, opacity: ok ? 1 : 0.4 }} disabled={!ok} onClick={() => onSave(b)}>Save booking</button>
      </div>
    </Modal>
  );
}

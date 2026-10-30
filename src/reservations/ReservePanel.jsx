// Full-screen "Reserve a Table" flow, opened from the landing page.
// Guest picks date, time, group size, name + phone, then taps a table.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FloorPlan from "./FloorPlan.jsx";
import { TABLES } from "./floorplanData.js";
import {
  getConfig, getTaken, createReservation, lookupReservation, cancelReservation,
  errText, fmtTime, fmtDateLong, fmtPhone, peso, SLOTS,
} from "./api.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";
const FONT = "Inter, system-ui, sans-serif";
const SERIF = "'Playfair Display', serif";

const card = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, marginBottom: 14 };
const label = { display: "block", fontSize: 11, color: GOLD_DIM, letterSpacing: 1.2, fontWeight: 600, marginBottom: 7 };
const field = {
  width: "100%", padding: "13px 14px", fontSize: 16, background: SURFACE2, border: `1px solid ${BORDER}`,
  borderRadius: 10, color: "#e8e0d0", outline: "none", boxSizing: "border-box", fontFamily: FONT,
};
const goldBtn = {
  width: "100%", padding: 15, fontSize: 16, fontWeight: 700, border: "none", borderRadius: 12, cursor: "pointer",
  background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: "#080808", fontFamily: FONT,
};
const ghostBtn = {
  width: "100%", padding: 13, fontSize: 14, background: "transparent", border: `1px solid ${BORDER}`,
  borderRadius: 12, color: "#bbb", cursor: "pointer", fontFamily: FONT,
};

function normPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return "0" + d.slice(2);
  if (/^9\d{9}$/.test(d)) return "0" + d;
  return null;
}
const todayStr = (cfg) => (cfg ? cfg.min_date : "");

export default function ReservePanel({ onClose }) {
  const [cfg, setCfg] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [floor, setFloor] = useState(1);
  const [taken, setTaken] = useState({});
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [manage, setManage] = useState(false);
  const scroller = useRef(null);

  // ── load config (dates, tables, prices) ──
  useEffect(() => {
    let dead = false;
    (async () => {
      const r = await getConfig();
      if (dead) return;
      if (!r.ok) { setLoadErr(errText("network")); return; }
      setCfg(r.data);
      setDate(r.data.min_date);
    })();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !confirming) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, confirming]);

  // ── which tables are taken on the chosen date (refresh every 30s while visible) ──
  const loadTaken = useCallback(async () => {
    if (!date) return;
    const r = await getTaken(date);
    if (!r.ok) return;
    const m = {};
    (r.data || []).forEach((x) => { m[x.table_id] = x.status; });
    setTaken(m);
  }, [date]);
  useEffect(() => {
    setSelected("");
    loadTaken();
    const id = setInterval(() => { if (document.visibilityState === "visible") loadTaken(); }, 30000);
    return () => clearInterval(id);
  }, [loadTaken]);

  const info = useMemo(() => {
    const m = {};
    (cfg?.tables || []).forEach((t) => { m[t.table_id] = t; });
    return m;
  }, [cfg]);
  const capacity = useMemo(() => {
    const m = {};
    Object.values(info).forEach((t) => { m[t.table_id] = t.capacity; });
    return m;
  }, [info]);

  const slotPast = (slot) => cfg && date === cfg.min_date && `${date}T${slot}:00` <= cfg.now;
  useEffect(() => { if (time && slotPast(time)) setTime(""); }, [date, cfg]); // eslint-disable-line

  const phoneOk = !!normPhone(phone);
  const nameOk = name.trim().length >= 2;
  const detailsOk = !!date && !!time && nameOk && phoneOk && guests >= 1;
  const sel = selected ? info[selected] : null;

  function pick(id) {
    setErr("");
    if (taken[id]) { setErr(`${info[id]?.label || id} is already ${taken[id] === "arrived" ? "taken" : "reserved"} for that date. Pick another table.`); return; }
    if (info[id] && info[id].capacity < guests) { setErr(`${info[id].label} fits up to ${info[id].capacity} guests. Pick a bigger table or change your group size.`); return; }
    setSelected(id);
  }

  async function submit() {
    setBusy(true); setErr("");
    const r = await createReservation({ date, time, table: selected, name: name.trim(), phone, guests });
    setBusy(false);
    if (!r.ok) { setConfirming(false); setErr(errText(r.error)); return; }
    if (!r.data.ok) {
      setConfirming(false);
      setErr(errText(r.data.error));
      if (r.data.error === "taken") { setSelected(""); loadTaken(); }
      return;
    }
    setConfirming(false);
    setDone({ ...r.data, name: name.trim(), phone });
    if (scroller.current) scroller.current.scrollTop = 0;
  }

  const holdMin = cfg?.hold_minutes || 30;
  const autoRel = cfg?.auto_release !== false;
  const holdNote = (t) => {
    if (!autoRel) return "Please arrive on time. If you will be late, call or message us so we can keep your table.";
    if (!t) return `Your table is held for ${holdMin} minutes after your reservation time. After that it may be released to other guests.`;
    const [h, m] = t.split(":").map(Number);
    const end = h * 60 + m + holdMin;
    return `Your table is held for ${holdMin} minutes after your reservation time (${fmtTime(t)} → until ${fmtTime(`${Math.floor(end / 60) % 24}:${String(end % 60).padStart(2, "0")}`)}). After that it may be released to other guests.`;
  };

  // ── shell ──
  const shell = (children) => (
    <div ref={scroller} role="dialog" aria-modal="true" aria-label="Reserve a table"
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: BG, color: "#e8e0d0", overflowY: "auto", fontFamily: FONT, WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 120px" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(8,8,8,0.96)", display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${BORDER}`, marginBottom: 18 }}>
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, color: GOLD, fontSize: 20, cursor: "pointer" }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 900, color: GOLD, lineHeight: 1.1 }}>Reserve a Table</div>
            <div style={{ fontSize: 11.5, color: "#777", marginTop: 2 }}>EasyCart Barcade & Lounge</div>
          </div>
          {!done && cfg?.enabled && <button onClick={() => setManage(true)} style={{ background: "none", border: "none", color: GOLD, fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: FONT }}>My booking</button>}
        </div>
        {children}
      </div>
      {manage && <ManageBooking onClose={() => setManage(false)} onChanged={loadTaken} />}
    </div>
  );

  if (loadErr) return shell(<div style={{ ...card, textAlign: "center", color: "#F87171" }}>{loadErr}<button style={{ ...ghostBtn, marginTop: 14 }} onClick={onClose}>Back</button></div>);
  if (!cfg) return shell(<div style={{ textAlign: "center", color: "#555", padding: 60 }}>Loading…</div>);
  if (!cfg.enabled) return shell(
    <div style={{ ...card, textAlign: "center", padding: 28 }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🥂</div>
      <div style={{ fontFamily: SERIF, fontSize: 20, marginBottom: 8 }}>Online reservations open soon</div>
      <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6, marginBottom: 18 }}>For now, please ask our staff to reserve a table for you.</div>
      <button style={ghostBtn} onClick={onClose}>Back</button>
    </div>
  );

  // ── booked! ──
  if (done) {
    const t = info[done.table_id];
    return shell(
      <div className="slide-up">
        <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 12px", background: "rgba(52,211,153,0.12)", border: "2px solid #34D399", color: "#34D399", fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
          <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 900 }}>You're booked!</div>
          <div style={{ fontSize: 13.5, color: "#888", marginTop: 4 }}>See you at EasyCart, {done.name.split(" ")[0]}.</div>
        </div>
        <div style={{ ...card, textAlign: "center", marginTop: 16, border: `1px solid ${GOLD_DIM}`, background: "rgba(201,168,76,0.05)" }}>
          <div style={{ fontSize: 11, color: GOLD_DIM, letterSpacing: 2 }}>BOOKING CODE</div>
          <div data-testid="booking-code" style={{ fontFamily: "'Courier New', monospace", fontSize: 42, fontWeight: 800, letterSpacing: 8, color: GOLD_LIGHT, margin: "6px 0 4px" }}>{done.code}</div>
          <div style={{ fontSize: 12, color: "#888" }}>Take a screenshot. You need this code and the last 4 digits of your phone to change or cancel.</div>
        </div>
        <div style={card}>
          {[["Table", t ? `${t.label} · up to ${t.capacity} guests` : done.table_id], ["Date", fmtDateLong(done.res_date)], ["Arrival", fmtTime(done.res_time)], ["Guests", String(done.guests)], ["Name", done.name], ["Phone", fmtPhone(normPhone(done.phone) || done.phone)]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "9px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 14 }}>
              <span style={{ color: "#777" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
            </div>
          ))}
          {t && <div style={{ fontSize: 13, color: "#aaa", marginTop: 12 }}>{peso(t.consumable)} consumable{t.note ? ` · ${t.note}` : ""}</div>}
        </div>
        <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, padding: "13px 15px", fontSize: 13.5, color: "#e9c27a", lineHeight: 1.6, marginBottom: 16 }}>
          ⏱ {holdNote(done.res_time)}
        </div>
        <button style={goldBtn} onClick={onClose}>Done</button>
        <button style={{ ...ghostBtn, marginTop: 10 }} onClick={() => { setDone(null); setSelected(""); setTime(""); loadTaken(); }}>Book another table</button>
      </div>
    );
  }

  // ── booking form ──
  const slots = SLOTS.map((s) => ({ s, off: slotPast(s) }));
  const firstFree = slots.find((x) => !x.off);
  const missing = !date ? "Pick a date" : !time ? "Pick an arrival time" : !nameOk ? "Enter your name" : !phoneOk ? "Enter a valid mobile number" : !selected ? "Tap a table on the plan" : "";

  return shell(
    <>
      <div style={card}>
        <div style={{ fontSize: 13, color: "#999", lineHeight: 1.6, marginBottom: 14 }}>
          Reserve any day from today until <b style={{ color: GOLD }}>{fmtDateLong(cfg.max_date).replace(/, \d{4}$/, "")}</b>. Reservations accepted from 6 PM to 10:30 PM.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <div>
            <label style={label} htmlFor="rs-date">DATE</label>
            <input id="rs-date" type="date" value={date} min={cfg.min_date} max={cfg.max_date}
              onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
            <div style={{ fontSize: 12, color: GOLD, marginTop: 6 }}>{date ? fmtDateLong(date) : ""}</div>
          </div>
          <div>
            <label style={label}>GUESTS</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" aria-label="Fewer guests" onClick={() => setGuests((g) => Math.max(1, g - 1))} style={{ ...field, width: 50, padding: 12, cursor: "pointer", fontWeight: 700 }}>−</button>
              <div data-testid="guests" style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 700 }}>{guests}</div>
              <button type="button" aria-label="More guests" onClick={() => setGuests((g) => Math.min(15, g + 1))} style={{ ...field, width: 50, padding: 12, cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={label}>ARRIVAL TIME</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 8 }}>
            {slots.map(({ s, off }) => (
              <button key={s} type="button" disabled={off} onClick={() => setTime(s)} aria-pressed={time === s}
                style={{ padding: "11px 4px", fontSize: 13.5, fontWeight: 600, borderRadius: 10, cursor: off ? "not-allowed" : "pointer", fontFamily: FONT,
                  background: time === s ? `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})` : SURFACE2, color: time === s ? "#080808" : off ? "#444" : "#ddd",
                  border: `1px solid ${time === s ? GOLD : BORDER}`, opacity: off ? 0.45 : 1 }}>{fmtTime(s)}</button>
            ))}
          </div>
          {!firstFree && <div style={{ fontSize: 12.5, color: "#F59E0B", marginTop: 8 }}>No arrival times left today. Pick another date.</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 16 }}>
          <div>
            <label style={label} htmlFor="rs-name">YOUR NAME</label>
            <input id="rs-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juan Dela Cruz" autoComplete="name" style={field} />
          </div>
          <div>
            <label style={label} htmlFor="rs-phone">MOBILE NUMBER</label>
            <input id="rs-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} inputMode="tel" placeholder="0917 123 4567" autoComplete="tel"
              style={{ ...field, borderColor: phone && !phoneOk ? "#7f1d1d" : BORDER }} />
            <div style={{ fontSize: 11.5, color: "#666", marginTop: 5 }}>Staff may call you to confirm.</div>
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, margin: "2px 4px 10px" }}>Choose your table</div>
        <FloorPlan floor={floor} onFloorChange={setFloor} status={taken} selected={selected} onPick={pick} capacity={capacity} minGuests={guests} />
        <div style={{ fontSize: 12, color: "#666", margin: "14px 4px 8px" }}>Or pick from the list</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {TABLES.map((t) => {
            const i = info[t.id]; if (!i) return null;
            const state = taken[t.id] ? "x" : i.capacity < guests ? "small" : "ok";
            return (
              <button key={t.id} type="button" onClick={() => { setFloor(t.floor); pick(t.id); }} aria-pressed={selected === t.id}
                style={{ padding: "8px 11px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: state === "ok" ? "pointer" : "not-allowed", fontFamily: FONT,
                  background: selected === t.id ? `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})` : SURFACE2,
                  color: selected === t.id ? "#080808" : state === "ok" ? "#9be8c6" : state === "x" ? "#f19a9a" : "#555",
                  border: `1px solid ${selected === t.id ? GOLD : state === "ok" ? "rgba(52,211,153,0.35)" : state === "x" ? "rgba(248,113,113,0.35)" : BORDER}`,
                  textDecoration: state === "x" ? "line-through" : "none", opacity: state === "small" ? 0.5 : 1 }}>{i.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ ...card, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.25)", color: "#e1be7d", fontSize: 13, lineHeight: 1.6 }}>
        ⏱ {autoRel ? <>Your table is held for <b>{holdMin} minutes</b> after your reservation time. After that it may be released to other guests.</> : "Please arrive on time. If you will be late, call or message us so we can keep your table."}
        Prices are consumable amounts (what you spend on food and drinks).
      </div>

      {err && <div role="alert" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", color: "#F87171", borderRadius: 12, padding: "12px 14px", fontSize: 14, marginBottom: 14 }}>{err}</div>}

      {/* sticky reserve bar */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20, background: "rgba(8,8,8,0.97)", borderTop: `1px solid ${BORDER}`, padding: "12px 16px calc(12px + env(safe-area-inset-bottom,0px))" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {sel ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: GOLD_LIGHT }}>{sel.label}</div>
                <div style={{ fontSize: 12, color: "#999", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{peso(sel.consumable)} consumable · up to {sel.capacity} guests</div>
              </>
            ) : <div style={{ fontSize: 13, color: "#777" }}>{missing || "Ready"}</div>}
          </div>
          <button disabled={!detailsOk || !selected} onClick={() => { setErr(""); setConfirming(true); }}
            style={{ ...goldBtn, width: "auto", padding: "13px 26px", opacity: detailsOk && selected ? 1 : 0.4, cursor: detailsOk && selected ? "pointer" : "not-allowed" }}>Reserve</button>
        </div>
        {sel && missing && missing !== "Tap a table on the plan" && <div style={{ maxWidth: 760, margin: "6px auto 0", fontSize: 12, color: "#F59E0B" }}>{missing} to continue.</div>}
      </div>

      {confirming && sel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2100, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }} onClick={() => !busy && setConfirming(false)}>
          <div className="slide-up" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: SURFACE, border: `1px solid ${GOLD_DIM}`, borderRadius: 20, padding: 22, marginBottom: "env(safe-area-inset-bottom,0px)" }}>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Confirm reservation</div>
            <div style={{ fontSize: 14, color: "#aaa", marginBottom: 14 }}>Table <b style={{ color: GOLD_LIGHT }}>{sel.label}</b> · {peso(sel.consumable)} consumable</div>
            {[["Date", fmtDateLong(date)], ["Arrival", fmtTime(time)], ["Guests", `${guests} (table fits ${sel.capacity})`], ["Name", name.trim()], ["Phone", fmtPhone(normPhone(phone))]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 14 }}>
                <span style={{ color: "#777" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
            {sel.note && <div style={{ fontSize: 12.5, color: "#999", marginTop: 10 }}>{sel.note}</div>}
            <div style={{ fontSize: 12.5, color: "#e1be7d", background: "rgba(245,158,11,0.07)", borderRadius: 10, padding: "10px 12px", margin: "14px 0", lineHeight: 1.55 }}>⏱ {holdNote(time)}</div>
            <button style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>{busy ? "Booking…" : "Confirm reservation"}</button>
            <button style={{ ...ghostBtn, marginTop: 10 }} disabled={busy} onClick={() => setConfirming(false)}>Go back</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── look up / cancel a booking with its code ──
function ManageBooking({ onClose, onChanged }) {
  const [code, setCode] = useState("");
  const [p4, setP4] = useState("");
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  async function find(e) {
    e.preventDefault();
    setBusy(true); setMsg(""); setRes(null); setSure(false);
    const r = await lookupReservation(code, p4);
    setBusy(false);
    if (!r.ok) setMsg(errText("network"));
    else if (!r.data.ok) setMsg(errText(r.data.error));
    else setRes(r.data);
  }
  async function cancel() {
    setBusy(true);
    const r = await cancelReservation(code, p4);
    setBusy(false);
    if (!r.ok) { setMsg(errText("network")); return; }
    if (!r.data.ok) { setMsg(errText(r.data.error)); return; }
    setRes({ ...res, status: "cancelled" }); setSure(false); onChanged && onChanged();
  }
  const statusText = { booked: "Booked", arrived: "Arrived", no_show: "Marked no-show", cancelled: "Cancelled", expired: "Expired (the 30-minute hold ran out)" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2100, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="slide-up" style={{ width: "100%", maxWidth: 400, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 22, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 900, marginBottom: 12 }}>My booking</div>
        <form onSubmit={find}>
          <label style={label} htmlFor="mb-code">BOOKING CODE</label>
          <input id="mb-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="e.g. K7M2QX" style={{ ...field, letterSpacing: 4, textAlign: "center", fontWeight: 700, marginBottom: 12 }} />
          <label style={label} htmlFor="mb-p4">LAST 4 DIGITS OF YOUR PHONE</label>
          <input id="mb-p4" value={p4} inputMode="numeric" onChange={(e) => setP4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" style={{ ...field, letterSpacing: 6, textAlign: "center", marginBottom: 14 }} />
          <button type="submit" disabled={busy || code.length < 6 || p4.length < 4} style={{ ...goldBtn, opacity: busy || code.length < 6 || p4.length < 4 ? 0.45 : 1 }}>{busy ? "Looking…" : "Find my booking"}</button>
        </form>
        {msg && <div role="alert" style={{ marginTop: 12, fontSize: 13.5, color: "#F87171" }}>{msg}</div>}
        {res && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: GOLD_LIGHT }}>{res.table_id}</div>
            <div style={{ fontSize: 14, color: "#ccc", margin: "4px 0" }}>{fmtDateLong(res.res_date)} · {fmtTime(res.res_time)}</div>
            <div style={{ fontSize: 13.5, color: "#999" }}>{res.guests} guests · {res.name}</div>
            <div data-testid="manage-status" style={{ fontSize: 13, marginTop: 8, color: res.status === "booked" ? "#34D399" : "#F59E0B" }}>{statusText[res.status] || res.status}</div>
            {res.status === "booked" && !sure && <button style={{ ...ghostBtn, marginTop: 12, color: "#F87171", borderColor: "rgba(248,113,113,0.4)" }} onClick={() => setSure(true)}>Cancel this booking</button>}
            {res.status === "booked" && sure && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13.5, marginBottom: 8 }}>Cancel this reservation?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...ghostBtn, flex: 1 }} onClick={() => setSure(false)}>Keep it</button>
                  <button style={{ ...goldBtn, flex: 1, padding: 12, fontSize: 14, background: "#B91C1C", color: "#fff" }} disabled={busy} onClick={cancel}>Yes, cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        <button style={{ ...ghostBtn, marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

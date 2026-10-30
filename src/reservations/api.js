// All reservation calls go through database functions (see supabase/reservations.sql).
// The browser never reads the reservation tables directly.
import { supabase } from "../lib/supabase.js";

const withTimeout = (p, ms = 12000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function rpc(fn, args) {
  try {
    const { data, error } = await withTimeout(supabase.rpc(fn, args));
    if (error) return { ok: false, error: /forbidden/i.test(error.message || "") ? "forbidden" : "network" };
    return { ok: true, data };
  } catch (_) {
    return { ok: false, error: "network" };
  }
}

export const getConfig = () => rpc("reservation_public_config");
export const getTaken = (date) => rpc("reservation_taken", { p_date: date });
export const createReservation = ({ date, time, table, name, phone, guests }) =>
  rpc("reservation_create", { p_date: date, p_time: time, p_table: table, p_name: name, p_phone: phone, p_guests: guests });
export const lookupReservation = (code, phone4) => rpc("reservation_lookup", { p_code: code, p_phone4: phone4 });
export const cancelReservation = (code, phone4) => rpc("reservation_cancel", { p_code: code, p_phone4: phone4 });

export const adminList = (pin, from, to) => rpc("reservation_admin_list", { p_pin: pin, p_from: from, p_to: to });
export const adminSet = (pin, id, status, note = null) => rpc("reservation_admin_set", { p_pin: pin, p_id: id, p_status: status, p_note: note });
export const adminMove = (pin, id, table) => rpc("reservation_admin_move", { p_pin: pin, p_id: id, p_table: table });
export const adminCreate = (pin, b) =>
  rpc("reservation_admin_create", { p_pin: pin, p_date: b.date, p_time: b.time, p_table: b.table, p_name: b.name, p_phone: b.phone, p_guests: b.guests });
export const adminSetEnabled = (pin, on) => rpc("reservation_admin_set_enabled", { p_pin: pin, p_enabled: on });
export const getEnabled = () => rpc("reservation_enabled");
export const getAutoRelease = () => rpc("reservation_auto_release");
export const adminSetAutoRelease = (pin, on) => rpc("reservation_admin_set_auto_release", { p_pin: pin, p_on: on });

export const ERROR_TEXT = {
  disabled: "Online reservations are not open right now.",
  name: "Please enter your name (2 to 40 letters).",
  phone: "Enter a valid mobile number, for example 0917 123 4567.",
  table: "That table is not available for booking.",
  guests: "That table is too small for your group. Pick a bigger one.",
  date: "Reservations are open from today until the end of this month.",
  time: "Pick an arrival time between 6:00 PM and 10:30 PM.",
  past: "That time has already passed. Pick a later time.",
  taken: "Someone just reserved that table. Please pick another one.",
  limit: "You already have 2 active reservations. Please use or cancel one first.",
  slow: "You are booking too fast. Please wait a few minutes.",
  busy: "We are busy right now. Please try again in a moment.",
  network: "Connection problem. Please check your internet and try again.",
  notfound: "We could not find that booking. Check the code and the last 4 digits of your phone.",
  not_cancellable: "This booking can no longer be cancelled here. Please talk to our staff.",
  forbidden: "Wrong admin PIN.",
  capacity: "That table is too small for this group.",
};

export const errText = (code) => ERROR_TEXT[code] || "Something went wrong. Please try again.";

// ---- formatting helpers ----
export function fmtTime(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}
export function fmtDateLong(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function fmtDateShort(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
export function fmtPhone(p) {
  const s = String(p || "");
  return /^09\d{9}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}` : s;
}
export const peso = (n) => "₱" + Number(n).toLocaleString("en-US");
export const SLOTS = (() => {
  const out = [];
  for (let h = 18; h <= 22; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return out; // 18:00 ... 22:30
})();

// Shared helpers for the attendance module (new file, touches nothing existing).
export const BUCKET = "attendance-selfies";
export const TZ = "Asia/Manila";
export const MAX_DISTANCE_M = 150;   // logs farther than this get flagged
export const OPEN_SHIFT_HOURS = 14;  // keep in sync with the 14 hours in attendance.sql

// Server timestamps carry microseconds ("...23.640471+00:00"). Some Safari versions
// reject more than 3 fractional digits, so trim to milliseconds before parsing.
export const ts = (v) =>
  new Date(typeof v === "string" ? v.replace(/(\.\d{3})\d+/, "$1") : v);

export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const r = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const fmtDateTime = (d) =>
  ts(d).toLocaleString("en-PH", {
    timeZone: TZ, year: "numeric", month: "short", day: "2-digit",
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });

export const fmtTime = (d) =>
  ts(d).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

// 'YYYY-MM-DD' in Manila time
export const manilaDate = (d) => ts(d).toLocaleDateString("en-CA", { timeZone: TZ });

export const fmtDay = (ymd) =>
  new Date(`${ymd}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  });

function logFlags(l, label) {
  const f = [];
  if (!l) return f;
  if (l.is_correction) return [`${label} entered by HR`];
  if (l.lat == null) f.push(`${label}: no GPS`);
  else if (l.distance_m > MAX_DISTANCE_M) {
    const acc = l.accuracy_m != null ? ` (GPS +/-${Math.round(l.accuracy_m)} m)` : "";
    f.push(`${label}: ${Math.round(l.distance_m)} m from bar${acc}`);
  }
  if (l.client_time && Math.abs(ts(l.client_time) - ts(l.logged_at)) > 120000) {
    f.push(`${label}: time mismatch`);
  }
  return f;
}

function makeShift(inLog, outLog, now, abandoned = false) {
  const base = inLog || outLog;
  const flags = [...logFlags(inLog, "In"), ...logFlags(outLog, "Out")];
  let hours = null;
  if (inLog && outLog) hours = (ts(outLog.logged_at) - ts(inLog.logged_at)) / 36e5;
  if (inLog && !outLog) {
    const open = (now - ts(inLog.logged_at)) / 36e5;
    flags.push(abandoned || open > OPEN_SHIFT_HOURS ? "No clock-out" : "Still on shift");
  }
  if (!inLog && outLog) flags.push("No clock-in");
  return {
    staff_id: base.staff_id, staff_name: base.staff_name,
    date: manilaDate(base.logged_at), inLog, outLog, hours, flags,
  };
}

// Pair by sequence per person (an "in" matches that person's next "out"),
// so shifts that cross midnight need no special handling.
export function pairShifts(logs, now = Date.now()) {
  const byStaff = {};
  logs.forEach((l) => (byStaff[l.staff_id] ||= []).push(l));
  const shifts = [];
  for (const arr of Object.values(byStaff)) {
    arr.sort((a, b) => ts(a.logged_at) - ts(b.logged_at));
    let open = null;
    for (const l of arr) {
      if (l.type === "in") {
        if (open) shifts.push(makeShift(open, null, now, true));
        open = l;
      } else if (open) {
        shifts.push(makeShift(open, l, now));
        open = null;
      } else {
        shifts.push(makeShift(null, l, now));
      }
    }
    if (open) shifts.push(makeShift(open, null, now));
  }
  return shifts.sort((a, b) => {
    const ta = ts((a.inLog || a.outLog).logged_at);
    const tb = ts((b.inLog || b.outLog).logged_at);
    return tb - ta;
  });
}

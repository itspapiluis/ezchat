// Remembers who is signed in on THIS device for the attendance gate.
// Stores only an id and names. Never a PIN.
const KEY = "ezchat_attendance_session";

// The Server screen already remembers "who is serving" under this key.
// The gate fills it in so the Server screen skips its old name picker.
export const SERVER_NAME_KEY = "ezchat_server_name";

export function getAttendanceSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.staff_id && s.name ? s : null;
  } catch (_) {
    return null;
  }
}

export function setAttendanceSession(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* storage blocked: gate still works for this page view */ }
}

export function clearAttendanceSession() {
  try { localStorage.removeItem(KEY); } catch (_) { /* nothing to clear */ }
}

export function applyServerName(name) {
  try { if (name) localStorage.setItem(SERVER_NAME_KEY, name); } catch (_) { /* ignore */ }
}

export function clearServerName() {
  try { localStorage.removeItem(SERVER_NAME_KEY); } catch (_) { /* ignore */ }
}

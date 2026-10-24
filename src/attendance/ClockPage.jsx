// /clock : staff clock in / out with a live, watermarked selfie.
// Uses the shared supabase client (anon). All trust decisions happen in the
// attendance_* RPC functions on the server, never in this file.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { BUCKET, distanceM, fmtDateTime, fmtTime, ts } from "./util.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";

const ERR = {
  wrong: "Wrong PIN. Try again.",
  locked: "Too many wrong tries. Wait 10 minutes.",
  missing: "This staff account is not active. Ask HR.",
  cooldown: "You just clocked a moment ago. Wait a minute, then try again.",
};

const page = {
  position: "fixed", inset: 0, zIndex: 1000, overflowY: "auto", background: BG, color: "#e8e0d0",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif", WebkitOverflowScrolling: "touch",
};
const wrap = { maxWidth: 420, margin: "0 auto", padding: "28px 20px 40px" };
const field = {
  width: "100%", padding: 14, fontSize: 16, background: SURFACE2, border: `1px solid ${BORDER}`,
  borderRadius: 10, color: "#e8e0d0", outline: "none", boxSizing: "border-box",
};
const btnGold = {
  width: "100%", padding: 15, fontSize: 16, fontWeight: 700, border: "none", borderRadius: 10,
  background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`, color: "#080808", cursor: "pointer",
};
const btnGhost = {
  width: "100%", padding: 13, fontSize: 14, background: "transparent", border: `1px solid ${BORDER}`,
  borderRadius: 10, color: "#aaa", cursor: "pointer",
};
const errBox = {
  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171",
  borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14,
};

// Screen size, kept current on rotate/resize, so every step can fit without scrolling.
function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(read);
  useEffect(() => {
    const f = () => setV(read());
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); };
  }, []);
  return v;
}

// mode "page": the normal /clock page (default, unchanged).
// mode "gate": sign-in screen for the staff screens. Already clocked in => just signs in.
// mode "end":  end-of-shift clock-out for fixedStaff. Not clocked in => nothing to do.
// onComplete({ staff_id, name, type }) gets type "in", "out" or "noop".
export default function ClockPage({ mode = "page", fixedStaff = null, onComplete = null, onCancel = null }) {
  const embedded = mode !== "page";
  const vp = useViewport();
  const short = vp.h < 560;                       // phone held sideways, small screens
  const landscape = vp.w > vp.h && vp.h < 600;    // camera beside the buttons
  const wrapS = short ? { ...wrap, padding: "12px 16px 16px" } : wrap;
  const fieldS = short ? { ...field, padding: 10 } : field;
  const goldS = short ? { ...btnGold, padding: 11 } : btnGold;
  const ghostS = short ? { ...btnGhost, padding: 10 } : btnGhost;
  const fixedId = fixedStaff ? fixedStaff.id : "";
  const [staff, setStaff] = useState(null);
  const [staffId, setStaffId] = useState(fixedId);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("pick"); // pick | camera | done
  const [info, setInfo] = useState(null);   // { name, nextType, offset, barLat, barLng }
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(null);
  const [gpsErr, setGpsErr] = useState("");
  const [gpsWaited, setGpsWaited] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [aspect, setAspect] = useState(0.75);
  const [, setTick] = useState(0);
  const [done, setDone] = useState(null);
  const [photoState, setPhotoState] = useState("uploading"); // uploading | ok | failed
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pendingRef = useRef(null);
  const submitting = useRef(false);

  // ── staff list ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "end") return undefined; // the person is already known
    let dead = false;
    supabase.rpc("attendance_staff_list").then(({ data, error }) => {
      if (dead) return;
      if (error) setMsg("Could not load the staff list. Check your connection and reload.");
      else setStaff(data || []);
    });
    return () => { dead = true; };
  }, [mode]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // ── camera + GPS while on the camera step ──────────────────────────────────
  useEffect(() => {
    if (step !== "camera") return undefined;
    let cancelled = false;
    let watchId = null;
    setCamReady(false); setPos(null); setGpsErr(""); setGpsWaited(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg("Camera not supported here. Open this page in Chrome or Safari.");
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
        .then((s) => {
          if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = s;
          const v = videoRef.current;
          if (v) { v.srcObject = s; const p = v.play && v.play(); if (p && p.catch) p.catch(() => {}); }
        })
        .catch(() => setMsg("Camera blocked. Allow camera access for this site, then reload."));
    }

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGpsErr(""); },
        () => setGpsErr("Location blocked or unavailable"),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    } else {
      setGpsErr("Location not supported");
    }

    const tick = setInterval(() => setTick((x) => x + 1), 1000);
    const wait = setTimeout(() => setGpsWaited(true), 8000);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearTimeout(wait);
      if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      stopCamera();
    };
  }, [step]);

  // After a successful clock, return to the start screen on its own.
  useEffect(() => {
    if (step !== "done" || photoState !== "ok") return undefined;
    const t = setTimeout(leaveDone, embedded ? 1200 : 8000);
    return () => clearTimeout(t);
    // reset() only uses state setters and refs, so it is safe to leave out of the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, photoState]);

  function reset() {
    stopCamera();
    pendingRef.current = null;
    setPin(""); setStaffId(fixedId); setInfo(null); setDone(null); setMsg("");
    setPhotoState("uploading"); setStep("pick");
  }

  // Leave the "done" screen: embedded modes hand the result to the caller; /clock starts over.
  function leaveDone() {
    if (embedded && onComplete && done) {
      onComplete({ staff_id: staffId, name: done.name, type: done.type });
    } else {
      reset();
    }
  }

  function backToPick(text) {
    stopCamera();
    setPin(""); setInfo(null); setStep("pick"); setMsg(text || "");
  }

  // ── step 1: verify PIN ─────────────────────────────────────────────────────
  async function begin(e) {
    e.preventDefault();
    if (busy) return;
    if (!staffId) { setMsg("Pick your name."); return; }
    if (pin.length !== 6) { setMsg("Enter your 6-digit PIN."); return; }
    setBusy(true); setMsg("");
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("attendance_begin", { p_staff: staffId, p_pin: pin });
    setBusy(false);
    if (error || !data) { setMsg("Connection problem. Try again."); return; }
    if (!data.ok) { setPin(""); setMsg(ERR[data.error] || "Could not verify."); return; }
    // Gate: already clocked in => just sign in, no second selfie. End: not clocked in => nothing to end.
    if (embedded && onComplete && ((mode === "gate" && data.next_type === "out") || (mode === "end" && data.next_type === "in"))) {
      onComplete({ staff_id: staffId, name: data.name, type: "noop" });
      return;
    }
    // Offset between the server's clock and this phone's clock (corrects for a wrong phone time).
    // If the timestamp cannot be parsed, fall back to the phone clock (the server still stamps the real time).
    const serverMs = ts(data.server_time).getTime();
    const offset = Number.isFinite(serverMs) ? serverMs + (Date.now() - t0) / 2 - Date.now() : 0;
    setInfo({ name: data.name, nextType: data.next_type, offset, barLat: data.bar_lat, barLng: data.bar_lng });
    setStep("camera");
  }

  // ── watermark text (live overlay and baked into the photo) ────────────────
  function lines() {
    if (!info) return [];
    const now = Date.now() + info.offset;
    const out = [`${info.name}  -  CLOCK ${info.nextType.toUpperCase()}`, fmtDateTime(now)];
    if (pos) {
      const d = distanceM(pos.lat, pos.lng, info.barLat, info.barLng);
      out.push(`GPS ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}  (+/-${Math.round(pos.acc)} m)`);
      out.push(`${Math.round(d)} m from EasyCart`);
    } else {
      out.push(gpsErr ? `GPS: ${gpsErr}` : "GPS: locating...");
    }
    return out;
  }

  function capture(v) {
    return new Promise((resolve) => {
      const w = 480;
      const h = Math.round((v.videoHeight * w) / v.videoWidth);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(v, 0, 0, w, h);
      const L = lines();
      const lh = 21;
      const boxH = L.length * lh + 14;
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, h - boxH, w, boxH);
      ctx.font = "bold 15px sans-serif";
      ctx.textBaseline = "top";
      L.forEach((t, i) => {
        ctx.fillStyle = i === 0 ? GOLD : "#ffffff";
        ctx.fillText(t, 10, h - boxH + 8 + i * lh, w - 20);
      });
      c.toBlob((b) => resolve(b), "image/jpeg", 0.6);
    });
  }

  async function upload(blob, path) {
    for (let i = 0; i < 2; i++) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (!error) return true;
      if (/exist|duplicate/i.test(error.message || "")) return true;
    }
    return false;
  }

  // ── step 2: capture + submit ───────────────────────────────────────────────
  async function submit() {
    if (submitting.current) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    submitting.current = true; setBusy(true); setMsg("");
    try {
      const blob = await capture(v);
      if (!blob) { setMsg("Could not take the photo. Try again."); return; }
      const { data, error } = await supabase.rpc("attendance_punch", {
        p_staff: staffId, p_pin: pin,
        p_lat: pos ? pos.lat : null, p_lng: pos ? pos.lng : null, p_accuracy: pos ? pos.acc : null,
        p_client_time: new Date(Date.now() + info.offset).toISOString(),
      });
      if (error || !data) { setMsg("Connection problem. Try again."); return; }
      if (!data.ok) { backToPick(ERR[data.error] || "Something went wrong."); return; }

      stopCamera();
      setDone({ type: data.type, name: info.name, loggedAt: data.logged_at });
      setPin("");
      setPhotoState("uploading");
      setStep("done");
      pendingRef.current = { blob, path: data.path };
      const ok = await upload(blob, data.path);
      setPhotoState(ok ? "ok" : "failed");
    } finally {
      submitting.current = false; setBusy(false);
    }
  }

  async function retryUpload() {
    const p = pendingRef.current;
    if (!p) return;
    setPhotoState("uploading");
    const ok = await upload(p.blob, p.path);
    setPhotoState(ok ? "ok" : "failed");
  }

  // ── screens ────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ textAlign: landscape ? "left" : "center", marginBottom: short ? 10 : 22 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: GOLD, letterSpacing: 0.5 }}>EasyCart</div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
        {mode === "gate" ? "Clock in to start your shift" : mode === "end" ? "End your shift" : "Staff clock in / out"}
      </div>
    </div>
  );

  if (step === "done" && done) {
    const isIn = done.type === "in";
    return (
      <div style={page}>
        <div style={{ ...wrapS, textAlign: "center", paddingTop: short ? 18 : 70 }}>
          <div style={{ fontSize: short ? 36 : 56, marginBottom: short ? 4 : 10 }}>{isIn ? "✅" : "👋"}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: isIn ? "#34D399" : GOLD }}>Clocked {isIn ? "IN" : "OUT"}</div>
          <div style={{ fontSize: 17, marginTop: 8 }}>{done.name}</div>
          <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>{fmtTime(done.loggedAt)}</div>
          <div style={{ marginTop: short ? 12 : 26, fontSize: 13, color: photoState === "failed" ? "#F87171" : "#666" }}>
            {photoState === "uploading" && "Saving your photo..."}
            {photoState === "ok" && "Photo saved."}
            {photoState === "failed" && "Your time was recorded, but the photo did not upload."}
          </div>
          {photoState === "failed" && (
            <button style={{ ...goldS, marginTop: 14 }} onClick={retryUpload}>Retry photo upload</button>
          )}
          <button
            style={{ ...ghostS, marginTop: 14 }}
            onClick={() => {
              if (photoState !== "ok" && !window.confirm("Your photo has not been saved yet. Leave anyway? HR will see no photo for this punch.")) return;
              leaveDone();
            }}
          >Done</button>
        </div>
      </div>
    );
  }

  if (step === "camera" && info) {
    const L = lines();
    const gpsReady = !!pos || !!gpsErr || gpsWaited;
    const canShoot = camReady && gpsReady && !busy;
    // Size the preview to the screen so the buttons never fall below the fold.
    const boxW = landscape
      ? Math.max(180, Math.min(Math.floor(vp.w * 0.55), Math.floor((vp.h - 32) * aspect)))
      : Math.max(150, Math.floor((vp.h - (short ? 235 : 285)) * aspect));
    const preview = (
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", aspectRatio: String(aspect), width: "100%", maxWidth: boxW, margin: landscape ? 0 : "0 auto", flex: landscape ? "0 0 auto" : undefined }}>
        <video
          ref={videoRef} playsInline muted autoPlay
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
            setCamReady(true);
          }}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: short ? "6px 10px" : "10px 12px", background: "rgba(0,0,0,0.72)", fontSize: short ? 11.5 : 13, lineHeight: short ? 1.4 : 1.55, fontWeight: 600 }}>
          {L.map((t, i) => (
            <div key={i} style={{ color: i === 0 ? GOLD : "#fff" }}>{t}</div>
          ))}
        </div>
      </div>
    );
    const controls = (
      <>
        <div style={{ fontSize: 12, color: "#666", margin: short ? "8px 2px 10px" : "10px 2px 14px", textAlign: landscape ? "left" : "center" }}>
          {!camReady ? "Starting camera..." : !gpsReady ? "Getting your location..." : "Face the camera, then tap the button."}
        </div>
        <button style={{ ...goldS, opacity: canShoot ? 1 : 0.45 }} disabled={!canShoot} onClick={submit}>
          {busy ? "Saving..." : `Take photo & clock ${info.nextType.toUpperCase()}`}
        </button>
        <button style={{ ...ghostS, marginTop: 10 }} onClick={() => backToPick("")}>Cancel</button>
      </>
    );
    if (landscape) {
      return (
        <div style={page}>
          <div style={{ ...wrapS, maxWidth: 900, minHeight: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 20 }}>
            {preview}
            <div style={{ flex: 1, minWidth: 200 }}>
              {header}
              {msg && <div style={errBox}>{msg}</div>}
              {controls}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={page}>
        <div style={wrapS}>
          {header}
          {msg && <div style={errBox}>{msg}</div>}
          {preview}
          {controls}
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={wrapS}>
        {header}
        {msg && <div style={errBox}>{msg}</div>}
        {mode !== "end" && staff === null && !msg && <div style={{ textAlign: "center", color: "#555" }}>Loading...</div>}
        {mode !== "end" && staff && staff.length === 0 && (
          <div style={{ textAlign: "center", color: "#888", fontSize: 14 }}>No staff set up yet. Ask HR to add you.</div>
        )}
        {(mode === "end" || (staff && staff.length > 0)) && (
          <form onSubmit={begin} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: short ? 14 : 20 }}>
            <label style={{ fontSize: 11, color: GOLD_DIM, letterSpacing: 1 }}>YOUR NAME</label>
            {mode === "end" ? (
              <div style={{ ...fieldS, margin: short ? "4px 0 10px" : "6px 0 16px", fontWeight: 600 }}>{fixedStaff ? fixedStaff.name : ""}</div>
            ) : (
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ ...fieldS, margin: short ? "4px 0 10px" : "6px 0 16px" }}>
                <option value="">Select...</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <label style={{ fontSize: 11, color: GOLD_DIM, letterSpacing: 1 }}>6-DIGIT PIN</label>
            <input
              type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="off"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••" style={{ ...fieldS, margin: short ? "4px 0 12px" : "6px 0 20px", letterSpacing: 6, textAlign: "center", fontSize: 20 }}
            />
            <button type="submit" style={{ ...goldS, opacity: busy ? 0.6 : 1 }} disabled={busy}>
              {busy ? "Checking..." : "Continue"}
            </button>
            {mode === "end" && onCancel && (
              <button type="button" style={{ ...ghostS, marginTop: 10 }} onClick={onCancel}>Back</button>
            )}
          </form>
        )}
        <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: short ? 8 : 18, lineHeight: 1.6 }}>
          Your photo, time and location are recorded when you clock in or out.
        </div>
      </div>
    </div>
  );
}

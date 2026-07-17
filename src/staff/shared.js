import React from "react";
import { supabase } from "../lib/supabase.js";
import { useConnection, verifyVoidPin } from "../lib/prod.js";
export { supabase };

// ── Staff PINs ────────────────────────────────────────────────────────────────
// PHASE 7 SECURITY: PINs are NO LONGER stored here. They lived in the shipped
// JavaScript bundle, meaning any guest could read them in DevTools.
// They now live in the `staff_config` table and are checked server-side by the
// verify_staff_pin() function. Change them in:
//   Supabase → Table Editor → staff_config
export const STAFF_ROLES = ["kitchen","bar","cashier","server","admin"];

export const ROLE_LABELS = {
  kitchen: "Kitchen",
  bar:     "Bar",
  cashier: "Cashier",
  server:  "Server",
  admin:   "Admin",
};

export const ROLE_COLORS = {
  kitchen: "#34D399",
  bar:     "#60A5FA",
  cashier: "#C9A84C",
  server:  "#F472B6",
  admin:   "#A78BFA",
};

export const ROLE_ICONS = {
  kitchen: "👨‍🍳",
  bar:     "🍸",
  cashier: "💰",
  server:  "🧑‍🍳",
  admin:   "👑",
};

// ── Order status ──────────────────────────────────────────────────────────────
export const ORDER_STATUS = {
  pending:   { label:"Pending",   color:"#F59E0B", icon:"⏳" },
  preparing: { label:"Preparing", color:"#60A5FA", icon:"🔥" },
  ready:     { label:"Ready",     color:"#34D399", icon:"✅" },
  served:    { label:"Served",    color:"#888",    icon:"🍽️" },
  voided:    { label:"Voided",    color:"#F87171", icon:"❌" },
};

export const VOID_REASONS = [
  "Out of stock",
  "Wrong order",
  "Customer cancelled",
  "Made in error",
  "Quality issue",
  "Other",
];

export const PAYMENT_METHODS = [
  { value:"cash",   label:"💵 Cash" },
  { value:"gcash",  label:"📱 GCash" },
  { value:"maya",   label:"💙 Maya" },
  { value:"credit", label:"💳 Credit Card" },
  { value:"debit",  label:"🏦 Debit Card" },
];

// ── Formatting ────────────────────────────────────────────────────────────────
export const fmtPrice = (n) =>
  "₱" + Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});

// ── Sound alert ───────────────────────────────────────────────────────────────
export function playAlert(type="new_order"){
  try{
    const ctx = new(window.AudioContext||window.webkitAudioContext)();
    const patterns = {
      new_order: [[0,880,.12],[.15,1100,.1],[.28,1320,.15]],
      bill_req:  [[0,660,.1],[.12,880,.1],[.24,660,.1],[.36,880,.18]],
      notify:    [[0,700,.1],[.15,900,.12]],
    };
    const tones = patterns[type]||patterns.new_order;
    tones.forEach(([when,freq,dur])=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=freq;osc.type="sine";
      gain.gain.setValueAtTime(0,ctx.currentTime+when);
      gain.gain.linearRampToValueAtTime(.3,ctx.currentTime+when+.01);
      gain.gain.linearRampToValueAtTime(0,ctx.currentTime+when+dur);
      osc.start(ctx.currentTime+when);
      osc.stop(ctx.currentTime+when+dur+.05);
    });
  }catch(e){}
}

// ── Session ───────────────────────────────────────────────────────────────────
// ── Staff session ─────────────────────────────────────────────────────────────
// THE BUG: the old code stored ONE role under ONE localStorage key. localStorage
// is shared by every tab in a browser, so opening Kitchen in tab 1 and Bar in
// tab 2 meant the second login OVERWROTE the first. The moment tab 1 re-rendered
// (any new order, any realtime event) ProtectedRoute re-read the key, saw the
// wrong role, and bounced you back to the role picker.
//
// (Separate DEVICES were never affected — each device has its own localStorage.
//  This only ever bit you when two stations shared one browser.)
//
// THE FIX: store each role under its OWN key. A browser can hold several roles
// at once, so Kitchen / Bar / Cashier can run in three tabs side by side.
//
// We deliberately keep localStorage (not sessionStorage) so a station stays
// logged in when the tablet reboots or the browser is closed mid-service —
// nobody wants to re-key a PIN during a rush.
const SESSION_PREFIX = "ezchat_staff_role_";
const LEGACY_KEY     = "ezchat_staff_session";

const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(_){} },
  del(k){ try{ localStorage.removeItem(k); }catch(_){} },
};

export function saveStaffSession(role){
  store.set(SESSION_PREFIX + role, "1");
  store.del(LEGACY_KEY);        // retire the old single-role key
}

// Is this browser authorised for `role`?
export function hasStaffRole(role){
  if(!role) return false;
  if(store.get(SESSION_PREFIX + role) === "1") return true;
  if(store.get(SESSION_PREFIX + "admin") === "1") return true;  // admin opens any door
  return store.get(LEGACY_KEY) === role;                        // honour an old session
}

// Kept for callers that just want "some role" (e.g. the logout button).
export function loadStaffSession(){
  for(const r of ["kitchen","bar","cashier","admin"]){
    if(store.get(SESSION_PREFIX + r) === "1") return r;
  }
  return store.get(LEGACY_KEY) || null;
}

// Log out of ONE role, or everything if no role is given.
export function clearStaffSession(role){
  if(role){
    store.del(SESSION_PREFIX + role);
  }else{
    for(const r of ["kitchen","bar","cashier","admin"]) store.del(SESSION_PREFIX + r);
  }
  store.del(LEGACY_KEY);
}

// ── Audit log ─────────────────────────────────────────────────────────────────
// BUGFIX: this used to throw if the audit insert failed (RLS, offline, bad
// column). Callers `await` it right after doing real work — so a failed LOG
// would abort the operation it was logging. Logging must never break the app.
export async function logAudit(action,entity,entityId,details,performedBy){
  try{
    const {error} = await supabase.from("audit_logs").insert({
      action,entity,entity_id:String(entityId||""),
      details,performed_by:performedBy||"staff"
    });
    if(error) console.warn("audit log failed:",error.message);
  }catch(e){
    console.warn("audit log failed:",e?.message||e);
  }
}

// ── PHASE 8: offline banner (staff) ──────────────────────────────────────────
// Venue wifi drops mid-service. Staff MUST know their screen has gone stale —
// otherwise they keep working from a ticket list that stopped updating minutes
// ago. Written with React.createElement because this is a .js file (no JSX).
export function ConnectionBanner(){
  const {connected} = useConnection();
  if(connected) return null;
  // BUGFIX: was position:fixed, which covered the dashboard header (logo and the
  // Pending/Preparing counters). A normal block pushes the page down instead.
  return React.createElement("div", {
    style:{
      background:"#7F1D1D", color:"#fff", textAlign:"center",
      padding:"7px 12px", fontSize:13, fontWeight:600,
      fontFamily:"Inter,sans-serif", letterSpacing:0.3, flexShrink:0,
    }
  }, "\u26A0 Connection lost \u2014 this screen is NOT updating. Check the wifi.");
}

// ── PHASE 9: the venue's tables ──────────────────────────────────────────────
// Single source of truth, shared by the Cashier's "Move Tab" picker.
export const TABLE_LIST = [
  "L1","L2","L3",
  "R1","R2","R3","R4",
  "C1","C2","C3","C4",
  "D1","D2","D3","D4","D5",
  "B1","B2","B3","B4","B5","B6","B7",
  "M1",
  "F1","F2","F3",
  "KTV ROOM 1","KTV ROOM 2",
  "SAPPHIRE","RUBY","DIAMOND",
];

// ── PHASE 11: void PIN prompt (shared by Kitchen, Bar, Cashier) ──────────────
// A tiny keypad modal. Calls onOk() only when the void PIN checks out.

export function VoidPinGate({ open, onOk, onCancel }){
  const [pin,setPin] = React.useState("");
  const [err,setErr] = React.useState("");
  const [busy,setBusy] = React.useState(false);
  React.useEffect(()=>{ if(open){ setPin(""); setErr(""); } },[open]);
  if(!open) return null;

  const submit = async(p)=>{
    setBusy(true);
    const ok = await verifyVoidPin(p);
    setBusy(false);
    if(ok){ onOk(); }
    else { setErr("Wrong void PIN"); setPin(""); }
  };
  const press = (v)=>{
    if(pin.length>=6) return;
    const n = pin+v; setPin(n);
    if(n.length===6) setTimeout(()=>submit(n),100);
  };

  return React.createElement("div",{
    onClick:onCancel,
    style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:500,padding:20}
  },
    React.createElement("div",{
      onClick:e=>e.stopPropagation(),
      style:{background:"#151510",border:"1px solid #2a2a20",borderRadius:16,
        padding:24,width:"100%",maxWidth:300,textAlign:"center"}
    },
      React.createElement("div",{style:{fontSize:26,marginBottom:6}},"\uD83D\uDD12"),
      React.createElement("div",{style:{fontSize:15,fontWeight:700,color:"#e8e0d0",marginBottom:2}},"Void Authorisation"),
      React.createElement("div",{style:{fontSize:12,color:"#777",marginBottom:14}},"Enter the void PIN to continue"),
      React.createElement("div",{style:{display:"flex",justifyContent:"center",gap:7,marginBottom:12}},
        [0,1,2,3,4,5].map(i=>React.createElement("div",{key:i,style:{
          width:11,height:11,borderRadius:"50%",
          background:i<pin.length?"#c9a84c":"#333"}}))),
      err && React.createElement("div",{style:{fontSize:12,color:"#F87171",marginBottom:10}},err),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}},
        [1,2,3,4,5,6,7,8,9].map(n=>React.createElement("button",{key:n,disabled:busy,
          onClick:()=>press(String(n)),
          style:{padding:"14px 0",fontSize:18,background:"#1e1e16",border:"1px solid #2a2a20",
            borderRadius:10,color:"#e8e0d0",cursor:"pointer"}},n)),
        React.createElement("div",{key:"x"}),
        React.createElement("button",{key:0,disabled:busy,onClick:()=>press("0"),
          style:{padding:"14px 0",fontSize:18,background:"#1e1e16",border:"1px solid #2a2a20",
            borderRadius:10,color:"#e8e0d0",cursor:"pointer"}},0),
        React.createElement("button",{key:"del",onClick:()=>setPin(p=>p.slice(0,-1)),
          style:{padding:"14px 0",fontSize:16,background:"#1e1e16",border:"1px solid #2a2a20",
            borderRadius:10,color:"#888",cursor:"pointer"}},"\u2190")),
      React.createElement("button",{onClick:onCancel,
        style:{marginTop:4,padding:"8px 16px",background:"none",border:"none",
          color:"#666",fontSize:13,cursor:"pointer"}},"Cancel")
    )
  );
}

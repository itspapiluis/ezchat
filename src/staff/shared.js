import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Staff PINs ────────────────────────────────────────────────────────────────
export const STAFF_PINS = {
  kitchen: "111111",
  bar:     "222222",
  cashier: "333333",
  admin:   "143143",
};

export const ROLE_LABELS = {
  kitchen: "Kitchen",
  bar:     "Bar",
  cashier: "Cashier",
  admin:   "Admin",
};

export const ROLE_COLORS = {
  kitchen: "#34D399",
  bar:     "#60A5FA",
  cashier: "#C9A84C",
  admin:   "#A78BFA",
};

export const ROLE_ICONS = {
  kitchen: "👨‍🍳",
  bar:     "🍸",
  cashier: "💰",
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
const SESSION_KEY = "ezchat_staff_session";
export function saveStaffSession(role){ localStorage.setItem(SESSION_KEY,role); }
export function loadStaffSession(){ return localStorage.getItem(SESSION_KEY)||null; }
export function clearStaffSession(){ localStorage.removeItem(SESSION_KEY); }

// ── Audit log ─────────────────────────────────────────────────────────────────
export async function logAudit(action,entity,entityId,details,performedBy){
  await supabase.from("audit_logs").insert({
    action,entity,entity_id:String(entityId||""),
    details,performed_by:performedBy||"staff"
  });
}

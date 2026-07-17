import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import { logError, installErrorHandlers, rateLimit, verifyStaffPin, useConnection } from "./lib/prod.js";

// ── Constants ─────────────────────────────────────────────────────────────────
// EGRESS FIX: the logo used to be served from SUPABASE STORAGE. It appears on
// 8+ screens, so every guest on every page load pulled it from Supabase — and it
// blew through the Cached Egress quota (8.9 GB against a 5 GB limit; the database
// itself was only using 27%).
//
// Now it is served by VERCEL's CDN from /public. Vercel bandwidth is free and
// generous, and Supabase egress for the logo drops to ZERO.
//
// The file must exist at:  public/logo.jpg
const LOGO_SRC = "/logo.jpg";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";
const VENUE_WIFI = "EasyCart_VIP";
const VENUE_NAME = "EasyCart Barcade & Lounge";
const VENUE_LOCATION = "Catarman, Northern Samar";
const ROOM_ID = "easycart-main";

// ── Table system ──────────────────────────────────────────────────────────────
const ALL_TABLES = [
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

function getTableFromURL(){
  try{
    const p = new URLSearchParams(window.location.search);
    const t = p.get("table");
    if(t && ALL_TABLES.includes(t.toUpperCase())) return t.toUpperCase();
    // Try case-insensitive match for KTV rooms etc.
    if(t){
      const match = ALL_TABLES.find(x=>x.toLowerCase()===t.toLowerCase());
      if(match) return match;
    }
    return null;
  }catch(e){return null;}
}

// PHASE 10: which "seating" of this table are we in?
// Staff bump this when the guests leave, which locks out their old phones.
function getSessionEpoch(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    return s.epoch ?? null;
  }catch(_){ return null; }
}

async function getTableEpoch(tableId){
  if(!tableId) return null;
  const {data} = await supabase
    .from("table_sessions").select("epoch").eq("table_id", tableId).maybeSingle();
  return data?.epoch ?? 1;
}

// Get or create open tab for this table
async function getOrCreateTab(tableId){
  // BUGFIX 1: this only matched status="open". Once a table requested the bill
  // (status="bill_requested"), it looked like NO tab existed and a SECOND tab
  // was opened for the same table — splitting the bill in two.
  // BUGFIX 2: .single() throws when there are 0 rows; .maybeSingle() returns null.
  const findOpen = async () =>
    (await supabase
      .from("table_tabs")
      .select("*")
      .eq("table_id", tableId)
      .in("status", ["open", "bill_requested"])
      .order("opened_at", { ascending: false })   // table_tabs has opened_at, NOT created_at
      .limit(1)
      .maybeSingle()).data;

  const existing = await findOpen();
  if (existing) return existing;

  // BUGFIX 3: two guests scanning the same table's QR at the same moment both
  // saw "no tab" and both created one. A unique index in the DB now blocks the
  // duplicate; if the insert loses the race, we just re-read the winner's tab.
  const { data: created, error } = await supabase
    .from("table_tabs")
    .insert({ table_id: tableId, status: "open", total: 0 })
    .select()
    .single();

  if (error) return await findOpen();   // someone else won the race
  return created;
}

// Format price
const fmtPrice = (n) => "₱" + Number(n).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
// Access code is loaded from Supabase (managed in Admin Panel)

const GENDERS = [
  {value:"male",    label:"Male",             emoji:"👨"},
  {value:"female",  label:"Female",           emoji:"👩"},
  {value:"gay",     label:"Gay",              emoji:"🏳️‍🌈"},
  {value:"lesbian", label:"Lesbian",          emoji:"🏳️‍🌈"},
  {value:"bisexual",label:"Bisexual",         emoji:"💜"},
  {value:"trans",   label:"Transgender",      emoji:"⚧️"},
  {value:"nonbinary",label:"Non-Binary",      emoji:"🌈"},
  {value:"prefer_not",label:"Prefer not to say",emoji:"🤐"},
];

const PROFANITY = ["badword1","badword2"];
const filterMsg = (t,extraWords=[]) => {
  const all=[...PROFANITY,...extraWords];
  return all.reduce((s,w)=>s.replace(new RegExp("\\b"+w+"\\b","gi"),"***"),t);
};
// ── Device fingerprint + session ─────────────────────────────────────────────
const SESSION_KEY = "ezchat_session_v1";

function getDeviceFingerprint(){
  const nav = window.navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    nav.hardwareConcurrency||"",
    screen.width+"x"+screen.height,
    screen.colorDepth||"",
    Intl.DateTimeFormat().resolvedOptions().timeZone||"",
    nav.platform||"",
  ].join("|");
  // Simple hash
  let hash = 0;
  for(let i=0;i<raw.length;i++){hash=(hash<<5)-hash+raw.charCodeAt(i);hash|=0;}
  return Math.abs(hash).toString(36);
}

function saveSession(user, tableId, epoch){
  try{
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: user.id,
      fingerprint: getDeviceFingerprint(),
      savedAt: new Date().toISOString(),
      // PHASE 10: which SEATING of this table we belong to. When staff close the
      // table, the epoch bumps and this phone is locked out — so a guest who
      // paid and went home cannot order onto the next group's bill.
      tableId: tableId || null,
      epoch: epoch ?? null,
    }));
  }catch(e){}
}

function clearSession(){
  try{localStorage.removeItem(SESSION_KEY);}catch(e){}
}

async function loadSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const session = JSON.parse(raw);
    // Verify fingerprint matches this device
    if(session.fingerprint !== getDeviceFingerprint()) return null;
    // Check if user still exists in Supabase
    const {data} = await supabase.from("users").select("*").eq("id", session.userId).single();
    if(!data || data.status === "blocked") {
      clearSession();
      return null;
    }
    // Update status to online
    await supabase.from("users").update({status:"online", last_seen: new Date().toISOString()}).eq("id", session.userId);
    return data;
  }catch(e){
    clearSession();
    return null;
  }
}

const EMOJIS = ["😄","😂","😍","🔥","👑","🎉","💛","✨","🥂","🎶","😎","🙌","💫","🤩","🍾","🎮","🎯","🎱"];
const COLORS = ["#C9A84C","#E8C96A","#A78BFA","#34D399","#F87171","#60A5FA","#FB923C","#E879F9"];
const fmtTime = (d) => new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
function randomId(){return Math.random().toString(36).slice(2,9);}
function initials(n){return n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;overflow:hidden}
body{background:#080808;color:#e8e0d0;font-family:'Inter',sans-serif}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#3a2e1a;border-radius:2px}
.gold-text{background:linear-gradient(135deg,#E8C96A,#C9A84C,#8A6A28);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.glass{background:rgba(201,168,76,0.03);border:1px solid #241E10}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-200%}100%{background-position:200%}}
.fade-in{animation:fadeIn .3s ease forwards}
.slide-up{animation:slideUp .35s ease forwards}
.typing-dot{width:5px;height:5px;border-radius:50%;background:#C9A84C;display:inline-block}
.typing-dot:nth-child(1){animation:pulse 1.2s infinite}
.typing-dot:nth-child(2){animation:pulse 1.2s .2s infinite}
.typing-dot:nth-child(3){animation:pulse 1.2s .4s infinite}
.skel{background:linear-gradient(90deg,#0F0F0F 25%,#1a1a1a 50%,#0F0F0F 75%);background-size:200%;animation:shimmer 1.5s infinite;border-radius:8px}
.btn-gold{background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#080808;border:none;border-radius:8px;font-weight:700;cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif;letter-spacing:.3px}
.btn-gold:hover{filter:brightness(1.12);transform:translateY(-1px);box-shadow:0 6px 20px rgba(201,168,76,0.3)}
.btn-gold:active{transform:translateY(0);filter:brightness(.95)}
.btn-ghost{background:transparent;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;cursor:pointer;transition:all .2s}
.btn-ghost:hover{border-color:#8A6A28;color:#C9A84C;background:rgba(201,168,76,0.05)}
input,textarea{background:#161616;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s}
input:focus,textarea:focus{border-color:#8A6A28;box-shadow:0 0 0 2px rgba(138,106,40,0.15)}
input::placeholder,textarea::placeholder{color:#3a3a3a}
.online-dot{width:8px;height:8px;border-radius:50%;background:#34D399;flex-shrink:0}
.online-dot.away{background:#F59E0B}
.msg-bubble{padding:10px 14px;border-radius:0 16px 16px 16px;background:#161616;border:1px solid #241E10;word-break:break-word;line-height:1.55;font-size:14px}
.msg-own .msg-bubble{background:rgba(201,168,76,0.1);border-color:rgba(201,168,76,0.25);border-radius:16px 0 16px 16px}
.reaction-btn{background:#161616;border:1px solid #241E10;border-radius:12px;font-size:12px;padding:2px 8px;cursor:pointer;transition:all .15s;color:#e8e0d0}
.reaction-btn:hover,.reaction-btn.active{border-color:#8A6A28;background:rgba(201,168,76,0.1)}
.sidebar-item{padding:9px 10px;border-radius:10px;cursor:pointer;transition:all .15s;border:1px solid transparent}
.sidebar-item:hover{background:#161616;border-color:#241E10}
.tab-btn{flex:1;padding:9px 4px;background:transparent;border:none;border-bottom:2px solid transparent;color:#444;font-family:'Inter',sans-serif;font-size:12px;cursor:pointer;transition:all .2s;white-space:nowrap}
.tab-btn.active{color:#C9A84C;border-bottom-color:#C9A84C}
.pm-bubble{padding:9px 13px;border-radius:12px;max-width:80%;font-size:14px;word-break:break-word;line-height:1.5}
.pm-bubble.mine{background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#080808;border-radius:12px 12px 3px 12px;align-self:flex-end;font-weight:500}
.pm-bubble.theirs{background:#161616;border:1px solid #241E10;border-radius:12px 12px 12px 3px;align-self:flex-start}
.toast{position:fixed;bottom:24px;right:20px;background:#161616;border:1px solid #C9A84C44;border-left:3px solid #C9A84C;border-radius:10px;padding:12px 18px;font-size:13px;z-index:9999;animation:slideUp .3s ease;box-shadow:0 8px 32px rgba(0,0,0,0.6);max-width:300px}
.ann-bar{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.mobile-only{display:none}
.desktop-only{display:flex}
@media(max-width:768px){
  .mobile-only{display:flex!important}
  .desktop-sidebar{display:none!important}
  .desktop-only{display:none!important}
}
/* Prevent iOS bounce scroll on the app container */
@supports(-webkit-touch-callout:none){
  body{position:fixed;width:100%;height:100%;}
  #root{overflow:hidden;height:100%;}
}
/* Safe area for iPhone notch/home bar */
.safe-bottom{padding-bottom:env(safe-area-inset-bottom,0px)}
.notif-dot{position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#F87171;border:2px solid #0F0F0F;animation:pulse 1.5s infinite}
.unread-badge{background:#F87171;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;min-width:18px;text-align:center}
@keyframes notifSlide{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
.notif-popup{position:fixed;top:70px;right:16px;background:#1a1208;border:1px solid ${GOLD_DIM};border-left:3px solid #C9A84C;border-radius:12px;padding:12px 16px;z-index:9998;animation:notifSlide .3s ease;box-shadow:0 8px 32px rgba(0,0,0,0.7);max-width:280px;cursor:pointer}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({user,size=32,onClick}){
  return(
    <div onClick={onClick} style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${user.color}cc,${user.color}55)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.34,fontWeight:700,color:"#080808",flexShrink:0,cursor:onClick?"pointer":"default",border:`1.5px solid ${user.color}55`,userSelect:"none"}}>
      {user.avatar_url?<img src={user.avatar_url} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}}/>:initials(user.name)}
    </div>
  );
}

function Logo({size=36,showText=true}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
      <img src={LOGO_SRC} alt="EasyCart" style={{width:size,height:size,objectFit:"contain",borderRadius:6,background:"#fff",padding:2}}/>
      {showText&&(
        <div style={{lineHeight:1}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:900,letterSpacing:.5}} className="gold-text">EasyCart</div>
          <div style={{fontSize:9,color:"#555",letterSpacing:.5,marginTop:1}}>BARCADE & LOUNGE</div>
        </div>
      )}
    </div>
  );
}

function useToast(){
  const [toasts,setToasts]=useState([]);
  const show=(msg)=>{const id=randomId();setToasts(p=>[...p,{id,msg}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3200);};
  return{toasts,show};
}

// ── Notification system ──────────────────────────────────────────────────────
function useNotifications(me){
  const [permission,setPermission]=useState("default");
  const [soundOn,setSoundOn]=useState(true);
  const [unreadDMs,setUnreadDMs]=useState({}); // {userId: count}
  const [notifPopups,setNotifPopups]=useState([]);
  const audioCtxRef=useRef(null);

  // Request permission on mount
  useEffect(()=>{
    if("Notification" in window){
      setPermission(Notification.permission);
      if(Notification.permission==="default"){
        Notification.requestPermission().then(p=>setPermission(p));
      }
    }
  },[]);

  // Play bar-vibe sound (Web Audio API — no file needed)
  const playSound=useCallback(()=>{
    if(!soundOn)return;
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      // Bar chime: two quick tones
      const times=[[0,880,0.15],[0.12,1100,0.1]];
      times.forEach(([when,freq,dur])=>{
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value=freq;
        osc.type="sine";
        gain.gain.setValueAtTime(0,ctx.currentTime+when);
        gain.gain.linearRampToValueAtTime(0.25,ctx.currentTime+when+0.01);
        gain.gain.linearRampToValueAtTime(0,ctx.currentTime+when+dur);
        osc.start(ctx.currentTime+when);
        osc.stop(ctx.currentTime+when+dur+0.05);
      });
    }catch(e){}
  },[soundOn]);

  // Show browser push notification
  const pushNotif=useCallback((title,body,onClick)=>{
    if(permission==="granted"&&document.hidden){
      const n=new Notification(title,{
        body,
        icon:"/favicon.svg",
        badge:"/favicon.svg",
        tag:"ezchat-dm",
        renotify:true,
      });
      if(onClick)n.onclick=()=>{window.focus();onClick();n.close();};
      setTimeout(()=>n.close(),6000);
    }
  },[permission]);

  // Show in-app popup notification
  const showPopup=useCallback((msg,onClick)=>{
    const id=randomId();
    setNotifPopups(p=>[...p,{id,msg,onClick}]);
    setTimeout(()=>setNotifPopups(p=>p.filter(n=>n.id!==id)),4000);
  },[]);

  // Mark DM as read
  const markDMRead=useCallback((userId)=>{
    setUnreadDMs(p=>{const n={...p};delete n[userId];return n;});
  },[]);

  // Add unread DM
  const addUnreadDM=useCallback((userId)=>{
    setUnreadDMs(p=>({...p,[userId]:(p[userId]||0)+1}));
  },[]);

  // Update tab title with unread count
  const totalUnread=Object.values(unreadDMs).reduce((a,b)=>a+b,0);
  useEffect(()=>{
    if(totalUnread>0){
      document.title=`(${totalUnread}) EZChat · EasyCart`;
    } else {
      document.title="EZChat · EasyCart Barcade & Lounge";
    }
  },[totalUnread]);

  return{permission,soundOn,setSoundOn,unreadDMs,totalUnread,playSound,pushNotif,showPopup,notifPopups,setNotifPopups,markDMRead,addUnreadDM};
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────
function MsgSkeleton(){
  return(
    <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-start"}}>
      <div className="skel" style={{width:34,height:34,borderRadius:"50%",flexShrink:0}}/>
      <div style={{flex:1}}>
        <div className="skel" style={{height:12,width:80,marginBottom:6}}/>
        <div className="skel" style={{height:40,width:"60%"}}/>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function Loading({label="CONNECTING…",sub=""}){
  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:BG,gap:18}}>
      <div style={{position:"relative"}}>
        <img src={LOGO_SRC} alt="" style={{width:70,height:70,objectFit:"contain",background:"#fff",borderRadius:16,padding:5}}/>
        <div style={{position:"absolute",inset:-6,borderRadius:"50%",border:`2px solid transparent`,borderTop:`2px solid ${GOLD}`,animation:"spin 1s linear infinite"}}/>
      </div>
      <div className="gold-text" style={{fontSize:13,fontWeight:600,letterSpacing:2,marginTop:4}}>{label}</div>
      {sub&&<div style={{fontSize:12,color:"#333"}}>{sub}</div>}
    </div>
  );
}

// ── Landing page ──────────────────────────────────────────────────────────────
function Landing({onJoin,onAdminTap,tableId}){
  const [scroll,setScroll]=useState(0);
  const [annIdx,setAnnIdx]=useState(0);
  const [announcements,setAnnouncements]=useState([
    "🥂 Welcome to EasyCart Barcade & Lounge!",
    "🎮 Barcade games open all night",
    "🏆 VIP booth reservations — see the host",
    "🎶 Live music tonight — stay tuned!",
  ]);

  useEffect(()=>{
    const t=setInterval(()=>setAnnIdx(i=>(i+1)%announcements.length),4500);
    return()=>clearInterval(t);
  },[announcements.length]);

  // Fetch live announcements from Supabase
  useEffect(()=>{
    const load=async()=>{
      const {data}=await supabase.from("announcements").select("text").eq("room_id",ROOM_ID).order("pinned",{ascending:false}).order("created_at",{ascending:false}).limit(5);
      if(data&&data.length>0)setAnnouncements(data.map(a=>a.text));
    };
    load();
    const ch=supabase.channel("ann-landing").on("postgres_changes",{event:"*",schema:"public",table:"announcements"},load).subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  const features=[
    {icon:"👑",t:"Instant Access",d:"No app, no sign-up. Scan the QR and you're in."},
    {icon:"🔒",t:"Venue-Only Privacy",d:"Only guests on EasyCart's Wi-Fi can join."},
    {icon:"💬",t:"Real-Time Chat",d:"Live messages, reactions, typing indicators."},
    {icon:"📸",t:"Photo Sharing",d:"Share moments from your night instantly."},
    {icon:"🤫",t:"Private Messages",d:"Slide into DMs with anyone in the room."},
    {icon:"🎮",t:"Barcade Vibes",d:"Coordinate games and challenge tables."},
  ];
  const steps=[
    {n:"01",t:"Connect to Wi-Fi",d:`Join "${VENUE_WIFI}" — your entry pass.`},
    {n:"02",t:"Scan the QR Code",d:"Every table has one. One tap and you're live."},
    {n:"03",t:"Say Hello",d:"Pick your name, choose your look, start chatting."},
  ];

  return(
    <div style={{height:"100dvh",overflowY:"auto",background:BG}} onScroll={e=>setScroll(e.currentTarget.scrollTop)}>
      <nav style={{position:"sticky",top:0,zIndex:100,padding:"0 5%",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",background:scroll>40?"rgba(8,8,8,0.97)":"transparent",backdropFilter:scroll>40?"blur(16px)":"none",borderBottom:scroll>40?`1px solid ${BORDER}`:"none",transition:"all .3s"}}>
        <div onClick={onAdminTap} style={{cursor:"default"}}>
          <Logo size={32} showText={true}/>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button className="btn-ghost" style={{padding:"7px 16px",fontSize:13}} onClick={()=>document.getElementById("how")?.scrollIntoView({behavior:"smooth"})}>How It Works</button>
          <button className="btn-gold" onClick={onJoin} style={{padding:"8px 20px",fontSize:13}}>Join Chat</button>
        </div>
      </nav>

      <div style={{background:`linear-gradient(90deg,transparent,rgba(201,168,76,0.08),transparent)`,borderBottom:`1px solid ${BORDER}`,padding:"8px 5%",fontSize:13,color:GOLD,textAlign:"center",transition:"all .4s"}} className="ann-bar">
        {announcements[annIdx]}
      </div>

      <section style={{minHeight:"88vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"40px 5%",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 55%,rgba(201,168,76,0.08) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{marginBottom:28}}>
          <img src={LOGO_SRC} alt="EasyCart" onClick={onAdminTap} style={{width:110,height:110,objectFit:"contain",background:"#fff",borderRadius:20,padding:8,border:`1px solid ${GOLD_DIM}44`,cursor:"default"}}/>
        </div>
        <div style={{background:"rgba(201,168,76,0.08)",border:`1px solid ${GOLD_DIM}44`,borderRadius:20,padding:"5px 16px",fontSize:12,color:GOLD,marginBottom:12,letterSpacing:1.5}}>
          ✦ {VENUE_LOCATION.toUpperCase()}
        </div>
        {tableId&&(
          <div style={{background:`rgba(52,211,153,0.08)`,border:`1px solid rgba(52,211,153,0.3)`,borderRadius:12,padding:"6px 18px",fontSize:13,color:"#34D399",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
            <span>📍</span><span>Table <strong>{tableId}</strong> — Ready to order</span>
          </div>
        )}
        {!tableId&&(
          <div style={{background:`rgba(245,158,11,0.06)`,border:`1px solid rgba(245,158,11,0.2)`,borderRadius:12,padding:"6px 18px",fontSize:12,color:"#888",marginBottom:12}}>
            💡 Scan the QR code at your table to place orders
          </div>
        )}
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(38px,6.5vw,80px)",fontWeight:900,lineHeight:1.06,marginBottom:20,maxWidth:820}}>
          <span className="gold-text">Meet Everyone</span><br/>
          <span style={{color:"#e8e0d0"}}>In the Bar Tonight</span>
        </h1>
        <p style={{fontSize:"clamp(15px,1.8vw,18px)",color:"#666",maxWidth:520,lineHeight:1.75,marginBottom:36}}>
          Chat with everyone at {VENUE_NAME} — without awkwardly walking up to them.
        </p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button className="btn-gold" onClick={onJoin} style={{padding:"14px 38px",fontSize:16,borderRadius:10}}>Join the Chat ✦</button>
          <button className="btn-ghost" style={{padding:"14px 28px",fontSize:15,borderRadius:10}} onClick={()=>document.getElementById("how")?.scrollIntoView({behavior:"smooth"})}>How It Works</button>
        </div>
        <div style={{marginTop:52,display:"flex",gap:36,flexWrap:"wrap",justifyContent:"center"}}>
          {[["Wi-Fi Only","Venue secured"],["Real-Time","Live database"],["0 Downloads","Works in browser"]].map(([n,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"'Playfair Display',serif"}} className="gold-text">{n}</div>
              <div style={{fontSize:12,color:"#444",marginTop:3,letterSpacing:.5}}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" style={{padding:"70px 5%",maxWidth:1100,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:52}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:2,marginBottom:10}}>THE PROCESS</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(26px,4vw,44px)",fontWeight:700}}>Three steps to <span className="gold-text">connection</span></h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:20}}>
          {steps.map((s,i)=>(
            <div key={i} className="glass" style={{padding:30,borderRadius:16,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-4,fontSize:72,fontWeight:900,color:GOLD,opacity:.05,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:32,fontWeight:900,color:GOLD,marginBottom:14,fontFamily:"'Playfair Display',serif"}}>{s.n}</div>
              <div style={{fontSize:17,fontWeight:600,marginBottom:7,color:"#e8e0d0"}}>{s.t}</div>
              <div style={{color:"#666",lineHeight:1.65,fontSize:14}}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{padding:"70px 5%",maxWidth:1100,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:52}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:2,marginBottom:10}}>WHAT YOU GET</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(26px,4vw,44px)",fontWeight:700}}>Built for the <span className="gold-text">barcade experience</span></h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
          {features.map((f,i)=>(
            <div key={i} style={{padding:22,borderRadius:14,background:SURFACE,border:`1px solid ${BORDER}`,transition:"all .2s",cursor:"default"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD_DIM;e.currentTarget.style.background=SURFACE2;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=SURFACE;}}>
              <div style={{fontSize:24,marginBottom:10}}>{f.icon}</div>
              <div style={{fontWeight:600,marginBottom:5,fontSize:15}}>{f.t}</div>
              <div style={{color:"#555",fontSize:13,lineHeight:1.65}}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{padding:"70px 5%",textAlign:"center",borderTop:`1px solid ${BORDER}`,background:`linear-gradient(180deg,transparent,rgba(201,168,76,0.04))`}}>
        <img src={LOGO_SRC} alt="EasyCart" style={{width:64,height:64,objectFit:"contain",background:"#fff",borderRadius:14,padding:5,marginBottom:24}}/>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(26px,4vw,48px)",fontWeight:900,marginBottom:12}}>The room is <span className="gold-text">live now</span></h2>
        <p style={{color:"#555",marginBottom:32,fontSize:15}}>Guests are already chatting at {VENUE_NAME}</p>
        <button className="btn-gold" onClick={onJoin} style={{padding:"15px 44px",fontSize:16,borderRadius:10}}>Enter the Chat ✦</button>
      </section>

      <footer style={{borderTop:`1px solid ${BORDER}`,padding:"20px 5%",display:"flex",justifyContent:"space-between",alignItems:"center",color:"#2a2a2a",fontSize:12,flexWrap:"wrap",gap:10}}>
        <Logo size={24} showText={true}/>
        <span>{VENUE_NAME} · {VENUE_LOCATION}</span>
        <span onClick={onAdminTap} style={{cursor:"default",userSelect:"none"}}>Venue Wi-Fi secured · No accounts</span>
      </footer>
    </div>
  );
}

// ── Entry screen ──────────────────────────────────────────────────────────────
function Entry({onEnter,wifiOk,tableId}){
  const [step,setStep]=useState(tableId?"profile":"access"); // skip access code if table QR
  const [accessCode,setAccessCode]=useState("");
  const [accessError,setAccessError]=useState("");
  const [nickname,setNickname]=useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [gender,setGender]=useState("");
  const [color,setColor]=useState(COLORS[0]);
  const [agreed,setAgreed]=useState(false);
  const [showGuide,setShowGuide]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  const checkCode=async()=>{
    if(!accessCode.trim()){setAccessError("Please enter the access code.");return;}
    // Phase 7 — brute-force guard on the venue access code (5 tries / 5 min)
    if(!await rateLimit(getDeviceFingerprint(),"join")){
      setAccessError("Too many attempts. Please wait a few minutes.");
      return;
    }
    try{
      const {data,error}=await supabase.from("settings").select("value").eq("key","access_code").single();
      const correct=((error||!data?.value)?"EASYCART2025":data.value).trim().toUpperCase();
      if(accessCode.trim().toUpperCase()===correct){
        setStep("profile");
        setAccessError("");
      } else {
        setAccessError("Incorrect code. Please ask staff for the access code.");
      }
    }catch(e){
      logError("checkCode",e);
      setAccessError("Could not verify code. Check your Wi-Fi and try again.");
    }
  };

  const submit=async()=>{
    if(!nickname.trim()){setError("Please enter a nickname");return;}
    if(!firstName.trim()||!lastName.trim()){setError("Please enter your full name");return;}
    if(!gender){setError("Please select your gender");return;}
    if(!agreed){setError("Please accept the community guidelines");return;}
    setLoading(true);
    try{
      const userId=randomId();
      const genderInfo=GENDERS.find(g=>g.value===gender);
      const {data,error:err}=await supabase.from("users").insert({
        id:userId,
        name:nickname.trim(),
        first_name:firstName.trim(),
        last_name:lastName.trim(),
        gender:gender,
        color,
        room_id:ROOM_ID,
        status:"online",
        last_seen:new Date().toISOString()
      }).select().single();
      if(err)throw err;
      await supabase.from("messages").insert({
        room_id:ROOM_ID, user_id:userId,
        text:`${nickname.trim()} joined the chat ${genderInfo?.emoji||"👋"}`,
        type:"system"
      });
      // Save session to localStorage + fingerprint
      saveSession(data, tableId, await getTableEpoch(tableId));
      onEnter(data);
    }catch(e){
      setError("Connection error. Check your Wi-Fi and try again.");
      setLoading(false);
    }
  };

  if(!wifiOk) return(
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,padding:20}}>
      <div className="glass slide-up" style={{padding:40,borderRadius:20,maxWidth:400,textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:16}}>📶</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:12}} className="gold-text">Venue Wi-Fi Required</h2>
        <p style={{color:"#666",lineHeight:1.7,marginBottom:20,fontSize:14}}>
          EZChat only works inside {VENUE_NAME}. Please connect to the venue Wi-Fi:
        </p>
        <div style={{background:SURFACE2,border:`1px solid ${GOLD_DIM}55`,borderRadius:10,padding:"14px 18px",fontSize:15,color:GOLD,fontWeight:600,marginBottom:20,letterSpacing:.5}}>
          📶 {VENUE_WIFI}
        </div>
        <p style={{fontSize:12,color:"#444",lineHeight:1.6}}>🔒 This keeps all chats private to guests currently in the venue.</p>
      </div>
    </div>
  );

  // ── STEP 1: Access Code Screen ──
  if(step==="access") return(
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% 45%,rgba(201,168,76,0.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div className="glass slide-up" style={{width:"100%",maxWidth:400,borderRadius:20,padding:"36px 28px",position:"relative",zIndex:1,textAlign:"center"}}>
        <img src={LOGO_SRC} alt="EasyCart" style={{width:68,height:68,objectFit:"contain",background:"#fff",borderRadius:14,padding:5,marginBottom:16}}/>
        <div style={{fontSize:32,marginBottom:8}}>🔐</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:900,marginBottom:6}} className="gold-text">Access Code</h1>
        <p style={{color:"#555",fontSize:13,marginBottom:24,lineHeight:1.6}}>Ask EasyCart staff for tonight's access code to join the chat.</p>
        <input
          value={accessCode}
          onChange={e=>setAccessCode(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&checkCode()}
          placeholder="Enter access code"
          style={{width:"100%",padding:"13px 14px",fontSize:18,letterSpacing:3,textAlign:"center",marginBottom:14,borderRadius:10,fontWeight:700}}
          maxLength={20}
        />
        {accessError&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,padding:"9px 13px",fontSize:13,color:"#F87171",marginBottom:14}}>{accessError}</div>}
        <button className="btn-gold" onClick={checkCode} style={{width:"100%",padding:13,fontSize:15,borderRadius:10}}>
          Verify Code ✦
        </button>
        <p style={{fontSize:11,color:"#333",marginTop:16}}>🔒 This ensures only EasyCart guests can join</p>
      </div>
    </div>
  );

  // ── STEP 2: Profile Setup Screen ──
  return(
    <div style={{height:"100dvh",overflowY:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",background:BG,padding:20,position:"relative"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% 30%,rgba(201,168,76,0.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div className="glass slide-up" style={{width:"100%",maxWidth:440,borderRadius:20,padding:"32px 28px",position:"relative",zIndex:1,margin:"20px 0"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <img src={LOGO_SRC} alt="EasyCart" style={{width:60,height:60,objectFit:"contain",background:"#fff",borderRadius:12,padding:4,marginBottom:10}}/>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:900,marginBottom:4}} className="gold-text">Set Up Your Profile</h1>
          <p style={{color:"#555",fontSize:13}}>{VENUE_NAME}</p>
          {tableId&&(
            <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,background:`rgba(52,211,153,0.08)`,border:`1px solid rgba(52,211,153,0.25)`,borderRadius:10,padding:"5px 14px",fontSize:12,color:"#34D399"}}>
              📍 Table <strong>{tableId}</strong>
            </div>
          )}
        </div>

        {/* Real name - private */}
        <div style={{background:`rgba(201,168,76,0.05)`,border:`1px solid ${GOLD_DIM}33`,borderRadius:12,padding:"14px 16px",marginBottom:18}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            🔒 REAL NAME <span style={{color:"#444",fontWeight:400,letterSpacing:0,fontSize:10}}>— private, only seen by venue staff</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" style={{width:"100%",padding:"10px 12px",fontSize:14}}/>
            </div>
            <div style={{flex:1}}>
              <input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" style={{width:"100%",padding:"10px 12px",fontSize:14}}/>
            </div>
          </div>
        </div>

        {/* Nickname - public */}
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,color:"#666",letterSpacing:1,display:"block",marginBottom:7}}>
            NICKNAME <span style={{color:"#444",fontWeight:400,letterSpacing:0,fontSize:10}}>— shown in chat</span>
          </label>
          <input value={nickname} onChange={e=>setNickname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="What should others call you?" style={{width:"100%",padding:"11px 14px",fontSize:15}} maxLength={24}/>
        </div>

        {/* Gender */}
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,color:"#666",letterSpacing:1,display:"block",marginBottom:10}}>GENDER</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {GENDERS.map(g=>(
              <button key={g.value} onClick={()=>setGender(g.value)} style={{padding:"10px 8px",borderRadius:10,border:`1px solid ${gender===g.value?GOLD:BORDER}`,background:gender===g.value?`rgba(201,168,76,0.12)`:SURFACE2,color:gender===g.value?GOLD:"#888",cursor:"pointer",fontSize:13,fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:8,transition:"all .15s",fontWeight:gender===g.value?600:400}}>
                <span style={{fontSize:16}}>{g.emoji}</span>{g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Avatar color */}
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:"#666",letterSpacing:1,display:"block",marginBottom:9}}>AVATAR COLOR</label>
          <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setColor(c)} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent",transition:"transform .15s",transform:color===c?"scale(1.2)":"scale(1)",boxShadow:color===c?`0 0 10px ${c}66`:"none"}}/>
            ))}
          </div>
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${color},${color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#080808",fontSize:12,border:`2px solid ${color}55`}}>{nickname?initials(nickname):"?"}</div>
            <span style={{fontSize:12,color:"#444"}}>{nickname||"Your preview"}</span>
            {gender&&<span style={{fontSize:16}}>{GENDERS.find(g=>g.value===gender)?.emoji}</span>}
          </div>
        </div>

        {/* Guidelines */}
        <div style={{marginBottom:18,display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}} onClick={()=>setAgreed(a=>!a)}>
          <div style={{width:19,height:19,borderRadius:5,border:`1px solid ${agreed?GOLD:BORDER}`,background:agreed?`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",marginTop:1}}>
            {agreed&&<span style={{fontSize:11,color:"#080808",fontWeight:800}}>✓</span>}
          </div>
          <p style={{fontSize:13,color:"#555",lineHeight:1.55}}>
            I agree to the <span style={{color:GOLD,cursor:"pointer",textDecoration:"underline"}} onClick={e=>{e.stopPropagation();setShowGuide(true);}}>Community Guidelines</span>. This chat may be monitored for safety.
          </p>
        </div>

        {error&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,padding:"9px 13px",fontSize:13,color:"#F87171",marginBottom:14}}>{error}</div>}

        <button className="btn-gold" onClick={submit} disabled={loading} style={{width:"100%",padding:13,fontSize:15,borderRadius:10,opacity:loading?.7:1}}>
          {loading?"Connecting…":"Enter the Room ✦"}
        </button>
        <button onClick={()=>setStep("access")} style={{width:"100%",marginTop:10,padding:10,background:"none",border:"none",color:"#444",fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>← Back</button>
      </div>

      {showGuide&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowGuide(false)}>
          <div className="glass" style={{maxWidth:440,borderRadius:20,padding:32}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:21,marginBottom:18}} className="gold-text">Community Guidelines</h2>
            {["Be respectful to all guests","No harassment or hate speech","Keep conversations appropriate","No spam or repetitive messages","Respect everyone's privacy","Report violations using the report button"].map((g,i)=>(
              <div key={i} style={{display:"flex",gap:10,marginBottom:11,fontSize:14,color:"#ccc",lineHeight:1.5}}><span style={{color:GOLD,flexShrink:0}}>✦</span>{g}</div>
            ))}
            <button className="btn-gold" onClick={()=>setShowGuide(false)} style={{width:"100%",padding:11,marginTop:10,fontSize:14}}>Got it, let's chat</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emoji Picker ──────────────────────────────────────────────────────────────
function EmojiPicker({onSelect,onClose}){
  return(
    <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:12,padding:10,display:"flex",flexWrap:"wrap",gap:3,width:230,zIndex:50,boxShadow:"0 8px 40px rgba(0,0,0,0.7)"}}>
      {EMOJIS.map(e=>(
        <button key={e} onClick={()=>{onSelect(e);onClose();}} style={{background:"none",border:"none",fontSize:19,cursor:"pointer",padding:5,borderRadius:6,lineHeight:1,transition:"background .1s"}} onMouseEnter={e2=>e2.currentTarget.style.background=SURFACE} onMouseLeave={e2=>e2.currentTarget.style.background="none"}>{e}</button>
      ))}
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────
function ProfileCard({user,me,onClose,onDM,onBlock,onReport}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="glass slide-up" style={{maxWidth:280,width:"100%",borderRadius:20,padding:28,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        <Avatar user={user} size={70}/>
        <h3 style={{marginTop:12,fontSize:18,fontWeight:600}}>{user.name}</h3>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:5,marginBottom:4}}>
          <div className={`online-dot ${user.status==="away"?"away":""}`}/>
          <span style={{fontSize:12,color:"#555",textTransform:"capitalize"}}>{user.status||"online"}</span>
        </div>
        <div style={{fontSize:12,color:"#333",marginBottom:18}}>at {VENUE_NAME}</div>
        {user.id!==me.id&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button className="btn-gold" onClick={onDM} style={{padding:10,fontSize:13,borderRadius:8}}>Send Message</button>
            <button className="btn-ghost" onClick={onReport} style={{padding:10,fontSize:13,borderRadius:8}}>Report</button>
            <button onClick={onBlock} style={{padding:10,fontSize:13,background:"none",border:"1px solid rgba(248,113,113,0.2)",color:"#F87171",cursor:"pointer",borderRadius:8,fontFamily:"Inter,sans-serif"}}>Block User</button>
          </div>
        )}
        <button onClick={onClose} style={{marginTop:14,background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:12}}>Close</button>
      </div>
    </div>
  );
}

// ── Image Modal ───────────────────────────────────────────────────────────────
function ImageModal({src,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.97)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <img src={src} alt="Full" style={{maxWidth:"92%",maxHeight:"90dvh",borderRadius:10,objectFit:"contain"}}/>
      <button onClick={onClose} style={{position:"fixed",top:18,right:18,background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0",borderRadius:"50%",width:38,height:38,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>×</button>
    </div>
  );
}

// ── Private Message Panel ─────────────────────────────────────────────────────
function PMPanel({target,me,onClose,notifications}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(true);
  const endRef=useRef(null);
  const {playSound,pushNotif,markDMRead}=notifications||{};

  useEffect(()=>{if(markDMRead)markDMRead(target.id);},[target.id]);
  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const {data}=await supabase.from("direct_messages")
        .select("*")
        .or(`and(from_id.eq.${me.id},to_id.eq.${target.id}),and(from_id.eq.${target.id},to_id.eq.${me.id})`)
        .order("created_at",{ascending:true});
      if(data)setMsgs(data);
      setLoading(false);
    };
    load();
    const ch=supabase.channel(`dm-${[me.id,target.id].sort().join("-")}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"direct_messages"},payload=>{
        const m=payload.new;
        if((m.from_id===me.id&&m.to_id===target.id)||(m.from_id===target.id&&m.to_id===me.id)){
          setMsgs(p=>[...p,m]);
          // Notify only for incoming messages
          if(m.from_id===target.id){
            if(playSound)playSound();
            if(pushNotif)pushNotif("EZChat — Private Message","You have a new message");
          }
        }
      }).subscribe();
    return()=>supabase.removeChannel(ch);
  },[me.id,target.id]);

  const send=async()=>{
    if(!input.trim())return;
    if(!await rateLimit(me.id,"dm"))return; // Phase 7 — DM spam guard
    const text=filterMsg(input.trim());
    setInput("");
    const {error}=await supabase.from("direct_messages").insert({from_id:me.id,to_id:target.id,text,created_at:new Date().toISOString()});
    if(error)logError("sendDM",error,{user_id:me.id});
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="glass slide-up" style={{width:"100%",maxWidth:400,borderRadius:20,overflow:"hidden",display:"flex",flexDirection:"column",height:480}}>
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:10,background:SURFACE2}}>
          <Avatar user={target} size={34}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{target.name}</div>
            <div style={{fontSize:11,color:"#555"}}>Private · {VENUE_NAME}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#444",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:8}}>
          {loading?[1,2].map(i=><div key={i} className="skel" style={{height:36,width:"60%",alignSelf:i%2?"flex-end":"flex-start"}}/>):null}
          {!loading&&msgs.length===0&&<div style={{color:"#333",fontSize:13,textAlign:"center",margin:"auto"}}>Say hello to {target.name} 👋</div>}
          {msgs.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:m.from_id===me.id?"flex-end":"flex-start"}} className="fade-in">
              <div className={`pm-bubble ${m.from_id===me.id?"mine":"theirs"}`}>{m.text}</div>
            </div>
          ))}
          <div ref={endRef}/>
        </div>
        <div style={{padding:"10px 12px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,background:SURFACE}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message…" maxLength={500} style={{flex:1,padding:"9px 13px",fontSize:14}}/>
          <button className="btn-gold" onClick={send} style={{padding:"9px 16px",fontSize:13,borderRadius:8}}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Chat Room ────────────────────────────────────────────────────────────
function ChatRoom({me,onLeave,showToast,notifications,tableId}){
  const {soundOn,setSoundOn,unreadDMs,totalUnread,playSound,pushNotif,showPopup,notifPopups,setNotifPopups,markDMRead,addUnreadDM}=notifications;
  const [showMenu,setShowMenu]=useState(false);
  const hasTable = !!tableId;
  const [messages,setMessages]=useState([]);
  const [users,setUsers]=useState([]);
  // Mirror of `users` that the realtime message handler can read without being
  // re-created (and re-subscribed) on every user-list change.
  const usersRef=useRef([]);
  useEffect(()=>{usersRef.current=users;},[users]);
  const [input,setInput]=useState("");
  const [typingUsers,setTypingUsers]=useState([]);
  const [showEmoji,setShowEmoji]=useState(false);
  const [showProfile,setShowProfile]=useState(null);
  const [pmTarget,setPmTarget]=useState(null);
  const [blockedIds,setBlockedIds]=useState([]);
  const [selectedImg,setSelectedImg]=useState(null);
  const [sideTab,setSideTab]=useState("users");
  const [mobileTab,setMobileTab]=useState("chat");
  const [annIdx,setAnnIdx]=useState(0);
  const [announcements,setAnnouncements]=useState(["🥂 Welcome to EasyCart!"]);
  const [loadingMsgs,setLoadingMsgs]=useState(true);
  const [blockedWordsList,setBlockedWordsList]=useState([]);
  const endRef=useRef(null);
  const fileRef=useRef(null);
  const inputRef=useRef(null);
  const typingTimeout=useRef(null);

  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[messages]);
  useEffect(()=>{const t=setInterval(()=>setAnnIdx(i=>(i+1)%announcements.length),5000);return()=>clearInterval(t);},[announcements.length]);

  // ── Load blocked words from Supabase ──
  useEffect(()=>{
    const loadWords=async()=>{
      const {data}=await supabase.from("blocked_words").select("word");
      if(data)setBlockedWordsList(data.map(w=>w.word));
    };
    loadWords();
    const ch=supabase.channel("blocked-words-watch")
      .on("postgres_changes",{event:"*",schema:"public",table:"blocked_words"},loadWords)
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  // ── Load announcements ──
  useEffect(()=>{
    const load=async()=>{
      const {data}=await supabase.from("announcements").select("text").eq("room_id",ROOM_ID).order("pinned",{ascending:false}).order("created_at",{ascending:false}).limit(5);
      if(data&&data.length>0)setAnnouncements(data.map(a=>a.text));
    };
    load();
    const ch=supabase.channel("ann-chat").on("postgres_changes",{event:"*",schema:"public",table:"announcements"},load).subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  // ── Load initial messages ──
  useEffect(()=>{
    const load=async()=>{
      setLoadingMsgs(true);
      const {data}=await supabase.from("messages")
        .select("*, users(id,name,color,status)")
        .eq("room_id",ROOM_ID)
        .order("created_at",{ascending:true})
        .limit(100);
      if(data)setMessages(data);
      setLoadingMsgs(false);
    };
    load();
  },[]);

  // ── Subscribe to new messages ──
  useEffect(()=>{
    const ch=supabase.channel("room-messages")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`room_id=eq.${ROOM_ID}`},async payload=>{
        const m=payload.new;
        // EGRESS FIX: this fired a SELECT on `users` for EVERY message, on EVERY
        // phone in the room. One message from a table of 60 = 60 extra queries.
        // The sender is almost always already in the `users` list we hold —
        // only hit the network for someone we've genuinely never seen.
        let userData = usersRef.current.find(u=>u.id===m.user_id);
        if(!userData){
          const {data}=await supabase.from("users").select("id,name,color,status").eq("id",m.user_id).maybeSingle();
          userData=data;
        }
        setMessages(p=>[...p,{...m,users:userData}]);
        // Notify for messages from others (not system)
        if(m.user_id!==me.id&&m.type!=="system"){
          playSound();
          if(document.hidden){
            pushNotif("EZChat — New Message",`${userData?.name||"Someone"} sent a message in the lounge`);
          }
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`room_id=eq.${ROOM_ID}`},payload=>{
        setMessages(p=>p.map(m=>m.id===payload.new.id?{...m,...payload.new}:m));
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`room_id=eq.${ROOM_ID}`},payload=>{
        setMessages(p=>p.filter(m=>m.id!==payload.old.id));
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  // ── Load and subscribe to online users ──
  useEffect(()=>{
    // EGRESS FIX (the big one). Every guest heartbeats into `users`. This channel
    // listened to event:"*" on that table, so EVERY heartbeat from EVERY guest
    // pushed an event to EVERY guest, and each one ran a full `SELECT *`.
    // That is N x N full-table reads per heartbeat cycle — quadratic. 60 guests
    // in a silent room generated ~432,000 reads/hour.
    //
    // Fix: coalesce the storm. However many events arrive, we re-read at most
    // once every 6 seconds — and only the columns we actually render.
    let timer=null, dead=false;

    const load=async()=>{
      const {data}=await supabase
        .from("users")
        .select("id,name,color,status,gender,avatar_url,last_seen")  // real columns, not "*"
        .eq("room_id",ROOM_ID)
        .gte("last_seen",new Date(Date.now()-300000).toISOString());
      if(data&&!dead)setUsers(data);
    };

    const loadDebounced=()=>{
      if(timer)return;                       // a refresh is already queued
      timer=setTimeout(()=>{ timer=null; load(); },6000);
    };

    load();
    const ch=supabase.channel("room-users")
      .on("postgres_changes",{event:"*",schema:"public",table:"users",filter:`room_id=eq.${ROOM_ID}`},loadDebounced)
      .subscribe();
    return()=>{
      dead=true;
      if(timer)clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  },[]);

  // ── Listen for incoming DMs (for red dot + notification when PM panel is closed) ──
  useEffect(()=>{
    const ch=supabase.channel(`dm-inbox-${me.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"direct_messages",filter:`to_id=eq.${me.id}`},payload=>{
        const m=payload.new;
        // Only notify if PM panel is not open with this sender
        if(!pmTarget||pmTarget.id!==m.from_id){
          addUnreadDM(m.from_id);
          playSound();
          const sender=users.find(u=>u.id===m.from_id);
          showPopup(`💬 ${sender?.name||"Someone"}: You have a new message`,()=>{
            const u=users.find(x=>x.id===m.from_id);
            if(u)setPmTarget(u);
          });
          pushNotif("EZChat — Private Message","You have a new message");
        }
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[me.id,pmTarget,users]);

  // ── Watch for kick/block by staff ──
  useEffect(()=>{
    const ch=supabase.channel(`user-status-${me.id}`)
      .on("postgres_changes",{
        event:"UPDATE",
        schema:"public",
        table:"users",
        filter:`id=eq.${me.id}`
      },payload=>{
        const status=payload.new.status;
        if(status==="blocked"){
          onLeave("blocked");
        } else if(status==="kicked"){
          onLeave("kicked");
        }
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[me.id]);

  // ── Heartbeat — keep user online ──
  useEffect(()=>{
    const beat=async()=>{
      // EGRESS FIX: this used to do TWO queries every 30s per guest — a SELECT
      // to check status, then an UPDATE. The UPDATE can return the row itself,
      // so one round-trip does both. Kick/block already arrives instantly on the
      // dedicated `user-status-${me.id}` realtime channel, so the SELECT was
      // redundant anyway.
      const {data,error}=await supabase
        .from("users")
        .update({last_seen:new Date().toISOString(),status:"online"})
        .eq("id",me.id)
        .neq("status","blocked")
        .neq("status","kicked")
        .select("status")
        .maybeSingle();

      // No row came back AND no error → the user was wiped by cleanup, or is
      // blocked/kicked (in which case the status channel handles the redirect).
      if(error){ logError("heartbeat",error,{user_id:me.id}); return; }
      if(!data){
        const {data:still}=await supabase.from("users").select("id").eq("id",me.id).maybeSingle();
        if(!still){ clearSession(); onLeave("landing"); }
      }
    };
    beat();
    // EGRESS FIX: 30s → 60s. Halves heartbeat traffic. The presence list still
    // filters on last_seen within 5 minutes, so nobody drops off early.
    const t=setInterval(beat,60000);
    return()=>{
      clearInterval(t);
      supabase.from("users").update({status:"offline",last_seen:new Date().toISOString()}).eq("id",me.id);
      supabase.from("messages").insert({room_id:ROOM_ID,user_id:me.id,text:`${me.name} left the chat`,type:"system"});
    };
  },[me.id,me.name]);

  // ── Typing indicators via Supabase Realtime broadcast ──
  const typingCh = useRef(null);   // BUGFIX: reuse ONE subscribed channel
  useEffect(()=>{
    const ch=supabase.channel(`typing-${ROOM_ID}`)
      .on("broadcast",{event:"typing"},(payload)=>{
        if(payload.payload.userId===me.id)return;
        const {userId,userName,isTyping}=payload.payload;
        setTypingUsers(p=>{
          if(isTyping&&!p.find(u=>u.id===userId))return[...p,{id:userId,name:userName}];
          if(!isTyping)return p.filter(u=>u.id!==userId);
          return p;
        });
      })
      .subscribe();
    typingCh.current=ch;
    return()=>{ typingCh.current=null; supabase.removeChannel(ch); };
  },[me.id]);

  // BUGFIX: this used to call supabase.channel(...) on EVERY keystroke, which
  // created a new (never-subscribed) channel object each time — a memory leak,
  // and the broadcast never actually reached anyone.
  const broadcastTyping=useCallback((isTyping)=>{
    typingCh.current?.send({type:"broadcast",event:"typing",payload:{userId:me.id,userName:me.name,isTyping}});
  },[me.id,me.name]);

  const handleInputChange=(e)=>{
    setInput(e.target.value);
    broadcastTyping(true);
    if(typingTimeout.current)clearTimeout(typingTimeout.current);
    typingTimeout.current=setTimeout(()=>broadcastTyping(false),2000);
  };

  // ── Send message ──
  const sendMsg=async()=>{
    if(!input.trim())return;
    // Phase 7 — rate limit
    if(!await rateLimit(me.id,"message")){
      showToast("Slow down a little ✦");
      return;
    }
    try{
      // Check if user is still allowed
      const {data:statusCheck}=await supabase.from("users").select("status").eq("id",me.id).single();
      if(statusCheck&&(statusCheck.status==="blocked"||statusCheck.status==="kicked")){
        onLeave(statusCheck.status);
        return;
      }
      const text=filterMsg(input.trim(),blockedWordsList);
      setInput("");
      broadcastTyping(false);
      const {error}=await supabase.from("messages").insert({room_id:ROOM_ID,user_id:me.id,text,type:"text",reactions:{}});
      if(error)throw error;
    }catch(e){
      logError("sendMsg",e,{user_id:me.id,table_id:tableId});
      showToast("Message failed — try again");
    }
  };

  // ── Send image ──
  const sendImage=async(file)=>{
    if(!file)return;
    if(file.size>15*1024*1024){showToast("Photo too large (max 15MB)");return;}
    if(!await rateLimit(me.id,"image")){showToast("Too many photos — wait a moment ✦");return;}
    showToast("Uploading image…");
    try{
      // PHASE 8 — compress BEFORE upload.
      // A phone shoots ~4000px / 3-5MB. Chat renders it at ~300px. Every one of
      // those bytes was billed twice: once on upload, and again on download for
      // EVERY guest in the room. One 3MB photo seen by 60 people = 180MB of
      // egress. That is what blew the Supabase quota (8.9GB against a 5GB cap).
      // 1600px @ q0.8 is visually identical on a phone and ~12x smaller.
      const compressed = await compressImage(file, 1600, 0.8);
      const path=`${ROOM_ID}/${randomId()}.jpg`;
      const {error}=await supabase.storage.from("chat-images")
        .upload(path, compressed, {contentType:"image/jpeg", cacheControl:"31536000"});
      if(error){showToast("Upload failed — try again");throw error;}
      const {data:{publicUrl}}=supabase.storage.from("chat-images").getPublicUrl(path);
      const {error:ie}=await supabase.from("messages").insert({room_id:ROOM_ID,user_id:me.id,image_url:publicUrl,type:"image",reactions:{}});
      if(ie)throw ie;
      showToast("Photo shared ✦");
    }catch(e){
      logError("sendImage",e,{user_id:me.id,table_id:tableId});
    }
  };

  // ── Toggle reaction ──
  const toggleReaction=async(msgId,emoji)=>{
    const msg=messages.find(m=>m.id===msgId);
    if(!msg)return;
    const r=msg.reactions||{};
    const updated={...r};
    if(!updated[emoji])updated[emoji]=[];
    if(updated[emoji].includes(me.id))updated[emoji]=updated[emoji].filter(x=>x!==me.id);
    else updated[emoji]=[...updated[emoji],me.id];
    if(updated[emoji].length===0)delete updated[emoji];
    await supabase.from("messages").update({reactions:updated}).eq("id",msgId);
    setMessages(p=>p.map(m=>m.id===msgId?{...m,reactions:updated}:m));
  };

  const blockUser=(uid)=>{setBlockedIds(p=>[...p,uid]);showToast("User blocked");setShowProfile(null);};
  const reportUser=()=>{showToast("Report submitted — thank you");setShowProfile(null);};
  const getUserFor=(m)=>m.users||users.find(u=>u.id===m.user_id)||{id:m.user_id,name:"Guest",color:GOLD,status:"online"};

  const visibleUsers=users.filter(u=>!blockedIds.includes(u.id)&&u.status!=="offline");
  const visibleMsgs=messages.filter(m=>!blockedIds.includes(m.user_id));

  // Phase 7 fix — useCart() must be called unconditionally, at the top level.
  // CartContext defaults to null, so this is safe even with no table / no provider.
  const cart = useCart();

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:BG,overflow:"hidden",position:"fixed",inset:0}} onClick={()=>showEmoji&&setShowEmoji(false)}>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div style={{height:50,minHeight:50,padding:"0 10px",display:"flex",alignItems:"center",gap:6,borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,zIndex:10}}>
        <Logo size={24} showText={false}/>
        {/* Announcement + online row */}
        <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:11,color:GOLD,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} className="ann-bar">
            📢 {announcements[annIdx]}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:1}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#34D399",flexShrink:0}}/>
            <span style={{fontSize:10,color:"#555"}}>{visibleUsers.length}</span>
            {[
              {l:"male",e:"👨",t:u=>u.gender==="male"},
              {l:"female",e:"👩",t:u=>u.gender==="female"},
              {l:"lgbtq",e:"🏳️‍🌈",t:u=>["gay","lesbian","bisexual","trans","nonbinary"].includes(u.gender)},
              {l:"prefer",e:"🤐",t:u=>u.gender==="prefer_not"},
            ].map(g=>{
              const c=visibleUsers.filter(g.t).length;
              return c>0?<span key={g.l} style={{fontSize:10,color:"#555"}}>{g.e}{c}</span>:null;
            })}
          </div>
        </div>
        {/* Action buttons */}
        <button onClick={()=>setShowMenu(true)} style={{background:`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,border:"none",borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:11,color:"#080808",fontFamily:"Inter,sans-serif",fontWeight:700,flexShrink:0}}>🍽️</button>
        <button onClick={()=>setSoundOn(s=>!s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,flexShrink:0,opacity:soundOn?1:0.35,padding:"2px"}}>{soundOn?"🔔":"🔕"}</button>
        <Avatar user={me} size={24}/>
        <button onClick={()=>onLeave("manual")} style={{background:"none",border:`1px solid ${BORDER}`,borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#555",fontFamily:"Inter,sans-serif",flexShrink:0}}>✕</button>
      </div>

      {/* ── BODY (flex row — sidebars hidden on mobile) ──────── */}
      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

        {/* Left sidebar - desktop only */}
        <div className="desktop-sidebar" style={{width:190,borderRight:`1px solid ${BORDER}`,background:SURFACE,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto",padding:"10px 6px"}}>
          <div style={{fontSize:10,color:GOLD,letterSpacing:1,padding:"2px 8px",marginBottom:8}}>ONLINE · {visibleUsers.length}</div>
          {visibleUsers.map(u=>(
            <div key={u.id} className="sidebar-item" onClick={()=>setShowProfile(u)} style={{display:"flex",alignItems:"center",gap:7,marginBottom:1}}>
              <div style={{position:"relative",flexShrink:0}}>
                <Avatar user={u} size={26}/>
                {unreadDMs[u.id]&&<div className="notif-dot"/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:u.id===me.id?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:u.id===me.id?"#C9A84C":"#ccc",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}{u.id===me.id?" ✦":""}</span>
                  {u.gender&&<span style={{fontSize:11,flexShrink:0}}>{u.gender==="male"?"👨":u.gender==="female"?"👩":["gay","lesbian","bisexual","trans","nonbinary"].includes(u.gender)?"🏳️‍🌈":u.gender==="prefer_not"?"🤐":""}</span>}
                </div>
              </div>
              <div className={`online-dot ${u.status==="away"?"away":""}`} style={{width:6,height:6}}/>
            </div>
          ))}
          <div style={{marginTop:"auto",paddingTop:12,borderTop:`1px solid ${BORDER}`}}>
            <div style={{fontSize:10,color:"#2a2a2a",textAlign:"center",lineHeight:1.5,padding:"0 4px"}}>🔒 {VENUE_WIFI}</div>
          </div>
        </div>

        {/* ── MAIN CHAT COLUMN ─────────────────────────────────── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>
          {/* Channel header */}
          <div style={{padding:"6px 12px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:6,flexShrink:0,background:SURFACE}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#34D399"}}/>
            <span style={{fontSize:12,fontWeight:600,color:"#ccc"}}># lounge-chat</span>
            <span style={{fontSize:10,color:"#333",marginLeft:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{VENUE_NAME}</span>
          </div>

          {/* Messages — this is the scrollable area */}
          <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"12px 10px 6px",WebkitOverflowScrolling:"touch"}}>
            {loadingMsgs&&[1,2,3,4].map(i=><MsgSkeleton key={i}/>)}
            {!loadingMsgs&&visibleMsgs.map((m,idx)=>{
              const u=getUserFor(m);
              const isMe=m.user_id===me.id;
              const isSystem=m.type==="system";
              const showAvatar=idx===0||visibleMsgs[idx-1].user_id!==m.user_id;
              if(isSystem)return(
                <div key={m.id} className="fade-in" style={{textAlign:"center",fontSize:11,color:"#333",padding:"3px 0 8px"}}>{m.text}</div>
              );
              return(
                <div key={m.id} className="fade-in" style={{display:"flex",gap:7,marginBottom:showAvatar?12:3,flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end"}}>
                  <div style={{width:28,flexShrink:0}}>
                    {showAvatar&&<Avatar user={u} size={28} onClick={()=>setShowProfile(u)}/>}
                  </div>
                  <div style={{maxWidth:"78%"}}>
                    {showAvatar&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2,flexDirection:isMe?"row-reverse":"row"}}>
                        <span style={{fontSize:11,fontWeight:600,color:isMe?GOLD:u.color}}>{isMe?"You":u.name}</span>
                        <span style={{fontSize:9,color:"#2a2a2a"}}>{fmtTime(m.created_at)}</span>
                      </div>
                    )}
                    <div className={`msg-bubble ${isMe?"msg-own":""}`}>
                      {m.type==="image"?(
                        <img src={m.image_url} alt="shared" style={{maxWidth:180,maxHeight:160,borderRadius:8,cursor:"pointer",display:"block"}} onClick={()=>setSelectedImg(m.image_url)}/>
                      ):(
                        <span style={{fontSize:14,lineHeight:1.5}}>{m.text}</span>
                      )}
                    </div>
                    {Object.keys(m.reactions||{}).length>0&&(
                      <div style={{display:"flex",gap:3,marginTop:3,flexWrap:"wrap",justifyContent:isMe?"flex-end":"flex-start"}}>
                        {Object.entries(m.reactions).filter(([,ids])=>ids.length>0).map(([emoji,ids])=>(
                          <button key={emoji} className={`reaction-btn ${ids.includes(me.id)?"active":""}`} onClick={()=>toggleReaction(m.id,emoji)}>
                            {emoji} {ids.length}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",gap:2,marginTop:2,flexWrap:"wrap",justifyContent:isMe?"flex-end":"flex-start",opacity:0}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                      {EMOJIS.slice(0,6).map(e=>(
                        <button key={e} onClick={()=>toggleReaction(m.id,e)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",padding:"1px 2px",lineHeight:1}}>{e}</button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUsers.filter(u=>!blockedIds.includes(u.id)).length>0&&(
              <div className="fade-in" style={{display:"flex",alignItems:"center",gap:7,padding:"3px 0 8px 35px"}}>
                <div style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"6px 10px",display:"flex",gap:4,alignItems:"center"}}>
                  <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                </div>
                <span style={{fontSize:10,color:"#333"}}>{typingUsers.filter(u=>!blockedIds.includes(u.id)).map(u=>u.name).join(", ")}</span>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* ── MESSAGE INPUT — always visible, never hidden ───── */}
          <div style={{padding:"8px 10px",borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom, 8px)"}}>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",position:"relative"}}>
              {showEmoji&&<EmojiPicker onSelect={e=>setInput(p=>p+e)} onClose={()=>setShowEmoji(false)}/>}
              <button onClick={e=>{e.stopPropagation();setShowEmoji(p=>!p);}} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 9px",cursor:"pointer",fontSize:16,flexShrink:0}}>😊</button>
              <button onClick={()=>fileRef.current?.click()} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 9px",cursor:"pointer",fontSize:14,flexShrink:0}}>📷</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{sendImage(e.target.files[0]);e.target.value="";}}/>
              <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}} placeholder="Message the room…" rows={1} maxLength={500} style={{flex:1,padding:"8px 11px",fontSize:14,resize:"none",lineHeight:1.5,borderRadius:8,maxHeight:80,overflowY:"auto"}}/>
              <button className="btn-gold" onClick={sendMsg} style={{padding:"8px 14px",fontSize:13,flexShrink:0,borderRadius:8}}>Send</button>
            </div>
          </div>
        </div>

        {/* Right sidebar - desktop only */}
        <div className="desktop-sidebar" style={{width:210,borderLeft:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
            {[["users","Guests"],["info","Venue"]].map(([v,l])=>(
              <button key={v} className={`tab-btn ${sideTab===v?"active":""}`} onClick={()=>setSideTab(v)}>{l}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:10}}>
            {sideTab==="users"?(
              <>
                <div style={{fontSize:10,color:"#2a2a2a",marginBottom:10,letterSpacing:1,padding:"0 2px"}}>ACTIVE GUESTS</div>
                {visibleUsers.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"6px 8px",borderRadius:9,cursor:u.id!==me.id?"pointer":"default",transition:"background .15s"}} onClick={()=>{if(u.id!==me.id){setPmTarget(u);markDMRead(u.id);}}} onMouseEnter={e=>{if(u.id!==me.id)e.currentTarget.style.background=SURFACE2;}} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <Avatar user={u} size={28}/>
                      {unreadDMs[u.id]&&<div className="notif-dot"/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:u.id===me.id?"#C9A84C":"#ccc"}}>{u.id===me.id?"You":u.name}</div>
                      <div style={{fontSize:10,color:u.status==="away"?"#F59E0B":"#34D399"}}>{u.status||"online"}</div>
                    </div>
                    {u.id!==me.id&&<span style={{fontSize:10,color:GOLD_DIM}}>DM</span>}
                  </div>
                ))}
              </>
            ):(
              <>
                <div style={{textAlign:"center",padding:"12px 0 14px"}}>
                  <img src={LOGO_SRC} alt="EasyCart" style={{width:48,height:48,objectFit:"contain",background:"#fff",borderRadius:10,padding:4,marginBottom:6}}/>
                  <div style={{fontSize:12,fontWeight:600,color:"#e8e0d0"}}>EasyCart</div>
                  <div style={{fontSize:10,color:"#555"}}>Barcade & Lounge</div>
                  <div style={{fontSize:9,color:"#333",marginTop:2}}>{VENUE_LOCATION}</div>
                </div>
                <div style={{height:1,background:BORDER,margin:"0 0 12px"}}/>
                <div style={{fontSize:10,color:"#2a2a2a",marginBottom:8,letterSpacing:1}}>TONIGHT</div>
                {announcements.map((a,i)=>(
                  <div key={i} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 10px",marginBottom:6,fontSize:11,lineHeight:1.5,color:"#ccc"}}>{a}</div>
                ))}
                <button onClick={()=>setShowMenu(true)} style={{width:"100%",marginTop:12,padding:"9px 0",background:`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,border:"none",borderRadius:9,color:"#080808",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>🍽️ View Full Menu</button>
                <div style={{fontSize:10,color:"#2a2a2a",margin:"14px 0 8px",letterSpacing:1}}>VENUE INFO</div>
                <div style={{fontSize:11,color:"#444",lineHeight:2}}><div>📍 {VENUE_LOCATION}</div><div>🔒 Wi-Fi secured</div><div>🍸 Hidden Bar inside</div></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────── */}
      <div className="mobile-only" style={{height:54,minHeight:54,borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,flexDirection:"row",zIndex:20,alignItems:"stretch",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {[
          {v:"chat",   icon:"💬", label:"Chat"},
          {v:"menu_tab",icon:"🍽️",label:"Menu"},
          ...(hasTable?[
            {v:"cart",   icon:"🛒", label:"Cart"},
            {v:"bill",   icon:"🧾", label:"Bill"},
          ]:[]),
          {v:"more",   icon:"•••",label:"More"},
        ].map(({v,icon,label})=>{
          const isActive = mobileTab===v;
          const cartBadge = v==="cart" && hasTable ? (cart?.cartCount||0) : 0;
          return(
            <button key={v} onClick={()=>{
              if(v==="menu_tab"){setShowMenu(true);}
              else{setMobileTab(v);}
            }}
              style={{flex:1,padding:"6px 2px 4px",background:"none",border:"none",
                borderTop:`2px solid ${isActive&&v!=="menu_tab"?GOLD:"transparent"}`,
                color:isActive&&v!=="menu_tab"?GOLD:"#555",
                fontFamily:"Inter,sans-serif",cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
                transition:"color .2s",position:"relative"}}>
              <div style={{position:"relative"}}>
                <span style={{fontSize:v==="more"?14:19,lineHeight:1,fontWeight:v==="more"?700:"normal"}}>{icon}</span>
                {v==="more"&&totalUnread>0&&(
                  <div style={{position:"absolute",top:-3,right:-6,background:"#F87171",color:"#fff",borderRadius:10,padding:"0 3px",fontSize:8,fontWeight:700,minWidth:12,textAlign:"center",lineHeight:"12px"}}>{totalUnread}</div>
                )}
                {cartBadge>0&&(
                  <div style={{position:"absolute",top:-3,right:-6,background:GOLD,color:"#080808",borderRadius:10,padding:"0 3px",fontSize:8,fontWeight:700,minWidth:12,textAlign:"center",lineHeight:"12px"}}>{cartBadge}</div>
                )}
              </div>
              <span style={{fontSize:9,letterSpacing:.3}}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── MOBILE PANELS (full-screen overlays) ─────────────── */}
      {/* Cart Tab */}
      {mobileTab==="cart"&&hasTable&&(
        <div className="mobile-only" style={{position:"fixed",top:50,left:0,right:0,bottom:54,background:BG,zIndex:100,flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:SURFACE,flexShrink:0}}>
            <span style={{fontWeight:600,fontSize:14,color:GOLD}}>🛒 Your Cart</span>
            <button onClick={()=>setMobileTab("chat")} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
          <CartTab me={me}/>
        </div>
      )}

      {/* Bill Tab */}
      {mobileTab==="bill"&&hasTable&&(
        <div className="mobile-only" style={{position:"fixed",top:50,left:0,right:0,bottom:54,background:BG,zIndex:100,flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:SURFACE,flexShrink:0}}>
            <span style={{fontWeight:600,fontSize:14,color:GOLD}}>🧾 Current Bill</span>
            <button onClick={()=>setMobileTab("chat")} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
          <BillTab/>
        </div>
      )}

      {/* More Tab (Guests + Venue) */}
      {mobileTab==="more"&&(
        <div className="mobile-only" style={{position:"fixed",top:50,left:0,right:0,bottom:54,background:BG,zIndex:100,flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:SURFACE,flexShrink:0}}>
            <span style={{fontWeight:600,fontSize:14,color:GOLD}}>••• More</span>
            <button onClick={()=>setMobileTab("chat")} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
          <MoreTab
            me={me}
            users={visibleUsers}
            announcements={announcements}
            blockedIds={blockedIds}
            setPmTarget={setPmTarget}
            markDMRead={markDMRead}
            unreadDMs={unreadDMs}
            setShowMenu={setShowMenu}
            setMobileTab={setMobileTab}
          />
        </div>
      )}

      {/* ── OVERLAYS ──────────────────────────────────────────── */}
      {showProfile&&<ProfileCard user={showProfile} me={me} onClose={()=>setShowProfile(null)} onDM={()=>{setPmTarget(showProfile);setShowProfile(null);}} onBlock={()=>blockUser(showProfile.id)} onReport={reportUser}/>}
      {pmTarget&&<PMPanel target={pmTarget} me={me} onClose={()=>{setPmTarget(null);}} notifications={{playSound,pushNotif,markDMRead}}/>}
      {selectedImg&&<ImageModal src={selectedImg} onClose={()=>setSelectedImg(null)}/>}
      {showMenu&&<MenuModal onClose={()=>setShowMenu(false)} hasTable={hasTable}/>}
      <ReceiptPopup receipt={hasTable&&cart?.showReceipt?cart.showReceipt:null} onClose={()=>cart?.setShowReceipt(null)}/>

      {/* In-app DM notification popups */}
      <div style={{position:"fixed",top:60,right:12,zIndex:9998,display:"flex",flexDirection:"column",gap:8,maxWidth:260,pointerEvents:"none"}}>
        {notifPopups.map(n=>(
          <div key={n.id} className="notif-popup" style={{pointerEvents:"all"}} onClick={()=>{if(n.onClick)n.onClick();setNotifPopups(p=>p.filter(x=>x.id!==n.id));}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>💬</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:GOLD,fontWeight:600,marginBottom:1}}>EZChat</div>
                <div style={{fontSize:12,color:"#ccc"}}>{n.msg}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();setNotifPopups(p=>p.filter(x=>x.id!==n.id));}} style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:14,flexShrink:0,fontFamily:"Inter,sans-serif",padding:0}}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── PHASE 8: offline banner (guest) ──────────────────────────────────────────
// If the wifi drops, a guest could tap "Confirm Order" and get nothing. Better
// they see the truth than think the kitchen has their food.
function GuestConnectionBanner(){
  const {connected} = useConnection();
  if(connected) return null;
  // BUGFIX: was position:fixed, which sat ON TOP of the header and hid it.
  // A normal block element pushes the page down instead.
  return (
    <div style={{
      background:"#7F1D1D", color:"#fff", textAlign:"center",
      padding:"7px 12px", fontSize:12.5, fontWeight:600,
      fontFamily:"Inter,sans-serif", flexShrink:0,
    }}>
      ⚠ Offline — orders won't send. Reconnecting…
    </div>
  );
}

// ── PHASE 8: client-side image compression ───────────────────────────────────
// Downscale + re-encode in the browser before anything touches the network.
// Falls back to the original file if anything goes wrong — never block a guest
// from sharing a photo just because compression failed.
function compressImage(file, maxDim=1600, quality=0.8){
  return new Promise(resolve=>{
    try{
      if(!file.type.startsWith("image/")) return resolve(file);
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = ()=>{
        URL.revokeObjectURL(url);
        let {width:w, height:h} = img;
        if(w>maxDim || h>maxDim){
          const scale = maxDim/Math.max(w,h);
          w = Math.round(w*scale);
          h = Math.round(h*scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          blob=>resolve(blob && blob.size < file.size ? blob : file),
          "image/jpeg",
          quality
        );
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    }catch(_){ resolve(file); }
  });
}

// ── Cart Context (global cart state) ─────────────────────────────────────────
const CartContext = React.createContext(null);

function useCart(){
  return React.useContext(CartContext);
}

function CartProvider({children, tableId}){
  const [cartItems, setCartItems] = React.useState([]);
  const [orderHistory, setOrderHistory] = React.useState([]);
  const [tab, setTab] = React.useState(null);
  const [showReceipt, setShowReceipt] = React.useState(null);
  const submittingRef = React.useRef(false); // Phase 7 — double-submit lock

  const [pastRounds, setPastRounds] = React.useState([]);   // settled tabs, this guest only

  const loadTabItems = async(tabId)=>{
    const {data} = await supabase
      .from("order_items")
      .select("*, orders(user_name,created_at,status,id)")
      .eq("tab_id", tabId)
      .eq("voided", false)
      .order("created_at", {ascending:true});
    return data||[];
  };

  // Earlier rounds THIS GUEST paid for, at this table.
  // Privacy: scoped to the guest's own user_id, so when a new group sits at C4
  // they do NOT see what the last group spent.
  const loadPastRounds = React.useCallback(async(userId)=>{
    if(!userId||!tableId) return;
    const {data:mine} = await supabase
      .from("orders")
      .select("tab_id")
      .eq("user_id", userId)
      .eq("table_id", tableId);
    const tabIds = [...new Set((mine||[]).map(o=>o.tab_id))];
    if(!tabIds.length){ setPastRounds([]); return; }

    const {data:closed} = await supabase
      .from("table_tabs")
      .select("id,total,closed_at,status")
      .in("id", tabIds)
      .eq("status","closed")
      .order("closed_at",{ascending:true});
    if(!closed?.length){ setPastRounds([]); return; }

    const rounds = [];
    for(const c of closed){
      rounds.push({ ...c, items: await loadTabItems(c.id) });
    }
    setPastRounds(rounds);
  },[tableId]);

  // Load existing tab and orders on mount
  React.useEffect(()=>{
    if(!tableId) return;
    const init = async()=>{
      const t = await getOrCreateTab(tableId);
      setTab(t);
      if(t) setOrderHistory(await loadTabItems(t.id));
    };
    init();
  },[tableId]);

  // Cashier opened a new round for this table: the paid tab is FINAL and keeps
  // its receipt. We simply pick up the fresh tab and move the settled one into
  // the scrollable history above.
  // ONE channel for the whole TABLE, not for a single tab id.
  //
  // BUGFIX: the guest used to subscribe with filter `id=eq.${tab.id}`. That
  // subscription had to be torn down and rebuilt every time the tab changed
  // (bill paid → new round). On round 2 the rebuild missed, so the guest never
  // heard that their bill was paid — the screen sat on "Bill Requested" forever
  // even though the cashier had closed the tab and issued a receipt.
  //
  // Filtering by table_id instead means one durable channel catches EVERY tab
  // event for this table — closes, reopens, new rounds — no matter how many.
  const tabRef = React.useRef(null);
  React.useEffect(()=>{ tabRef.current = tab; },[tab]);

  // PHASE 10 — TABLE HANDOVER.
  // The QR is a bearer token: a guest who paid and went home still has ?table=C4
  // in their browser. Without this, their next order would land on whoever is
  // sitting at C4 now. (My "New Round" listener made it worse — it silently
  // moved them onto the new group's tab.)
  //
  // Paying does NOT lock them out — a table ordering another round is normal and
  // must stay frictionless. Staff tapping CLOSE TABLE does, because only staff
  // know the guests actually left.
  const [tableHandedOver, setTableHandedOver] = React.useState(false);

  React.useEffect(()=>{
    if(!tableId) return;
    let dead = false;

    const check = async()=>{
      const mine = getSessionEpoch();
      if(mine == null) return;                 // joined before this existed — let them be
      const current = await getTableEpoch(tableId);
      if(!dead && current != null && current !== mine) setTableHandedOver(true);
    };
    check();

    const ch = supabase.channel(`table-session-${tableId}`)
      .on("postgres_changes",
        {event:"UPDATE",schema:"public",table:"table_sessions",filter:`table_id=eq.${tableId}`},
        payload=>{
          const mine = getSessionEpoch();
          if(mine != null && payload.new?.epoch !== mine) setTableHandedOver(true);
        })
      .subscribe();

    return()=>{ dead = true; supabase.removeChannel(ch); };
  },[tableId]);

  // Safety net: realtime can drop a message (phone sleeps, wifi blips, tab
  // backgrounded). Never leave a guest stranded on a stale bill — re-check the
  // real tab state whenever they come back to the screen.
  React.useEffect(()=>{
    if(!tableId) return;
    const resync = async()=>{
      if(document.hidden) return;
      const cur = tabRef.current;
      if(!cur) return;
      const {data} = await supabase
        .from("table_tabs").select("*").eq("id",cur.id).maybeSingle();
      if(data && data.status !== cur.status) setTab(p=>({...p,...data}));
    };
    document.addEventListener("visibilitychange",resync);
    window.addEventListener("focus",resync);
    return()=>{
      document.removeEventListener("visibilitychange",resync);
      window.removeEventListener("focus",resync);
    };
  },[tableId]);

  React.useEffect(()=>{
    if(!tableId) return;
    const ch = supabase.channel(`table-tabs-${tableId}`)
      .on("postgres_changes",
        {event:"*",schema:"public",table:"table_tabs",filter:`table_id=eq.${tableId}`},
        async payload=>{
          const row = payload.new;
          if(!row) return;
          const cur = tabRef.current;

          // An update to the tab we're already on (bill requested, paid, etc.)
          if(cur && row.id === cur.id){
            setTab(p=>({...p,...row}));
            return;
          }

          // A brand-new OPEN tab appeared for this table = cashier hit "New Round".
          // PHASE 10: but NOT if staff have handed the table to a new group —
          // that new tab belongs to them, not to us.
          if(row.status === "open" && !tableHandedOver && (!cur || row.id !== cur.id)){
            if(cur && cur.status === "closed"){
              const settledItems = await loadTabItems(cur.id);
              setPastRounds(p =>
                p.some(r=>r.id===cur.id) ? p : [...p,{...cur, items:settledItems}]
              );
            }
            setTab(row);
            setCartItems([]);
            setOrderHistory(await loadTabItems(row.id));
          }
        })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[tableId]);

  const startNewRound = React.useCallback(async(userId)=>{
    const t = await getOrCreateTab(tableId);
    if(!t) return;
    setTab(t);
    setCartItems([]);
    setOrderHistory(await loadTabItems(t.id));
    if(userId) loadPastRounds(userId);
  },[tableId,loadPastRounds]);

  // Realtime: listen for new order items on this tab
  React.useEffect(()=>{
    if(!tab) return;
    const ch = supabase.channel(`tab-items-${tab.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"order_items",filter:`tab_id=eq.${tab.id}`},
        async payload=>{
          const item = payload.new;
          // Fetch order info
          const {data:ord} = await supabase.from("orders").select("user_name,created_at,status,id").eq("id",item.order_id).single();
          setOrderHistory(p=>[...p,{...item,orders:ord}]);
        })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"order_items",filter:`tab_id=eq.${tab.id}`},
        payload=>{
          setOrderHistory(p=>p.map(i=>i.id===payload.new.id?{...i,...payload.new}:i));
        })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[tab?.id]);

  const addToCart = (item, categoryType)=>{
    setCartItems(prev=>{
      const existing = prev.find(c=>c.menu_item_id===item.id);
      if(existing) return prev.map(c=>c.menu_item_id===item.id?{...c,quantity:c.quantity+1}:c);
      return [...prev,{
        menu_item_id: item.id,
        item_name: item.name,
        item_price: Number(item.price),
        category_type: categoryType,
        quantity: 1,
      }];
    });
  };

  const removeFromCart = (menuItemId)=>{
    setCartItems(p=>p.filter(c=>c.menu_item_id!==menuItemId));
  };

  const updateQty = (menuItemId, qty)=>{
    if(qty<=0){removeFromCart(menuItemId);return;}
    setCartItems(p=>p.map(c=>c.menu_item_id===menuItemId?{...c,quantity:qty}:c));
  };

  const clearCart = ()=>setCartItems([]);

  // PHASE 9: cancel an item the kitchen/bar hasn't accepted yet.
  // Wrong item goes in, and the only option was to hassle a staff member for a
  // void. If it is still "pending", nobody has started making it — the guest
  // should just be able to take it back.
  const cancelItem = async(itemId, me)=>{
    const {data, error} = await supabase.from("order_items")
      .update({
        voided:true, status:"voided",
        void_reason:"Cancelled by guest",
        voided_at:new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("status","pending")     // refuse once the kitchen has accepted it
      .eq("voided", false)
      .select();
    if(error) return {success:false,error:"Could not cancel."};
    if(!data?.length){
      return {success:false,error:"Too late — the kitchen has already started this."};
    }
    // The DB triggers recompute the tab total and the order status for us.
    setOrderHistory(p=>p.map(i=>i.id===itemId?{...i,voided:true,status:"voided"}:i));
    return {success:true};
  };

  const confirmOrder = async(me, note="")=>{
    // BUGFIX: these three were collapsed into one message, so a NULL TAB reported
    // "Nothing in cart" while the cart was full. Three failures, three messages.
    if(!cartItems.length) return {success:false,error:"Nothing in cart"};
    if(!me)              return {success:false,error:"Please rejoin the chat first."};
    if(!tab)             return {success:false,error:"No open tab for this table. Ask staff to start a new round."};
    // PHASE 10: staff handed this table to someone else. This phone must not be
    // able to order onto the new group's bill.
    if(tableHandedOver){
      return {success:false,error:"This table has been closed. Please scan the QR code again to start a new order."};
    }
    // Once the bill is printed, the total is fixed. Adding items after that
    // means the cashier collects the wrong amount.
    if(tab.status==="bill_requested"){
      return {success:false,error:"Bill already requested — please ask staff to reopen the tab."};
    }
    if(tab.status==="closed"){
      return {success:false,error:"This tab is closed. Please start a new order."};
    }
    // Phase 7 — hard lock against double-submit (double tap / slow network)
    if(submittingRef.current) return {success:false,error:"Order already sending…"};
    submittingRef.current = true;
    try{
      // Phase 7 — rate limit
      if(!await rateLimit(me.id,"order")){
        return {success:false,error:"Too many orders — please wait a moment"};
      }
      // Create order
      const {data:order,error:oe} = await supabase.from("orders").insert({
        tab_id: tab.id,
        table_id: tableId,
        user_id: me.id,
        user_name: me.name,
        status: "pending",
        note: note||null,
      }).select().single();
      if(oe) throw oe;

      // Create order items
      const items = cartItems.map(c=>({
        order_id: order.id,
        tab_id: tab.id,
        table_id: tableId,
        menu_item_id: c.menu_item_id,
        item_name: c.item_name,
        item_price: c.item_price,
        category_type: c.category_type,
        quantity: c.quantity,
        subtotal: c.item_price * c.quantity,
        status: "pending",
        voided: false,
      }));
      const {error:ie} = await supabase.from("order_items").insert(items);
      if(ie) throw ie;

      // Tab total is now recalculated by the recalc_tab_total() DB trigger.
      // (This used to do `total: tab.total + addedTotal` from React state, which
      //  lost money when two guests at the same table ordered simultaneously.)
      const addedTotal = items.reduce((s,i)=>s+i.subtotal,0);

      setShowReceipt({order, items: cartItems, total: addedTotal});
      clearCart();
      return {success:true, order};
    }catch(e){
      logError("confirmOrder",e,{user_id:me?.id,table_id:tableId});
      return {success:false, error:e.message};
    }finally{
      submittingRef.current = false;
    }
  };

  const requestBill = async()=>{
    if(!tab) return;
    if(tab.status!=="open") return;          // already requested, or closed
    if(billTotal<=0) return;                 // nothing left to pay
    const {error} = await supabase.from("table_tabs").update({
      status:"bill_requested",
      bill_requested_at: new Date().toISOString()
    }).eq("id",tab.id).eq("status","open");  // refuse if the cashier just closed it
    if(error) logError("requestBill",error,{table_id:tableId});
  };

  const cartTotal = cartItems.reduce((s,i)=>s+(i.item_price*i.quantity),0);
  const cartCount = cartItems.reduce((s,i)=>s+i.quantity,0);
  // BUGFIX (Phase 9): after someone at the table pays for part of the bill
  // (a split), those items are settled. The guest's "Total Bill" must show what
  // is STILL OWED, not the whole tab again.
  const billTotal = orderHistory
    .filter(i=>!i.voided && !i.paid_receipt_id)
    .reduce((s,i)=>s+Number(i.subtotal),0);

  return(
    <CartContext.Provider value={{
      cartItems, addToCart, removeFromCart, updateQty, clearCart,
      confirmOrder, requestBill,
      cartTotal, cartCount, billTotal,
      orderHistory, tab, showReceipt, setShowReceipt,
      pastRounds, loadPastRounds, startNewRound, cancelItem, tableHandedOver,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// ── Receipt Popup ─────────────────────────────────────────────────────────────
function ReceiptPopup({receipt, onClose}){
  if(!receipt) return null; // Phase 7 — guard: no receipt, no overlay
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="glass slide-up" style={{width:"100%",maxWidth:380,borderRadius:20,overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${GOLD_DIM}33,${GOLD}11)`,padding:"20px 20px 16px",textAlign:"center",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:36,marginBottom:6}}>🎉</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900}} className="gold-text">Order Confirmed!</div>
          <div style={{fontSize:12,color:"#666",marginTop:4}}>Your order has been sent to the kitchen/bar</div>
          <div style={{fontSize:11,color:GOLD,marginTop:8,background:"rgba(201,168,76,0.08)",border:`1px solid ${GOLD_DIM}55`,borderRadius:8,padding:"6px 10px"}}>
            📸 Screenshot this for your records — receipts are not re-sent.
          </div>
        </div>
        <div style={{padding:"14px 20px",maxHeight:260,overflowY:"auto"}}>
          {receipt.items.map((item,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${BORDER}`}}>
              <div>
                <div style={{fontSize:13,color:"#e8e0d0"}}>{item.item_name}</div>
                <div style={{fontSize:11,color:"#555"}}>x{item.quantity} × {fmtPrice(item.item_price)}</div>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:GOLD}}>{fmtPrice(item.item_price*item.quantity)}</div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 4px",borderTop:`1px solid ${GOLD_DIM}44`,marginTop:4}}>
            <span style={{fontWeight:700,color:"#e8e0d0"}}>Order Total</span>
            <span style={{fontWeight:700,color:GOLD,fontSize:16}}>{fmtPrice(receipt.total)}</span>
          </div>
          {receipt.order.note&&<div style={{fontSize:11,color:"#555",marginTop:4}}>📝 Note: {receipt.order.note}</div>}
        </div>
        <div style={{padding:"12px 20px",borderTop:`1px solid ${BORDER}`}}>
          <button className="btn-gold" onClick={onClose} style={{width:"100%",padding:12,fontSize:14,borderRadius:10}}>
            Done ✦
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cart Tab ──────────────────────────────────────────────────────────────────
function CartTab({me}){
  const {cartItems,removeFromCart,updateQty,confirmOrder,cartTotal,cartCount,tab} = useCart();
  const [note,setNote] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  const handleConfirm = async()=>{
    if(!cartItems.length) return;
    setLoading(true);setError("");
    const result = await confirmOrder(me, note);
    if(!result.success) setError(result.error||"Failed. Try again.");
    setLoading(false);
    setNote("");
  };

  if(!cartItems.length) return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:12}}>🛒</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#555",marginBottom:8}}>Your cart is empty</div>
      <div style={{fontSize:13,color:"#333"}}>Browse the menu and add items to get started</div>
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",WebkitOverflowScrolling:"touch"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>YOUR ORDER · {cartCount} ITEMS</div>
        {cartItems.map(item=>(
          <div key={item.menu_item_id} style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:500,color:"#e8e0d0"}}>{item.item_name}</div>
              <div style={{fontSize:12,color:GOLD,marginTop:2}}>{fmtPrice(item.item_price)} each</div>
            </div>
            {/* Qty controls */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <button onClick={()=>updateQty(item.menu_item_id,item.quantity-1)} style={{width:28,height:28,borderRadius:"50%",background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>−</button>
              <span style={{fontSize:14,fontWeight:600,color:"#e8e0d0",minWidth:20,textAlign:"center"}}>{item.quantity}</span>
              <button onClick={()=>updateQty(item.menu_item_id,item.quantity+1)} style={{width:28,height:28,borderRadius:"50%",background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>+</button>
            </div>
            <div style={{fontSize:13,fontWeight:700,color:GOLD,minWidth:60,textAlign:"right",flexShrink:0}}>{fmtPrice(item.item_price*item.quantity)}</div>
            <button onClick={()=>removeFromCart(item.menu_item_id)} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:18,flexShrink:0,fontFamily:"Inter,sans-serif",lineHeight:1,padding:2}}>×</button>
          </div>
        ))}
        <div style={{marginTop:8}}>
          <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>SPECIAL INSTRUCTIONS (OPTIONAL)</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Less ice, extra spicy…" rows={2} style={{width:"100%",padding:"9px 12px",fontSize:13,resize:"none",borderRadius:8,lineHeight:1.5}}/>
        </div>
      </div>
      {/* Footer */}
      <div style={{padding:"12px 14px",borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:14,color:"#888"}}>Total</span>
          <span style={{fontSize:18,fontWeight:700,color:GOLD,fontFamily:"'Playfair Display',serif"}}>{fmtPrice(cartTotal)}</span>
        </div>
        {error&&<div style={{fontSize:12,color:"#F87171",marginBottom:8,textAlign:"center"}}>{error}</div>}
        <button className="btn-gold" onClick={handleConfirm} disabled={loading} style={{width:"100%",padding:13,fontSize:15,borderRadius:10,opacity:loading?.7:1}}>
          {loading?"Placing Order…":"Confirm Order ✦"}
        </button>
        {tab?.status==="bill_requested"&&(
          <div style={{marginTop:8,textAlign:"center",fontSize:12,color:"#F59E0B"}}>⏳ Bill has been requested</div>
        )}
      </div>
    </div>
  );
}

// ── Bill Tab ──────────────────────────────────────────────────────────────────
function BillTab(){
  const {orderHistory,billTotal,requestBill,tab,pastRounds,cancelItem,tableHandedOver} = useCart();
  const [cancelling,setCancelling] = useState(null);

  const doCancel = async(item)=>{
    if(!window.confirm(`Cancel "${item.item_name}"? It hasn't been started yet.`)) return;
    setCancelling(item.id);
    const r = await cancelItem(item.id);
    setCancelling(null);
    if(!r.success) alert(r.error);
  };

  const STATUS_COLOR = {
    pending:"#F59E0B",
    preparing:"#60A5FA",
    ready:"#34D399",
    served:"#888",
    voided:"#F87171",
  };
  const STATUS_LABEL = {
    pending:"⏳ Pending",
    preparing:"👨‍🍳 Preparing",
    ready:"✅ Ready",
    served:"🍽️ Served",
    voided:"❌ Voided",
  };

  // Group by order
  const byOrder = orderHistory.reduce((acc,item)=>{
    const oid = item.order_id;
    if(!acc[oid]) acc[oid]={
      id:oid,
      user_name:item.orders?.user_name||"Guest",
      created_at:item.orders?.created_at,
      items:[],
    };
    acc[oid].items.push(item);
    return acc;
  },{});

  const orders = Object.values(byOrder).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const activeItems = orderHistory.filter(i=>!i.voided);
  const billRequested = tab?.status==="bill_requested";

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",WebkitOverflowScrolling:"touch"}}>

        {/* ── Earlier rounds YOU already paid for, at this table. ──────────────
            Each settled tab keeps its own receipt — nothing is ever deleted or
            merged. Scoped to this guest, so a new group at the table does NOT
            see what the previous group spent. */}
        {pastRounds?.map((round,idx)=>(
          <div key={`past-${round.id}`} style={{marginBottom:16,opacity:0.75}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{flex:1,height:1,background:BORDER}}/>
              <span style={{fontSize:10,color:"#34D399",fontWeight:600,letterSpacing:1}}>
                ✅ ROUND {idx+1} · PAID
              </span>
              <div style={{flex:1,height:1,background:BORDER}}/>
            </div>
            <div style={{background:"rgba(52,211,153,0.04)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:12,padding:"10px 12px"}}>
              {round.items?.map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0"}}>
                  <span style={{fontSize:12,color:"#888",flex:1}}>{item.quantity}× {item.item_name}</span>
                  <span style={{fontSize:12,color:"#888"}}>{fmtPrice(item.subtotal)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:`1px solid ${BORDER}`}}>
                <span style={{fontSize:12,color:"#34D399",fontWeight:600}}>Paid</span>
                <span style={{fontSize:13,color:"#34D399",fontWeight:700}}>{fmtPrice(round.total)}</span>
              </div>
            </div>
          </div>
        ))}

        {pastRounds?.length>0&&orders.length>0&&(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{flex:1,height:1,background:BORDER}}/>
            <span style={{fontSize:10,color:GOLD,fontWeight:600,letterSpacing:1}}>CURRENT ROUND</span>
            <div style={{flex:1,height:1,background:BORDER}}/>
          </div>
        )}

        {orders.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#444"}}>
            <div style={{fontSize:40,marginBottom:10}}>🧾</div>
            <div style={{fontSize:14}}>{pastRounds?.length?"No orders in this round yet":"No orders yet"}</div>
          </div>
        ):orders.map(order=>(
          <div key={order.id} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:11,color:GOLD,fontWeight:600}}>{order.user_name}</span>
              <span style={{fontSize:10,color:"#333"}}>{order.created_at?fmtTime(order.created_at):""}</span>
            </div>
            {order.items.map(item=>(
              <div key={item.id} style={{background:item.voided?`rgba(248,113,113,0.06)`:SURFACE,border:`1px solid ${item.voided?"rgba(248,113,113,0.2)":BORDER}`,borderRadius:10,padding:"9px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:8,opacity:item.voided?.6:1}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:item.voided?"#666":"#e8e0d0",textDecoration:item.voided?"line-through":"none"}}>{item.item_name} ×{item.quantity}</div>
                  <div style={{fontSize:10,color:STATUS_COLOR[item.status]||"#555",marginTop:1}}>{STATUS_LABEL[item.status]||item.status}</div>
                </div>
                <div style={{fontSize:13,fontWeight:600,color:item.voided?"#555":item.paid_receipt_id?"#34D399":GOLD,flexShrink:0}}>
                  {fmtPrice(item.subtotal)}
                </div>
                {item.paid_receipt_id&&(
                  <span style={{marginLeft:8,fontSize:10,color:"#34D399",fontWeight:700,letterSpacing:0.5,flexShrink:0}}>PAID</span>
                )}
                {/* PHASE 9: only while it is still "pending" — once the kitchen
                    accepts it, someone is already cooking it. */}
                {!item.voided && !item.paid_receipt_id && item.status==="pending" && tab?.status==="open" && (
                  <button onClick={()=>doCancel(item)} disabled={cancelling===item.id}
                    style={{marginLeft:8,padding:"3px 9px",background:"rgba(248,113,113,0.08)",
                      border:"1px solid rgba(248,113,113,0.3)",borderRadius:7,color:"#F87171",
                      fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0,
                      opacity:cancelling===item.id?0.4:1}}>
                    {cancelling===item.id?"…":"Cancel"}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Bill footer */}
      <div style={{padding:"12px 14px",borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:15,fontWeight:600,color:"#e8e0d0"}}>Total Bill</span>
          <span style={{fontSize:20,fontWeight:700,color:GOLD,fontFamily:"'Playfair Display',serif"}}>{fmtPrice(billTotal)}</span>
        </div>
        {tableHandedOver?(
          <div style={{textAlign:"center",padding:"14px 0",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.35)",borderRadius:12}}>
            <div style={{fontSize:20,marginBottom:4}}>🔒</div>
            <div style={{fontSize:14,color:"#F59E0B",fontWeight:600}}>This table has been closed</div>
            <div style={{fontSize:12,color:"#666",marginTop:3}}>Scan the QR code again to start a new order</div>
          </div>
        ):tab?.status==="closed"?(
          <div style={{textAlign:"center",padding:"14px 0",background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:12}}>
            <div style={{fontSize:20,marginBottom:4}}>✅</div>
            <div style={{fontSize:14,color:"#34D399",fontWeight:600}}>Bill Paid — Thank You!</div>
            <div style={{fontSize:12,color:"#666",marginTop:3}}>Hope to see you again at EasyCart!</div>
            <div style={{fontSize:11,color:"#888",marginTop:8,paddingTop:8,borderTop:`1px solid ${BORDER}`}}>
              📸 Screenshot your bill if you need a copy — it cannot be re-sent later.
            </div>
          </div>
        ):billRequested?(
          <div style={{textAlign:"center",padding:"12px 0",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:12}}>
            <div style={{fontSize:14,color:"#F59E0B",fontWeight:600}}>⏳ Bill Requested</div>
            <div style={{fontSize:12,color:"#666",marginTop:3}}>Staff will be with you shortly</div>
          </div>
        ):billTotal<=0?(
          /* Nothing ordered yet — asking for a bill would just confuse the staff. */
          <div style={{textAlign:"center",padding:"12px 0",background:SURFACE,border:`1px dashed ${BORDER}`,borderRadius:12}}>
            <div style={{fontSize:13,color:"#888",fontWeight:600}}>Nothing to bill yet</div>
            <div style={{fontSize:12,color:"#555",marginTop:3}}>Add something from the menu first 🍻</div>
          </div>
        ):(
          <button onClick={requestBill} style={{width:"100%",padding:13,fontSize:15,background:`linear-gradient(135deg,${GOLD_DIM},${GOLD})`,border:"none",borderRadius:10,color:"#080808",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            🧾 Request Bill
          </button>
        )}
      </div>
    </div>
  );
}

// ── More Tab (Guests + Venue) ─────────────────────────────────────────────────
function MoreTab({me, users, announcements, blockedIds, setPmTarget, markDMRead, unreadDMs, setShowMenu, setMobileTab}){
  const [subTab, setSubTab] = useState("guests");
  const visibleUsers = users.filter(u=>!blockedIds.includes(u.id));

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
        {[["guests","👥 Guests"],["venue","✦ Venue"]].map(([v,l])=>(
          <button key={v} className={`tab-btn ${subTab===v?"active":""}`} onClick={()=>setSubTab(v)} style={{fontSize:13,padding:"10px 8px"}}>{l}</button>
        ))}
      </div>
      {subTab==="guests"&&(
        <div style={{flex:1,overflowY:"auto",padding:12,WebkitOverflowScrolling:"touch"}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:10}}>ONLINE · {visibleUsers.length}</div>
          {visibleUsers.map(u=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 8px",borderBottom:`1px solid ${BORDER}`,cursor:u.id!==me.id?"pointer":"default"}}
              onClick={()=>{if(u.id!==me.id){setPmTarget(u);markDMRead(u.id);setMobileTab("chat");}}}>
              <div style={{position:"relative",flexShrink:0}}>
                <Avatar user={u} size={36}/>
                {unreadDMs[u.id]&&<div className="notif-dot"/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,color:u.id===me.id?GOLD:"#ccc"}}>{u.id===me.id?"You":u.name}</div>
                <div style={{fontSize:11,color:"#34D399",marginTop:1}}>{u.status||"online"}</div>
              </div>
              {u.id!==me.id&&<span style={{fontSize:12,color:GOLD_DIM,background:`rgba(201,168,76,0.08)`,padding:"4px 10px",borderRadius:8,border:`1px solid ${GOLD_DIM}44`,flexShrink:0}}>DM</span>}
            </div>
          ))}
        </div>
      )}
      {subTab==="venue"&&(
        <div style={{flex:1,overflowY:"auto",padding:16,WebkitOverflowScrolling:"touch"}}>
          <div style={{textAlign:"center",padding:"16px 0 20px"}}>
            <img src={LOGO_SRC} alt="EasyCart" style={{width:64,height:64,objectFit:"contain",background:"#fff",borderRadius:14,padding:5,marginBottom:10}}/>
            <div style={{fontSize:16,fontWeight:700,color:"#e8e0d0"}}>EasyCart</div>
            <div style={{fontSize:13,color:"#555"}}>Barcade & Lounge</div>
            <div style={{fontSize:12,color:"#333",marginTop:3}}>{VENUE_LOCATION}</div>
          </div>
          <button onClick={()=>{setShowMenu(true);setMobileTab("chat");}} style={{width:"100%",padding:"13px 0",background:`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,border:"none",borderRadius:12,color:"#080808",fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:20}}>🍽️ View Full Menu</button>
          <div style={{height:1,background:BORDER,marginBottom:16}}/>
          <div style={{fontSize:11,color:"#444",letterSpacing:1,marginBottom:10}}>TONIGHT</div>
          {announcements.map((a,i)=>(
            <div key={i} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"11px 13px",marginBottom:8,fontSize:13,lineHeight:1.6,color:"#ccc"}}>{a}</div>
          ))}
          <div style={{fontSize:11,color:"#444",letterSpacing:1,margin:"16px 0 10px"}}>INFO</div>
          <div style={{fontSize:13,color:"#555",lineHeight:2.2}}>
            <div>📍 {VENUE_LOCATION}</div>
            <div>🔒 Wi-Fi secured chat</div>
            <div>🍸 Hidden Bar inside</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Guest Menu Modal ─────────────────────────────────────────────────────────
function MenuModal({onClose, hasTable=false}){
  const [categories,setCategories]=useState([]);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [menuTab,setMenuTab]=useState("food");
  const [activeCat,setActiveCat]=useState(null);
  const [addedMsg,setAddedMsg]=useState("");
  // Phase 7 fix — hooks must never be conditional; context defaults to null
  const cartCtx = useCart();
  const cart = hasTable ? cartCtx : null;

  const handleAddToCart = (item, categoryType)=>{
    if(!cart) return;
    cart.addToCart(item, categoryType);
    setAddedMsg(item.name);
    setTimeout(()=>setAddedMsg(""),1800);
  };

  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const {data:cats}=await supabase.from("menu_categories").select("*").order("sort_order");
      const {data:itms}=await supabase.from("menu_items").select("*").eq("available",true).order("sort_order");
      if(cats){
        setCategories(cats);
        const first=cats.find(c=>c.type==="food");
        if(first)setActiveCat(first.id);
      }
      if(itms)setItems(itms);
      setLoading(false);
    };
    load();
  },[]);

  const tabs=[
    {value:"food",label:"🍽️ Food"},
    {value:"drinks",label:"🍹 Drinks"},
    {value:"spirits",label:"🥃 Spirits"},
  ];

  const filteredCats=categories.filter(c=>c.type===menuTab);
  const activeItems=items.filter(i=>i.category_id===activeCat);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:680,height:"90dvh",background:BG,borderRadius:"20px 20px 0 0",border:`1px solid ${BORDER}`,borderBottom:"none",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"16px 16px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900}} className="gold-text">EasyCart Menu</div>
              <div style={{fontSize:11,color:"#555",marginTop:1}}>Bar Chow's & Spirits</div>
            </div>
            <button onClick={onClose} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:"50%",width:34,height:34,cursor:"pointer",color:"#888",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",flexShrink:0}}>×</button>
          </div>
          {addedMsg&&(
            <div className="fade-in" style={{background:`rgba(201,168,76,0.12)`,border:`1px solid ${GOLD_DIM}`,borderRadius:8,padding:"6px 12px",marginBottom:8,fontSize:12,color:GOLD,textAlign:"center"}}>
              ✦ {addedMsg} added to cart
            </div>
          )}
          {/* Main tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {tabs.map(t=>(
              <button key={t.value} onClick={()=>{
                setMenuTab(t.value);
                const first=categories.find(c=>c.type===t.value);
                if(first)setActiveCat(first.id);
              }} style={{flex:1,padding:"8px 4px",background:menuTab===t.value?`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`:"transparent",border:`1px solid ${menuTab===t.value?GOLD:BORDER}`,borderRadius:10,color:menuTab===t.value?"#080808":"#666",fontSize:12,fontWeight:menuTab===t.value?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
          {/* Category list */}
          <div style={{width:110,borderRight:`1px solid ${BORDER}`,overflowY:"auto",flexShrink:0,padding:"6px 4px",WebkitOverflowScrolling:"touch"}}>
            {loading?[1,2,3,4].map(i=><div key={i} className="skel" style={{height:48,margin:"4px",borderRadius:8}}/>):
            filteredCats.map(c=>(
              <button key={c.id} onClick={()=>setActiveCat(c.id)} style={{width:"100%",padding:"8px 6px",background:activeCat===c.id?`rgba(201,168,76,0.12)`:"transparent",border:`1px solid ${activeCat===c.id?GOLD_DIM:"transparent"}`,borderRadius:10,cursor:"pointer",marginBottom:4,textAlign:"left",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                <div style={{fontSize:18,marginBottom:2,textAlign:"center"}}>{c.icon}</div>
                <div style={{fontSize:10,color:activeCat===c.id?GOLD:"#888",fontWeight:activeCat===c.id?600:400,lineHeight:1.3,textAlign:"center"}}>{c.name}</div>
              </button>
            ))}
          </div>

          {/* Items list */}
          <div style={{flex:1,overflowY:"auto",padding:"10px 12px",WebkitOverflowScrolling:"touch"}}>
            {loading?[1,2,3,4,5].map(i=><div key={i} className="skel" style={{height:48,marginBottom:8,borderRadius:10}}/>):
            activeItems.length===0?<div style={{color:"#444",textAlign:"center",padding:40,fontSize:13}}>No items in this category</div>:
            activeItems.map((item,idx)=>{
              const catType = categories.find(c=>c.id===activeCat)?.type||"food";
              const inCart = cart?.cartItems?.find(c=>c.menu_item_id===item.id);
              return(
                <div key={item.id} className="fade-in" style={{display:"flex",alignItems:"center",padding:"10px 12px",marginBottom:6,background:idx%2===0?SURFACE:SURFACE2,borderRadius:10,border:`1px solid ${BORDER}`,gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8e0d0"}}>{item.name}</div>
                    {item.description&&<div style={{fontSize:10,color:"#555",marginTop:1,lineHeight:1.4}}>{item.description}</div>}
                    <div style={{fontSize:13,fontWeight:700,color:GOLD,fontFamily:"'Playfair Display',serif",marginTop:3}}>₱{Number(item.price).toLocaleString()}</div>
                  </div>
                  {hasTable&&(
                    <button onClick={()=>handleAddToCart(item,catType)}
                      style={{flexShrink:0,padding:"7px 12px",background:inCart?`rgba(201,168,76,0.15)`:`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,border:inCart?`1px solid ${GOLD_DIM}`:"none",borderRadius:8,color:inCart?"#C9A84C":"#080808",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s",whiteSpace:"nowrap"}}>
                      {inCart?`+${inCart.quantity} ✓`:"+ Add"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"8px 16px",borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,textAlign:"center"}}>
          <div style={{fontSize:10,color:"#444"}}>🔒 Prices may change · Ask staff for today's specials</div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Menu Editor ─────────────────────────────────────────────────────────
function AdminMenuEditor(){
  const [categories,setCategories]=useState([]);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [menuTab,setMenuTab]=useState("food");
  const [activeCat,setActiveCat]=useState(null);
  const [editingItem,setEditingItem]=useState(null);
  const [newItem,setNewItem]=useState({name:"",price:"",description:""});
  const [newCatName,setNewCatName]=useState("");
  const [newCatIcon,setNewCatIcon]=useState("🍽️");
  const [showAddCat,setShowAddCat]=useState(false);
  const {toasts,show:showToast}=useToast();

  useEffect(()=>{loadMenu();},[]);

  const loadMenu=async()=>{
    setLoading(true);
    const {data:cats}=await supabase.from("menu_categories").select("*").order("sort_order");
    const {data:itms}=await supabase.from("menu_items").select("*").order("sort_order");
    if(cats)setCategories(cats);
    if(itms)setItems(itms);
    if(cats&&cats.length>0&&!activeCat){
      const first=cats.find(c=>c.type==="food");
      if(first)setActiveCat(first.id);
    }
    setLoading(false);
  };

  const addItem=async()=>{
    if(!newItem.name.trim()||!newItem.price)return;
    const {error}=await supabase.from("menu_items").insert({
      category_id:activeCat,name:newItem.name.trim(),
      price:Number(newItem.price),description:newItem.description.trim()||null,
      available:true,sort_order:items.filter(i=>i.category_id===activeCat).length+1
    });
    if(error){showToast("Error: "+error.message);return;}
    setNewItem({name:"",price:"",description:""});
    showToast("Item added ✦");
    loadMenu();
  };

  const saveItem=async(item)=>{
    const {error}=await supabase.from("menu_items").update({
      name:item.name,price:Number(item.price),
      description:item.description||null,available:item.available
    }).eq("id",item.id);
    if(error){showToast("Error: "+error.message);return;}
    setEditingItem(null);
    showToast("Item saved ✦");
    loadMenu();
  };

  const deleteItem=async(id)=>{
    setItems(p=>p.filter(i=>i.id!==id));
    await supabase.from("menu_items").delete().eq("id",id);
    showToast("Item removed");
  };

  const toggleAvailable=async(item)=>{
    await supabase.from("menu_items").update({available:!item.available}).eq("id",item.id);
    setItems(p=>p.map(i=>i.id===item.id?{...i,available:!i.available}:i));
  };

  const addCategory=async()=>{
    if(!newCatName.trim())return;
    const {error}=await supabase.from("menu_categories").insert({
      name:newCatName.trim(),icon:newCatIcon,type:menuTab,
      sort_order:categories.filter(c=>c.type===menuTab).length+1
    });
    if(error){showToast("Error: "+error.message);return;}
    setNewCatName("");setShowAddCat(false);
    showToast("Category added ✦");
    loadMenu();
  };

  const deleteCategory=async(id)=>{
    await supabase.from("menu_categories").delete().eq("id",id);
    if(activeCat===id)setActiveCat(null);
    showToast("Category removed");
    loadMenu();
  };

  const tabs=[{value:"food",label:"🍽️ Food"},{value:"drinks",label:"🍹 Drinks"},{value:"spirits",label:"🥃 Spirits"}];
  const filteredCats=categories.filter(c=>c.type===menuTab);
  const activeItems=items.filter(i=>i.category_id===activeCat);
  const ICONS=["🍽️","🍟","🍜","🦑","🥩","🍗","🍚","🍺","🍹","🥃","🍸","🥤","🔥","❄️","🌵","🍷","🧊","🗼"];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {tabs.map(t=>(
          <button key={t.value} onClick={()=>{setMenuTab(t.value);const first=categories.find(c=>c.type===t.value);if(first)setActiveCat(first.id);else setActiveCat(null);}} style={{flex:1,padding:"9px 4px",background:menuTab===t.value?`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`:"transparent",border:`1px solid ${menuTab===t.value?GOLD:BORDER}`,borderRadius:10,color:menuTab===t.value?"#080808":"#666",fontSize:13,fontWeight:menuTab===t.value?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,display:"flex",gap:12,overflow:"hidden",minHeight:0}}>
        {/* Categories */}
        <div style={{width:160,flexShrink:0,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:10,color:GOLD,letterSpacing:1,marginBottom:4}}>CATEGORIES</div>
          <div style={{flex:1,overflowY:"auto"}}>
            {filteredCats.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 8px",background:activeCat===c.id?`rgba(201,168,76,0.1)`:SURFACE2,border:`1px solid ${activeCat===c.id?GOLD_DIM:BORDER}`,borderRadius:9,marginBottom:5,cursor:"pointer",transition:"all .15s"}} onClick={()=>setActiveCat(c.id)}>
                <span style={{fontSize:14}}>{c.icon}</span>
                <span style={{flex:1,fontSize:12,color:activeCat===c.id?GOLD:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                <button onClick={e=>{e.stopPropagation();deleteCategory(c.id);}} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:13,flexShrink:0,fontFamily:"Inter,sans-serif",opacity:.7}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.7}>×</button>
              </div>
            ))}
          </div>
          {!showAddCat?(
            <button onClick={()=>setShowAddCat(true)} style={{padding:"8px",background:`rgba(201,168,76,0.08)`,border:`1px dashed ${GOLD_DIM}`,borderRadius:8,color:GOLD,cursor:"pointer",fontSize:12,fontFamily:"Inter,sans-serif"}}>+ Add Category</button>
          ):(
            <div style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:10}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                {ICONS.map(ic=>(
                  <button key={ic} onClick={()=>setNewCatIcon(ic)} style={{background:newCatIcon===ic?`rgba(201,168,76,0.2)`:"none",border:`1px solid ${newCatIcon===ic?GOLD_DIM:"transparent"}`,borderRadius:6,padding:3,fontSize:16,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{ic}</button>
                ))}
              </div>
              <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Category name" style={{width:"100%",padding:"7px 8px",fontSize:12,marginBottom:6,borderRadius:6}}/>
              <div style={{display:"flex",gap:4}}>
                <button className="btn-gold" onClick={addCategory} style={{flex:1,padding:"6px 4px",fontSize:11,borderRadius:6}}>Add</button>
                <button className="btn-ghost" onClick={()=>setShowAddCat(false)} style={{flex:1,padding:"6px 4px",fontSize:11,borderRadius:6}}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!activeCat?(
            <div style={{color:"#444",textAlign:"center",padding:40,fontSize:14}}>Select a category</div>
          ):(
            <>
              {/* Add new item */}
              <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:12,padding:12,marginBottom:12,flexShrink:0}}>
                <div style={{fontSize:10,color:GOLD,letterSpacing:1,marginBottom:8}}>ADD NEW ITEM</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="Item name" style={{flex:2,minWidth:120,padding:"8px 10px",fontSize:13,borderRadius:7}}/>
                  <input value={newItem.price} onChange={e=>setNewItem(p=>({...p,price:e.target.value}))} placeholder="₱ Price" type="number" style={{flex:1,minWidth:80,padding:"8px 10px",fontSize:13,borderRadius:7}}/>
                  <input value={newItem.description} onChange={e=>setNewItem(p=>({...p,description:e.target.value}))} placeholder="Description (optional)" style={{flex:3,minWidth:140,padding:"8px 10px",fontSize:13,borderRadius:7}}/>
                  <button className="btn-gold" onClick={addItem} style={{padding:"8px 14px",fontSize:13,borderRadius:7,flexShrink:0}}>Add ✦</button>
                </div>
              </div>

              {/* Items list */}
              <div style={{flex:1,overflowY:"auto"}}>
                {loading?[1,2,3].map(i=><div key={i} className="skel" style={{height:50,marginBottom:8,borderRadius:10}}/>):
                activeItems.length===0?<div style={{color:"#444",textAlign:"center",padding:32,fontSize:13}}>No items yet. Add one above.</div>:
                activeItems.map(item=>(
                  <div key={item.id} style={{background:SURFACE,border:`1px solid ${item.available?BORDER:"rgba(248,113,113,0.2)"}`,borderRadius:10,padding:"10px 12px",marginBottom:6,opacity:item.available?1:0.6}}>
                    {editingItem?.id===item.id?(
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        <div style={{display:"flex",gap:6}}>
                          <input value={editingItem.name} onChange={e=>setEditingItem(p=>({...p,name:e.target.value}))} style={{flex:2,padding:"7px 10px",fontSize:13,borderRadius:7}}/>
                          <input value={editingItem.price} onChange={e=>setEditingItem(p=>({...p,price:e.target.value}))} type="number" style={{flex:1,padding:"7px 10px",fontSize:13,borderRadius:7}}/>
                        </div>
                        <input value={editingItem.description||""} onChange={e=>setEditingItem(p=>({...p,description:e.target.value}))} placeholder="Description" style={{width:"100%",padding:"7px 10px",fontSize:12,borderRadius:7}}/>
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn-gold" onClick={()=>saveItem(editingItem)} style={{flex:1,padding:"7px",fontSize:12,borderRadius:7}}>Save ✦</button>
                          <button className="btn-ghost" onClick={()=>setEditingItem(null)} style={{flex:1,padding:"7px",fontSize:12,borderRadius:7}}>Cancel</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:"#e8e0d0",fontWeight:500}}>{item.name}</div>
                          {item.description&&<div style={{fontSize:11,color:"#555",marginTop:1}}>{item.description}</div>}
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:GOLD,flexShrink:0}}>₱{Number(item.price).toLocaleString()}</div>
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          <button onClick={()=>toggleAvailable(item)} title={item.available?"Mark unavailable":"Mark available"} style={{background:item.available?"rgba(52,211,153,0.08)":"rgba(248,113,113,0.08)",border:`1px solid ${item.available?"rgba(52,211,153,0.3)":"rgba(248,113,113,0.3)"}`,borderRadius:6,width:28,height:28,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>{item.available?"✅":"❌"}</button>
                          <button onClick={()=>setEditingItem({...item})} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:6,width:28,height:28,cursor:"pointer",color:"#888",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>✏️</button>
                          <button onClick={()=>deleteItem(item.id)} style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,width:28,height:28,cursor:"pointer",color:"#F87171",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>×</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {toasts.map(t=><div key={t.id} className="toast">✦ {t.msg}</div>)}
    </div>
  );
}

// ── Admin Panel ──────────────────────────────────────────────────────────────
// PHASE 7 SECURITY: the admin PIN is no longer hardcoded here (it was readable
// in DevTools). It is verified server-side. Change it in Supabase → staff_config.

function AdminLogin({onSuccess,onBack}){
  const [pin,setPin]=useState("");
  const [error,setError]=useState("");
  const [shake,setShake]=useState(false);
  const [fails,setFails]=useState(0);
  const [lockedUntil,setLockedUntil]=useState(0);

  const tryPin=async(p)=>{
    if(lockedUntil&&Date.now()<lockedUntil){
      setError(`Locked. Wait ${Math.ceil((lockedUntil-Date.now())/1000)}s.`);
      setPin("");
      return;
    }
    const ok = await verifyStaffPin("admin",p);
    if(ok){setFails(0);setLockedUntil(0);onSuccess();}
    else{
      const n=fails+1;
      setFails(n);
      if(n>=5){setLockedUntil(Date.now()+60000);setError("Too many attempts. Locked 60s.");}
      else setError(`Incorrect PIN. ${5-n} left.`);
      setShake(true);
      setPin("");
      setTimeout(()=>{setShake(false);setError("");},2000);
    }
  };
  const press=(v)=>{
    if(pin.length>=6)return;
    const next=pin+v;
    setPin(next);
    if(next.length===6)setTimeout(()=>tryPin(next),120);
  };
  const del=()=>setPin(p=>p.slice(0,-1));

  return(
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 45%,rgba(201,168,76,0.06) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div className="glass slide-up" style={{width:"100%",maxWidth:340,borderRadius:22,padding:"36px 24px",textAlign:"center",position:"relative",zIndex:1}}>
        <button onClick={onBack} style={{position:"absolute",top:16,left:16,background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:18,lineHeight:1,fontFamily:"Inter,sans-serif"}}>←</button>
        <img src={LOGO_SRC} alt="EasyCart" style={{width:56,height:56,objectFit:"contain",background:"#fff",borderRadius:12,padding:4,marginBottom:12}}/>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:900,marginBottom:4}} className="gold-text">Staff Access</h2>
        <p style={{fontSize:12,color:"#444",marginBottom:24}}>Enter your 6-digit staff PIN</p>
        <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:24,animation:shake?"shake .4s ease":"none"}}>
          {[0,1,2,3,4,5].map(i=>(
            <div key={i} style={{width:12,height:12,borderRadius:"50%",background:i<pin.length?GOLD:"transparent",border:`2px solid ${i<pin.length?GOLD:BORDER}`,transition:"all .15s"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:220,margin:"0 auto"}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
            <button key={i} onClick={()=>k==="⌫"?del():k!==""?press(String(k)):null}
              style={{padding:"14px 0",borderRadius:12,background:k==="⌫"?"transparent":SURFACE2,border:`1px solid ${k==="⌫"?"transparent":BORDER}`,color:k==="⌫"?"#555":"#e8e0d0",fontSize:k==="⌫"?18:20,fontWeight:500,cursor:k===""?"default":"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s",opacity:k===""?0:1}}
              onMouseEnter={e=>{if(k!=="")e.currentTarget.style.borderColor=GOLD_DIM;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=k==="⌫"?"transparent":BORDER;}}>
              {k}
            </button>
          ))}
        </div>
        {error&&<div style={{marginTop:16,fontSize:13,color:"#F87171"}}>{error}</div>}
        <p style={{marginTop:18,fontSize:10,color:"#2a2a2a"}}>Staff only — do not share with guests</p>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
    </div>
  );
}

// Report components — loaded via dynamic import
const ReportComponents = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.SalesReports/>})));
const AnalyticsComponent = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.Analytics/>})));
const VoidComponent = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.VoidReports/>})));
const StaffMgmtComponent = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.StaffManagement/>})));
const BackupComponent = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.BackupPanel/>})));
const DailySummaryComponent = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.DailySummary/>})));
const AlertsComponent = React.lazy(()=>import("./staff/Reports.jsx").then(m=>({default:()=><m.AdminAlerts/>})));

const Suspensed = ({C})=>(
  <React.Suspense fallback={<div style={{textAlign:"center",padding:40,color:"#555"}}>Loading…</div>}>
    <C/>
  </React.Suspense>
);

function AdminPanel({onLogout}){
  const [tab,setTab]=useState("dashboard");
  const [users,setUsers]=useState([]);
  const [messages,setMessages]=useState([]);
  const [announcements,setAnnouncements]=useState([]);
  const [blockedWords,setBlockedWords]=useState([]);
  const [newAnn,setNewAnn]=useState("");
  const [newWord,setNewWord]=useState("");
  const [accessCodeSetting,setAccessCodeSetting]=useState("");
  const [accessCodeLoading,setAccessCodeLoading]=useState(false);
  const [confirmLogout,setConfirmLogout]=useState(false);
  const [confirmClear,setConfirmClear]=useState(false);
  const {toasts,show:showToast}=useToast();

  const PRESETS=[
    "🥂 Happy Hour until 10PM — 2-for-1 cocktails",
    "🎮 Barcade Challenge starting NOW — winner gets a free round!",
    "🎶 Live band takes the stage in 15 minutes!",
    "🏆 VIP booth available — see the host",
    "🍹 Tonight's special: ask your server",
    "⏰ Last call for food orders — kitchen closes at midnight",
    "🎉 Welcome everyone to EasyCart — have an amazing night!",
    "🔥 The bar is fully stocked — what are you having?",
  ];

  const FIL_SLANG=["putangina","gago","tangina","bobo","tanga","ulol","bwisit","puta","leche","hudas","buwisit","inutil","engot","lintik","hayop","pakyu","tarantado","gunggong","mangmang","buang","yawa","bogo","piste","ungo"];

  useEffect(()=>{loadAll();loadAccessCode();},[]);
  useEffect(() => {
    const channel = supabase
        .channel("admin-live")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "messages",
            },
            () => {
                loadAll();
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}, []);

  const loadAccessCode=async()=>{
    const {data}=await supabase.from("settings").select("value").eq("key","access_code").single();
    if(data?.value)setAccessCodeSetting(data.value);
  };

  const saveAccessCode=async()=>{
    if(!accessCodeSetting.trim())return;
    setAccessCodeLoading(true);
    const {error}=await supabase.from("settings").upsert({key:"access_code",value:accessCodeSetting.trim().toUpperCase()},{onConflict:"key"});
    setAccessCodeLoading(false);
    if(error){showToast("Error saving: "+error.message);return;}
    showToast("Access code updated ❆");
  };

  const loadAll=async()=>{
    // Load users
    const {data:u,error:ue}=await supabase.from("users").select("*").eq("room_id",ROOM_ID).order("created_at",{ascending:false});
    if(u)setUsers(u);
    // Load messages separately then merge with user data
    const {data:m,error:me}=await supabase.from("messages").select("*").eq("room_id",ROOM_ID).order("created_at",{ascending:false}).limit(100);
    if(m){
      // Attach user info from already-loaded users
      const usersMap={};
      if(u)u.forEach(usr=>usersMap[usr.id]=usr);
      setMessages(m.map(msg=>({...msg,users:usersMap[msg.user_id]||null})));
    }
    // Load announcements
    const {data:a}=await supabase.from("announcements").select("*").eq("room_id",ROOM_ID).order("pinned",{ascending:false}).order("created_at",{ascending:false});
    if(a)setAnnouncements(a);
    // Load blocked words
    const {data:w}=await supabase.from("blocked_words").select("*").order("created_at",{ascending:true});
    if(w)setBlockedWords(w);
  };

  // ── Announcements ──
  const postAnn=async(text)=>{
    if(!text.trim())return;
    const {error}=await supabase.from("announcements").insert({room_id:ROOM_ID,text:text.trim(),pinned:false});
    if(error){showToast("Error: "+error.message);return;}
    setNewAnn("");
    showToast("Announcement posted ✦");
    loadAll();
  };
  const deleteAnn=async(id)=>{
    const {error}=await supabase.from("announcements").delete().eq("id",id);
    if(error){showToast("Error: "+error.message);return;}
    setAnnouncements(p=>p.filter(a=>a.id!==id));
    showToast("Announcement removed");
  };
  const togglePin=async(id,pinned)=>{
    const {error}=await supabase.from("announcements").update({pinned:!pinned}).eq("id",id);
    if(error){showToast("Error: "+error.message);return;}
    setAnnouncements(p=>p.map(a=>a.id===id?{...a,pinned:!pinned}:a));
  };

  // ── Users ──
  const kickUser=async(u)=>{
    const {error}=await supabase.from("users").update({status:"kicked"}).eq("id",u.id);
    if(error){showToast("Error kicking: "+error.message);return;}
    await supabase.from("messages").insert({room_id:ROOM_ID,user_id:u.id,text:`${u.name} was removed from the chat by staff.`,type:"system"});
    setUsers(p=>p.map(x=>x.id===u.id?{...x,status:"kicked"}:x));
    showToast(`${u.name} kicked ✦`);
  };
  const blockUser=async(u)=>{
    const {error}=await supabase.from("users").update({status:"blocked"}).eq("id",u.id);
    if(error){showToast("Error blocking: "+error.message);return;}
    await supabase.from("messages").insert({room_id:ROOM_ID,user_id:u.id,text:`${u.name} was blocked by staff.`,type:"system"});
    setUsers(p=>p.map(x=>x.id===u.id?{...x,status:"blocked"}:x));
    showToast(`${u.name} blocked ✦`);
  };
  const unblockUser=async(u)=>{
    const {error}=await supabase.from("users").update({status:"offline"}).eq("id",u.id);
    if(error){showToast("Error: "+error.message);return;}
    setUsers(p=>p.map(x=>x.id===u.id?{...x,status:"offline"}:x));
    showToast(`${u.name} unblocked`);
  };

  // ── Messages ──
  const deleteMsg=async(id)=>{
    // Optimistically remove from UI first
    setMessages(p=>p.filter(m=>m.id!==id));
    const {error}=await supabase.from("messages").delete().eq("id",id);
    if(error){
      showToast("Delete failed: "+error.message);
      loadAll(); // reload to restore
      return;
    }
    showToast("Message deleted ✦");
  };
  const clearAllMsgs=async()=>{
    const {error}=await supabase.from("messages").delete().neq("id",0).eq("room_id",ROOM_ID);
    if(error){
      // Try alternative approach
      const {data:allMsgs}=await supabase.from("messages").select("id").eq("room_id",ROOM_ID);
      if(allMsgs&&allMsgs.length>0){
        for(const m of allMsgs){
          await supabase.from("messages").delete().eq("id",m.id);
        }
      }
    }
    setMessages([]);
    setConfirmClear(false);
    showToast("All messages cleared ✦");
  };

  // ── Word filter ──
  const addWord=async(word)=>{
    if(!word.trim())return;
    const {error}=await supabase.from("blocked_words").insert({word:word.trim().toLowerCase()});
    if(error){showToast("Error: "+error.message);return;}
    setNewWord("");
    setBlockedWords(p=>[...p,{id:Date.now(),word:word.trim().toLowerCase()}]);
    showToast(`"${word}" added to filter ✦`);
  };
  const removeWord=async(id)=>{
    setBlockedWords(p=>p.filter(w=>w.id!==id));
    const {error}=await supabase.from("blocked_words").delete().eq("id",id);
    if(error)showToast("Error: "+error.message);
  };
  const addFilipino=async()=>{
    let added=0;
    for(const w of FIL_SLANG){
      const {error}=await supabase.from("blocked_words").upsert({word:w},{onConflict:"word"});
      if(!error)added++;
    }
    showToast(`Filipino slang filter added — ${added} words ✦`);
    loadAll();
  };

  const onlineUsers=users.filter(u=>u.status==="online");
  const maleCount=onlineUsers.filter(u=>u.gender==="male").length;
  const femaleCount=onlineUsers.filter(u=>u.gender==="female").length;
  const lgbtqCount=onlineUsers.filter(u=>["gay","lesbian","bisexual","trans","nonbinary"].includes(u.gender)).length;
  const preferCount=onlineUsers.filter(u=>u.gender==="prefer_not").length;

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:BG,overflow:"hidden"}}>
      {/* Top bar */}
      <div style={{padding:"0 16px",height:54,display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
        <Logo size={28} showText={true}/>
        <div style={{flex:1}}/>
        <div style={{background:`rgba(201,168,76,0.08)`,border:`1px solid ${GOLD_DIM}44`,borderRadius:8,padding:"4px 12px",fontSize:11,color:GOLD,letterSpacing:.5}}>⚙️ STAFF PANEL</div>
        <button className="btn-ghost" onClick={()=>setConfirmLogout(true)} style={{padding:"5px 12px",fontSize:12}}>Logout</button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,overflowX:"auto"}}>
        {[["dashboard","📊 Dashboard"],["announcements","📢 Announce"],["users","👥 Guests"],["messages","💬 Messages"],["filter","🛡️ Word Filter"],["menu","🍽️ Menu"],["daily","🧾 Daily"],["reports","📈 Reports"],["analytics","📉 Analytics"],["voids","❌ Voids"],["staff","👥 Staff"],["backup","💾 Backup"],["alerts","🔔 Alerts"],["settings","⚙️ Settings"]].map(([v,l])=>(
          <button key={v} className={`tab-btn ${tab===v?"active":""}`} onClick={()=>setTab(v)} style={{fontSize:11,padding:"10px 8px",whiteSpace:"nowrap"}}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:16,paddingBottom:80}}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&(
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
              {[
                {icon:"👥",label:"Online Now",value:onlineUsers.length,color:GOLD},
                {icon:"👨",label:"Male",value:maleCount,color:"#60A5FA"},
                {icon:"👩",label:"Female",value:femaleCount,color:"#F87171"},
                {icon:"🏳️‍🌈",label:"LGBTQ+",value:lgbtqCount,color:"#A78BFA"},
                {icon:"🤐",label:"Prefer Not",value:preferCount,color:"#888"},
                {icon:"💬",label:"Messages",value:messages.length,color:"#34D399"},
              ].map(s=>(
                <div key={s.label} style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:"16px 14px",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontSize:26,fontWeight:700,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.value}</div>
                  <div style={{fontSize:11,color:"#444",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="glass" style={{borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>QUICK ACTIONS</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn-gold" onClick={()=>setTab("announcements")} style={{padding:"9px 16px",fontSize:13,borderRadius:8}}>📢 Post Announcement</button>
                <button className="btn-ghost" onClick={()=>setTab("users")} style={{padding:"9px 16px",fontSize:13,borderRadius:8}}>👥 Manage Guests</button>
                <button onClick={()=>setConfirmClear(true)} style={{padding:"9px 16px",fontSize:13,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,color:"#F87171",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>🗑️ Clear All Messages</button>
              </div>
            </div>

            <div className="glass" style={{borderRadius:14,padding:16}}>
              <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>RECENT GUESTS</div>
              {users.slice(0,8).map(u=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
                  <Avatar user={u} size={30}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:"#ccc",fontWeight:500}}>{u.name}</div>
                    <div style={{fontSize:11,color:"#444"}}>{u.first_name} {u.last_name} · {u.gender||"—"}</div>
                  </div>
                  <div style={{fontSize:10,color:u.status==="online"?"#34D399":u.status==="blocked"?"#F87171":"#555",textTransform:"uppercase",letterSpacing:.5}}>{u.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {tab==="announcements"&&(
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div className="glass" style={{borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>POST NEW ANNOUNCEMENT</div>
              <textarea value={newAnn} onChange={e=>setNewAnn(e.target.value)} placeholder="Type your announcement…" rows={3} style={{width:"100%",padding:"10px 12px",fontSize:14,resize:"none",borderRadius:8,marginBottom:10,lineHeight:1.5}}/>
              <button className="btn-gold" onClick={()=>postAnn(newAnn)} style={{padding:"9px 20px",fontSize:13,borderRadius:8}}>Post ✦</button>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"#444",letterSpacing:1,marginBottom:10}}>QUICK PRESETS</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
                {PRESETS.map((p,i)=>(
                  <button key={i} onClick={()=>postAnn(p)} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 12px",textAlign:"left",cursor:"pointer",fontFamily:"Inter,sans-serif",color:"#ccc",fontSize:12,lineHeight:1.5,transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD_DIM;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;}}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{fontSize:11,color:"#444",letterSpacing:1,marginBottom:10}}>ACTIVE ANNOUNCEMENTS ({announcements.length})</div>
              {announcements.length===0&&<div style={{textAlign:"center",padding:32,color:"#333",fontSize:13,background:SURFACE,borderRadius:12}}>No announcements yet</div>}
              {announcements.map(a=>(
                <div key={a.id} className="fade-in" style={{background:SURFACE,border:`1px solid ${a.pinned?GOLD_DIM:BORDER}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                  {a.pinned&&<span style={{fontSize:14}}>📌</span>}
                  <div style={{flex:1,fontSize:13,color:"#ccc",lineHeight:1.5}}>{a.text}</div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>togglePin(a.id,a.pinned)} style={{background:a.pinned?`rgba(201,168,76,0.12)`:SURFACE2,border:`1px solid ${a.pinned?GOLD_DIM:BORDER}`,borderRadius:6,width:28,height:28,cursor:"pointer",color:a.pinned?GOLD:"#555",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>📌</button>
                    <button onClick={()=>deleteAnn(a.id)} style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,width:28,height:28,cursor:"pointer",color:"#F87171",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GUESTS ── */}
        {tab==="users"&&(
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div style={{fontSize:11,color:"#444",letterSpacing:1,marginBottom:12}}>ALL GUESTS TONIGHT ({users.length})</div>
            {users.map(u=>(
              <div key={u.id} className="fade-in" style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                <Avatar user={u} size={36}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#e8e0d0",display:"flex",alignItems:"center",gap:6}}>
                    {u.name}
                    <span style={{fontSize:11}}>{u.gender==="male"?"👨":u.gender==="female"?"👩":["gay","lesbian","bisexual","trans","nonbinary"].includes(u.gender)?"🏳️‍🌈":u.gender==="prefer_not"?"🤐":""}</span>
                  </div>
                  <div style={{fontSize:11,color:"#555",marginTop:2}}>{u.first_name} {u.last_name} · {u.gender||"not set"}</div>
                  <div style={{fontSize:10,color:u.status==="online"?"#34D399":u.status==="blocked"?"#F87171":"#555",marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{u.status}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {u.status==="online"&&<>
                    <button onClick={()=>kickUser(u)} style={{background:SURFACE2,border:`1px solid #F59E0B44`,borderRadius:7,padding:"6px 10px",cursor:"pointer",color:"#F59E0B",fontSize:11,fontFamily:"Inter,sans-serif",transition:"all .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(245,158,11,0.1)"}
                      onMouseLeave={e=>e.currentTarget.style.background=SURFACE2}>
                      👢 Kick
                    </button>
                    <button onClick={()=>blockUser(u)} style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:"#F87171",fontSize:11,fontFamily:"Inter,sans-serif",transition:"all .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(248,113,113,0.12)"}
                      onMouseLeave={e=>e.currentTarget.style.background="rgba(248,113,113,0.06)"}>
                      🚫 Block
                    </button>
                  </>}
                  {(u.status==="kicked"||u.status==="blocked")&&<>
                    <span style={{fontSize:11,color:u.status==="blocked"?"#F87171":"#F59E0B",background:u.status==="blocked"?"rgba(248,113,113,0.08)":"rgba(245,158,11,0.08)",padding:"4px 8px",borderRadius:8,border:`1px solid ${u.status==="blocked"?"rgba(248,113,113,0.2)":"rgba(245,158,11,0.2)"}`}}>
                      {u.status==="blocked"?"🚫 Blocked":"👢 Kicked"}
                    </span>
                    <button onClick={()=>unblockUser(u)} style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:"#34D399",fontSize:11,fontFamily:"Inter,sans-serif"}}>
                      ✅ Restore
                    </button>
                  </>}
                  {u.status==="offline"&&<span style={{fontSize:11,color:"#555",padding:"4px 8px"}}>Offline</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab==="messages"&&(
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:11,color:"#444",letterSpacing:1}}>RECENT MESSAGES ({messages.length})</div>
              <button onClick={()=>setConfirmClear(true)} style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,padding:"6px 14px",cursor:"pointer",color:"#F87171",fontSize:12,fontFamily:"Inter,sans-serif"}}>🗑️ Clear All</button>
            </div>
            {messages.filter(m=>m.type!=="system").map(m=>(
              <div key={m.id} className="fade-in" style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:m.users?.color||GOLD,marginBottom:4,fontWeight:600}}>{m.users?.name||"Guest"}</div>
                  {m.type==="image"?<div style={{fontSize:12,color:"#555"}}>📷 Shared an image</div>:<div style={{fontSize:13,color:"#ccc",lineHeight:1.5,wordBreak:"break-word"}}>{m.text}</div>}
                  <div style={{fontSize:10,color:"#333",marginTop:4}}>{fmtTime(m.created_at)}</div>
                </div>
                <button onClick={()=>deleteMsg(m.id)} style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,width:26,height:26,cursor:"pointer",color:"#F87171",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"Inter,sans-serif"}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── WORD FILTER ── */}
        {tab==="filter"&&(
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div className="glass" style={{borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>ADD WORD TO FILTER</div>
              <div style={{display:"flex",gap:8}}>
                <input value={newWord} onChange={e=>setNewWord(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord(newWord)} placeholder="Type a word to block…" style={{flex:1,padding:"10px 12px",fontSize:14,borderRadius:8}}/>
                <button className="btn-gold" onClick={()=>addWord(newWord)} style={{padding:"10px 16px",fontSize:13,borderRadius:8}}>Add</button>
              </div>
              <div style={{marginTop:12}}>
                <button onClick={addFilipino} style={{background:`rgba(201,168,76,0.08)`,border:`1px solid ${GOLD_DIM}44`,borderRadius:8,padding:"8px 16px",cursor:"pointer",color:GOLD,fontSize:12,fontFamily:"Inter,sans-serif",width:"100%"}}>
                  🇵🇭 Add Filipino/Bisaya Slang Filter (23 words)
                </button>
              </div>
            </div>

            <div>
              <div style={{fontSize:11,color:"#444",letterSpacing:1,marginBottom:10}}>BLOCKED WORDS ({blockedWords.length})</div>
              {blockedWords.length===0&&<div style={{textAlign:"center",padding:32,color:"#333",fontSize:13,background:SURFACE,borderRadius:12}}>No blocked words yet. Add some above.</div>}
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {blockedWords.map(w=>(
                  <div key={w.id} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#ccc"}}>
                    <span>{w.word}</span>
                    <button onClick={()=>removeWord(w.id)} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:14,lineHeight:1,fontFamily:"Inter,sans-serif",padding:0}}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MENU ── */}
      {tab==="menu"&&(
        <div style={{maxWidth:900,margin:"0 auto",height:"calc(100vh - 160px)",display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:16}}>MENU MANAGEMENT — Edit items, prices, and availability</div>
          <div style={{flex:1,overflow:"hidden"}}>
            <AdminMenuEditor/>
          </div>
        </div>
      )}

      {/* ── REPORTS ── */}
      {tab==="reports"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={ReportComponents}/>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {tab==="analytics"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={AnalyticsComponent}/>
        </div>
      )}

      {/* ── VOID REPORTS ── */}
      {tab==="voids"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={VoidComponent}/>
        </div>
      )}

      {/* ── STAFF MANAGEMENT ── */}
      {/* BUGFIX: Daily and Backup were rendered OUTSIDE the scrollable content
          container, so the empty container still took up flex:1 and pushed them
          far down the page — that big blank gap above "BACKUP & EXPORT". */}
      {tab==="daily"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={DailySummaryComponent}/>
        </div>
      )}
      {tab==="backup"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={BackupComponent}/>
        </div>
      )}
      {tab==="staff"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={StaffMgmtComponent}/>
        </div>
      )}

      {/* ── ADMIN ALERTS ── */}
      {tab==="alerts"&&(
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <Suspensed C={AlertsComponent}/>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab==="settings"&&(
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div className="glass" style={{borderRadius:14,padding:20,marginBottom:16}}>
            <div style={{fontSize:11,color:"#C9A84C",letterSpacing:1,marginBottom:6}}>ACCESS CODE</div>
            <p style={{fontSize:12,color:"#555",marginBottom:14,lineHeight:1.6}}>
              This is the code guests must enter to join the chat. Change it anytime — guests with the old code will not be re-verified until they rejoin.
            </p>
            <div style={{display:"flex",gap:8}}>
              <input
                value={accessCodeSetting}
                onChange={e=>setAccessCodeSetting(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&saveAccessCode()}
                placeholder="e.g. EASYCART2025"
                style={{flex:1,padding:"11px 14px",fontSize:16,letterSpacing:3,fontWeight:700,borderRadius:8,textTransform:"uppercase"}}
                maxLength={30}
              />
              <button className="btn-gold" onClick={saveAccessCode} disabled={accessCodeLoading} style={{padding:"11px 20px",fontSize:13,borderRadius:8,opacity:accessCodeLoading?.7:1}}>
                {accessCodeLoading?"Saving…":"Save ❆"}
              </button>
            </div>
            <p style={{fontSize:11,color:"#2a2a2a",marginTop:10}}>🔒 Stored securely in your database — not hardcoded</p>
          </div>
        </div>
      )}

      {/* Confirm clear modal */}
      {confirmClear&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div className="glass slide-up" style={{maxWidth:300,borderRadius:18,padding:28,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>🗑️</div>
            <h3 style={{fontSize:17,marginBottom:8}}>Clear all messages?</h3>
            <p style={{fontSize:13,color:"#555",marginBottom:20,lineHeight:1.6}}>This cannot be undone.</p>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setConfirmClear(false)} style={{flex:1,padding:10,fontSize:13,borderRadius:8}}>Cancel</button>
              <button onClick={clearAllMsgs} style={{flex:1,padding:10,fontSize:13,background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,color:"#F87171",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm logout modal */}
      {confirmLogout&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div className="glass slide-up" style={{maxWidth:300,borderRadius:18,padding:28,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔒</div>
            <h3 style={{fontSize:17,marginBottom:8}}>Log out of Staff Panel?</h3>
            <p style={{fontSize:13,color:"#555",marginBottom:20,lineHeight:1.6}}>You'll need your PIN to get back in.</p>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setConfirmLogout(false)} style={{flex:1,padding:10,fontSize:13,borderRadius:8}}>Cancel</button>
              <button className="btn-gold" onClick={onLogout} style={{flex:1,padding:10,fontSize:13,borderRadius:8}}>Log out</button>
            </div>
          </div>
        </div>
      )}

      {toasts.map(t=><div key={t.id} className="toast">✦ {t.msg}</div>)}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [me,setMe]=useState(null);
  const [wifiOk,setWifiOk]=useState(true);
  const [adminAuthed,setAdminAuthed]=useState(false);
  const [removedReason,setRemovedReason]=useState(null);
  const [tableId]=useState(()=>getTableFromURL()); // read once from URL
  const {toasts,show:showToast}=useToast();
  const notifications=useNotifications(me);

  // Phase 7 — capture any uncaught crash into error_logs
  useEffect(()=>{
    installErrorHandlers(()=>({user_id:me?.id||null,table_id:tableId||null}));
  },[me,tableId]);

  useEffect(()=>{
    const init=async()=>{
      // Phase 7 — staff login sends admins here with ?admin=1
      if(new URLSearchParams(window.location.search).get("admin")==="1"){
        setScreen("admin");
        return;
      }
      // Try to restore existing session
      const savedUser = await loadSession();
      if(savedUser){
        // Returning user — go straight to chat silently
        setMe(savedUser);
        setScreen("chat");
      } else {
        // New user — show landing after brief load
        setTimeout(()=>{
          setWifiOk(true);
          setScreen("landing");
        },1500);
      }
    };
    init();
  },[]);

  // Clean up user session on page close (mark offline but keep in DB)
  useEffect(()=>{
    if(!me)return;
    const cleanup=()=>supabase.from("users").update({status:"offline"}).eq("id",me.id);
    window.addEventListener("beforeunload",cleanup);
    return()=>window.removeEventListener("beforeunload",cleanup);
  },[me]);

  // Secret admin access: tap logo 5 times on landing
  const [logoTaps,setLogoTaps]=useState(0);
  const tapResetRef=useRef(null);
  const tapLogo=()=>{
    // Clear any existing reset timer
    if(tapResetRef.current)clearTimeout(tapResetRef.current);
    setLogoTaps(t=>{
      const next=t+1;
      if(next>=5){
        setScreen("admin");
        return 0;
      }
      // Reset tap count after 3 seconds of inactivity
      tapResetRef.current=setTimeout(()=>setLogoTaps(0),3000);
      return next;
    });
  };

  return(
    <>
      <style>{CSS}</style>
      <GuestConnectionBanner/>
      {screen==="loading"&&<Loading label="CONNECTING…" sub={`Checking ${VENUE_WIFI}`}/>}
      {screen==="landing"&&<Landing onJoin={()=>setScreen("entry")} onAdminTap={tapLogo} tableId={tableId}/>}
      {screen==="entry"&&<Entry onEnter={user=>{setMe(user);setScreen("chat");}} wifiOk={wifiOk} tableId={tableId}/>}
      {screen==="chat"&&me&&(
        <CartProvider tableId={tableId}>
          <ChatRoom me={me} tableId={tableId} onLeave={(reason)=>{
            setMe(null);
            if(reason==="kicked"||reason==="blocked"){
              clearSession();
              setRemovedReason(reason);
              setScreen("removed");
            } else if(reason==="manual"){
              clearSession();
              setScreen("landing");
            } else {
              setScreen("landing");
            }
          }} showToast={showToast} notifications={notifications}/>
        </CartProvider>
      )}
      {screen==="admin"&&(
        adminAuthed
          ?<AdminPanel onLogout={()=>{setAdminAuthed(false);setScreen("landing");}}/>
          :<AdminLogin onSuccess={()=>setAdminAuthed(true)} onBack={()=>setScreen("landing")}/>
      )}
      {screen==="removed"&&(
        <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,padding:20}}>
          <div className="glass slide-up" style={{maxWidth:380,borderRadius:20,padding:40,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:16}}>{removedReason==="blocked"?"🚫":"👋"}</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:12,color:removedReason==="blocked"?"#F87171":GOLD}}>
              {removedReason==="blocked"?"You have been blocked":"You have been removed"}
            </h2>
            <p style={{color:"#666",lineHeight:1.7,marginBottom:24,fontSize:14}}>
              {removedReason==="blocked"
                ?"You have been blocked by EasyCart staff and can no longer access this chat. If you think this was a mistake, please speak to a staff member."
                :"You have been removed from the chat by EasyCart staff. You are welcome to rejoin if you follow the community guidelines."}
            </p>
            {removedReason==="kicked"&&(
              <button className="btn-gold" onClick={()=>{setRemovedReason(null);setScreen("entry");}} style={{width:"100%",padding:12,fontSize:14,borderRadius:10,marginBottom:10}}>
                Rejoin Chat
              </button>
            )}
            <button className="btn-ghost" onClick={()=>{setRemovedReason(null);setScreen("landing");}} style={{width:"100%",padding:12,fontSize:14,borderRadius:10}}>
              Back to Home
            </button>
          </div>
        </div>
      )}
      {toasts.map(t=><div key={t.id} className="toast">✦ {t.msg}</div>)}
    </>
  );
}

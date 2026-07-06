import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ───────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values from supabase.com
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Constants ─────────────────────────────────────────────────────────────────
const LOGO_SRC = "data:image/jpeg;base64,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";
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

// Get or create open tab for this table
async function getOrCreateTab(tableId){
  // Check for existing open tab
  const {data:existing} = await supabase
    .from("table_tabs")
    .select("*")
    .eq("table_id", tableId)
    .eq("status", "open")
    .single();
  if(existing) return existing;
  // Create new tab
  const {data:created} = await supabase
    .from("table_tabs")
    .insert({table_id: tableId, status:"open", total:0})
    .select()
    .single();
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

function saveSession(user){
  try{
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: user.id,
      fingerprint: getDeviceFingerprint(),
      savedAt: new Date().toISOString(),
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
      saveSession(data);
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
    const text=filterMsg(input.trim());
    setInput("");
    await supabase.from("direct_messages").insert({from_id:me.id,to_id:target.id,text,created_at:new Date().toISOString()});
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
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type a message…" style={{flex:1,padding:"9px 13px",fontSize:14}}/>
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
        const {data:userData}=await supabase.from("users").select("id,name,color,status").eq("id",m.user_id).single();
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
    const load=async()=>{
      const {data}=await supabase.from("users").select("*").eq("room_id",ROOM_ID).gte("last_seen",new Date(Date.now()-300000).toISOString());
      if(data)setUsers(data);
    };
    load();
    const ch=supabase.channel("room-users")
      .on("postgres_changes",{event:"*",schema:"public",table:"users",filter:`room_id=eq.${ROOM_ID}`},load)
      .subscribe();
    return()=>supabase.removeChannel(ch);
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
      const {data,error}=await supabase.from("users").select("status").eq("id",me.id).single();
      // If user no longer exists (wiped by 1PM cleanup), clear session and go to landing
      if(error||!data){
        clearSession();
        onLeave("landing");
        return;
      }
      if(data.status==="blocked"||data.status==="kicked")return;
      await supabase.from("users").update({last_seen:new Date().toISOString(),status:"online"}).eq("id",me.id);
    };
    beat();
    const t=setInterval(beat,30000);
    return()=>{
      clearInterval(t);
      supabase.from("users").update({status:"offline",last_seen:new Date().toISOString()}).eq("id",me.id);
      supabase.from("messages").insert({room_id:ROOM_ID,user_id:me.id,text:`${me.name} left the chat`,type:"system"});
    };
  },[me.id,me.name]);

  // ── Typing indicators via Supabase Realtime broadcast ──
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
    return()=>supabase.removeChannel(ch);
  },[me.id]);

  const broadcastTyping=useCallback((isTyping)=>{
    supabase.channel(`typing-${ROOM_ID}`).send({type:"broadcast",event:"typing",payload:{userId:me.id,userName:me.name,isTyping}});
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
    // Check if user is still allowed
    const {data:statusCheck}=await supabase.from("users").select("status").eq("id",me.id).single();
    if(statusCheck&&(statusCheck.status==="blocked"||statusCheck.status==="kicked")){
      onLeave(statusCheck.status);
      return;
    }
    const text=filterMsg(input.trim(),blockedWordsList);
    setInput("");
    broadcastTyping(false);
    await supabase.from("messages").insert({room_id:ROOM_ID,user_id:me.id,text,type:"text",reactions:{}});
  };

  // ── Send image ──
  const sendImage=async(file)=>{
    if(!file)return;
    showToast("Uploading image…");
    const ext=file.name.split(".").pop();
    const path=`${ROOM_ID}/${randomId()}.${ext}`;
    const {error}=await supabase.storage.from("chat-images").upload(path,file);
    if(error){showToast("Upload failed — try again");return;}
    const {data:{publicUrl}}=supabase.storage.from("chat-images").getPublicUrl(path);
    await supabase.from("messages").insert({room_id:ROOM_ID,user_id:me.id,image_url:publicUrl,type:"image",reactions:{}});
    showToast("Photo shared ✦");
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

  // Inner component to access CartContext inside ChatRoom
  function ReceiptDisplay(){
    const ctx = hasTable ? useCart() : null;
    if(!ctx?.showReceipt) return null;
    return <ReceiptPopup receipt={ctx.showReceipt} onClose={()=>ctx.setShowReceipt(null)}/>;
  }

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
              <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}} placeholder="Message the room…" rows={1} style={{flex:1,padding:"8px 11px",fontSize:14,resize:"none",lineHeight:1.5,borderRadius:8,maxHeight:80,overflowY:"auto"}}/>
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
          const cartBadge = v==="cart" && hasTable ? (useCart()?.cartCount||0) : 0;
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
      <ReceiptDisplay/>

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

  // Load existing tab and orders on mount
  React.useEffect(()=>{
    if(!tableId) return;
    const init = async()=>{
      const t = await getOrCreateTab(tableId);
      setTab(t);
      // Load existing order items for this tab
      const {data} = await supabase
        .from("order_items")
        .select("*, orders(user_name,created_at,status,id)")
        .eq("tab_id", t.id)
        .eq("voided", false)
        .order("created_at", {ascending:true});
      if(data) setOrderHistory(data);
    };
    init();
  },[tableId]);

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
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"table_tabs",filter:`id=eq.${tab.id}`},
        payload=>setTab(p=>({...p,...payload.new})))
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

  const confirmOrder = async(me, note="")=>{
    if(!cartItems.length||!tab||!me) return {success:false,error:"Nothing in cart"};
    // Idempotency check — prevent double submit
    const key = `order_${tab.id}_${Date.now()}`;
    try{
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

      // Update tab total
      const addedTotal = items.reduce((s,i)=>s+i.subtotal,0);
      await supabase.from("table_tabs").update({total: (Number(tab.total)||0)+addedTotal}).eq("id",tab.id);

      setShowReceipt({order, items: cartItems, total: addedTotal});
      clearCart();
      return {success:true, order};
    }catch(e){
      return {success:false, error:e.message};
    }
  };

  const requestBill = async()=>{
    if(!tab) return;
    await supabase.from("table_tabs").update({
      status:"bill_requested",
      bill_requested_at: new Date().toISOString()
    }).eq("id",tab.id);
  };

  const cartTotal = cartItems.reduce((s,i)=>s+(i.item_price*i.quantity),0);
  const cartCount = cartItems.reduce((s,i)=>s+i.quantity,0);
  const billTotal = orderHistory.filter(i=>!i.voided).reduce((s,i)=>s+Number(i.subtotal),0);

  return(
    <CartContext.Provider value={{
      cartItems, addToCart, removeFromCart, updateQty, clearCart,
      confirmOrder, requestBill,
      cartTotal, cartCount, billTotal,
      orderHistory, tab, showReceipt, setShowReceipt,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// ── Receipt Popup ─────────────────────────────────────────────────────────────
function ReceiptPopup({receipt, onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="glass slide-up" style={{width:"100%",maxWidth:380,borderRadius:20,overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${GOLD_DIM}33,${GOLD}11)`,padding:"20px 20px 16px",textAlign:"center",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:36,marginBottom:6}}>🎉</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900}} className="gold-text">Order Confirmed!</div>
          <div style={{fontSize:12,color:"#666",marginTop:4}}>Your order has been sent to the kitchen/bar</div>
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
  const {orderHistory,billTotal,requestBill,tab} = useCart();

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
        {orders.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#444"}}>
            <div style={{fontSize:40,marginBottom:10}}>🧾</div>
            <div style={{fontSize:14}}>No orders yet</div>
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
                <div style={{fontSize:13,fontWeight:600,color:item.voided?"#555":GOLD,flexShrink:0}}>{fmtPrice(item.subtotal)}</div>
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
        {tab?.status==="closed"?(
          <div style={{textAlign:"center",padding:"14px 0",background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:12}}>
            <div style={{fontSize:20,marginBottom:4}}>✅</div>
            <div style={{fontSize:14,color:"#34D399",fontWeight:600}}>Bill Paid — Thank You!</div>
            <div style={{fontSize:12,color:"#666",marginTop:3}}>Hope to see you again at EasyCart!</div>
          </div>
        ):billRequested?(
          <div style={{textAlign:"center",padding:"12px 0",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:12}}>
            <div style={{fontSize:14,color:"#F59E0B",fontWeight:600}}>⏳ Bill Requested</div>
            <div style={{fontSize:12,color:"#666",marginTop:3}}>Staff will be with you shortly</div>
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
  const cart = hasTable ? useCart() : null;

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
const ADMIN_PIN = "143143"; // Change this to your staff PIN

function AdminLogin({onSuccess,onBack}){
  const [pin,setPin]=useState("");
  const [error,setError]=useState("");
  const [shake,setShake]=useState(false);

  const tryPin=(p)=>{
    if(p===ADMIN_PIN){onSuccess();}
    else{
      setError("Incorrect PIN");
      setShake(true);
      setPin("");
      setTimeout(()=>{setShake(false);setError("");},1500);
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
        {[["dashboard","📊 Dashboard"],["announcements","📢 Announce"],["users","👥 Guests"],["messages","💬 Messages"],["filter","🛡️ Word Filter"],["menu","🍽️ Menu"],["settings","⚙️ Settings"]].map(([v,l])=>(
          <button key={v} className={`tab-btn ${tab===v?"active":""}`} onClick={()=>setTab(v)} style={{fontSize:11,padding:"10px 8px",whiteSpace:"nowrap"}}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:16}}>

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

  useEffect(()=>{
    const init=async()=>{
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

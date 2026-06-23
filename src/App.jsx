import { useState, useEffect, useRef, useCallback } from "react";
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

const PROFANITY = ["badword1","badword2"];
const filterMsg = (t) => PROFANITY.reduce((s,w)=>s.replace(new RegExp(w,"gi"),"***"),t);
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
function Landing({onJoin}){
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
        <Logo size={32} showText={true}/>
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
          <img src={LOGO_SRC} alt="EasyCart" style={{width:110,height:110,objectFit:"contain",background:"#fff",borderRadius:20,padding:8,border:`1px solid ${GOLD_DIM}44`}}/>
        </div>
        <div style={{background:"rgba(201,168,76,0.08)",border:`1px solid ${GOLD_DIM}44`,borderRadius:20,padding:"5px 16px",fontSize:12,color:GOLD,marginBottom:20,letterSpacing:1.5}}>
          ✦ {VENUE_LOCATION.toUpperCase()}
        </div>
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
        <span>Venue Wi-Fi secured · No accounts</span>
      </footer>
    </div>
  );
}

// ── Entry screen ──────────────────────────────────────────────────────────────
function Entry({onEnter,wifiOk}){
  const [name,setName]=useState("");
  const [color,setColor]=useState(COLORS[0]);
  const [agreed,setAgreed]=useState(false);
  const [showGuide,setShowGuide]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  const submit=async()=>{
    if(!name.trim()){setError("Please enter a nickname");return;}
    if(!agreed){setError("Please accept the community guidelines");return;}
    setLoading(true);
    try{
      const userId=randomId();
      const {data,error:err}=await supabase.from("users").insert({
        id:userId, name:name.trim(), color, room_id:ROOM_ID, status:"online", last_seen:new Date().toISOString()
      }).select().single();
      if(err)throw err;
      // Post join notification
      await supabase.from("messages").insert({
        room_id:ROOM_ID, user_id:userId, text:`${name.trim()} joined the chat 👋`, type:"system"
      });
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

  return(
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% 45%,rgba(201,168,76,0.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div className="glass slide-up" style={{width:"100%",maxWidth:420,borderRadius:20,padding:"36px 32px",position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <img src={LOGO_SRC} alt="EasyCart" style={{width:72,height:72,objectFit:"contain",background:"#fff",borderRadius:14,padding:5,marginBottom:12}}/>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:900,marginBottom:4}} className="gold-text">Join the Chat</h1>
          <p style={{color:"#555",fontSize:13}}>{VENUE_NAME}</p>
        </div>

        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,color:"#666",letterSpacing:1,display:"block",marginBottom:7}}>YOUR NICKNAME</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="What should we call you?" style={{width:"100%",padding:"11px 14px",fontSize:15}} maxLength={24}/>
        </div>

        <div style={{marginBottom:22}}>
          <label style={{fontSize:11,color:"#666",letterSpacing:1,display:"block",marginBottom:9}}>AVATAR COLOR</label>
          <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setColor(c)} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent",transition:"transform .15s",transform:color===c?"scale(1.2)":"scale(1)",boxShadow:color===c?`0 0 10px ${c}66`:"none"}}/>
            ))}
          </div>
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${color},${color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#080808",fontSize:12,border:`2px solid ${color}55`}}>{name?initials(name):"?"}</div>
            <span style={{fontSize:12,color:"#444"}}>{name||"Your preview"}</span>
          </div>
        </div>

        <div style={{marginBottom:22,display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}} onClick={()=>setAgreed(a=>!a)}>
          <div style={{width:19,height:19,borderRadius:5,border:`1px solid ${agreed?GOLD:BORDER}`,background:agreed?`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",marginTop:1}}>
            {agreed&&<span style={{fontSize:11,color:"#080808",fontWeight:800}}>✓</span>}
          </div>
          <p style={{fontSize:13,color:"#555",lineHeight:1.55}}>
            I agree to the <span style={{color:GOLD,cursor:"pointer",textDecoration:"underline"}} onClick={e=>{e.stopPropagation();setShowGuide(true);}}>Community Guidelines</span>
          </p>
        </div>

        {error&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,padding:"9px 13px",fontSize:13,color:"#F87171",marginBottom:14}}>{error}</div>}

        <button className="btn-gold" onClick={submit} disabled={loading} style={{width:"100%",padding:13,fontSize:15,borderRadius:10,opacity:loading?.7:1}}>
          {loading?"Connecting…":"Enter the Room ✦"}
        </button>
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
function PMPanel({target,me,onClose}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(true);
  const endRef=useRef(null);

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
function ChatRoom({me,onLeave,showToast}){
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
  const [annIdx,setAnnIdx]=useState(0);
  const [announcements,setAnnouncements]=useState(["🥂 Welcome to EasyCart!"]);
  const [loadingMsgs,setLoadingMsgs]=useState(true);
  const endRef=useRef(null);
  const fileRef=useRef(null);
  const inputRef=useRef(null);
  const typingTimeout=useRef(null);

  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[messages]);
  useEffect(()=>{const t=setInterval(()=>setAnnIdx(i=>(i+1)%announcements.length),5000);return()=>clearInterval(t);},[announcements.length]);

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
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`room_id=eq.${ROOM_ID}`},payload=>{
        setMessages(p=>p.map(m=>m.id===payload.new.id?{...m,...payload.new}:m));
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

  // ── Heartbeat — keep user online ──
  useEffect(()=>{
    const beat=async()=>{
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
    const text=filterMsg(input.trim());
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

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:BG,overflow:"hidden"}} onClick={()=>showEmoji&&setShowEmoji(false)}>
      {/* Top bar */}
      <div style={{padding:"0 14px",height:54,display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
        <Logo size={30} showText={true}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"5px 12px",fontSize:12,color:GOLD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} className="ann-bar">
            📢 {announcements[annIdx]}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <div className="online-dot"/>
          <span style={{fontSize:11,color:"#555",whiteSpace:"nowrap"}}>{visibleUsers.length} online</span>
        </div>
        <Avatar user={me} size={28}/>
        <button className="btn-ghost" onClick={onLeave} style={{padding:"5px 11px",fontSize:11,flexShrink:0}}>Leave</button>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        {/* Left sidebar */}
        <div style={{width:190,borderRight:`1px solid ${BORDER}`,background:SURFACE,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto",padding:"10px 6px"}}>
          <div style={{fontSize:10,color:GOLD,letterSpacing:1,padding:"2px 8px",marginBottom:8}}>ONLINE · {visibleUsers.length}</div>
          {visibleUsers.map(u=>(
            <div key={u.id} className="sidebar-item" onClick={()=>setShowProfile(u)} style={{display:"flex",alignItems:"center",gap:7,marginBottom:1}}>
              <Avatar user={u} size={26}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:u.id===me.id?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:u.id===me.id?"#C9A84C":"#ccc"}}>{u.name}{u.id===me.id?" ✦":""}</div>
              </div>
              <div className={`online-dot ${u.status==="away"?"away":""}`} style={{width:6,height:6}}/>
            </div>
          ))}
          <div style={{marginTop:"auto",paddingTop:16,borderTop:`1px solid ${BORDER}`,marginTop:12}}>
            <div style={{fontSize:10,color:"#2a2a2a",textAlign:"center",lineHeight:1.5,padding:"0 4px"}}>🔒 {VENUE_WIFI}</div>
          </div>
        </div>

        {/* Main chat */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>
          <div style={{padding:"8px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:8,flexShrink:0,background:SURFACE}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#34D399"}}/>
            <span style={{fontSize:13,fontWeight:600,color:"#ccc"}}># lounge-chat</span>
            <span style={{fontSize:11,color:"#333",marginLeft:4}}>{VENUE_NAME}</span>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 14px 6px"}}>
            {loadingMsgs&&[1,2,3,4].map(i=><MsgSkeleton key={i}/>)}
            {!loadingMsgs&&visibleMsgs.map((m,idx)=>{
              const u=getUserFor(m);
              const isMe=m.user_id===me.id;
              const isSystem=m.type==="system";
              const showAvatar=idx===0||visibleMsgs[idx-1].user_id!==m.user_id;
              if(isSystem) return(
                <div key={m.id} className="fade-in" style={{textAlign:"center",fontSize:12,color:"#333",padding:"4px 0 10px"}}>{m.text}</div>
              );
              return(
                <div key={m.id} className="fade-in" style={{display:"flex",gap:9,marginBottom:showAvatar?14:4,flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end"}}>
                  <div style={{width:32,flexShrink:0}}>
                    {showAvatar&&<Avatar user={u} size={30} onClick={()=>setShowProfile(u)}/>}
                  </div>
                  <div style={{maxWidth:"72%"}}>
                    {showAvatar&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexDirection:isMe?"row-reverse":"row"}}>
                        <span style={{fontSize:12,fontWeight:600,color:isMe?GOLD:u.color}}>{isMe?"You":u.name}</span>
                        <span style={{fontSize:10,color:"#2a2a2a"}}>{fmtTime(m.created_at)}</span>
                      </div>
                    )}
                    <div className={`msg-bubble ${isMe?"msg-own":""}`}>
                      {m.type==="image"?(
                        <img src={m.image_url} alt="shared" style={{maxWidth:200,maxHeight:180,borderRadius:8,cursor:"pointer",display:"block"}} onClick={()=>setSelectedImg(m.image_url)}/>
                      ):(
                        <span>{m.text}</span>
                      )}
                    </div>
                    {Object.keys(m.reactions||{}).length>0&&(
                      <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap",justifyContent:isMe?"flex-end":"flex-start"}}>
                        {Object.entries(m.reactions).filter(([,ids])=>ids.length>0).map(([emoji,ids])=>(
                          <button key={emoji} className={`reaction-btn ${ids.includes(me.id)?"active":""}`} onClick={()=>toggleReaction(m.id,emoji)}>
                            {emoji} {ids.length}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",gap:2,marginTop:3,flexWrap:"wrap",justifyContent:isMe?"flex-end":"flex-start",opacity:0}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                      {EMOJIS.slice(0,6).map(e=>(
                        <button key={e} onClick={()=>toggleReaction(m.id,e)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",padding:"1px 2px",lineHeight:1}}>{e}</button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUsers.filter(u=>!blockedIds.includes(u.id)).length>0&&(
              <div className="fade-in" style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0 10px 41px"}}>
                <div style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:12,padding:"7px 12px",display:"flex",gap:4,alignItems:"center"}}>
                  <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                </div>
                <span style={{fontSize:11,color:"#333"}}>{typingUsers.filter(u=>!blockedIds.includes(u.id)).map(u=>u.name).join(", ")} typing…</span>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"10px 14px",borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
            <div style={{display:"flex",gap:7,alignItems:"flex-end",position:"relative"}}>
              {showEmoji&&<EmojiPicker onSelect={e=>setInput(p=>p+e)} onClose={()=>setShowEmoji(false)}/>}
              <button onClick={e=>{e.stopPropagation();setShowEmoji(p=>!p);}} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 11px",cursor:"pointer",fontSize:16,flexShrink:0}} onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD_DIM} onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>😊</button>
              <button onClick={()=>fileRef.current?.click()} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 11px",cursor:"pointer",fontSize:15,flexShrink:0}} onMouseEnter={e=>e.currentTarget.style.borderColor=GOLD_DIM} onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>📷</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{sendImage(e.target.files[0]);e.target.value="";}}/>
              <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}} placeholder="Message the room… (Enter to send)" rows={1} style={{flex:1,padding:"9px 13px",fontSize:14,resize:"none",lineHeight:1.55,borderRadius:8,maxHeight:90,overflowY:"auto"}}/>
              <button className="btn-gold" onClick={sendMsg} style={{padding:"9px 16px",fontSize:13,flexShrink:0,borderRadius:8}}>Send</button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{width:210,borderLeft:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
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
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"6px 8px",borderRadius:9,cursor:u.id!==me.id?"pointer":"default",transition:"background .15s"}} onClick={()=>{if(u.id!==me.id)setPmTarget(u);}} onMouseEnter={e=>{if(u.id!==me.id)e.currentTarget.style.background=SURFACE2;}} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <Avatar user={u} size={28}/>
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
                <div style={{textAlign:"center",padding:"12px 0 16px"}}>
                  <img src={LOGO_SRC} alt="EasyCart" style={{width:52,height:52,objectFit:"contain",background:"#fff",borderRadius:10,padding:4,marginBottom:8}}/>
                  <div style={{fontSize:13,fontWeight:600,color:"#e8e0d0"}}>EasyCart</div>
                  <div style={{fontSize:11,color:"#555"}}>Barcade & Lounge</div>
                  <div style={{fontSize:10,color:"#333",marginTop:2}}>{VENUE_LOCATION}</div>
                </div>
                <div style={{height:1,background:BORDER,margin:"0 0 14px"}}/>
                <div style={{fontSize:10,color:"#2a2a2a",marginBottom:9,letterSpacing:1}}>TONIGHT</div>
                {announcements.map((a,i)=>(
                  <div key={i} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:9,padding:"9px 11px",marginBottom:7,fontSize:12,lineHeight:1.5,color:"#ccc"}}>{a}</div>
                ))}
                <div style={{fontSize:10,color:"#2a2a2a",margin:"14px 0 9px",letterSpacing:1}}>VENUE INFO</div>
                <div style={{fontSize:11,color:"#444",lineHeight:2}}>
                  <div>📍 {VENUE_LOCATION}</div>
                  <div>🔒 Wi-Fi secured chat</div>
                  <div>🍸 Hidden Bar inside</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showProfile&&<ProfileCard user={showProfile} me={me} onClose={()=>setShowProfile(null)} onDM={()=>{setPmTarget(showProfile);setShowProfile(null);}} onBlock={()=>blockUser(showProfile.id)} onReport={reportUser}/>}
      {pmTarget&&<PMPanel target={pmTarget} me={me} onClose={()=>setPmTarget(null)}/>}
      {selectedImg&&<ImageModal src={selectedImg} onClose={()=>setSelectedImg(null)}/>}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [me,setMe]=useState(null);
  const [wifiOk,setWifiOk]=useState(true);
  const {toasts,show:showToast}=useToast();

  useEffect(()=>{
    // Simulate Wi-Fi/connection check then go to landing
    setTimeout(()=>{
      setWifiOk(true);
      setScreen("landing");
    },2000);
  },[]);

  // Clean up user session on page close
  useEffect(()=>{
    if(!me)return;
    const cleanup=()=>supabase.from("users").update({status:"offline"}).eq("id",me.id);
    window.addEventListener("beforeunload",cleanup);
    return()=>window.removeEventListener("beforeunload",cleanup);
  },[me]);

  return(
    <>
      <style>{CSS}</style>
      {screen==="loading"&&<Loading label="CONNECTING…" sub={`Checking ${VENUE_WIFI}`}/>}
      {screen==="landing"&&<Landing onJoin={()=>setScreen("entry")}/>}
      {screen==="entry"&&<Entry onEnter={user=>{setMe(user);setScreen("chat");showToast(`Welcome, ${user.name}! You're in 👑`);}} wifiOk={wifiOk}/>}
      {screen==="chat"&&me&&<ChatRoom me={me} onLeave={()=>{setMe(null);setScreen("landing");}} showToast={showToast}/>}
      {toasts.map(t=><div key={t.id} className="toast">✦ {t.msg}</div>)}
    </>
  );
}

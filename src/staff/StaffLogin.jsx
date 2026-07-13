import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STAFF_ROLES, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS, saveStaffSession, supabase } from "./shared.js";
import { verifyStaffPin } from "../lib/prod.js";

const LOGO_STYLE = {
  fontFamily:"'Georgia',serif",fontSize:28,fontWeight:900,
  letterSpacing:2,color:"#C9A84C"
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#e8e0d0;font-family:'Inter',sans-serif;height:100dvh;overflow:hidden}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
.slide-up{animation:slideUp .35s ease}
.btn-gold{background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#080808;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.btn-gold:hover{filter:brightness(1.1)}
.btn-ghost{background:transparent;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;cursor:pointer}
.btn-ghost:hover{border-color:#8A6A28;color:#C9A84C}
`;

export default function StaffLogin(){
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [fails, setFails] = useState(0);            // Phase 7 — brute-force guard
  const [lockedUntil, setLockedUntil] = useState(0);

  // Phase 7 — /admin-staff never existed; admin panel lives inside App at ?admin=1
  const ROUTES = { kitchen:"/kitchen", bar:"/bar", cashier:"/cashier", admin:"/?admin=1" };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setPin("");
    setError("");
  };

  const handleKeypad = (v) => {
    if(pin.length >= 6) return;
    const next = pin + v;
    setPin(next);
    if(next.length === 6) setTimeout(()=>verifyPin(next), 120);
  };

  const verifyPin = async(p) => {
    // Phase 7 — brute-force lockout (5 wrong PINs = 60s cooldown)
    if(lockedUntil && Date.now() < lockedUntil){
      const secs = Math.ceil((lockedUntil - Date.now())/1000);
      setError(`Too many attempts. Wait ${secs}s.`);
      setPin("");
      return;
    }

    // Phase 7 — PIN is checked on the server; it never enters the browser bundle
    const ok = await verifyStaffPin(selectedRole, p);

    if(ok){
      setFails(0);
      setLockedUntil(0);
      saveStaffSession(selectedRole);
      // Log login activity
      await supabase.from("staff_activity").insert({
        role:selectedRole, action:"login",
        details:{}, device_hint:navigator.userAgent.slice(0,50)
      }).catch(()=>{});
      navigate(ROUTES[selectedRole]);
    } else {
      const n = fails + 1;
      setFails(n);
      if(n >= 5){
        setLockedUntil(Date.now() + 60000);
        setError("Too many attempts. Locked for 60s.");
      } else {
        setError(`Incorrect PIN. ${5-n} attempt${5-n===1?"":"s"} left.`);
      }
      await supabase.from("staff_activity").insert({
        role:selectedRole, action:"login_failed",
        details:{}, device_hint:navigator.userAgent.slice(0,50)
      }).catch(()=>{});
      setShake(true);
      setPin("");
      setTimeout(()=>{ setShake(false); setError(""); }, 2000);
    }
  };

  const del = () => setPin(p => p.slice(0,-1));

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#080808",padding:20,position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 45%,rgba(201,168,76,0.06) 0%,transparent 65%)",pointerEvents:"none"}}/>

      <div className="slide-up" style={{width:"100%",maxWidth:480,position:"relative",zIndex:1}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={LOGO_STYLE}>EASYCART</div>
          <div style={{fontSize:11,color:"#555",letterSpacing:2,marginTop:2}}>BARCADE & LOUNGE · STAFF ACCESS</div>
        </div>

        {!selectedRole ? (
          /* Role selection */
          <div>
            <div style={{fontSize:12,color:"#555",letterSpacing:1,textAlign:"center",marginBottom:16}}>SELECT YOUR ROLE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {STAFF_ROLES.map(role=>(
                <button key={role} onClick={()=>handleRoleSelect(role)}
                  style={{padding:"24px 16px",background:"#0F0F0F",border:`2px solid #241E10`,borderRadius:16,cursor:"pointer",textAlign:"center",transition:"all .2s",fontFamily:"Inter,sans-serif"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=ROLE_COLORS[role];e.currentTarget.style.background="#161616";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#241E10";e.currentTarget.style.background="#0F0F0F";}}>
                  <div style={{fontSize:36,marginBottom:8}}>{ROLE_ICONS[role]}</div>
                  <div style={{fontSize:15,fontWeight:600,color:ROLE_COLORS[role]}}>{ROLE_LABELS[role]}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* PIN entry */
          <div style={{background:"#0F0F0F",border:"1px solid #241E10",borderRadius:20,padding:"28px 24px",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:4}}>{ROLE_ICONS[selectedRole]}</div>
            <div style={{fontSize:18,fontWeight:700,color:ROLE_COLORS[selectedRole],marginBottom:2}}>{ROLE_LABELS[selectedRole]}</div>
            <div style={{fontSize:12,color:"#555",marginBottom:24}}>Enter your 6-digit PIN</div>

            {/* PIN dots */}
            <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:24,animation:shake?"shake .4s ease":"none"}}>
              {[0,1,2,3,4,5].map(i=>(
                <div key={i} style={{width:13,height:13,borderRadius:"50%",background:i<pin.length?ROLE_COLORS[selectedRole]:"transparent",border:`2px solid ${i<pin.length?ROLE_COLORS[selectedRole]:"#241E10"}`,transition:"all .15s"}}/>
              ))}
            </div>

            {/* Keypad */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:260,margin:"0 auto 16px"}}>
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
                <button key={i} onClick={()=>k==="⌫"?del():k!==""?handleKeypad(String(k)):null}
                  style={{padding:"15px 0",borderRadius:12,background:k==="⌫"?"transparent":"#161616",border:`1px solid ${k==="⌫"?"transparent":"#241E10"}`,color:k==="⌫"?"#555":"#e8e0d0",fontSize:k==="⌫"?18:20,fontWeight:500,cursor:k===""?"default":"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s",opacity:k===""?0:1}}
                  onMouseEnter={e=>{if(k!=="")e.currentTarget.style.borderColor="#8A6A28";}}
                  onMouseLeave={e=>{if(k!=="⌫")e.currentTarget.style.borderColor="#241E10";}}>
                  {k}
                </button>
              ))}
            </div>

            {error&&<div style={{fontSize:13,color:"#F87171",marginBottom:12}}>{error}</div>}

            <button onClick={()=>setSelectedRole(null)}
              style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:13,fontFamily:"Inter,sans-serif"}}>
              ← Change Role
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
    </div>
  );
}

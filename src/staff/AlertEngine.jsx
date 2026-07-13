import { useEffect, useRef, useState } from "react";
import { supabase } from "./shared.js";

const GOLD = "#C9A84C";
const GOLD_DIM = "#8A6A28";
const SURFACE = "#0F0F0F";
const BORDER = "#241E10";

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getConfig(){
  try{
    const {data} = await supabase
      .from("staff_config")
      .select("key,value")
      .in("key",["alert_void_threshold","alert_pending_threshold","alert_unpaid_minutes"]);
    const cfg = {};
    data?.forEach(c=>{ cfg[c.key]=Number(c.value); });
    return {
      voidThreshold:    cfg.alert_void_threshold    || 300,
      pendingThreshold: cfg.alert_pending_threshold  || 5,
      unpaidMinutes:    cfg.alert_unpaid_minutes     || 30,
    };
  }catch(e){
    return { voidThreshold:300, pendingThreshold:5, unpaidMinutes:30 };
  }
}

async function createAlert(type, title, message, data={}){
  try{
    // Deduplicate — don't fire same alert within 15 minutes
    const since = new Date(Date.now()-15*60*1000).toISOString();
    const {data:existing} = await supabase
      .from("admin_alerts")
      .select("id")
      .eq("type",type)
      .eq("title",title)
      .gte("created_at",since)
      .limit(1);
    if(existing?.length>0) return;
    await supabase.from("admin_alerts").insert({type,title,message,data,read:false});
  }catch(e){}
}

// ── Alert Engine Hook (used in Kitchen, Bar, Cashier) ─────────────────────────
export function useAlertEngine(role){
  const cfg = useRef({voidThreshold:300, pendingThreshold:5, unpaidMinutes:30});
  const alertedVoids = useRef(new Set());
  const alertedBills = useRef(new Set());

  useEffect(()=>{
    getConfig().then(c=>{ cfg.current=c; });

    // Watch void_logs for large voids
    const voidCh = supabase.channel(`alert-voids-${role}-${Date.now()}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"void_logs"},async payload=>{
        const v = payload.new;
        const total = Number(v.item_price||0)*Number(v.quantity||1);
        if(total>=cfg.current.voidThreshold && !alertedVoids.current.has(v.id)){
          alertedVoids.current.add(v.id);
          await createAlert(
            "large_void",
            `Large Void — Table ${v.table_id}`,
            `${v.voided_by} voided "${v.item_name}" ×${v.quantity} worth ₱${total.toFixed(2)}. Reason: ${v.reason}`,
            {table_id:v.table_id, item:v.item_name, total, voided_by:v.voided_by}
          );
        }
      })
      .subscribe();

    // Watch bill requests
    const billCh = supabase.channel(`alert-bills-${role}-${Date.now()}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"table_tabs"},async payload=>{
        const tab = payload.new;
        if(tab.status==="bill_requested" && !alertedBills.current.has(tab.id)){
          alertedBills.current.add(tab.id);
          await createAlert(
            "bill_request",
            `Bill Requested — Table ${tab.table_id}`,
            `Table ${tab.table_id} has requested the bill. Total: ₱${Number(tab.total||0).toFixed(2)}`,
            {table_id:tab.table_id, total:tab.total}
          );
        }
        if(tab.status==="closed") alertedBills.current.delete(tab.id);
      })
      .subscribe();

    // Periodic checks every 2 minutes
    let tick = 0;
    const interval = setInterval(async()=>{
      // Phase 7 — egress: thresholds almost never change. Refresh them every
      // 30 min instead of every 2 min on every open dashboard.
      if(tick++ % 15 === 0){
        cfg.current = await getConfig();
      }
      const config = cfg.current;

      // Backed up orders
      const {data:pending} = await supabase
        .from("orders").select("id").eq("status","pending");
      if(pending && pending.length>=config.pendingThreshold){
        await createAlert(
          "backed_up",
          `${pending.length} Pending Orders — Action Needed`,
          `There are ${pending.length} pending orders waiting. Check kitchen and bar dashboards immediately.`,
          {count:pending.length}
        );
      }

      // Unpaid bill requests
      const cutoff = new Date(Date.now()-config.unpaidMinutes*60*1000).toISOString();
      const {data:unpaid} = await supabase
        .from("table_tabs")
        .select("id,table_id,bill_requested_at,total")
        .eq("status","bill_requested")
        .lte("bill_requested_at",cutoff);
      if(unpaid?.length>0){
        for(const tab of unpaid){
          await createAlert(
            "unpaid_bill",
            `Unpaid Bill — Table ${tab.table_id}`,
            `Table ${tab.table_id} requested the bill ${config.unpaidMinutes}+ minutes ago and it is still unpaid. Total: ₱${Number(tab.total||0).toFixed(2)}`,
            {table_id:tab.table_id, total:tab.total}
          );
        }
      }
    }, 2*60*1000);

    return()=>{
      supabase.removeChannel(voidCh);
      supabase.removeChannel(billCh);
      clearInterval(interval);
    };
  },[role]);
}

// ── Alert Bell Component ──────────────────────────────────────────────────────
export function AlertBell(){
  const [open,setOpen] = useState(false);
  const [alerts,setAlerts] = useState([]);
  const [unread,setUnread] = useState(0);

  useEffect(()=>{
    loadAlerts();
    const ch = supabase.channel(`alert-bell-${Date.now()}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"admin_alerts"},payload=>{
        setAlerts(p=>[payload.new,...p].slice(0,20));
        setUnread(n=>n+1);
        // Subtle ping sound
        try{
          const ctx=new(window.AudioContext||window.webkitAudioContext)();
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value=880; o.type="sine";
          g.gain.setValueAtTime(0,ctx.currentTime);
          g.gain.linearRampToValueAtTime(.2,ctx.currentTime+.01);
          g.gain.linearRampToValueAtTime(0,ctx.currentTime+.3);
          o.start(); o.stop(ctx.currentTime+.35);
        }catch(e){}
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  const loadAlerts = async()=>{
    const {data} = await supabase
      .from("admin_alerts").select("*")
      .order("created_at",{ascending:false}).limit(20);
    setAlerts(data||[]);
    setUnread((data||[]).filter(a=>!a.read).length);
  };

  const markAllRead = async()=>{
    await supabase.from("admin_alerts").update({read:true}).eq("read",false);
    setAlerts(p=>p.map(a=>({...a,read:true})));
    setUnread(0);
  };

  const TYPE_ICON = {
    large_void:"💸", backed_up:"🔥",
    unpaid_bill:"⏰", bill_request:"🧾", void:"❌"
  };

  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>{setOpen(o=>!o); if(unread>0) markAllRead();}}
        style={{background:"none",border:`1px solid ${unread>0?"rgba(248,113,113,0.4)":BORDER}`,
          borderRadius:8,padding:"5px 10px",cursor:"pointer",
          color:unread>0?"#F87171":"#666",fontSize:18,
          fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:4}}>
        🔔
        {unread>0&&(
          <span style={{background:"#F87171",color:"#fff",borderRadius:10,
            padding:"0 5px",fontSize:10,fontWeight:700,lineHeight:"16px"}}>
            {unread}
          </span>
        )}
      </button>

      {open&&(
        <>
          {/* Backdrop */}
          <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setOpen(false)}/>
          {/* Dropdown */}
          <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,
            width:300,background:SURFACE,border:`1px solid ${BORDER}`,
            borderRadius:14,overflow:"hidden",zIndex:100,
            boxShadow:"0 8px 32px rgba(0,0,0,.7)"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${BORDER}`,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:GOLD,fontWeight:600,letterSpacing:1}}>ALERTS</span>
              <button onClick={()=>setOpen(false)}
                style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:16,fontFamily:"Inter,sans-serif"}}>
                ×
              </button>
            </div>
            <div style={{maxHeight:320,overflowY:"auto"}}>
              {alerts.length===0
                ?<div style={{padding:20,textAlign:"center",color:"#444",fontSize:13}}>No alerts</div>
                :alerts.map(a=>(
                  <div key={a.id} style={{padding:"10px 14px",borderBottom:`1px solid ${BORDER}`,
                    background:a.read?"transparent":"rgba(248,113,113,0.04)"}}>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:16,flexShrink:0}}>{TYPE_ICON[a.type]||"🔔"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:a.read?400:600,
                          color:a.read?"#666":"#e8e0d0"}}>{a.title}</div>
                        <div style={{fontSize:11,color:"#444",marginTop:1,lineHeight:1.4}}>
                          {a.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, ORDER_STATUS, VOID_REASONS, fmtTime, fmtPrice, playAlert, loadStaffSession, clearStaffSession, logAudit } from "./shared.js";
import { useAlertEngine, AlertBell } from "./AlertEngine.jsx";

const GOLD = "#C9A84C";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";
const BAR_COLOR = "#60A5FA";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#e8e0d0;font-family:'Inter',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1a2a3a;border-radius:2px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes flash{0%,100%{background:#0F0F0F}50%{background:rgba(96,165,250,0.15)}}
.fade-in{animation:fadeIn .3s ease}
.new-flash{animation:flash .6s ease 3}
.btn-gold{background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#080808;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-ghost{background:transparent;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;cursor:pointer}
.btn-ghost:hover{border-color:#8A6A28;color:#C9A84C}
input,select,textarea{background:#161616;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;outline:none}
input:focus,select:focus,textarea:focus{border-color:#3b82f6}
`;

const NEXT_ACTION = {
  pending:   { label:"Accept Order", color:"#F59E0B", next:"preparing" },
  preparing: { label:"Mark Ready",   color:"#34D399", next:"ready"     },
  ready:     { label:"Mark Served",  color:"#888",    next:"served"    },
};

// BUGFIX: the Bar used to read `order.status` — the SAME row the Kitchen wrote
// to. An order can hold food AND drinks, so the kitchen marking the burger
// ready flipped the beer to "Ready" before anyone poured it. Each station now
// judges only ITS OWN items (`order.items` is pre-filtered to drinks/spirits).
const STATUS_FLOW = ["pending","preparing","ready","served"];
const RANK = { pending:1, preparing:2, ready:3, served:4 };
function stationStatus(order){
  const live = (order.items||[]).filter(i=>!i.voided);
  if(!live.length) return "voided";
  const min = Math.min(...live.map(i=>RANK[i.status]||1));
  return STATUS_FLOW[min-1] || "pending";
}

export default function Bar(){
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [voidModal, setVoidModal] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidNote, setVoidNote] = useState("");
  const [newIds, setNewIds] = useState(new Set());
  const audioUnlocked = useRef(false);

  const role = loadStaffSession();
  useAlertEngine(role||"bar");
  useEffect(()=>{
    if(role!=="bar"&&role!=="admin"){ navigate("/staff"); }
  },[role]);

  const unlockAudio = ()=>{ audioUnlocked.current=true; };

  useEffect(()=>{
    loadOrders();
    const ch = supabase.channel("bar-orders")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"orders"},payload=>{
        loadOrderWithItems(payload.new.id,"new");
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"orders"},payload=>{
        setOrders(p=>p.map(o=>o.id===payload.new.id?{...o,...payload.new}:o));
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"order_items"},payload=>{
        setOrders(p=>p.map(o=>({
          ...o,
          items: o.items?.map(i=>i.id===payload.new.id?{...i,...payload.new}:i)
        })));
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  const loadOrders = async()=>{
    setLoading(true);
    const {data} = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at",{ascending:false})
      .limit(100);
    if(data){
      const drinkOrders = data.filter(o=>
        o.order_items?.some(i=>["drinks","spirits"].includes(i.category_type)&&!i.voided)
      ).map(o=>({
        ...o,
        items: o.order_items?.filter(i=>["drinks","spirits"].includes(i.category_type))
      }));
      setOrders(drinkOrders);
    }
    setLoading(false);
  };

  const loadOrderWithItems = async(orderId, flag="")=>{
    const {data} = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id",orderId)
      .maybeSingle();   // BUGFIX: .single() throws when the row is gone
    if(data){
      const hasDrinkItems = data.order_items?.some(i=>["drinks","spirits"].includes(i.category_type)&&!i.voided);
      if(!hasDrinkItems) return;
      const order = {...data, items: data.order_items?.filter(i=>["drinks","spirits"].includes(i.category_type))};
      setOrders(p=>{
        const exists = p.find(o=>o.id===orderId);
        if(exists) return p.map(o=>o.id===orderId?order:o);
        if(flag==="new"){
          if(audioUnlocked.current) playAlert("new_order");
          setNewIds(prev=>new Set([...prev,orderId]));
          setTimeout(()=>setNewIds(prev=>{const n=new Set(prev);n.delete(orderId);return n;}),3000);
        }
        return [order,...p];
      });
    }
  };

  const advanceStatus = async(order)=>{
    const action = NEXT_ACTION[stationStatus(order)];
    if(!action) return;
    // BUGFIX: no longer writes `orders.status` (the row the Kitchen shares).
    // Only this station's items change; the DB trigger recalc_order_status()
    // rolls the parent order up from them.
    const {error} = await supabase.from("order_items")
      .update({status:action.next})
      .eq("order_id",order.id)
      .eq("voided",false)
      .in("category_type",["drinks","spirits"]);
    if(error){
      console.warn("advanceStatus failed:",error.message);
      return;
    }
    await logAudit(`order_${action.next}`,"orders",order.id,{table_id:order.table_id},"bar");
  };

  const submitVoid = async()=>{
    if(!voidReason) return;
    const reason = voidNote?`${voidReason}: ${voidNote}`:voidReason;
    // BUGFIX: voids only THIS station's drinks now. It used to also mark the
    // whole ORDER voided, which erased the guest's food from the Kitchen screen
    // while still billing them for it.
    const {error:ve} = await supabase.from("order_items")
      .update({voided:true,void_reason:reason,voided_at:new Date().toISOString(),status:"voided"})
      .eq("order_id",voidModal.id)
      .eq("voided",false)
      .in("category_type",["drinks","spirits"]);
    if(ve){
      console.warn("void failed:",ve.message);
      setVoidModal(null);
      return;
    }
    // BUGFIX: .insert(undefined) threw when items was missing.
    const rows = (voidModal.items||[]).filter(i=>!i.voided).map(i=>({
      order_item_id:i.id,tab_id:i.tab_id,table_id:i.table_id,
      item_name:i.item_name,item_price:i.item_price,quantity:i.quantity,
      reason,voided_by:"bar"
    }));
    if(rows.length) await supabase.from("void_logs").insert(rows);
    await logAudit("order_voided","orders",voidModal.id,{reason},"bar");
    setVoidModal(null);
    loadOrders();
  };

  const filtered = orders.filter(o=>{
    if(filter==="active") return ["pending","preparing","ready"].includes(stationStatus(o));
    if(filter==="served") return stationStatus(o)==="served";
    return true;
  });

  const pendingCount = orders.filter(o=>stationStatus(o)==="pending").length;
  const preparingCount = orders.filter(o=>stationStatus(o)==="preparing").length;

  return(
    <div style={{minHeight:"100dvh",background:BG,display:"flex",flexDirection:"column"}} onClick={unlockAudio}>
      <style>{CSS}</style>

      <div style={{height:56,background:SURFACE,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0}}>
        <div style={{fontSize:22}}>🍸</div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:BAR_COLOR}}>Bar Dashboard</div>
          <div style={{fontSize:11,color:"#555"}}>EasyCart Barcade & Lounge</div>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",gap:10}}>
          {[{label:"Pending",count:pendingCount,color:"#F59E0B"},{label:"Preparing",count:preparingCount,color:BAR_COLOR}].map(s=>(
            <div key={s.label} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"6px 14px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.count}</div>
              <div style={{fontSize:10,color:"#555"}}>{s.label}</div>
            </div>
          ))}
        </div>
        <AlertBell/>
        <button onClick={async()=>{
          await supabase.from("staff_activity").insert({role:"bar",action:"logout",details:{}});
          clearStaffSession("bar");navigate("/staff");
        }} style={{background:"none",border:`1px solid ${BORDER}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,color:"#666",fontFamily:"Inter,sans-serif"}}>
          Logout
        </button>
      </div>

      <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,background:SURFACE}}>
        {[["active","🔥 Active"],["served","✅ Served"],["all","📋 All"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{flex:1,padding:"11px 8px",background:"none",border:"none",borderBottom:`2px solid ${filter===v?BAR_COLOR:"transparent"}`,color:filter===v?BAR_COLOR:"#555",fontFamily:"Inter,sans-serif",fontSize:13,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {loading&&<div style={{textAlign:"center",padding:40,color:"#555"}}>Loading orders…</div>}
        {!loading&&filtered.length===0&&(
          <div style={{textAlign:"center",padding:60,color:"#444"}}>
            <div style={{fontSize:48,marginBottom:12}}>🍸</div>
            <div style={{fontSize:16}}>{filter==="active"?"No active drink orders":"No orders found"}</div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {filtered.map(order=>{
            const isNew = newIds.has(order.id);
            const sStatus = stationStatus(order);
            const action = NEXT_ACTION[sStatus];
            const st = ORDER_STATUS[sStatus]||ORDER_STATUS.pending;
            return(
              <div key={order.id} className={`fade-in${isNew?" new-flash":""}`}
                style={{background:SURFACE,border:`2px solid ${st.color}44`,borderRadius:16,overflow:"hidden"}}>
                <div style={{background:`${st.color}15`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${st.color}33`}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:st.color}}>Table {order.table_id}</div>
                    <div style={{fontSize:11,color:"#888",marginTop:1}}>{fmtTime(order.created_at)} · {order.user_name}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:st.color,background:`${st.color}22`,border:`1px solid ${st.color}44`,borderRadius:8,padding:"3px 10px",fontWeight:600}}>{st.icon} {st.label}</span>
                    {isNew&&<span style={{fontSize:10,background:BAR_COLOR,color:"#080808",borderRadius:8,padding:"2px 8px",fontWeight:700}}>NEW!</span>}
                  </div>
                </div>
                <div style={{padding:"12px 16px"}}>
                  {order.items?.filter(i=>!i.voided).map(item=>(
                    <div key={item.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${BORDER}`}}>
                      <div>
                        <div style={{fontSize:14,color:"#e8e0d0",fontWeight:500}}>{item.item_name}</div>
                        <div style={{fontSize:11,color:"#555"}}>×{item.quantity} · {item.category_type}</div>
                      </div>
                      <div style={{fontSize:13,color:GOLD,fontWeight:600}}>{fmtPrice(item.subtotal)}</div>
                    </div>
                  ))}
                  {order.note&&(
                    <div style={{marginTop:8,fontSize:12,color:"#888",background:SURFACE2,borderRadius:8,padding:"6px 10px"}}>📝 {order.note}</div>
                  )}
                </div>
                {sStatus!=="served"&&sStatus!=="voided"&&(
                  <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8}}>
                    {action&&(
                      <button className="btn-gold" onClick={()=>advanceStatus(order)}
                        style={{flex:1,padding:"9px 0",fontSize:13,borderRadius:9,background:`linear-gradient(135deg,${action.color},${action.color}dd)`}}>
                        {action.label}
                      </button>
                    )}
                    <button onClick={()=>{setVoidModal(order);setVoidReason("");setVoidNote("");}}
                      style={{padding:"9px 14px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:9,cursor:"pointer",fontSize:13,color:"#F87171",fontFamily:"Inter,sans-serif"}}>
                      Void
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {voidModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,maxWidth:400,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4,color:"#F87171"}}>❌ Void Drink Order</div>
            <div style={{fontSize:13,color:"#666",marginBottom:16}}>Table {voidModal?.table_id}</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>REASON</label>
              <select value={voidReason} onChange={e=>setVoidReason(e.target.value)} style={{width:"100%",padding:"10px 12px",fontSize:14,borderRadius:8}}>
                <option value="">Select reason…</option>
                {VOID_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>ADDITIONAL NOTE (OPTIONAL)</label>
              <textarea value={voidNote} onChange={e=>setVoidNote(e.target.value)} rows={2} placeholder="Add more details…" style={{width:"100%",padding:"9px 12px",fontSize:13,resize:"none",borderRadius:8}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setVoidModal(null)} style={{flex:1,padding:11,fontSize:14,borderRadius:9}}>Cancel</button>
              <button onClick={submitVoid} disabled={!voidReason}
                style={{flex:1,padding:11,fontSize:14,background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.4)",borderRadius:9,color:"#F87171",cursor:voidReason?"pointer":"not-allowed",fontFamily:"Inter,sans-serif",fontWeight:600,opacity:voidReason?1:0.5}}>
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

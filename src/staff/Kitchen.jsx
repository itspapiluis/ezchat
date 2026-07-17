import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, ORDER_STATUS, VOID_REASONS, fmtTime, fmtPrice, playAlert, loadStaffSession, clearStaffSession, logAudit, ConnectionBanner, VoidPinGate, displayTable } from "./shared.js";
import { useAlertEngine, AlertBell } from "./AlertEngine.jsx";

const GOLD = "#C9A84C";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#e8e0d0;font-family:'Inter',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#3a2e1a;border-radius:2px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes flash{0%,100%{background:#0F0F0F}50%{background:rgba(52,211,153,0.15)}}
.fade-in{animation:fadeIn .3s ease}
.new-flash{animation:flash .6s ease 3}
.btn-gold{background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#080808;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-gold:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn-ghost{background:transparent;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;cursor:pointer;transition:all .2s}
.btn-ghost:hover{border-color:#8A6A28;color:#C9A84C}
input,select,textarea{background:#161616;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;outline:none}
input:focus,select:focus,textarea:focus{border-color:#8A6A28}
`;

const STATUS_FLOW = ["pending","preparing","ready","served"];
// PHASE 11: the Kitchen no longer marks "Served" — the SERVER does, because the
// server is the one who physically carries the food out. Kitchen stops at Ready.
const NEXT_ACTION = {
  pending:   { label:"Accept Order",  color:"#F59E0B", next:"preparing" },
  preparing: { label:"Mark Ready",    color:"#34D399", next:"ready"     },
};

// BUGFIX: Kitchen and Bar used to read `order.status` — a SINGLE shared row.
// An order can hold food AND drinks, so when the kitchen marked the burger
// ready, the bar's beer flipped to "Ready" too. Each station must judge only
// ITS OWN items. `order.items` is already filtered to this station's category.
// Rule: the least-advanced live item decides. All voided → "voided".
const RANK = { pending:1, preparing:2, ready:3, served:4 };
function stationStatus(order){
  const live = (order.items||[]).filter(i=>!i.voided);
  if(!live.length) return "voided";
  const min = Math.min(...live.map(i=>RANK[i.status]||1));
  return STATUS_FLOW[min-1] || "pending";
}

export default function Kitchen(){
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active"); // active | served | all
  const [voidModal, setVoidModal] = useState(null);
  const [voidGate, setVoidGate] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidNote, setVoidNote] = useState("");
  const [newIds, setNewIds] = useState(new Set());
  const audioUnlocked = useRef(false);

  const role = "kitchen";   // BUGFIX: this screen IS the kitchen. loadStaffSession() returned whichever role logged in first, so in a multi-tab setup the Bar screen could report itself as "kitchen".
  useAlertEngine(role||"kitchen");
  useEffect(()=>{
    if(role!=="kitchen"&&role!=="admin"){ navigate("/staff"); }
  },[role]);

  // Unlock audio on first interaction
  const unlockAudio = ()=>{ audioUnlocked.current=true; };

  useEffect(()=>{
    loadOrders();
    // Realtime subscription
    const ch = supabase.channel("kitchen-orders")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"orders"},payload=>{
        const o = payload.new;
        // Only food orders
        loadOrderWithItems(o.id,"new");
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
      .select("*, order_items(*), table_tabs(is_walkin,walkin_name)")
      .order("created_at",{ascending:false})
      .limit(100);
    if(data){
      // Filter to only orders that have food items
      const foodOrders = data.filter(o=>
        o.order_items?.some(i=>i.category_type==="food"&&!i.voided)
      ).map(o=>({
        ...o,
        items: o.order_items?.filter(i=>i.category_type==="food")
      }));
      setOrders(foodOrders);
    }
    setLoading(false);
  };

  const loadOrderWithItems = async(orderId, flag="")=>{
    const {data} = await supabase
      .from("orders")
      .select("*, order_items(*), table_tabs(is_walkin,walkin_name)")
      .eq("id",orderId)
      .maybeSingle();   // BUGFIX: .single() throws when the row is gone
    if(data){
      const hasFoodItems = data.order_items?.some(i=>i.category_type==="food"&&!i.voided);
      if(!hasFoodItems) return;
      const order = {...data, items: data.order_items?.filter(i=>i.category_type==="food")};
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
    // BUGFIX: this used to UPDATE `orders.status` first — the row the BAR also
    // reads — which is what made the bar's drinks jump to "Ready" whenever the
    // kitchen advanced. We now touch ONLY this station's items. The DB trigger
    // recalc_order_status() rolls `orders.status` up from the items.
    const {error} = await supabase.from("order_items")
      .update({status:action.next})
      .eq("order_id",order.id)
      .eq("voided",false)
      .in("category_type",["food"]);
    if(error){
      console.warn("advanceStatus failed:",error.message);
      return;
    }
    await logAudit(`order_${action.next}`,"orders",order.id,{table_id:order.table_id},"kitchen");
  };

  const openVoidModal = (order)=>{
    setVoidModal(order);
    setVoidReason("");
    setVoidNote("");
  };

  const _doVoid = async()=>{
    if(!voidReason) return;
    const reason = voidNote ? `${voidReason}: ${voidNote}` : voidReason;
    // Void only THIS station's items.
    // BUGFIX: this used to also set the whole ORDER to "voided". The kitchen
    // voiding a burger made the guest's beer vanish from the Bar screen — while
    // still being billed, because billing reads order_items (where the beer was
    // never voided). The DB trigger now marks the order voided only when EVERY
    // station has voided its items.
    const {error:ve} = await supabase.from("order_items")
      .update({voided:true, void_reason:reason, voided_at:new Date().toISOString(), status:"voided"})
      .eq("order_id",voidModal.id)
      .eq("voided",false)
      .in("category_type",["food"]);
    if(ve){
      console.warn("void failed:",ve.message);
      setVoidModal(null);
      return;
    }
    // BUGFIX: if items was undefined this called .insert(undefined) and threw.
    const rows = (voidModal.items||[]).filter(i=>!i.voided).map(i=>({
      order_item_id:i.id, tab_id:i.tab_id, table_id:i.table_id,
      item_name:i.item_name, item_price:i.item_price, quantity:i.quantity,
      reason, voided_by:"kitchen"
    }));
    if(rows.length) await supabase.from("void_logs").insert(rows);
    await logAudit("order_voided","orders",voidModal.id,{reason},"kitchen");
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
      <ConnectionBanner/>
      <VoidPinGate open={voidGate}
        onCancel={()=>setVoidGate(false)}
        onOk={()=>{ setVoidGate(false); _doVoid(); }}/>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{height:56,background:SURFACE,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0}}>
        <div style={{fontSize:22}}>👨‍🍳</div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:"#34D399"}}>Kitchen Dashboard</div>
          <div style={{fontSize:11,color:"#555"}}>EasyCart Barcade & Lounge</div>
        </div>
        <div style={{flex:1}}/>
        {/* Stats */}
        <div style={{display:"flex",gap:10}}>
          {[
            {label:"Pending",count:pendingCount,color:"#F59E0B"},
            {label:"Preparing",count:preparingCount,color:"#60A5FA"},
          ].map(s=>(
            <div key={s.label} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"6px 14px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.count}</div>
              <div style={{fontSize:10,color:"#555"}}>{s.label}</div>
            </div>
          ))}
        </div>
        <AlertBell/>
        <button onClick={async()=>{
          await supabase.from("staff_activity").insert({role:"kitchen",action:"logout",details:{}});
          clearStaffSession("kitchen");navigate("/staff");
        }}
          style={{background:"none",border:`1px solid ${BORDER}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,color:"#666",fontFamily:"Inter,sans-serif"}}>
          Logout
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
        {[["active","🔥 Active"],["served","✅ Served"],["all","📋 All"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{flex:1,padding:"11px 8px",background:"none",border:"none",borderBottom:`2px solid ${filter===v?"#34D399":"transparent"}`,color:filter===v?"#34D399":"#555",fontFamily:"Inter,sans-serif",fontSize:13,cursor:"pointer",transition:"all .2s"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Orders grid */}
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {loading&&<div style={{textAlign:"center",padding:40,color:"#555"}}>Loading orders…</div>}
        {!loading&&filtered.length===0&&(
          <div style={{textAlign:"center",padding:60,color:"#444"}}>
            <div style={{fontSize:48,marginBottom:12}}>👨‍🍳</div>
            <div style={{fontSize:16}}>{filter==="active"?"No active orders":"No orders found"}</div>
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
                style={{background:SURFACE,border:`2px solid ${st.color}44`,borderRadius:16,overflow:"hidden",transition:"all .3s"}}>
                {/* Order header */}
                <div style={{background:`${st.color}15`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${st.color}33`}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:st.color}}>{displayTable(order)}</div>
                    <div style={{fontSize:11,color:"#888",marginTop:1}}>{fmtTime(order.created_at)} · by {order.user_name}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:st.color,background:`${st.color}22`,border:`1px solid ${st.color}44`,borderRadius:8,padding:"3px 10px",fontWeight:600}}>{st.icon} {st.label}</span>
                    {isNew&&<span style={{fontSize:10,background:"#34D399",color:"#080808",borderRadius:8,padding:"2px 8px",fontWeight:700}}>NEW!</span>}
                  </div>
                </div>
                {/* Items */}
                <div style={{padding:"12px 16px"}}>
                  {order.items?.filter(i=>!i.voided).map(item=>(
                    <div key={item.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${BORDER}`}}>
                      <div>
                        <div style={{fontSize:14,color:"#e8e0d0",fontWeight:500}}>{item.item_name}</div>
                        <div style={{fontSize:11,color:"#555"}}>×{item.quantity}</div>
                      </div>
                      <div style={{fontSize:13,color:GOLD,fontWeight:600}}>{fmtPrice(item.subtotal)}</div>
                    </div>
                  ))}
                  {order.note&&(
                    <div style={{marginTop:8,fontSize:12,color:"#888",background:SURFACE2,borderRadius:8,padding:"6px 10px"}}>
                      📝 {order.note}
                    </div>
                  )}
                </div>
                {/* Actions */}
                {sStatus!=="served"&&sStatus!=="voided"&&(
                  <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8}}>
                    {action&&(
                      <button className="btn-gold" onClick={()=>advanceStatus(order)}
                        style={{flex:1,padding:"9px 0",fontSize:13,borderRadius:9,background:`linear-gradient(135deg,${action.color},${action.color}dd)`}}>
                        {action.label}
                      </button>
                    )}
                    <button onClick={()=>openVoidModal(order)}
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

      {/* Void Modal */}
      {voidModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,maxWidth:400,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4,color:"#F87171"}}>❌ Void Order</div>
            <div style={{fontSize:13,color:"#666",marginBottom:16}}>{displayTable(voidModal)} · {voidModal?.items?.length} food item(s)</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>REASON</label>
              <select value={voidReason} onChange={e=>setVoidReason(e.target.value)}
                style={{width:"100%",padding:"10px 12px",fontSize:14,borderRadius:8}}>
                <option value="">Select reason…</option>
                {VOID_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>ADDITIONAL NOTE (OPTIONAL)</label>
              <textarea value={voidNote} onChange={e=>setVoidNote(e.target.value)} rows={2}
                placeholder="Add more details…"
                style={{width:"100%",padding:"9px 12px",fontSize:13,resize:"none",borderRadius:8}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setVoidModal(null)} style={{flex:1,padding:11,fontSize:14,borderRadius:9}}>Cancel</button>
              <button onClick={()=>{ if(voidReason) setVoidGate(true); }} disabled={!voidReason}
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

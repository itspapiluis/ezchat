import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase, fmtTime, fmtDate, fmtPrice,
  playAlert, loadStaffSession, clearStaffSession,
  PAYMENT_METHODS, VOID_REASONS, logAudit, ConnectionBanner } from "./shared.js";
import { useAlertEngine, AlertBell } from "./AlertEngine.jsx";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";
const CASHIER_COLOR = "#C9A84C";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#e8e0d0;font-family:'Inter',sans-serif}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#3a2e1a;border-radius:2px}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes flash{0%,100%{border-color:#241E10}50%{border-color:#C9A84C}}
.fade-in{animation:fadeIn .3s ease}
.bill-flash{animation:flash .5s ease 4}
.btn-gold{background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#080808;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-gold:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn-ghost{background:transparent;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;cursor:pointer;transition:all .2s}
.btn-ghost:hover{border-color:#8A6A28;color:#C9A84C}
input,select,textarea{background:#161616;border:1px solid #241E10;color:#e8e0d0;border-radius:8px;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s}
input:focus,select:focus,textarea:focus{border-color:#8A6A28}
`;

export default function Cashier(){
  const navigate = useNavigate();
  const [tabs, setTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState(null);
  const [tabItems, setTabItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainFilter, setMainFilter] = useState("open"); // open | bill_requested | closed
  const [billRequests, setBillRequests] = useState([]);

  // Modals
  const [payModal, setPayModal] = useState(false);
  const [discountModal, setDiscountModal] = useState(false);
  const [voidItemModal, setVoidItemModal] = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);
  const [resetModal, setResetModal] = useState(false);

  // Payment state
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);

  // Discount state
  const [discType, setDiscType] = useState("percent");
  const [discValue, setDiscValue] = useState("");
  const [discReason, setDiscReason] = useState("");
  const [discounts, setDiscounts] = useState([]);

  // Void item
  const [voidReason, setVoidReason] = useState("");
  const [voidNote, setVoidNote] = useState("");

  const audioUnlocked = useRef(false);
  const role = "cashier";   // BUGFIX: was loadStaffSession() — wrong role in a multi-tab setup.
  useAlertEngine(role||"cashier");

  useEffect(()=>{
    if(role!=="cashier"&&role!=="admin"){ navigate("/staff"); }
  },[role]);

  useEffect(()=>{
    loadTabs();
    const ch = supabase.channel("cashier-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"table_tabs"},()=>loadTabs())
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>{
        if(selectedTab) loadTabItems(selectedTab.id);
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"order_items"},()=>{
        if(selectedTab) loadTabItems(selectedTab.id);
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[selectedTab?.id]);

  const loadTabs = async()=>{
    setLoading(true);
    const {data} = await supabase
      .from("table_tabs")
      .select("*")
      .order("opened_at",{ascending:false});
    if(data){
      setTabs(data);
      const reqs = data.filter(t=>t.status==="bill_requested");
      if(reqs.length > billRequests.length && audioUnlocked.current){
        playAlert("bill_req");
      }
      setBillRequests(reqs);
    }
    setLoading(false);
  };

  const loadTabItems = async(tabId)=>{
    const {data:items} = await supabase
      .from("order_items")
      .select("*, orders(user_name,created_at,id,status)")
      .eq("tab_id",tabId)
      .order("created_at",{ascending:true});
    if(items) setTabItems(items);

    const {data:discs} = await supabase
      .from("discounts")
      .select("*")
      .eq("tab_id",tabId);
    if(discs) setDiscounts(discs);
  };

  const selectTab = async(tab)=>{
    setSelectedTab(tab);
    await loadTabItems(tab.id);
  };

  // ── Calculations ──────────────────────────────────────────────────────────
  // BUGFIX: peso amounts must be rounded to 2dp. Raw JS floats produce values
  // like 1111.0949999999998, which get written straight into receipts/reports.
  const peso = (n) => Math.round((Number(n)||0) * 100) / 100;

  const activeItems = tabItems.filter(i=>!i.voided);
  const subtotal = peso(activeItems.reduce((s,i)=>s+Number(i.subtotal),0));

  const totalDiscountAmt = peso(discounts.reduce((s,d)=>{
    if(d.type==="percent") return s + (subtotal * Number(d.value)/100);
    if(d.type==="fixed") return s + Number(d.value);
    if(d.type==="complimentary"){
      // BUGFIX: was searching ALL items incl. voided ones. Comping an already
      // voided item subtracted money that was never in the subtotal → undercharge.
      const item = activeItems.find(i=>i.id===d.item_id);
      return s + (item?Number(item.subtotal):0);
    }
    return s;
  },0));

  const grandTotal = peso(Math.max(0, subtotal - totalDiscountAmt));

  // ── Apply Discount ────────────────────────────────────────────────────────
  const applyDiscount = async()=>{
    if(!discValue && discType!=="complimentary") return;
    const {error} = await supabase.from("discounts").insert({
      tab_id: selectedTab.id,
      table_id: selectedTab.table_id,
      type: discType,
      value: Number(discValue)||0,
      reason: discReason||null,
      applied_by: "cashier",
    });
    if(!error){
      await logAudit("discount_applied","discounts",selectedTab.id,{type:discType,value:discValue,reason:discReason},"cashier");
      // BUGFIX: Supabase builders have .then() but NO .catch(). Chaining .catch()
      // threw a TypeError and aborted the discount mid-way.
      try{
        await supabase.from("staff_activity").insert({
          role:"cashier", action:"discount",
          details:{table_id:selectedTab.table_id, type:discType, value:discValue}
        });
      }catch(_){ /* logging must never block the cashier */ }
      await loadTabItems(selectedTab.id);
      setDiscountModal(false);
      setDiscValue("");setDiscReason("");setDiscType("percent");
    }
  };

  const removeDiscount = async(id)=>{
    await supabase.from("discounts").delete().eq("id",id);
    await loadTabItems(selectedTab.id);
  };

  // ── Void Item ─────────────────────────────────────────────────────────────
  const submitVoidItem = async()=>{
    if(!voidReason) return;
    const reason = voidNote?`${voidReason}: ${voidNote}`:voidReason;
    await supabase.from("order_items").update({
      voided:true, void_reason:reason,
      voided_at:new Date().toISOString(), status:"voided"
    }).eq("id",voidItemModal.id);
    await supabase.from("void_logs").insert({
      order_item_id:voidItemModal.id, tab_id:voidItemModal.tab_id,
      table_id:voidItemModal.table_id, item_name:voidItemModal.item_name,
      item_price:voidItemModal.item_price, quantity:voidItemModal.quantity,
      reason, voided_by:"cashier"
    });
    await logAudit("item_voided","order_items",voidItemModal.id,{reason},"cashier");
    setVoidItemModal(null);setVoidReason("");setVoidNote("");
    await loadTabItems(selectedTab.id);
  };

  // ── New Round ─────────────────────────────────────────────────────────────
  // The table has PAID and wants to keep drinking. We do NOT reopen the settled
  // tab — its receipt is final and must never change. We open a BRAND-NEW tab
  // for the table. The guest's bill then shows the paid round above, and the
  // new round below.
  const startNewRound = async()=>{
    if(!selectedTab || selectedTab.status!=="closed") return;

    // Guard: a table may only ever have one live tab (the DB enforces this too).
    const {data:live} = await supabase.from("table_tabs")
      .select("id").eq("table_id",selectedTab.table_id)
      .in("status",["open","bill_requested"]).limit(1);
    if(live?.length){
      alert("This table already has an open tab.");
      loadTabs();
      return;
    }

    const {data:fresh,error} = await supabase.from("table_tabs")
      .insert({table_id:selectedTab.table_id, status:"open", total:0})
      .select().single();
    if(error||!fresh){ alert("Could not start a new round."); return; }

    await logAudit("new_round","table_tabs",fresh.id,
      {table_id:selectedTab.table_id, previous_tab:selectedTab.id},"cashier");
    try{
      await supabase.from("staff_activity").insert({
        role:"cashier", action:"new_round",
        details:{table_id:selectedTab.table_id, previous_tab:selectedTab.id}
      });
    }catch(_){}

    setSelectedTab(fresh);
    loadTabs();
  };

  // ── Process Payment ───────────────────────────────────────────────────────
  const processPayment = async()=>{
    if(!selectedTab) return;
    if(payProcessing) return;   // BUGFIX: re-entrancy guard (double-tap = 2 receipts)
    setPayProcessing(true);
    try{
      // No pre-check needed: pay_tab() locks the tab, refuses a second receipt,
      // and RECOVERS a tab that was left half-paid by the old two-step code.

      // Build receipt items snapshot
      const receiptItems = activeItems.map(i=>({
        name:i.item_name, qty:i.quantity,
        price:i.item_price, subtotal:i.subtotal,
        category:i.category_type, status:i.status,
      }));

      // BUGFIX: this used to INSERT the receipt, then separately UPDATE the tab
      // to closed — and it never checked the update's error. When the close
      // failed, the money was taken but the tab stayed in "Bill Requested", and
      // retrying just said "already paid". A half-finished payment.
      //
      // pay_tab() does both in ONE database transaction: either the receipt is
      // created AND the tab closes, or nothing happens. It also self-heals a tab
      // that is already stuck in that state.
      const {data:res, error:pe} = await supabase.rpc("pay_tab",{
        p_tab_id:         selectedTab.id,
        p_items:          receiptItems,
        p_subtotal:       subtotal,
        p_discount_amt:   totalDiscountAmt,
        p_discount_note:  discounts.map(d=>`${d.type}${d.type!=="complimentary"?" "+d.value:""}`).join(", ")||null,
        p_total:          grandTotal,
        p_payment_method: payMethod,
        p_payment_ref:    payRef||"",
      });
      if(pe) throw pe;
      if(!res?.ok) throw new Error(res?.error||"Payment failed.");

      const receipt = res.receipt;

      await logAudit("bill_paid","table_tabs",selectedTab.id,{
        total:grandTotal, payment_method:payMethod, receipt_id:receipt.id
      },"cashier");
      // BUGFIX: same .catch() TypeError — this one fired AFTER the receipt was
      // written but BEFORE the UI cleared, so payment would appear to hang.
      try{
        await supabase.from("staff_activity").insert({
          role:"cashier", action:"payment",
          details:{table_id:selectedTab.table_id, total:grandTotal, method:payMethod}
        });
      }catch(_){ /* logging must never block a payment */ }

      setReceiptModal({...receipt, items:receiptItems});
      setPayModal(false);
      setSelectedTab(null);
      setTabItems([]);
      setDiscounts([]);
      await loadTabs();
    }catch(e){
      alert("Payment error: "+(e.message||e));
    }finally{
      // BUGFIX: was outside a finally — an early return left the button stuck
      // on "Processing…" forever.
      setPayProcessing(false);
    }
  };

  // ── Reset Table ───────────────────────────────────────────────────────────
  const resetTable = async()=>{
    await supabase.from("table_tabs").update({
      status:"closed", closed_at:new Date().toISOString(), closed_by:"cashier"
    }).eq("id",selectedTab.id);
    await logAudit("table_reset","table_tabs",selectedTab.id,{},"cashier");
    setResetModal(false);
    setSelectedTab(null);
    setTabItems([]);
    await loadTabs();
  };

  const filteredTabs = tabs.filter(t=>{
    if(mainFilter==="open") return t.status==="open";
    if(mainFilter==="bill_requested") return t.status==="bill_requested";
    if(mainFilter==="closed") return t.status==="closed";
    return true;
  });

  const billReqCount = tabs.filter(t=>t.status==="bill_requested").length;
  const openCount = tabs.filter(t=>t.status==="open").length;

  return(
    <div style={{height:"100dvh",background:BG,display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={()=>audioUnlocked.current=true}>
      <ConnectionBanner/>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{height:56,background:SURFACE,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0}}>
        <div style={{fontSize:22}}>💰</div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:CASHIER_COLOR}}>Cashier Dashboard</div>
          <div style={{fontSize:11,color:"#555"}}>EasyCart Barcade & Lounge</div>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",gap:10}}>
          {[
            {label:"Open Tabs",count:openCount,color:"#34D399"},
            {label:"Bill Requests",count:billReqCount,color:"#F87171"},
          ].map(s=>(
            <div key={s.label} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"6px 14px",textAlign:"center",cursor:"pointer"}}
              onClick={()=>setMainFilter(s.label==="Open Tabs"?"open":"bill_requested")}>
              <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.count}</div>
              <div style={{fontSize:10,color:"#555"}}>{s.label}</div>
            </div>
          ))}
        </div>
        <AlertBell/>
        <button onClick={async()=>{
          await supabase.from("staff_activity").insert({role:"cashier",action:"logout",details:{}});
          clearStaffSession("cashier");navigate("/staff");
        }} style={{background:"none",border:`1px solid ${BORDER}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,color:"#666",fontFamily:"Inter,sans-serif"}}>
          Logout
        </button>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        {/* Left — Tab list */}
        <div style={{width:260,borderRight:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          {/* Filter tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
            {[["open","Open"],["bill_requested","Bill Req"],["closed","Closed"]].map(([v,l])=>(
              <button key={v} onClick={()=>setMainFilter(v)}
                style={{flex:1,padding:"9px 4px",background:"none",border:"none",borderBottom:`2px solid ${mainFilter===v?CASHIER_COLOR:"transparent"}`,color:mainFilter===v?CASHIER_COLOR:"#555",fontFamily:"Inter,sans-serif",fontSize:11,cursor:"pointer",position:"relative"}}>
                {l}
                {v==="bill_requested"&&billReqCount>0&&(
                  <span style={{position:"absolute",top:4,right:4,background:"#F87171",color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{billReqCount}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflowY:"auto"}}>
            {loading&&<div style={{padding:20,textAlign:"center",color:"#555",fontSize:13}}>Loading…</div>}
            {!loading&&filteredTabs.length===0&&(
              <div style={{padding:24,textAlign:"center",color:"#444",fontSize:13}}>No {mainFilter} tabs</div>
            )}
            {filteredTabs.map(tab=>{
              const isBillReq = tab.status==="bill_requested";
              const isSelected = selectedTab?.id===tab.id;
              return(
                <div key={tab.id} className={`fade-in${isBillReq?" bill-flash":""}`}
                  onClick={()=>selectTab(tab)}
                  style={{padding:"12px 14px",borderBottom:`1px solid ${BORDER}`,cursor:"pointer",background:isSelected?`rgba(201,168,76,0.08)`:SURFACE,borderLeft:`3px solid ${isSelected?CASHIER_COLOR:isBillReq?"#F87171":"transparent"}`,transition:"all .15s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:isSelected?GOLD:"#e8e0d0"}}>Table {tab.table_id}</div>
                      <div style={{fontSize:11,color:"#555",marginTop:1}}>{fmtTime(tab.opened_at)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:GOLD}}>{fmtPrice(tab.total||0)}</div>
                      {isBillReq&&<div style={{fontSize:9,color:"#F87171",fontWeight:700,letterSpacing:.5,marginTop:2}}>BILL REQ !</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Tab detail */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!selectedTab?(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",color:"#444",gap:12}}>
              <div style={{fontSize:48}}>💰</div>
              <div style={{fontSize:15}}>Select a table to view its bill</div>
            </div>
          ):(
            <>
              {/* Tab header */}
              <div style={{padding:"12px 20px",borderBottom:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:20,fontWeight:700,color:GOLD}}>Table {selectedTab.table_id}</div>
                  <div style={{fontSize:12,color:"#555"}}>Opened: {fmtTime(selectedTab.opened_at)} · {fmtDate(selectedTab.opened_at)}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {/* PAID tabs are final. The only action left is to start a
                      brand-new round for this table — the receipt is untouched. */}
                  {selectedTab.status==="closed"&&(
                    <button onClick={startNewRound}
                      title="Table has paid but wants to keep ordering — opens a NEW tab. The paid receipt is not changed."
                      style={{padding:"8px 16px",background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:9,cursor:"pointer",fontSize:13,color:"#34D399",fontWeight:600,fontFamily:"Inter,sans-serif"}}>
                      ＋ New Round
                    </button>
                  )}
                  {selectedTab.status!=="closed"&&(
                    <>
                      <button onClick={()=>setDiscountModal(true)}
                        style={{padding:"8px 14px",background:`rgba(201,168,76,0.08)`,border:`1px solid ${GOLD_DIM}`,borderRadius:9,cursor:"pointer",fontSize:13,color:GOLD,fontFamily:"Inter,sans-serif"}}>
                        🏷️ Discount
                      </button>
                      <button className="btn-gold" onClick={()=>setPayModal(true)}
                        style={{padding:"8px 18px",fontSize:13,borderRadius:9}}>
                        💵 Process Payment
                      </button>
                      <button onClick={()=>setResetModal(true)}
                        style={{padding:"8px 12px",background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:9,cursor:"pointer",fontSize:13,color:"#F87171",fontFamily:"Inter,sans-serif"}}>
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bill items */}
              <div style={{flex:1,overflowY:"auto",padding:"14px 20px"}}>
                {/* Active discounts */}
                {discounts.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:8}}>APPLIED DISCOUNTS</div>
                    {discounts.map(d=>(
                      <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,background:`rgba(201,168,76,0.06)`,border:`1px solid ${GOLD_DIM}44`,borderRadius:9,padding:"7px 12px",marginBottom:5}}>
                        <span style={{fontSize:12,color:GOLD,flex:1}}>
                          🏷️ {d.type==="percent"?`${d.value}% off`:d.type==="fixed"?`₱${d.value} off`:"Complimentary"}
                          {d.reason&&<span style={{color:"#666"}}> · {d.reason}</span>}
                        </span>
                        {selectedTab.status!=="closed"&&(
                          <button onClick={()=>removeDiscount(d.id)}
                            style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:14,fontFamily:"Inter,sans-serif"}}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Order items */}
                <div style={{fontSize:11,color:"#444",letterSpacing:1,marginBottom:10}}>ORDER ITEMS</div>
                {tabItems.length===0&&<div style={{textAlign:"center",padding:32,color:"#444",fontSize:13}}>No items ordered yet</div>}
                {tabItems.map(item=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:6,background:item.voided?`rgba(248,113,113,0.04)`:SURFACE,border:`1px solid ${item.voided?"rgba(248,113,113,0.15)":BORDER}`,borderRadius:10,opacity:item.voided?.55:1}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:item.voided?"#666":"#e8e0d0",textDecoration:item.voided?"line-through":"none"}}>{item.item_name} ×{item.quantity}</div>
                      <div style={{fontSize:11,color:"#444",marginTop:1,display:"flex",gap:8}}>
                        <span>{item.orders?.user_name}</span>
                        <span>·</span>
                        <span style={{color:item.voided?"#F87171":item.status==="served"?"#888":item.status==="ready"?"#34D399":"#F59E0B"}}>
                          {item.voided?"Voided":item.status}
                        </span>
                      </div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:item.voided?"#444":GOLD}}>{fmtPrice(item.subtotal)}</div>
                    {!item.voided&&selectedTab.status!=="closed"&&(
                      <button onClick={()=>{setVoidItemModal(item);setVoidReason("");setVoidNote("");}}
                        style={{background:"none",border:`1px solid rgba(248,113,113,0.2)`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#F87171",fontFamily:"Inter,sans-serif"}}>
                        Void
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Bill summary */}
              <div style={{padding:"14px 20px",borderTop:`1px solid ${BORDER}`,background:SURFACE,flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,color:"#666"}}>Subtotal</span>
                  <span style={{fontSize:13,color:"#888"}}>{fmtPrice(subtotal)}</span>
                </div>
                {totalDiscountAmt>0&&(
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,color:GOLD}}>Discount</span>
                    <span style={{fontSize:13,color:GOLD}}>- {fmtPrice(totalDiscountAmt)}</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:`1px solid ${BORDER}`,marginTop:4}}>
                  <span style={{fontSize:16,fontWeight:700}}>Total</span>
                  <span style={{fontSize:20,fontWeight:700,color:GOLD,fontFamily:"'Playfair Display',serif"}}>{fmtPrice(grandTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PAYMENT MODAL ── */}
      {payModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,maxWidth:420,width:"100%"}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4,color:GOLD}}>💵 Process Payment</div>
            <div style={{fontSize:13,color:"#555",marginBottom:20}}>Table {selectedTab?.table_id}</div>

            <div style={{background:SURFACE2,borderRadius:12,padding:"14px 16px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:15,color:"#888"}}>Amount Due</span>
              <span style={{fontSize:24,fontWeight:900,color:GOLD,fontFamily:"'Playfair Display',serif"}}>{fmtPrice(grandTotal)}</span>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:8}}>PAYMENT METHOD</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {PAYMENT_METHODS.map(m=>(
                  <button key={m.value} onClick={()=>setPayMethod(m.value)}
                    style={{padding:"10px 8px",background:payMethod===m.value?`rgba(201,168,76,0.12)`:SURFACE2,border:`1px solid ${payMethod===m.value?GOLD_DIM:BORDER}`,borderRadius:9,cursor:"pointer",fontSize:13,color:payMethod===m.value?GOLD:"#888",fontFamily:"Inter,sans-serif",fontWeight:payMethod===m.value?700:400,transition:"all .15s"}}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payMethod!=="cash"&&(
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>REFERENCE NUMBER (OPTIONAL)</label>
                <input value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="e.g. GCash ref number"
                  style={{width:"100%",padding:"10px 12px",fontSize:14,borderRadius:8}}/>
              </div>
            )}

            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button className="btn-ghost" onClick={()=>setPayModal(false)} style={{flex:1,padding:12,fontSize:14,borderRadius:9}}>Cancel</button>
              <button className="btn-gold" onClick={processPayment} disabled={payProcessing}
                style={{flex:2,padding:12,fontSize:14,borderRadius:9,opacity:payProcessing?.7:1}}>
                {payProcessing?"Processing…":"Confirm Payment ✦"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DISCOUNT MODAL ── */}
      {discountModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,maxWidth:400,width:"100%"}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4,color:GOLD}}>🏷️ Apply Discount</div>
            <div style={{fontSize:13,color:"#555",marginBottom:20}}>Table {selectedTab?.table_id}</div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:8}}>DISCOUNT TYPE</label>
              <div style={{display:"flex",gap:8}}>
                {[["percent","% Percent"],["fixed","₱ Fixed"],["complimentary","🎁 Complimentary"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setDiscType(v)}
                    style={{flex:1,padding:"9px 4px",background:discType===v?`rgba(201,168,76,0.12)`:SURFACE2,border:`1px solid ${discType===v?GOLD_DIM:BORDER}`,borderRadius:8,cursor:"pointer",fontSize:12,color:discType===v?GOLD:"#888",fontFamily:"Inter,sans-serif",fontWeight:discType===v?700:400}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {discType!=="complimentary"&&(
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>
                  {discType==="percent"?"PERCENTAGE (%)":"AMOUNT (₱)"}
                </label>
                <input value={discValue} onChange={e=>setDiscValue(e.target.value)} type="number"
                  placeholder={discType==="percent"?"e.g. 20":"e.g. 100"}
                  style={{width:"100%",padding:"10px 12px",fontSize:14,borderRadius:8}}/>
              </div>
            )}

            <div style={{marginBottom:18}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>REASON</label>
              <input value={discReason} onChange={e=>setDiscReason(e.target.value)} placeholder="e.g. Senior citizen, loyalty, event promo…"
                style={{width:"100%",padding:"10px 12px",fontSize:14,borderRadius:8}}/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setDiscountModal(false)} style={{flex:1,padding:12,fontSize:14,borderRadius:9}}>Cancel</button>
              <button className="btn-gold" onClick={applyDiscount} style={{flex:1,padding:12,fontSize:14,borderRadius:9}}>Apply ✦</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VOID ITEM MODAL ── */}
      {voidItemModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,maxWidth:380,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4,color:"#F87171"}}>❌ Void Item</div>
            <div style={{fontSize:13,color:"#666",marginBottom:16}}>{voidItemModal.item_name} ×{voidItemModal.quantity} · {fmtPrice(voidItemModal.subtotal)}</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>REASON</label>
              <select value={voidReason} onChange={e=>setVoidReason(e.target.value)} style={{width:"100%",padding:"10px 12px",fontSize:14,borderRadius:8}}>
                <option value="">Select reason…</option>
                {VOID_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontSize:11,color:"#555",letterSpacing:1,display:"block",marginBottom:6}}>NOTE (OPTIONAL)</label>
              <textarea value={voidNote} onChange={e=>setVoidNote(e.target.value)} rows={2} placeholder="Additional details…"
                style={{width:"100%",padding:"9px 12px",fontSize:13,resize:"none",borderRadius:8}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setVoidItemModal(null)} style={{flex:1,padding:11,fontSize:14,borderRadius:9}}>Cancel</button>
              <button onClick={submitVoidItem} disabled={!voidReason}
                style={{flex:1,padding:11,fontSize:14,background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.4)",borderRadius:9,color:"#F87171",cursor:voidReason?"pointer":"not-allowed",fontFamily:"Inter,sans-serif",fontWeight:600,opacity:voidReason?1:.5}}>
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET TABLE MODAL ── */}
      {resetModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:20,padding:28,maxWidth:340,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔄</div>
            <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>Reset Table {selectedTab?.table_id}?</div>
            <div style={{fontSize:13,color:"#555",marginBottom:22,lineHeight:1.6}}>This will close the current tab without payment. Use only if the table is empty or guests left without paying.</div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setResetModal(false)} style={{flex:1,padding:11,fontSize:14,borderRadius:9}}>Cancel</button>
              <button onClick={resetTable}
                style={{flex:1,padding:11,fontSize:14,background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:9,color:"#F87171",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
                Reset Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── E-RECEIPT MODAL ── */}
      {receiptModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:SURFACE,border:`1px solid ${GOLD_DIM}`,borderRadius:20,maxWidth:400,width:"100%",overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${GOLD_DIM}44,${GOLD}11)`,padding:"20px 20px 16px",textAlign:"center",borderBottom:`1px solid ${BORDER}`}}>
              <div style={{fontSize:28,marginBottom:4}}>🧾</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900,color:GOLD}}>Payment Received</div>
              <div style={{fontSize:12,color:"#555",marginTop:2}}>Table {receiptModal.table_id} · {fmtDate(receiptModal.issued_at)}</div>
            </div>
            <div style={{padding:"14px 20px",maxHeight:320,overflowY:"auto"}}>
              {receiptModal.items?.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${BORDER}`,fontSize:13}}>
                  <div>
                    <div style={{color:"#e8e0d0"}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#555"}}>×{item.qty} × {fmtPrice(item.price)}</div>
                  </div>
                  <div style={{color:GOLD,fontWeight:600}}>{fmtPrice(item.subtotal)}</div>
                </div>
              ))}
              <div style={{paddingTop:10,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#666",marginBottom:3}}>
                  <span>Subtotal</span><span>{fmtPrice(receiptModal.subtotal)}</span>
                </div>
                {receiptModal.discount_amt>0&&(
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:GOLD,marginBottom:3}}>
                    <span>Discount</span><span>- {fmtPrice(receiptModal.discount_amt)}</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,borderTop:`1px solid ${GOLD_DIM}44`,paddingTop:8,marginTop:4}}>
                  <span>Total Paid</span>
                  <span style={{color:GOLD,fontFamily:"'Playfair Display',serif"}}>{fmtPrice(receiptModal.total)}</span>
                </div>
                <div style={{fontSize:12,color:"#555",marginTop:8,textAlign:"center"}}>
                  {PAYMENT_METHODS.find(m=>m.value===receiptModal.payment_method)?.label||receiptModal.payment_method}
                  {receiptModal.payment_ref&&<span> · Ref: {receiptModal.payment_ref}</span>}
                </div>
              </div>
            </div>
            <div style={{padding:"12px 20px",borderTop:`1px solid ${BORDER}`,textAlign:"center"}}>
              <div style={{fontSize:11,color:"#444",marginBottom:12}}>Thank you for dining at EasyCart Barcade & Lounge!</div>
              <button className="btn-gold" onClick={()=>setReceiptModal(null)} style={{width:"100%",padding:12,fontSize:14,borderRadius:10}}>Done ✦</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

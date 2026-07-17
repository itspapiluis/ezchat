import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase, fmtTime, fmtPrice, playAlert, clearStaffSession,
  ConnectionBanner, TABLE_LIST,
} from "./shared.js";

const BG="#0a0a08", SURFACE="#151510", SURFACE2="#1e1e16", BORDER="#2a2a20";
const GOLD="#C9A84C", PINK="#F472B6";

const RANK={pending:1,preparing:2,ready:3,served:4};
function stationStatus(items){
  const live=(items||[]).filter(i=>!i.voided);
  if(!live.length) return "voided";
  const min=Math.min(...live.map(i=>RANK[i.status]||1));
  return ["pending","preparing","ready","served"][min-1]||"pending";
}

export default function Server(){
  const navigate=useNavigate();
  const audioUnlocked=useRef(false);

  // who's serving (shared PIN, then pick a name)
  const [servers,setServers]=useState([]);
  const [me,setMe]=useState(()=>localStorage.getItem("ezchat_server_name")||"");
  const [assigned,setAssigned]=useState([]);      // table_ids this server watches
  const [tab,setTab]=useState("mine");            // mine | serve | walkin

  const [orders,setOrders]=useState([]);          // all live orders
  const [menu,setMenu]=useState({cats:[],items:[]});

  // ── who am I ──
  useEffect(()=>{
    supabase.from("servers").select("*").eq("active",true).order("name")
      .then(({data})=>setServers(data||[]));
  },[]);

  useEffect(()=>{
    if(!me) return;
    localStorage.setItem("ezchat_server_name",me);
    // load this server's assignments
    (async()=>{
      const {data:srv}=await supabase.from("servers").select("id").eq("name",me).maybeSingle();
      if(srv){
        const {data:asg}=await supabase.from("server_assignments").select("table_id").eq("server_id",srv.id);
        setAssigned((asg||[]).map(a=>a.table_id));
      }
    })();
  },[me]);

  // ── live orders + menu ──
  const loadOrders=async()=>{
    const {data}=await supabase
      .from("orders")
      .select("*, order_items(*), table_tabs(is_walkin,walkin_name,status)")
      .order("created_at",{ascending:false}).limit(120);
    setOrders(data||[]);
  };
  useEffect(()=>{
    loadOrders();
    (async()=>{
      const [{data:cats},{data:items}]=await Promise.all([
        supabase.from("menu_categories").select("*").order("sort_order"),
        // BUGFIX: .eq("available",true) HID items whose available flag is NULL.
        // But SQL `<> false` also excludes NULLs (three-valued logic), so we
        // fetch everything and filter in JS: show unless EXPLICITLY false.
        supabase.from("menu_items").select("*"),
      ]);
      setMenu({cats:cats||[], items:(items||[]).filter(i=>i.available!==false)});
    })();
    const ch=supabase.channel("server-orders")
      .on("postgres_changes",{event:"*",schema:"public",table:"order_items"},()=>loadOrders())
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>loadOrders())
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  const logout=()=>{ localStorage.removeItem("ezchat_server_name"); clearStaffSession("server"); navigate("/staff"); };

  // ── name picker ──
  if(!me){
    return(
      <div style={{minHeight:"100dvh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{width:"100%",maxWidth:380,textAlign:"center"}}>
          <div style={{fontSize:34,marginBottom:6}}>🧑‍🍳</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:900,color:GOLD}}>Who's serving?</div>
          <div style={{fontSize:12.5,color:"#666",marginBottom:22}}>Pick your name to start your shift</div>
          <div style={{display:"grid",gap:10}}>
            {servers.map(s=>(
              <button key={s.id} onClick={()=>setMe(s.name)}
                style={{padding:"14px",background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:12,color:"#e8e0d0",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                {s.name}
              </button>
            ))}
            {servers.length===0&&<div style={{fontSize:13,color:"#555",padding:20}}>No servers set up yet. Ask the admin to add names in the Staff panel.</div>}
          </div>
          <button onClick={()=>navigate("/staff")} style={{marginTop:18,background:"none",border:"none",color:"#555",fontSize:13,cursor:"pointer"}}>← Back</button>
        </div>
      </div>
    );
  }

  // orders for a given table_id
  const ordersForTable=(t)=>orders.filter(o=>o.table_id===t && stationStatus(o.order_items)!=="voided");

  // items ready to run out (any table)
  const readyToServe=orders.filter(o=>{
    const items=(o.order_items||[]).filter(i=>!i.voided);
    return items.length && items.some(i=>i.status==="ready");
  });

  const markServed=async(order)=>{
    const {error}=await supabase.from("order_items")
      .update({status:"served"})
      .eq("order_id",order.id)
      .eq("status","ready")
      .eq("voided",false);
    if(!error) loadOrders();
  };

  return(
    <div style={{minHeight:"100dvh",background:BG,color:"#e8e0d0",fontFamily:"Inter,sans-serif"}}
      onClick={()=>audioUnlocked.current=true}>
      <style>{`
        @keyframes srvToast{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .srv-press{transition:transform .1s ease;-webkit-tap-highlight-color:transparent}
        .srv-press:active{transform:scale(0.94)}
      `}</style>
      <ConnectionBanner/>

      {/* header */}
      <div style={{display:"flex",alignItems:"center",padding:"12px 14px",borderBottom:`1px solid ${BORDER}`,gap:8,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:900,color:GOLD}}>Server</div>
          <div style={{fontSize:11.5,color:"#777"}}>Signed in as <b style={{color:PINK}}>{me}</b></div>
        </div>
        <button onClick={()=>setMe("")} style={{padding:"6px 12px",background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:8,color:"#888",fontSize:12,cursor:"pointer"}}>Switch</button>
        <button onClick={logout} style={{padding:"6px 12px",background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:8,color:"#888",fontSize:12,cursor:"pointer"}}>Logout</button>
      </div>

      {/* tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${BORDER}`,overflowX:"auto"}}>
        {[["mine","My Tables"],["serve",`Ready to Serve${readyToServe.length?" ("+readyToServe.length+")":""}`],["walkin","Get Order"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{flex:1,minWidth:110,padding:"13px 6px",background:"none",border:"none",borderBottom:tab===k?`2px solid ${PINK}`:"2px solid transparent",
              color:tab===k?PINK:"#777",fontSize:13.5,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{padding:"14px 12px 90px",maxWidth:900,margin:"0 auto"}}>
        {tab==="mine"   && <MyTables me={me} assigned={assigned} setAssigned={setAssigned} ordersForTable={ordersForTable}/>}
        {tab==="serve"  && <ReadyToServe list={readyToServe} onServed={markServed}/>}
        {tab==="walkin" && <GetOrder me={me} menu={menu} onDone={()=>{loadOrders();setTab("mine");}}/>}
      </div>
    </div>
  );
}

// ── MY TABLES ────────────────────────────────────────────────────────────────
function MyTables({me,assigned,setAssigned,ordersForTable}){
  const [editing,setEditing]=useState(false);

  const toggle=async(t)=>{
    const {data:srv}=await supabase.from("servers").select("id").eq("name",me).maybeSingle();
    if(!srv) return;
    if(assigned.includes(t)){
      await supabase.from("server_assignments").delete().eq("server_id",srv.id).eq("table_id",t);
      setAssigned(a=>a.filter(x=>x!==t));
    }else{
      await supabase.from("server_assignments").insert({server_id:srv.id,table_id:t});
      setAssigned(a=>[...a,t]);
    }
  };

  if(editing){
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",marginBottom:14}}>
          <div style={{flex:1,fontSize:12.5,color:"#888"}}>Tap the tables you're assigned to. Ask your manager which ones.</div>
          <button onClick={()=>setEditing(false)} style={{padding:"7px 14px",background:PINK,border:"none",borderRadius:8,color:"#150a10",fontSize:13,fontWeight:600,cursor:"pointer"}}>Done</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(72px,1fr))",gap:7}}>
          {TABLE_LIST.map(t=>(
            <button key={t} onClick={()=>toggle(t)}
              style={{padding:"12px 4px",fontSize:12.5,borderRadius:9,cursor:"pointer",fontFamily:"Inter,sans-serif",
                background:assigned.includes(t)?"rgba(244,114,182,0.15)":SURFACE,
                border:`1px solid ${assigned.includes(t)?PINK:BORDER}`,
                color:assigned.includes(t)?PINK:"#888",fontWeight:assigned.includes(t)?600:400}}>
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",marginBottom:14}}>
        <div style={{flex:1,fontSize:11,color:GOLD,letterSpacing:1}}>MY TABLES</div>
        <button onClick={()=>setEditing(true)} style={{padding:"7px 14px",background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:8,color:PINK,fontSize:13,cursor:"pointer"}}>Edit assignment</button>
      </div>

      {assigned.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#555"}}>
          <div style={{fontSize:32,marginBottom:8}}>🪑</div>
          <div style={{fontSize:14}}>No tables assigned yet</div>
          <div style={{fontSize:12,marginTop:4}}>Tap "Edit assignment" and pick your tables.</div>
        </div>
      ):(
        <div style={{display:"grid",gap:12}}>
          {assigned.map(t=>{
            const os=ordersForTable(t);
            return(
              <div key={t} style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:15,fontWeight:700,color:GOLD,marginBottom:os.length?8:0}}>{t}</div>
                {os.length===0?(
                  <div style={{fontSize:12.5,color:"#555"}}>No orders yet</div>
                ):os.map(o=>(
                  <div key={o.id} style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:"#666",marginBottom:3}}>{o.user_name||"Guest"} · {fmtTime(o.created_at)}</div>
                    {(o.order_items||[]).filter(i=>!i.voided).map(i=>(
                      <div key={i.id} style={{display:"flex",gap:8,padding:"2px 0"}}>
                        <span style={{fontSize:13,flex:1}}>{i.quantity}× {i.item_name}</span>
                        <span style={{fontSize:11,color:i.status==="ready"?"#34D399":i.status==="served"?"#666":"#F59E0B"}}>{i.status}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── READY TO SERVE ───────────────────────────────────────────────────────────
function ReadyToServe({list,onServed}){
  if(!list.length){
    return(
      <div style={{textAlign:"center",padding:40,color:"#555"}}>
        <div style={{fontSize:32,marginBottom:8}}>✅</div>
        <div style={{fontSize:14}}>Nothing waiting to be served</div>
      </div>
    );
  }
  return(
    <div style={{display:"grid",gap:12}}>
      {list.map(o=>{
        const walkin=o.table_tabs?.is_walkin;
        const label=walkin?`${o.table_tabs?.walkin_name||"Walk-in"} (walk-in)`:o.table_id;
        const readyItems=(o.order_items||[]).filter(i=>i.status==="ready"&&!i.voided);
        return(
          <div key={o.id} style={{background:SURFACE,border:`1px solid #34D39944`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{flex:1,fontSize:15,fontWeight:700,color:"#34D399"}}>{label}</div>
              <button onClick={()=>onServed(o)}
                style={{padding:"8px 16px",background:"#34D399",border:"none",borderRadius:9,color:"#04120b",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                Mark Served
              </button>
            </div>
            {readyItems.map(i=>(
              <div key={i.id} style={{fontSize:13,color:"#ccc",padding:"2px 0"}}>{i.quantity}× {i.item_name}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── GET ORDER (walk-in) ──────────────────────────────────────────────────────
function GetOrder({me,menu,onDone}){
  const [name,setName]=useState("");
  const [cart,setCart]=useState([]);
  const [activeCat,setActiveCat]=useState(null);
  const [busy,setBusy]=useState(false);
  const [existing,setExisting]=useState(null);   // an already-open walk-in with this name
  const [toast,setToast]=useState(null);          // {msg,kind}
  const [flash,setFlash]=useState(null);          // menu_item_id just tapped (for animation)
  const showToast=(msg,kind="ok")=>{ setToast({msg,kind}); setTimeout(()=>setToast(null),2200); };

  const cats=menu.cats;
  const itemsFor=(catId)=>menu.items.filter(i=>i.category_id===catId);
  const total=cart.reduce((s,c)=>s+c.item_price*c.qty,0);

  const add=(item,catType)=>{
    setFlash(item.id); setTimeout(()=>setFlash(f=>f===item.id?null:f),260);
    setCart(prev=>{
      const ex=prev.find(c=>c.menu_item_id===item.id);
      if(ex) return prev.map(c=>c.menu_item_id===item.id?{...c,qty:c.qty+1}:c);
      return[...prev,{menu_item_id:item.id,item_name:item.name,item_price:Number(item.price),category_type:catType,qty:1}];
    });
  };
  const dec=(id)=>setCart(p=>p.map(c=>c.menu_item_id===id?{...c,qty:c.qty-1}:c).filter(c=>c.qty>0));

  const submit=async()=>{
    if(!name.trim()){ showToast("Enter the guest's name first.","warn"); return; }
    if(!cart.length){ showToast("Add at least one item.","warn"); return; }
    setBusy(true);
    try{
      // Per your decision (B): a matching open name gets ASKED, never auto-merged.
      const {data:open}=await supabase.from("table_tabs")
        .select("id,walkin_name").eq("is_walkin",true).eq("status","open")
        .ilike("walkin_name",name.trim());
      let tabId, tableId;
      if(open&&open.length&&!existing){
        setExisting(open[0]); setBusy(false); return;   // ask first
      }
      if(existing){ tabId=existing.id; }
      else{
        const {data:res,error}=await supabase.rpc("open_walkin",{p_name:name.trim(),p_by:me});
        if(error||!res?.ok) throw new Error(res?.error||"Could not open walk-in.");
        tabId=res.tab.id; tableId=res.tab.table_id;
      }
      if(!tableId){
        const {data:t}=await supabase.from("table_tabs").select("table_id").eq("id",tabId).maybeSingle();
        tableId=t?.table_id;
      }
      // one order, its items
      // BUGFIX: orders.user_id is NOT NULL. The guest app always sets it; the
      // server panel omitted it, so every server order was REJECTED by the
      // database ("can't send order"). Walk-ins have no real user account, so we
      // tag them with a synthetic staff id.
      const {data:order,error:oe}=await supabase.from("orders")
        .insert({tab_id:tabId,table_id:tableId,user_id:`server:${me}`,user_name:name.trim(),status:"pending",placed_by:me})
        .select().single();
      if(oe) throw oe;
      const items=cart.map(c=>({
        order_id:order.id,tab_id:tabId,table_id:tableId,menu_item_id:c.menu_item_id,
        item_name:c.item_name,item_price:c.item_price,category_type:c.category_type,
        quantity:c.qty,subtotal:c.item_price*c.qty,status:"pending",voided:false,
      }));
      const {error:ie}=await supabase.from("order_items").insert(items);
      if(ie) throw ie;
      setCart([]); setName(""); setExisting(null);
      showToast(`Order sent for ${name.trim()} \u2713`,"ok");
      onDone();
    }catch(e){
      showToast((e.message||String(e)),"err");
    }finally{ setBusy(false); }
  };

  return(
    <div>
      {/* merge prompt */}
      {existing&&(
        <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.35)",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:13,color:"#F59E0B",marginBottom:10}}>
            There's already an open tab for <b>"{existing.walkin_name}"</b>. Add to it, or start a new one?
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={submit} style={{flex:1,padding:"9px",background:"#F59E0B",border:"none",borderRadius:8,color:"#1a1205",fontSize:13,fontWeight:600,cursor:"pointer"}}>Add to existing</button>
            <button onClick={()=>{setExisting(null); submit();}} style={{flex:1,padding:"9px",background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:8,color:"#ccc",fontSize:13,cursor:"pointer"}}>Start new</button>
          </div>
        </div>
      )}

      <input value={name} onChange={e=>setName(e.target.value)} maxLength={40}
        placeholder="Guest's name (e.g. Marco, or 'guy in red cap')"
        style={{width:"100%",padding:"12px 14px",background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:10,color:"#e8e0d0",fontSize:14,fontFamily:"Inter,sans-serif",marginBottom:14}}/>

      {/* category chips */}
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:10}}>
        {cats.map(c=>(
          <button key={c.id} className="srv-press" onClick={()=>setActiveCat(c.id)}
            style={{flexShrink:0,padding:"7px 12px",borderRadius:20,fontSize:12.5,cursor:"pointer",fontFamily:"Inter,sans-serif",
              background:activeCat===c.id?PINK:SURFACE,border:`1px solid ${activeCat===c.id?PINK:BORDER}`,
              color:activeCat===c.id?"#150a10":"#aaa"}}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* items */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:16}}>
        {(activeCat?itemsFor(activeCat):[]).map(item=>{
          const cat=cats.find(c=>c.id===item.category_id);
          const inCart=cart.find(c=>c.menu_item_id===item.id);
          const isFlash=flash===item.id;
          return(
            <button key={item.id} onClick={()=>add(item,cat?.type)}
              style={{position:"relative",textAlign:"left",padding:"10px 12px",
                background:isFlash?"rgba(244,114,182,0.18)":inCart?"rgba(201,168,76,0.08)":SURFACE,
                border:`1px solid ${isFlash?PINK:inCart?GOLD:BORDER}`,borderRadius:10,cursor:"pointer",
                fontFamily:"Inter,sans-serif",transform:isFlash?"scale(0.96)":"scale(1)",
                transition:"transform .12s ease, background .18s, border-color .18s",WebkitTapHighlightColor:"transparent"}}>
              <div style={{fontSize:13,color:"#e8e0d0",marginBottom:2,paddingRight:inCart?22:0}}>{item.name}</div>
              <div style={{fontSize:12,color:GOLD}}>{fmtPrice(item.price)}</div>
              {inCart&&(
                <div style={{position:"absolute",top:8,right:8,minWidth:18,height:18,borderRadius:9,
                  background:GOLD,color:"#150a10",fontSize:11,fontWeight:800,display:"flex",
                  alignItems:"center",justifyContent:"center",padding:"0 5px"}}>{inCart.qty}</div>
              )}
            </button>
          );
        })}
        {!activeCat&&<div style={{gridColumn:"1/-1",textAlign:"center",color:"#555",fontSize:13,padding:20}}>Pick a category above</div>}
      </div>

      {/* toast */}
      {toast&&(
        <div style={{position:"fixed",left:"50%",bottom:24,transform:"translateX(-50%)",zIndex:600,
          maxWidth:"90%",padding:"11px 18px",borderRadius:12,fontSize:13.5,fontWeight:600,
          fontFamily:"Inter,sans-serif",boxShadow:"0 8px 30px rgba(0,0,0,0.5)",
          animation:"srvToast .25s ease",
          background:toast.kind==="err"?"#3b1414":toast.kind==="warn"?"#3a2f12":"#12281b",
          border:`1px solid ${toast.kind==="err"?"#7f1d1d":toast.kind==="warn"?"#8a6d1e":"#1f6b45"}`,
          color:toast.kind==="err"?"#fca5a5":toast.kind==="warn"?"#fcd34d":"#6ee7b7"}}>
          {toast.msg}
        </div>
      )}

      {/* cart */}
      {cart.length>0&&(
        <div style={{position:"sticky",bottom:0,background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:12,padding:14}}>
          {cart.map(c=>(
            <div key={c.menu_item_id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
              <span style={{flex:1,fontSize:13}}>{c.qty}× {c.item_name}</span>
              <span style={{fontSize:13,color:GOLD}}>{fmtPrice(c.item_price*c.qty)}</span>
              <button onClick={()=>dec(c.menu_item_id)} style={{width:24,height:24,borderRadius:6,background:SURFACE2,border:`1px solid ${BORDER}`,color:"#F87171",cursor:"pointer"}}>−</button>
            </div>
          ))}
          <button onClick={submit} disabled={busy} className="srv-press"
            style={{width:"100%",marginTop:10,padding:"12px",background:PINK,border:"none",borderRadius:10,color:"#150a10",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",opacity:busy?0.5:1}}>
            {busy?"Sending…":`Send Order · ${fmtPrice(total)}`}
          </button>
        </div>
      )}
    </div>
  );
}

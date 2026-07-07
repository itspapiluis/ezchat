import { useState, useEffect, useCallback } from "react";
import { supabase, fmtPrice, fmtDate, fmtTime, PAYMENT_METHODS } from "./shared.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const BG = "#080808";
const SURFACE = "#0F0F0F";
const SURFACE2 = "#161616";
const BORDER = "#241E10";

// ── Helpers ───────────────────────────────────────────────────────────────────
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x.toISOString(); }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x.toISOString(); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function formatHour(h){ const ampm=h>=12?"PM":"AM"; return `${h===0?12:h>12?h-12:h}${ampm}`; }

// ── CSV Export ─────────────────────────────────────────────────────────────────
function exportCSV(filename, headers, rows){
  const csv = [
    headers.join(","),
    ...rows.map(r => r.map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function BarChart({data, color=GOLD, height=120, labelKey="label", valueKey="value"}){
  const max = Math.max(...data.map(d=>d[valueKey]),1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height,paddingTop:8}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end"}}>
          <div style={{fontSize:9,color:GOLD,fontWeight:600,opacity:d[valueKey]>0?1:0}}>
            {typeof d[valueKey]==="number"&&d[valueKey]>999?`₱${(d[valueKey]/1000).toFixed(1)}k`:d[valueKey]}
          </div>
          <div style={{width:"100%",background:`${color}22`,borderRadius:"4px 4px 0 0",position:"relative",height:`${Math.max((d[valueKey]/max)*100,2)}%`,transition:"height .4s ease"}}>
            <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg,${color},${color}88)`,borderRadius:"4px 4px 0 0"}}/>
          </div>
          <div style={{fontSize:9,color:"#555",textAlign:"center",lineHeight:1.2}}>{d[labelKey]}</div>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({icon,label,value,sub,color=GOLD}){
  return(
    <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:"16px 18px"}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:24,fontWeight:700,color,fontFamily:"'Playfair Display',serif"}}>{value}</div>
      <div style={{fontSize:12,color:"#888",marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"#555",marginTop:1}}>{sub}</div>}
    </div>
  );
}

// ── SALES REPORTS TAB ─────────────────────────────────────────────────────────
export function SalesReports(){
  const today = new Date();
  const [period, setPeriod] = useState("today");
  const [dateFrom, setDateFrom] = useState(today.toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split("T")[0]);
  const [receipts, setReceipts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const getPeriodRange = () => {
    const now = new Date();
    if(period==="today")   return {from:startOfDay(now), to:endOfDay(now)};
    if(period==="7days")   return {from:startOfDay(addDays(now,-6)), to:endOfDay(now)};
    if(period==="30days")  return {from:startOfDay(addDays(now,-29)), to:endOfDay(now)};
    if(period==="custom")  return {from:startOfDay(new Date(dateFrom)), to:endOfDay(new Date(dateTo))};
    return {from:startOfDay(now), to:endOfDay(now)};
  };

  const loadData = useCallback(async()=>{
    setLoading(true);
    const {from,to} = getPeriodRange();
    const [{data:r},{data:oi}] = await Promise.all([
      supabase.from("receipts").select("*").gte("issued_at",from).lte("issued_at",to).eq("status","paid").order("issued_at",{ascending:true}),
      supabase.from("order_items").select("*").gte("created_at",from).lte("created_at",to).eq("voided",false),
    ]);
    setReceipts(r||[]);
    setOrderItems(oi||[]);
    setLoading(false);
  },[period,dateFrom,dateTo]);

  useEffect(()=>{ loadData(); },[loadData]);

  // ── Calculations ──
  const totalRevenue = receipts.reduce((s,r)=>s+Number(r.total),0);
  const totalBills   = receipts.length;
  const avgBill      = totalBills>0 ? totalRevenue/totalBills : 0;
  const totalDiscount= receipts.reduce((s,r)=>s+Number(r.discount_amt||0),0);

  // Revenue by category
  const byCategory = ["food","drinks","spirits"].map(cat=>({
    label: cat.charAt(0).toUpperCase()+cat.slice(1),
    value: orderItems.filter(i=>i.category_type===cat).reduce((s,i)=>s+Number(i.subtotal),0),
  }));

  // Revenue by payment method
  const byPayment = PAYMENT_METHODS.map(m=>({
    method: m.label,
    count: receipts.filter(r=>r.payment_method===m.value).length,
    total: receipts.filter(r=>r.payment_method===m.value).reduce((s,r)=>s+Number(r.total),0),
  })).filter(m=>m.count>0);

  // Revenue by table section
  const sections = ["L","R","C","D","B","M","F","KTV","VIP"];
  const bySection = sections.map(sec=>({
    label: sec,
    value: receipts
      .filter(r=>{
        if(sec==="KTV") return r.table_id?.startsWith("KTV");
        if(sec==="VIP") return ["SAPPHIRE","RUBY","DIAMOND"].includes(r.table_id);
        return r.table_id?.startsWith(sec)&&!r.table_id.startsWith("KTV");
      })
      .reduce((s,r)=>s+Number(r.total),0),
  })).filter(s=>s.value>0);

  // Top 10 selling items
  const itemMap = {};
  orderItems.forEach(i=>{
    if(!itemMap[i.item_name]) itemMap[i.item_name]={name:i.item_name,qty:0,revenue:0,cat:i.category_type};
    itemMap[i.item_name].qty += i.quantity;
    itemMap[i.item_name].revenue += Number(i.subtotal);
  });
  const topItems = Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue).slice(0,10);

  // Daily revenue for chart (last 7 or 30 days)
  const dailyRevenue = (() => {
    const {from} = getPeriodRange();
    const days = period==="7days"?7:period==="30days"?30:1;
    return Array.from({length:days},(_,i)=>{
      const d = addDays(new Date(from),i);
      const label = days===1?"Today":`${d.getMonth()+1}/${d.getDate()}`;
      const dayStr = d.toISOString().split("T")[0];
      const value = receipts
        .filter(r=>r.issued_at?.startsWith(dayStr))
        .reduce((s,r)=>s+Number(r.total),0);
      return {label,value};
    });
  })();

  // CSV export
  const exportSales = () => exportCSV(
    `easycart_sales_${dateFrom}_${dateTo}.csv`,
    ["Receipt ID","Table","Date","Subtotal","Discount","Total","Payment Method","Ref"],
    receipts.map(r=>[r.id,r.table_id,fmtDate(r.issued_at),r.subtotal,r.discount_amt||0,r.total,r.payment_method,r.payment_ref||""])
  );

  const exportItems = () => exportCSV(
    `easycart_items_${dateFrom}_${dateTo}.csv`,
    ["Item Name","Category","Qty Sold","Revenue"],
    topItems.map(i=>[i.name,i.cat,i.qty,i.revenue.toFixed(2)])
  );

  return(
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* Period selector */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {[["today","Today"],["7days","Last 7 Days"],["30days","Last 30 Days"],["custom","Custom"]].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            style={{padding:"8px 16px",background:period===v?`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`:"transparent",border:`1px solid ${period===v?GOLD:BORDER}`,borderRadius:9,color:period===v?"#080808":"#666",fontSize:13,fontWeight:period===v?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s"}}>
            {l}
          </button>
        ))}
        {period==="custom"&&(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:"7px 10px",fontSize:13,borderRadius:8,background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0"}}/>
            <span style={{color:"#555",fontSize:13}}>to</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:"7px 10px",fontSize:13,borderRadius:8,background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0"}}/>
          </div>
        )}
        <button onClick={loadData} style={{padding:"8px 16px",background:`rgba(201,168,76,0.1)`,border:`1px solid ${GOLD_DIM}`,borderRadius:9,cursor:"pointer",fontSize:13,color:GOLD,fontFamily:"Inter,sans-serif"}}>
          {loading?"Loading…":"🔄 Refresh"}
        </button>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={exportSales} style={{padding:"8px 14px",background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:9,cursor:"pointer",fontSize:12,color:"#888",fontFamily:"Inter,sans-serif"}}>📥 Export Sales CSV</button>
          <button onClick={exportItems} style={{padding:"8px 14px",background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:9,cursor:"pointer",fontSize:12,color:"#888",fontFamily:"Inter,sans-serif"}}>📥 Export Items CSV</button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
        <StatCard icon="💰" label="Total Revenue" value={fmtPrice(totalRevenue)} color={GOLD}/>
        <StatCard icon="🧾" label="Bills Closed" value={totalBills} color="#34D399"/>
        <StatCard icon="📊" label="Avg Bill" value={fmtPrice(avgBill)} color="#60A5FA"/>
        <StatCard icon="🏷️" label="Total Discounts" value={fmtPrice(totalDiscount)} color="#F59E0B"/>
      </div>

      {/* Revenue chart */}
      {dailyRevenue.length>1&&(
        <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18,marginBottom:20}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>DAILY REVENUE</div>
          <BarChart data={dailyRevenue} color={GOLD} height={140}/>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {/* By category */}
        <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>REVENUE BY CATEGORY</div>
          <BarChart data={byCategory} color="#A78BFA" height={100}/>
        </div>
        {/* By section */}
        <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>REVENUE BY TABLE SECTION</div>
          {bySection.length===0?<div style={{color:"#444",fontSize:13,textAlign:"center",padding:20}}>No data</div>:
          <BarChart data={bySection} color="#34D399" height={100}/>}
        </div>
      </div>

      {/* Payment method breakdown */}
      <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18,marginBottom:20}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>PAYMENT METHOD BREAKDOWN</div>
        {byPayment.length===0?<div style={{color:"#444",fontSize:13,textAlign:"center",padding:16}}>No payments yet</div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
          {byPayment.map(m=>(
            <div key={m.method} style={{background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:13,color:"#e8e0d0",fontWeight:600,marginBottom:3}}>{m.method}</div>
              <div style={{fontSize:16,color:GOLD,fontWeight:700}}>{fmtPrice(m.total)}</div>
              <div style={{fontSize:11,color:"#555",marginTop:1}}>{m.count} transaction{m.count!==1?"s":""}</div>
            </div>
          ))}
        </div>}
      </div>

      {/* Top items */}
      <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>TOP 10 ITEMS BY REVENUE</div>
        {topItems.length===0?<div style={{color:"#444",fontSize:13,textAlign:"center",padding:16}}>No items sold yet</div>:
        topItems.map((item,i)=>(
          <div key={item.name} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:`1px solid ${BORDER}`}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:`${GOLD}22`,border:`1px solid ${GOLD_DIM}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:GOLD,flexShrink:0}}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,color:"#e8e0d0",fontWeight:500}}>{item.name}</div>
              <div style={{fontSize:11,color:"#555"}}>{item.cat} · {item.qty} sold</div>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:GOLD}}>{fmtPrice(item.revenue)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ANALYTICS TAB ─────────────────────────────────────────────────────────────
export function Analytics(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7days");

  useEffect(()=>{ loadAnalytics(); },[period]);

  const loadAnalytics = async()=>{
    setLoading(true);
    const now = new Date();
    const days = period==="7days"?7:30;
    const from = startOfDay(addDays(now,-days+1));
    const to = endOfDay(now);

    const [{data:orders},{data:items},{data:receipts},{data:tabs}] = await Promise.all([
      supabase.from("orders").select("created_at,table_id,status").gte("created_at",from).lte("created_at",to),
      supabase.from("order_items").select("*").gte("created_at",from).lte("created_at",to).eq("voided",false),
      supabase.from("receipts").select("*").gte("issued_at",from).lte("issued_at",to).eq("status","paid"),
      supabase.from("table_tabs").select("*").gte("opened_at",from).lte("opened_at",to),
    ]);

    // Peak hours (0–23)
    const hourCounts = Array(24).fill(0);
    orders?.forEach(o=>{
      const h = new Date(o.created_at).getHours();
      hourCounts[h]++;
    });
    // Bar hours 6PM(18) to 4AM(4)
    const barHours = [18,19,20,21,22,23,0,1,2,3,4].map(h=>({
      label: formatHour(h),
      value: hourCounts[h],
    }));

    // Best sellers (qty)
    const itemMap = {};
    items?.forEach(i=>{
      if(!itemMap[i.item_name]) itemMap[i.item_name]={name:i.item_name,qty:0,revenue:0,cat:i.category_type};
      itemMap[i.item_name].qty += i.quantity;
      itemMap[i.item_name].revenue += Number(i.subtotal);
    });
    const bestSellers = Object.values(itemMap).sort((a,b)=>b.qty-a.qty).slice(0,5);

    // Avg bill per table section
    const sectionMap = {};
    receipts?.forEach(r=>{
      let sec = "Other";
      if(r.table_id?.startsWith("KTV")) sec="KTV";
      else if(["SAPPHIRE","RUBY","DIAMOND"].includes(r.table_id)) sec="VIP";
      else sec = r.table_id?.charAt(0)||"Other";
      if(!sectionMap[sec]) sectionMap[sec]={sec,total:0,count:0};
      sectionMap[sec].total += Number(r.total);
      sectionMap[sec].count++;
    });
    const sectionAvg = Object.values(sectionMap).map(s=>({
      label:s.sec, value:s.count>0?Math.round(s.total/s.count):0
    })).sort((a,b)=>b.value-a.value);

    // Table turnover
    const tableCount = new Set(tabs?.map(t=>t.table_id)||[]).size;
    const totalRevenue = receipts?.reduce((s,r)=>s+Number(r.total),0)||0;
    const totalBills = receipts?.length||0;

    setData({barHours, bestSellers, sectionAvg, tableCount, totalRevenue, totalBills,
      avgBill: totalBills>0?totalRevenue/totalBills:0,
      totalOrders: orders?.length||0,
    });
    setLoading(false);
  };

  if(loading) return <div style={{textAlign:"center",padding:40,color:"#555"}}>Loading analytics…</div>;

  return(
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["7days","Last 7 Days"],["30days","Last 30 Days"]].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            style={{padding:"8px 16px",background:period===v?`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`:"transparent",border:`1px solid ${period===v?GOLD:BORDER}`,borderRadius:9,color:period===v?"#080808":"#666",fontSize:13,fontWeight:period===v?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Key metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        <StatCard icon="📦" label="Total Orders" value={data?.totalOrders||0} color="#60A5FA"/>
        <StatCard icon="🪑" label="Tables Served" value={data?.tableCount||0} color="#34D399"/>
        <StatCard icon="💰" label="Revenue" value={fmtPrice(data?.totalRevenue||0)} color={GOLD}/>
        <StatCard icon="📊" label="Avg Bill" value={fmtPrice(data?.avgBill||0)} color="#A78BFA"/>
      </div>

      {/* Peak hours */}
      <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18,marginBottom:20}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:4}}>PEAK HOURS (Bar Hours: 6PM – 4AM)</div>
        <div style={{fontSize:12,color:"#555",marginBottom:12}}>Number of orders placed per hour</div>
        <BarChart data={data?.barHours||[]} color="#F59E0B" height={130}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {/* Best sellers by qty */}
        <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>🏆 TOP 5 BEST SELLERS (QTY)</div>
          {data?.bestSellers?.length===0?<div style={{color:"#444",fontSize:13,textAlign:"center",padding:16}}>No data</div>:
          data?.bestSellers?.map((item,i)=>(
            <div key={item.name} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:i===0?`${GOLD}33`:`${SURFACE2}`,border:`1px solid ${i===0?GOLD:BORDER}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i===0?GOLD:"#666",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#e8e0d0",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                <div style={{fontSize:11,color:"#555"}}>{item.cat}</div>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:"#34D399",flexShrink:0}}>{item.qty} sold</div>
            </div>
          ))}
        </div>

        {/* Avg bill by section */}
        <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:18}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>💺 AVG BILL BY TABLE SECTION</div>
          {data?.sectionAvg?.length===0?<div style={{color:"#444",fontSize:13,textAlign:"center",padding:16}}>No data</div>:
          data?.sectionAvg?.map((s,i)=>(
            <div key={s.label} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
              <div style={{width:32,height:32,borderRadius:8,background:`${GOLD}15`,border:`1px solid ${GOLD_DIM}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:GOLD,flexShrink:0}}>{s.label}</div>
              <div style={{flex:1}}>
                <div style={{height:6,background:`${SURFACE2}`,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:`linear-gradient(90deg,${GOLD},${GOLD_LIGHT})`,width:`${Math.min((s.value/Math.max(...data.sectionAvg.map(x=>x.value),1))*100,100)}%`,borderRadius:3,transition:"width .4s"}}/>
                </div>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:GOLD,flexShrink:0,minWidth:70,textAlign:"right"}}>{fmtPrice(s.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── VOID REPORTS TAB ──────────────────────────────────────────────────────────
export function VoidReports(){
  const [voids, setVoids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(()=>{ loadVoids(); },[period,dateFrom,dateTo]);

  const loadVoids = async()=>{
    setLoading(true);
    const now = new Date();
    let from, to;
    if(period==="today")  { from=startOfDay(now); to=endOfDay(now); }
    else if(period==="7days") { from=startOfDay(addDays(now,-6)); to=endOfDay(now); }
    else { from=startOfDay(new Date(dateFrom)); to=endOfDay(new Date(dateTo)); }

    const {data} = await supabase.from("void_logs").select("*").gte("voided_at",from).lte("voided_at",to).order("voided_at",{ascending:false});
    setVoids(data||[]);
    setLoading(false);
  };

  const totalVoided = voids.reduce((s,v)=>s+(Number(v.item_price||0)*Number(v.quantity||1)),0);

  const exportVoids = ()=>exportCSV(
    `easycart_voids_${dateFrom}_${dateTo}.csv`,
    ["ID","Table","Item","Price","Qty","Total","Reason","Voided By","Date"],
    voids.map(v=>[v.id,v.table_id,v.item_name,v.item_price,v.quantity,(Number(v.item_price)*Number(v.quantity)).toFixed(2),v.reason,v.voided_by,fmtDate(v.voided_at)])
  );

  return(
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {[["today","Today"],["7days","7 Days"],["custom","Custom"]].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            style={{padding:"8px 16px",background:period===v?`rgba(248,113,113,0.15)`:"transparent",border:`1px solid ${period===v?"rgba(248,113,113,0.4)":BORDER}`,borderRadius:9,color:period===v?"#F87171":"#666",fontSize:13,fontWeight:period===v?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            {l}
          </button>
        ))}
        {period==="custom"&&(
          <>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:"7px 10px",fontSize:13,borderRadius:8,background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0"}}/>
            <span style={{color:"#555"}}>to</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:"7px 10px",fontSize:13,borderRadius:8,background:SURFACE2,border:`1px solid ${BORDER}`,color:"#e8e0d0"}}/>
          </>
        )}
        <button onClick={exportVoids} style={{marginLeft:"auto",padding:"8px 14px",background:SURFACE2,border:`1px solid ${BORDER}`,borderRadius:9,cursor:"pointer",fontSize:12,color:"#888",fontFamily:"Inter,sans-serif"}}>📥 Export CSV</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <StatCard icon="❌" label="Total Voids" value={voids.length} color="#F87171"/>
        <StatCard icon="💸" label="Total Voided Value" value={fmtPrice(totalVoided)} color="#F59E0B"/>
        <StatCard icon="👨‍🍳" label="By Kitchen" value={voids.filter(v=>v.voided_by==="kitchen").length} color="#34D399"/>
        <StatCard icon="🍸" label="By Bar" value={voids.filter(v=>v.voided_by==="bar").length} color="#60A5FA"/>
        <StatCard icon="💰" label="By Cashier" value={voids.filter(v=>v.voided_by==="cashier").length} color={GOLD}/>
      </div>

      {loading?<div style={{textAlign:"center",padding:40,color:"#555"}}>Loading…</div>:
      voids.length===0?<div style={{textAlign:"center",padding:40,color:"#444",fontSize:14}}>No voids for this period</div>:
      <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${BORDER}`,display:"grid",gridTemplateColumns:"60px 80px 1fr 80px 80px 80px 100px",gap:8,fontSize:10,color:"#444",letterSpacing:1}}>
          <span>TABLE</span><span>ITEM</span><span></span><span>QTY</span><span>PRICE</span><span>TOTAL</span><span>VOIDED BY</span>
        </div>
        {voids.map(v=>(
          <div key={v.id} style={{padding:"10px 16px",borderBottom:`1px solid ${BORDER}`,display:"grid",gridTemplateColumns:"60px 80px 1fr 80px 80px 80px 100px",gap:8,alignItems:"center",fontSize:13}}>
            <span style={{color:GOLD,fontWeight:600}}>{v.table_id}</span>
            <span style={{color:"#888",fontSize:11}}>{fmtTime(v.voided_at)}</span>
            <div>
              <div style={{color:"#e8e0d0"}}>{v.item_name}</div>
              <div style={{fontSize:11,color:"#F87171"}}>{v.reason}</div>
            </div>
            <span style={{color:"#888"}}>×{v.quantity}</span>
            <span style={{color:"#888"}}>{fmtPrice(v.item_price)}</span>
            <span style={{color:"#F87171",fontWeight:600}}>{fmtPrice(Number(v.item_price)*Number(v.quantity))}</span>
            <span style={{fontSize:11,color:v.voided_by==="kitchen"?"#34D399":v.voided_by==="bar"?"#60A5FA":"#C9A84C",textTransform:"capitalize"}}>{v.voided_by}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ── STAFF MANAGEMENT TAB ──────────────────────────────────────────────────────
export function StaffManagement(){
  const [pins, setPins] = useState({kitchen:"",bar:"",cashier:""});
  const [activity, setActivity] = useState([]);
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [showPin, setShowPin] = useState({});

  useEffect(()=>{ loadData(); },[]);

  const loadData = async()=>{
    const [{data:cfg},{data:act}] = await Promise.all([
      supabase.from("staff_config").select("*").in("key",["pin_kitchen","pin_bar","pin_cashier"]),
      supabase.from("staff_activity").select("*").order("performed_at",{ascending:false}).limit(50),
    ]);
    if(cfg){
      const p = {};
      cfg.forEach(c=>{ p[c.key.replace("pin_","")]=c.value; });
      setPins(p);
    }
    if(act) setActivity(act);
  };

  const savePin = async(role)=>{
    const pin = pins[role];
    if(!pin||pin.length!==6||!/^\d{6}$/.test(pin)){
      alert("PIN must be exactly 6 digits");return;
    }
    setSaving(p=>({...p,[role]:true}));
    await supabase.from("staff_config").upsert({key:`pin_${role}`,value:pin,updated_at:new Date().toISOString()},{onConflict:"key"});
    setSaving(p=>({...p,[role]:false}));
    setSaved(p=>({...p,[role]:true}));
    setTimeout(()=>setSaved(p=>({...p,[role]:false})),2000);
    // Log this action
    await supabase.from("staff_activity").insert({role:"admin",action:"pin_changed",details:{role_changed:role}});
  };

  const ROLES = [
    {key:"kitchen",label:"Kitchen",icon:"👨‍🍳",color:"#34D399"},
    {key:"bar",label:"Bar",icon:"🍸",color:"#60A5FA"},
    {key:"cashier",label:"Cashier",icon:"💰",color:GOLD},
  ];

  const ACTION_LABELS = {
    login:"Logged in",logout:"Logged out",void:"Voided order",
    payment:"Processed payment",discount:"Applied discount",pin_changed:"Changed PIN",
  };

  return(
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* PIN Management */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:14}}>ROLE PIN MANAGEMENT</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
          {ROLES.map(r=>(
            <div key={r.key} style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,padding:"18px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <span style={{fontSize:22}}>{r.icon}</span>
                <span style={{fontSize:15,fontWeight:600,color:r.color}}>{r.label}</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,position:"relative"}}>
                  <input
                    type={showPin[r.key]?"text":"password"}
                    value={pins[r.key]||""}
                    onChange={e=>setPins(p=>({...p,[r.key]:e.target.value}))}
                    maxLength={6}
                    placeholder="6-digit PIN"
                    style={{width:"100%",padding:"9px 36px 9px 12px",fontSize:16,letterSpacing:showPin[r.key]?2:4,borderRadius:8,fontFamily:"monospace"}}
                  />
                  <button onClick={()=>setShowPin(p=>({...p,[r.key]:!p[r.key]}))}
                    style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#555",fontSize:14,fontFamily:"Inter,sans-serif"}}>
                    {showPin[r.key]?"🙈":"👁️"}
                  </button>
                </div>
                <button onClick={()=>savePin(r.key)} disabled={saving[r.key]}
                  style={{padding:"9px 14px",background:saved[r.key]?"rgba(52,211,153,0.15)":`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,border:saved[r.key]?"1px solid rgba(52,211,153,0.4)":"none",borderRadius:8,cursor:"pointer",fontSize:13,color:saved[r.key]?"#34D399":"#080808",fontFamily:"Inter,sans-serif",fontWeight:700,flexShrink:0,transition:"all .2s"}}>
                  {saving[r.key]?"…":saved[r.key]?"✓ Saved":"Save"}
                </button>
              </div>
              <div style={{fontSize:10,color:"#444",marginTop:6}}>
                Staff access: ezchat-bar.vercel.app/staff
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,fontSize:12,color:"#555",background:`rgba(245,158,11,0.06)`,border:`1px solid rgba(245,158,11,0.2)`,borderRadius:8,padding:"8px 14px"}}>
          ⚠️ After changing a PIN, inform the relevant staff immediately. Old PIN stops working right away.
        </div>
      </div>

      {/* Activity log */}
      <div>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1,marginBottom:12}}>STAFF ACTIVITY LOG (LAST 50)</div>
        {activity.length===0?<div style={{textAlign:"center",padding:32,color:"#444",fontSize:13}}>No activity recorded yet</div>:
        <div style={{background:SURFACE,border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden"}}>
          {activity.map(a=>(
            <div key={a.id} style={{padding:"10px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:18,flexShrink:0}}>
                {a.role==="kitchen"?"👨‍🍳":a.role==="bar"?"🍸":a.role==="cashier"?"💰":"👑"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#e8e0d0"}}>{ACTION_LABELS[a.action]||a.action}</div>
                {a.details&&Object.keys(a.details).length>0&&(
                  <div style={{fontSize:11,color:"#555",marginTop:1}}>
                    {JSON.stringify(a.details).replace(/[{}"]/g,"").replace(/,/g," · ")}
                  </div>
                )}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:11,color:a.role==="kitchen"?"#34D399":a.role==="bar"?"#60A5FA":a.role==="cashier"?GOLD:"#A78BFA",textTransform:"capitalize",fontWeight:600}}>{a.role}</div>
                <div style={{fontSize:10,color:"#444",marginTop:1}}>{fmtTime(a.performed_at)} {fmtDate(a.performed_at)}</div>
              </div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

// ── ADMIN ALERTS TAB ──────────────────────────────────────────────────────────
export function AdminAlerts(){
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    loadAlerts();
    // Realtime
    const ch = supabase.channel("admin-alerts-tab")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"admin_alerts"},payload=>{
        setAlerts(p=>[payload.new,...p]);
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  const loadAlerts = async()=>{
    setLoading(true);
    const {data} = await supabase.from("admin_alerts").select("*").order("created_at",{ascending:false}).limit(100);
    setAlerts(data||[]);
    setLoading(false);
  };

  const markRead = async(id)=>{
    await supabase.from("admin_alerts").update({read:true}).eq("id",id);
    setAlerts(p=>p.map(a=>a.id===id?{...a,read:true}:a));
  };

  const markAllRead = async()=>{
    await supabase.from("admin_alerts").update({read:true}).eq("read",false);
    setAlerts(p=>p.map(a=>({...a,read:true})));
  };

  const deleteAlert = async(id)=>{
    await supabase.from("admin_alerts").delete().eq("id",id);
    setAlerts(p=>p.filter(a=>a.id!==id));
  };

  const clearAll = async()=>{
    await supabase.from("admin_alerts").delete().neq("id",0);
    setAlerts([]);
  };

  const unreadCount = alerts.filter(a=>!a.read).length;

  const TYPE_STYLE = {
    large_void:   {icon:"💸",color:"#F87171"},
    backed_up:    {icon:"🔥",color:"#F59E0B"},
    unpaid_bill:  {icon:"⏰",color:"#F59E0B"},
    bill_request: {icon:"🧾",color:GOLD},
    void:         {icon:"❌",color:"#F87171"},
  };

  return(
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:1}}>
          ADMIN ALERTS {unreadCount>0&&<span style={{background:"#F87171",color:"#fff",borderRadius:10,padding:"1px 8px",fontSize:10,marginLeft:6,fontWeight:700}}>{unreadCount} NEW</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          {unreadCount>0&&<button onClick={markAllRead} style={{padding:"6px 12px",background:`rgba(201,168,76,0.08)`,border:`1px solid ${GOLD_DIM}`,borderRadius:8,cursor:"pointer",fontSize:12,color:GOLD,fontFamily:"Inter,sans-serif"}}>Mark all read</button>}
          {alerts.length>0&&<button onClick={clearAll} style={{padding:"6px 12px",background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,cursor:"pointer",fontSize:12,color:"#F87171",fontFamily:"Inter,sans-serif"}}>Clear all</button>}
        </div>
      </div>

      {loading?<div style={{textAlign:"center",padding:40,color:"#555"}}>Loading…</div>:
      alerts.length===0?<div style={{textAlign:"center",padding:40,color:"#444",fontSize:14}}>
        <div style={{fontSize:40,marginBottom:10}}>🔔</div>
        No alerts yet
      </div>:
      alerts.map(a=>{
        const style = TYPE_STYLE[a.type]||{icon:"🔔",color:GOLD};
        return(
          <div key={a.id} style={{background:a.read?SURFACE:`${style.color}08`,border:`1px solid ${a.read?BORDER:`${style.color}33`}`,borderRadius:12,padding:"12px 16px",marginBottom:8,display:"flex",gap:12,alignItems:"flex-start",transition:"all .2s"}}>
            <span style={{fontSize:22,flexShrink:0}}>{style.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:a.read?400:600,color:a.read?"#888":"#e8e0d0"}}>{a.title}</div>
              <div style={{fontSize:12,color:"#555",marginTop:2,lineHeight:1.5}}>{a.message}</div>
              <div style={{fontSize:10,color:"#333",marginTop:4}}>{fmtTime(a.created_at)} · {fmtDate(a.created_at)}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {!a.read&&<button onClick={()=>markRead(a.id)} style={{padding:"4px 10px",background:`${style.color}15`,border:`1px solid ${style.color}44`,borderRadius:6,cursor:"pointer",fontSize:11,color:style.color,fontFamily:"Inter,sans-serif"}}>Read</button>}
              <button onClick={()=>deleteAlert(a.id)} style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:16,fontFamily:"Inter,sans-serif",lineHeight:1,padding:"2px 4px"}}>×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

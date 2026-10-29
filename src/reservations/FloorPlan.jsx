// Interactive floor plan for EasyCart Barcade & Lounge (SVG, drawn from the real layout).
// Props:
//   status   { [tableId]: "booked" | "arrived" }   (anything else = available)
//   selected table id or ""
//   onPick(tableId)   called when the guest taps a table
//   capacity { [tableId]: number }, minGuests  -> tables too small for the group are dimmed
import { useEffect, useMemo, useRef, useState } from "react";
import { FLOORS, TABLES, tableReach } from "./floorplanData.js";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_DIM = "#8A6A28";
const LINE = "#3a2f14";
const WALL_FILL = "#0c0b08";
const INK = "#8c7640";

const ST = {
  available: { stroke: "#34D399", fill: "rgba(52,211,153,0.14)", text: "#d9f7ea" },
  booked: { stroke: "#F87171", fill: "rgba(248,113,113,0.30)", text: "#ffd9d9" },
  arrived: { stroke: "#FBBF24", fill: "rgba(251,191,36,0.30)", text: "#fff0c2" },
};

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function Label({ x, y, children, size = 13, rotate = 0, fill = INK, weight = 700, spacing = 2 }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} textAnchor="middle" dominantBaseline="middle"
      letterSpacing={spacing} fontFamily="Inter, sans-serif" transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      style={{ pointerEvents: "none", userSelect: "none" }}>{children}</text>
  );
}

function Stairs({ x, y, r = 50 }) {
  const spokes = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return <line key={i} x1={x + Math.cos(a) * 12} y1={y + Math.sin(a) * 12} x2={x + Math.cos(a) * (r - 3)} y2={y + Math.sin(a) * (r - 3)} stroke={LINE} strokeWidth="2" />;
  });
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={x} cy={y} r={r} fill={WALL_FILL} stroke={GOLD_DIM} strokeWidth="2" />
      {spokes}
      <circle cx={x} cy={y} r="12" fill="none" stroke={GOLD_DIM} strokeWidth="2" />
      <Label x={x} y={y - r - 12} size={11} fill={INK} spacing={3}>STAIRS</Label>
    </g>
  );
}

function Floor1Decor() {
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x="1" y="46" width="913" height="660" rx="6" fill={WALL_FILL} stroke={LINE} strokeWidth="2" />
      <Label x="243" y="24" size={24} fill={GOLD} weight={800} spacing={3}>FIRST FLOOR</Label>
      {/* comfort rooms */}
      <rect x="1" y="46" width="66" height="132" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="67" y="46" width="66" height="132" fill="none" stroke={LINE} strokeWidth="2" />
      <Label x="34" y="112" size={13} rotate={-90}>CR</Label>
      <Label x="100" y="112" size={13} rotate={-90}>CR</Label>
      {/* darts + arcade */}
      <Label x="187" y="57" size={12} spacing={3}>DARTS</Label>
      <rect x="133" y="73" width="36" height="86" rx="4" fill="none" stroke={LINE} strokeWidth="2" />
      <Label x="152" y="116" size={11} rotate={-90} spacing={3}>ARCADE</Label>
      {/* billiard */}
      <rect x="294" y="85" width="218" height="123" rx="10" fill="#3a0f14" stroke={GOLD_DIM} strokeWidth="3" />
      <rect x="306" y="97" width="194" height="99" rx="6" fill="#5a1620" />
      <Label x="403" y="146" size={13} fill="#e8c6a0" spacing={2}>BILLIARD TABLE</Label>
      {/* bar counter */}
      <rect x="572" y="46" width="234" height="108" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="611" y="63" width="154" height="55" fill="none" stroke={LINE} strokeWidth="2" />
      <Label x="688" y="90" size={12} spacing={3}>BAR COUNTER</Label>
      <rect x="892" y="64" width="22" height="66" fill="none" stroke={LINE} strokeWidth="2" />
      {/* exit / stage / dj / tech */}
      <rect x="1" y="220" width="18" height="74" fill="#0f2a1a" stroke="#1f6b45" strokeWidth="2" />
      <Label x="10" y="257" size={11} rotate={-90} fill="#34D399" spacing={3}>EXIT</Label>
      <rect x="1" y="319" width="132" height="307" fill="none" stroke={LINE} strokeWidth="2" />
      <Label x="67" y="358" size={12} spacing={3}>STAGE</Label>
      <path d="M53 438 H92 A26 38 0 0 1 92 513 H53 Z" fill="none" stroke={LINE} strokeWidth="2" />
      <Label x="76" y="476" size={12} spacing={2}>DJ</Label>
      <rect x="1" y="626" width="132" height="80" fill="none" stroke={LINE} strokeWidth="2" />
      <Label x="67" y="666" size={11} spacing={3}>TECH BOOTH</Label>
      <Label x="195" y="478" size={13} rotate={-90} spacing={5}>DANCE FLOOR</Label>
      {/* entrance */}
      <rect x="885" y="453" width="29" height="97" fill="#3a1010" stroke="#B91C1C" strokeWidth="2" />
      <Label x="899" y="501" size={11} rotate={-90} fill="#F87171" spacing={3}>ENTRANCE</Label>
      <Stairs x={673} y={640} />
    </g>
  );
}

function Floor2Decor() {
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x="955" y="46" width="395" height="660" rx="6" fill={WALL_FILL} stroke={LINE} strokeWidth="2" />
      <Label x="1152" y="24" size={24} fill={GOLD} weight={800} spacing={3}>SECOND FLOOR</Label>
      <circle cx="997" cy="283" r="29" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="1336" y="256" width="14" height="37" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="955" y="321" width="189" height="385" fill="none" stroke={LINE} strokeWidth="2" />
      <Stairs x={1061} y={640} />
      {/* VIP sofas */}
      {[[323, "#2F6FEB"], [449, "#E11D63"], [586, "#7DD3E0"]].map(([y, c]) => (
        <g key={y}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={1280 + i * 24} y={y} width="22" height="85" rx="3" fill={c} fillOpacity="0.55" stroke={c} strokeOpacity="0.9" strokeWidth="1.5" />
          ))}
        </g>
      ))}
    </g>
  );
}

function TableShape({ t, state, selected, dim }) {
  const s = ST[state];
  const reach = tableReach(t);
  const common = { fill: s.fill, stroke: s.stroke, strokeWidth: selected ? 4 : 2.5 };
  const label = t.label || t.id;
  const fs = t.kind === "room" ? 17 : t.kind === "vip" ? 12 : t.kind === "circ" ? Math.round(t.r * 0.62) : 15;
  const dx = t.kind === "circ" || t.kind === "vip" ? t.r * 0.72 : (t.w || 0) / 2 - 4;
  const dy = t.kind === "circ" || t.kind === "vip" ? -t.r * 0.72 : -(t.h || 0) / 2 + 4;
  return (
    <g opacity={dim ? 0.32 : 1} style={{ transition: "opacity .15s" }}>
      {selected && <circle cx={t.x} cy={t.y} r={reach + 10} fill="none" stroke={GOLD_LIGHT} strokeWidth="3" strokeDasharray="7 5" opacity="0.95" />}
      {t.kind === "circ" && <circle cx={t.x} cy={t.y} r={t.r} {...common} />}
      {t.kind === "vip" && (
        <>
          <circle cx={t.x} cy={t.y} r={t.r} {...common} />
          <circle cx={t.x} cy={t.y} r={t.r - 9} fill={t.color} fillOpacity={state === "available" ? 0.55 : 0.18} stroke="none" />
        </>
      )}
      {t.kind === "sq" && (
        <>
          {t.chairs.includes("lr") && (<><rect x={t.x - t.w / 2 - 8} y={t.y - 14} width="6" height="28" rx="2" fill="#4a3b17" /><rect x={t.x + t.w / 2 + 2} y={t.y - 14} width="6" height="28" rx="2" fill="#4a3b17" /></>)}
          {t.chairs.includes("tb") && (<><rect x={t.x - 14} y={t.y - t.h / 2 - 8} width="28" height="6" rx="2" fill="#4a3b17" /><rect x={t.x - 14} y={t.y + t.h / 2 + 2} width="28" height="6" rx="2" fill="#4a3b17" /></>)}
          <rect x={t.x - t.w / 2} y={t.y - t.h / 2} width={t.w} height={t.h} rx="10" {...common} />
        </>
      )}
      {t.kind === "rect" && (
        <>
          <rect x={t.x - t.w / 2 - 12} y={t.y - t.h / 2 - 4} width={t.w + 24} height={t.h + 8} rx="6" fill="none" stroke={LINE} strokeWidth="2" />
          <rect x={t.x - t.w / 2} y={t.y - t.h / 2} width={t.w} height={t.h} rx="10" {...common} />
        </>
      )}
      {t.kind === "room" && <rect x={t.x - t.w / 2} y={t.y - t.h / 2} width={t.w} height={t.h} rx="14" {...common} />}
      <text x={t.x} y={t.y + (t.kind === "room" ? -6 : 1)} fontSize={fs} fontWeight="800" fill={s.text} textAnchor="middle" dominantBaseline="middle"
        fontFamily="Inter, sans-serif" style={{ pointerEvents: "none", userSelect: "none" }}>{label}</text>
      {t.kind === "room" && (
        <text x={t.x} y={t.y + 16} fontSize="11" fill={s.text} fillOpacity="0.8" textAnchor="middle" fontFamily="Inter, sans-serif" style={{ pointerEvents: "none" }}>
          {state === "available" ? "Available" : state === "booked" ? "Reserved" : "Arrived"}
        </text>
      )}
      <circle cx={t.x + dx} cy={t.y + dy} r="5.5" fill={s.stroke} stroke="#080808" strokeWidth="1.5" />
    </g>
  );
}

export default function FloorPlan({ floor, onFloorChange, status = {}, selected = "", onPick, capacity = {}, minGuests = 1 }) {
  const svgRef = useRef(null);
  const fv = FLOORS[floor].vb;
  const [vb, setVb] = useState(fv);
  const drag = useRef(null);
  useEffect(() => { setVb(FLOORS[floor].vb); }, [floor]);

  const zoomed = vb[2] < fv[2] * 0.97;
  const tables = useMemo(() => TABLES.filter((t) => t.floor === floor), [floor]);
  const stateOf = (id) => (status[id] === "booked" ? "booked" : status[id] === "arrived" ? "arrived" : "available");

  function clampVb(x, y, w, h) {
    const [fx, fy, fw, fh] = fv;
    w = clamp(w, 110, fw); h = w * (fh / fw);
    return [clamp(x, fx, fx + fw - w), clamp(y, fy, fy + fh - h), w, h];
  }
  function zoom(factor) {
    const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
    const w = clamp(vb[2] * factor, 110, fv[2]);
    const h = w * (fv[3] / fv[2]);
    setVb(clampVb(cx - w / 2, cy - h / 2, w, h));
  }

  function toPlan(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }
  function hit(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const pad = 14 * (vb[2] / rect.width); // 14 screen pixels of forgiveness around every table
    const p = toPlan(e);
    let best = null, bestScore = Infinity;
    for (const t of tables) {
      let inside, score;
      if (t.kind === "circ" || t.kind === "vip") {
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        inside = d <= t.r + pad; score = d / t.r;
      } else {
        const dx = Math.abs(p.x - t.x), dy = Math.abs(p.y - t.y);
        inside = dx <= t.w / 2 + pad && dy <= t.h / 2 + pad;
        score = Math.hypot(dx / t.w, dy / t.h);
      }
      if (inside && score < bestScore) { best = t; bestScore = score; }
    }
    return best;
  }

  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, vb, moved: false }; };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dxs = e.clientX - d.x, dys = e.clientY - d.y;
    if (Math.abs(dxs) + Math.abs(dys) > 6) d.moved = true;
    if (d.moved && zoomed) {
      const rect = svgRef.current.getBoundingClientRect();
      const k = d.vb[2] / rect.width;
      setVb(clampVb(d.vb[0] - dxs * k, d.vb[1] - dys * k, d.vb[2], d.vb[3]));
    }
  };
  const onUp = (e) => {
    const d = drag.current; drag.current = null;
    if (!d || d.moved) return;
    const t = hit(e);
    if (t && onPick) onPick(t.id);
  };

  const tab = (n) => (
    <button key={n} onClick={() => onFloorChange(n)} type="button"
      style={{ flex: 1, padding: "10px 8px", background: floor === n ? "rgba(201,168,76,0.12)" : "transparent", border: "none",
        borderBottom: `2px solid ${floor === n ? GOLD : "transparent"}`, color: floor === n ? GOLD : "#777", fontSize: 13, fontWeight: 700,
        cursor: "pointer", fontFamily: "Inter, sans-serif", letterSpacing: 0.5 }}>
      {FLOORS[n].label}
    </button>
  );
  const zbtn = (label, fn, aria) => (
    <button type="button" onClick={fn} aria-label={aria}
      style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(15,15,15,0.92)", border: `1px solid ${GOLD_DIM}`, color: GOLD, fontSize: 18, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>{label}</button>
  );

  return (
    <div style={{ border: "1px solid #241E10", borderRadius: 16, overflow: "hidden", background: "#0b0a07" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #241E10", background: "#0F0F0F" }}>{tab(1)}{tab(2)}</div>
      <div style={{ position: "relative" }}>
        <svg ref={svgRef} viewBox={vb.join(" ")} role="img" aria-label={`${FLOORS[floor].label} floor plan`}
          style={{ width: "100%", height: "auto", display: "block", maxHeight: "78vh", touchAction: zoomed ? "none" : "pan-y", cursor: zoomed ? "grab" : "pointer" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }}>
          {floor === 1 ? <Floor1Decor /> : <Floor2Decor />}
          {tables.map((t) => (
            <TableShape key={t.id} t={t} state={stateOf(t.id)} selected={selected === t.id}
              dim={capacity[t.id] != null && capacity[t.id] < minGuests} />
          ))}
        </svg>
        <div style={{ position: "absolute", right: 10, top: 10, display: "grid", gap: 6 }}>
          {zbtn("+", () => zoom(0.7), "Zoom in")}
          {zbtn("−", () => zoom(1 / 0.7), "Zoom out")}
          {zoomed && zbtn("⤢", () => setVb(fv), "Show whole floor")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "10px 14px", borderTop: "1px solid #241E10", background: "#0F0F0F", fontSize: 12, color: "#999" }}>
        {[["available", "Available"], ["booked", "Reserved"], ["arrived", "Arrived"]].map(([k, l]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: ST[k].fill, border: `2px solid ${ST[k].stroke}`, display: "inline-block" }} />{l}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "#555" }}>Tap a table</span>
      </div>
    </div>
  );
}

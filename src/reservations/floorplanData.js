// Floor plan geometry (plan units). Measured from the real floor plan.
// One entry per table. The 32 ids match the EZChat table list exactly.
export const FLOORS = {
  1: { label: "First floor", vb: [0, 0, 914, 707] },
  2: { label: "Second floor", vb: [955, 0, 395, 707] },
};

const sq = (id, x, y, s = 58, chairs = "") => ({ id, floor: 1, kind: "sq", x, y, w: s, h: s, chairs });
const ci = (id, x, y, r = 29) => ({ id, floor: 1, kind: "circ", x, y, r });

export const TABLES = [
  ci("F3", 242, 86, 24),
  sq("F2", 277, 280, 60, "lr"), sq("F1", 409, 280, 60, "lr"),
  ci("B7", 558, 281), ci("B6", 666, 281),
  sq("D5", 770, 281, 62, "tb"),
  ci("M1", 877, 282, 26),
  ci("B5", 877, 344), ci("B4", 877, 409),
  sq("R4", 324, 426), sq("R3", 409, 426), sq("C4", 497, 426), sq("C3", 581, 426), sq("D4", 671, 426, 62, "tb"), sq("D3", 770, 426, 62, "tb"),
  sq("R2", 324, 536), sq("R1", 409, 536), sq("C2", 495, 536), sq("C1", 581, 536), sq("D2", 671, 536, 62, "tb"), sq("D1", 770, 536, 62, "tb"),
  { id: "L3", floor: 1, kind: "rect", x: 301, y: 659, w: 68, h: 66 },
  { id: "L2", floor: 1, kind: "rect", x: 431, y: 659, w: 68, h: 66 },
  { id: "L1", floor: 1, kind: "rect", x: 562, y: 659, w: 68, h: 66 },
  ci("B1", 881, 615), ci("B3", 765, 672), ci("B2", 833, 672),
  { id: "KTV ROOM 2", floor: 2, kind: "room", x: 1053, y: 148, w: 196, h: 185, label: "KTV ROOM 2" },
  { id: "KTV ROOM 1", floor: 2, kind: "room", x: 1253, y: 148, w: 178, h: 185, label: "KTV ROOM 1" },
  { id: "SAPPHIRE", floor: 2, kind: "vip", x: 1179, y: 363, r: 42, color: "#2F6FEB", label: "SAPPHIRE" },
  { id: "RUBY", floor: 2, kind: "vip", x: 1179, y: 490, r: 42, color: "#E11D63", label: "RUBY" },
  { id: "DIAMOND", floor: 2, kind: "vip", x: 1179, y: 626, r: 42, color: "#7DD3E0", label: "DIAMOND" },
];

// half-size used to size the tap target
export const tableReach = (t) => (t.kind === "circ" || t.kind === "vip" ? t.r : Math.max(t.w, t.h) / 2);
export const shortLabel = (t) => t.label || t.id;

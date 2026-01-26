export type Vec2 = { x: number; y: number };
export type Disk = { id: string; x: number; y: number; r: number };

export type TangentSegment = {
  type: "tangent";
  from: Vec2;
  to: Vec2;
  disk1: Disk;
  disk2: Disk;
};

export type ArcSegment = {
  type: "arc";
  disk: Disk;
  startAngle: number;
  endAngle: number;
  startPoint: Vec2;
  endPoint: Vec2;
  // Para SVG path flags
  largeArcFlag: 0 | 1;
  sweepFlag: 0 | 1;
};

export type HullSegment = TangentSegment | ArcSegment;

export type DiskHull = {
  hullDisks: Disk[];
  segments: HullSegment[];
  svgPathD: string;
  stats: { disks: number; tangents: number; arcs: number };
};

function cross(o: Vec2, a: Vec2, b: Vec2) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mul(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}



function perpLeft(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

function len(v: Vec2) {
  return Math.hypot(v.x, v.y);
}

function norm(v: Vec2): Vec2 {
  const l = len(v);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

function angleOf(center: Vec2, p: Vec2) {
  return Math.atan2(p.y - center.y, p.x - center.x);
}

// normaliza a [-pi, pi)
function normalizeAngle(a: number) {
  while (a >= Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Andrew monotone chain convex hull ids (orden CCW). [web:382]
 */
// ... (imports and types remain the same, simplified for context)
import type { DiskHull, HullSegment, Disk, Vec2, TangentSegment, ArcSegment } from './diskHull'; // Self-reference for types if needed, or just keep them

// ... (helper functions cross, sub, add, mul, perpLeft, len, norm, angleOf, normalizeAngle remain SAME)

/**
 * Andrew monotone chain convex hull ids (orden CCW).
 */
function convexHullIdsMonotoneChain(disks: Disk[]) {
  const map = new Map<string, Disk>();
  for (const d of disks) map.set(`${d.x},${d.y}`, d);
  const pts = Array.from(map.values());

  if (pts.length <= 1) return pts.map((d) => d.id);

  pts.sort((a, b) => (a.x - b.x) || (a.y - b.y));

  const lower: Disk[] = [];
  for (const p of pts) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2];
      const b = lower[lower.length - 1];
      if (cross({ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: p.x, y: p.y }) <= 0) lower.pop();
      else break;
    }
    lower.push(p);
  }

  const upper: Disk[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2) {
      const a = upper[upper.length - 2];
      const b = upper[upper.length - 1];
      if (cross({ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: p.x, y: p.y }) <= 0) upper.pop();
      else break;
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper).map((d) => d.id);
}

/**
 * Tangente externa “lado izquierdo” para dos círculos de igual radio.
 */
function outerTangentEqualRadiusCCW(d1: Disk, d2: Disk) {
  const c1 = { x: d1.x, y: d1.y };
  const c2 = { x: d2.x, y: d2.y };
  const v = sub(c2, c1);
  const u = norm(v);
  if (len(u) < 1e-12) return null;

  const n = perpLeft(u); // normal izquierda (CCW)
  const p1 = add(c1, mul(n, d1.r));
  const p2 = add(c2, mul(n, d2.r));
  return { p1, p2 };
}

function arcFlagsFromAngles(startAngle: number, endAngle: number) {
  const d = normalizeAngle(endAngle - startAngle);
  const abs = Math.abs(d);

  // Sweep flag 0 for CCW in Cartesian (usually)
  // For SVG paths, A rx ry rot large sweep x y
  // In Cartesian, CCW is positive angle delta.
  // We want to draw CCW.
  const sweepFlag: 0 | 1 = 0;

  // largeArcFlag: 1 si el arco “largo” (> pi)
  // normalizeAngle returns [-pi, pi), if we strictly want positive diff [0, 2pi), adjust
  let diff = endAngle - startAngle;
  while (diff < 0) diff += 2 * Math.PI;
  while (diff >= 2 * Math.PI) diff -= 2 * Math.PI;

  const largeArcFlag: 0 | 1 = diff > Math.PI ? 1 : 0;

  return { sweepFlag, largeArcFlag };
}

/**
 * Convierte segmentos a un path continuo.
 * Asume que los segmentos están ordenados y conectados (endPoint del anterior == from/startPoint del siguiente)
 */
export function hullSegmentsToSvgPath(segments: HullSegment[]) {
  if (segments.length === 0) return "";

  const cmds: string[] = [];

  // Move to start of first segment
  const start = segments[0].type === 'tangent' ? segments[0].from : segments[0].startPoint;
  cmds.push(`M ${start.x} ${start.y}`);

  for (const s of segments) {
    if (s.type === "tangent") {
      cmds.push(`L ${s.to.x} ${s.to.y}`);
    } else {
      const r = s.disk.r;
      cmds.push(`A ${r} ${r} 0 ${s.largeArcFlag} ${s.sweepFlag} ${s.endPoint.x} ${s.endPoint.y}`);
    }
  }

  cmds.push("Z"); // Cerrar path
  return cmds.join(" ");
}

function buildHullSegmentsCCW(hullDisks: Disk[]) {
  const segments: HullSegment[] = [];
  if (hullDisks.length < 2) return segments;

  // 1) Calcular todas las tangentes primero (sin pushear a segments aún)
  const tangents: Array<{ from: Vec2; to: Vec2; disk1: Disk; disk2: Disk }> = [];
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const next = hullDisks[(i + 1) % hullDisks.length];
    const t = outerTangentEqualRadiusCCW(curr, next);

    // Fallback si coinciden: línea centro a centro (no ideal pero evita crash)
    const tan = t ? { from: t.p1, to: t.p2 } : { from: { x: curr.x, y: curr.y }, to: { x: next.x, y: next.y } };
    tangents.push({ ...tan, disk1: curr, disk2: next });
  }

  // 2) Intercalar: Arc -> Tangent -> Arc -> Tangent ...
  // Para cerrar el loop correctamente, empezamos en el disco 0.
  // El "arco" en disco 0 conecta la tangente entrante (desde N-1) con la saliente (hacia 1).

  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const prevTan = tangents[(i - 1 + hullDisks.length) % hullDisks.length];
    const currTan = tangents[i];

    // Arco en curr: entra prevTan.to -> sale currTan.from
    const startPoint = prevTan.to;
    const endPoint = currTan.from;

    const c = { x: curr.x, y: curr.y };
    const startAngle = angleOf(c, startPoint);
    const endAngle = angleOf(c, endPoint);

    const { sweepFlag, largeArcFlag } = arcFlagsFromAngles(startAngle, endAngle);

    segments.push({
      type: "arc",
      disk: curr,
      startAngle,
      endAngle,
      startPoint,
      endPoint,
      sweepFlag,
      largeArcFlag,
    });

    // Tangente curr -> next
    segments.push({
      type: "tangent",
      from: currTan.from,
      to: currTan.to,
      disk1: currTan.disk1,
      disk2: currTan.disk2
    });
  }

  return segments;
}

export function computeDiskHull(disks: Disk[]): DiskHull {
  if (disks.length === 0) {
    return { hullDisks: [], segments: [], svgPathD: "", stats: { disks: 0, tangents: 0, arcs: 0 } };
  }

  // Caso 1 disco: dibujar círculo completo
  if (disks.length === 1) {
    const d = disks[0];
    // Path: Move to (x+r, y), Arc around to close
    const path = `M ${d.x + d.r} ${d.y} A ${d.r} ${d.r} 0 1 0 ${d.x - d.r} ${d.y} A ${d.r} ${d.r} 0 1 0 ${d.x + d.r} ${d.y}`;
    return {
      hullDisks: disks.slice(),
      segments: [],
      svgPathD: path,
      stats: { disks: 1, tangents: 0, arcs: 1 }
    };
  }

  const idToDisk = new Map(disks.map((d) => [d.id, d] as const));
  const hullIds = convexHullIdsMonotoneChain(disks);
  const hullDisks = hullIds.map((id) => idToDisk.get(id)!).filter(Boolean);

  const segments = buildHullSegmentsCCW(hullDisks);
  const svgPathD = hullSegmentsToSvgPath(segments);

  const tangents = segments.filter((s) => s.type === "tangent").length;
  const arcs = segments.filter((s) => s.type === "arc").length;

  return {
    hullDisks,
    segments,
    svgPathD,
    stats: { disks: hullDisks.length, tangents, arcs },
  };
}

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
 * Para un recorrido CCW del hull, queremos el segmento tangente que queda al “exterior”,
 * que corresponde a usar el normal n = left(unit(d)) para el edge i->i+1.
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

/**
 * Para el arco en un disco: elegir el tramo exterior.
 * En CCW, el “exterior” es el que avanza CCW desde startAngle a endAngle (delta positivo),
 * si no, usar el complemento (delta negativo implica barrer CW).
 * En canvas tu amigo decide counterclockwise con normalizeAngle(end-start). [file:421][file:425]
 */
function arcFlagsFromAngles(startAngle: number, endAngle: number) {
  const d = normalizeAngle(endAngle - startAngle);
  const abs = Math.abs(d);

  // En SVG sweepFlag: 1 = "positive-angle direction" (depende del sistema),
  // pero en práctica en SVG con y hacia abajo suele invertirse.
  // Para que se vea bien en tu app, usamos: d >= 0 -> sweepFlag=0 (CCW visual), d < 0 -> 1.
  // Esto evita el sweep fijo que te dejaba arcos por el lado equivocado. [file:421]
  const sweepFlag: 0 | 1 = d >= 0 ? 0 : 1;

  // largeArcFlag: 1 si el arco “largo” (> pi)
  const largeArcFlag: 0 | 1 = abs > Math.PI ? 1 : 0;

  return { sweepFlag, largeArcFlag };
}

/**
 * Convierte segmentos a un path continuo tipo exportHullPath. [file:421]
 */
export function hullSegmentsToSvgPath(segments: HullSegment[]) {
  const cmds: string[] = [];
  let current: Vec2 | null = null;

  for (const s of segments) {
    if (s.type === "tangent") {
      if (
        !current ||
        Math.abs(current.x - s.from.x) > 1e-6 ||
        Math.abs(current.y - s.from.y) > 1e-6
      ) {
        cmds.push(`M ${s.from.x} ${s.from.y}`);
      }
      cmds.push(`L ${s.to.x} ${s.to.y}`);
      current = s.to;
    } else {
      const r = s.disk.r;
      cmds.push(`A ${r} ${r} 0 ${s.largeArcFlag} ${s.sweepFlag} ${s.endPoint.x} ${s.endPoint.y}`);
      current = s.endPoint;
    }
  }

  return cmds.join(" ");
}

function buildHullSegmentsCCW(hullDisks: Disk[]) {
  const segments: HullSegment[] = [];
  if (hullDisks.length < 2) return segments;

  // 1) Tangentes CCW (una por arista)
  const tangents: Array<{ from: Vec2; to: Vec2 }> = [];
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const next = hullDisks[(i + 1) % hullDisks.length];
    const t = outerTangentEqualRadiusCCW(curr, next);
    if (!t) {
      tangents.push({ from: { x: curr.x, y: curr.y }, to: { x: next.x, y: next.y } });
      continue;
    }
    tangents.push({ from: t.p1, to: t.p2 });
    segments.push({ type: "tangent", from: t.p1, to: t.p2, disk1: curr, disk2: next });
  }

  // 2) Arcos: en cada disco i, desde el final de la tangente (i-1)->i hasta el inicio de la tangente i->(i+1)
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const prevIndex = (i - 1 + hullDisks.length) % hullDisks.length;

    const startPoint = tangents[prevIndex].to; // llega al disco curr
    const endPoint = tangents[i].from;         // sale desde curr

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
  }

  return segments;
}

export function computeDiskHull(disks: Disk[]): DiskHull {
  if (disks.length === 0) {
    return { hullDisks: [], segments: [], svgPathD: "", stats: { disks: 0, tangents: 0, arcs: 0 } };
  }
  if (disks.length === 1) {
    return { hullDisks: disks.slice(), segments: [], svgPathD: "", stats: { disks: 1, tangents: 0, arcs: 0 } };
  }

  const idToDisk = new Map(disks.map((d) => [d.id, d] as const));
  const hullIds = convexHullIdsMonotoneChain(disks); // CCW estable [web:382]
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

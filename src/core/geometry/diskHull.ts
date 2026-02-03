
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

/* --- Helpers --- */

function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function mul(a: Vec2, k: number): Vec2 { return { x: a.x * k, y: a.y * k }; }
function len(v: Vec2) { return Math.hypot(v.x, v.y); }
function norm(v: Vec2): Vec2 {
  const l = len(v);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}
function angleOf(center: Vec2, p: Vec2) { return Math.atan2(p.y - center.y, p.x - center.x); }

function perpLeft(v: Vec2): Vec2 { return { x: -v.y, y: v.x }; }

/**
 * Cross Product (2D)
 * Returns (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
 * In Y-down: Cross < 0 is Left Turn (CCW).
 */
function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function distanceSq(a: Vec2, b: Vec2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Jarvis March (Gift Wrapping)
 * Computes Convex Hull of CENTERS.
 * Returns order CCW.
 */
function jarvisMarch(disks: Disk[]): Disk[] {
  if (disks.length <= 2) return disks;

  // 1. Start at Top-Left (Min Y, then Min X)
  let startIdx = 0;
  for (let i = 1; i < disks.length; i++) {
    if (disks[i].y < disks[startIdx].y || (disks[i].y === disks[startIdx].y && disks[i].x < disks[startIdx].x)) {
      startIdx = i;
    }
  }

  const hull: Disk[] = [];
  let currentIdx = startIdx;

  do {
    hull.push(disks[currentIdx]);

    let nextIdx = (currentIdx + 1) % disks.length;

    for (let i = 0; i < disks.length; i++) {
      if (i === currentIdx) continue;

      const c = cross(disks[currentIdx], disks[nextIdx], disks[i]);

      // We want Left (CCW) turns.
      // In Y-Up (Cartesian): Cross > 0 is Left Turn.
      // In Y-Down (Screen): Cross < 0 is Left Turn.
      // The system uses Y-Up (Cartesian) for logic.
      const isLeft = c > 0; // FIXED for Y-Up CCW
      const isCollinear = c === 0;
      const isFurthestVar = distanceSq(disks[currentIdx], disks[i]) > distanceSq(disks[currentIdx], disks[nextIdx]);

      if (nextIdx === currentIdx || isLeft || (isCollinear && isFurthestVar)) {
        nextIdx = i;
      }
    }

    currentIdx = nextIdx;
    if (hull.length > disks.length + 1) break; // Safety
  } while (currentIdx !== startIdx);

  return hull;
}

/**
 * Tangente externa del lado IZQUIERDO (CCW / Exterior).
 */
function outerTangentEqualRadiusCCW(d1: Disk, d2: Disk) {
  const c1 = { x: d1.x, y: d1.y };
  const c2 = { x: d2.x, y: d2.y };

  if (Math.abs(c1.x - c2.x) < 1e-5 && Math.abs(c1.y - c2.y) < 1e-5) return null;

  const v = sub(c2, c1);
  const u = norm(v);
  const n = perpLeft(u); // Normal izquierda

  const p1 = add(c1, mul(n, d1.r));
  const p2 = add(c2, mul(n, d2.r));

  return { p1, p2, dir: u };
}

function arcFlagsFromAngles(startAngle: number, endAngle: number) {
  // We traverse CCW around the hull.
  // The Arc connects Tangent_In to Tangent_Out.
  // Since the hull is Convex CCW, the turn angle is always Convex (< 180).
  // In Y-down CCW sweep, we want 'sweepFlag = 0'.
  // And 'largeArcFlag = 0' (Short arc).
  // Calculating diff to be safe:
  let diff = endAngle - startAngle;
  // Normalize to positive CCW angle [0, 2PI)
  while (diff < 0) diff += 2 * Math.PI;
  while (diff >= 2 * Math.PI) diff -= 2 * Math.PI;

  // Convex Hull Vertex Logic:
  // For a set of Disks (N >= 2), the bounding arc at any vertex must be <= 180 degrees.
  // We should never draw a reflex (> 180) arc.
  // If 'diff' (CCW angle) is > PI, it implies the points are inverted due to noise (e.g. 359.9 deg).
  // In that case, the "Shortest Path" is CW (0.1 deg).
  // We ALWAYS pick the shortest path.

  const largeArcFlag = 0;
  const sweepFlag = (diff <= Math.PI) ? 1 : 0; // 1=CCW, 0=CW

  return { sweepFlag, largeArcFlag };
}

function buildHullSegmentsCCW(hullDisks: Disk[]) {
  const segments: HullSegment[] = [];
  if (hullDisks.length < 2) return segments;

  // Tangents
  const tangents: Array<{ from: Vec2; to: Vec2; disk1: Disk; disk2: Disk }> = [];
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const next = hullDisks[(i + 1) % hullDisks.length];
    const t = outerTangentEqualRadiusCCW(curr, next);
    const tan = t ? { from: t.p1, to: t.p2 } : { from: { x: curr.x, y: curr.y }, to: { x: next.x, y: next.y } };
    tangents.push({ ...tan, disk1: curr, disk2: next });
  }

  // Interleave Arcs and Tangents
  for (let i = 0; i < hullDisks.length; i++) {
    const curr = hullDisks[i];
    const prevTan = tangents[(i - 1 + hullDisks.length) % hullDisks.length];
    const currTan = tangents[i];

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

const fmt = (n: number) => n.toFixed(3);

export function hullSegmentsToSvgPath(segments: HullSegment[]) {
  if (segments.length === 0) return "";
  const start = segments[0].type === 'tangent' ? segments[0].from : segments[0].startPoint;
  const cmds: string[] = [`M ${fmt(start.x)} ${fmt(start.y)}`];
  for (const s of segments) {
    if (s.type === "tangent") {
      cmds.push(`L ${fmt(s.to.x)} ${fmt(s.to.y)}`);
    } else {
      const r = s.disk.r;
      cmds.push(`A ${fmt(r)} ${fmt(r)} 0 0 ${s.sweepFlag} ${fmt(s.endPoint.x)} ${fmt(s.endPoint.y)}`);
    }
  }
  cmds.push("Z");
  return cmds.join(" ");
}

export function computeDiskHull(disks: Disk[]): DiskHull {
  if (disks.length === 0) return { hullDisks: [], segments: [], svgPathD: "", stats: { disks: 0, tangents: 0, arcs: 0 } };

  if (disks.length === 1) {
    const d = disks[0];
    const path = `M ${d.x + d.r} ${d.y} A ${d.r} ${d.r} 0 1 0 ${d.x - d.r} ${d.y} A ${d.r} ${d.r} 0 1 0 ${d.x + d.r} ${d.y}`;
    return { hullDisks: disks.slice(), segments: [], svgPathD: path, stats: { disks: 1, tangents: 0, arcs: 1 } };
  }

  // 1. Jarvis March (CCW of Centers)
  const hullDisks = jarvisMarch(disks);

  // 2. Build Belt Segments (CCW)
  const segments = buildHullSegmentsCCW(hullDisks);
  const svgPathD = hullSegmentsToSvgPath(segments);

  return {
    hullDisks,
    segments,
    svgPathD,
    stats: {
      disks: hullDisks.length,
      tangents: segments.filter(s => s.type === 'tangent').length,
      arcs: segments.filter(s => s.type === 'arc').length
    },
  };
}

export function computeFromOrderedHull(hullDisks: Disk[]): DiskHull {
  const segments = buildHullSegmentsCCW(hullDisks);
  const svgPathD = hullSegmentsToSvgPath(segments);
  return {
    hullDisks,
    segments,
    svgPathD,
    stats: { disks: hullDisks.length, tangents: segments.filter(s => s.type === 'tangent').length, arcs: segments.filter(s => s.type === 'arc').length }
  }
}

export function computeHullLength(hull: DiskHull): number {
  let totalLength = 0;
  for (const seg of hull.segments) {
    if (seg.type === 'tangent') {
      const dx = seg.to.x - seg.from.x;
      const dy = seg.to.y - seg.from.y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    } else {
      // Arc length = r * theta
      // theta is absolute diff of angles ... need to be careful with direction?
      // Hull is CCW.
      let diff = seg.endAngle - seg.startAngle;
      while (diff < 0) diff += 2 * Math.PI;
      // buildHullSegmentsCCW logic ensures positive diff corresponds to the arc being drawn (short way?)
      // Actually buildHullSegmentsCCW logic:
      // "If CW Diff > 180, then CCW Diff < 180" -> implies we take the smaller angle?
      // Wait, convex hull arcs are always <= 180 (convex).
      // So normalizing to [0, 2PI) should give the correct positive angle if we assume CCW traversal blocks.

      totalLength += seg.disk.r * diff;
    }
  }
  return totalLength;
}

export type HullMetrics = {
  totalLength: number;
  tangentLength: number;
  arcLength: number;
};

export function computeHullMetrics(hull: DiskHull): HullMetrics {
  let tangentLength = 0;
  let arcLength = 0;

  for (const seg of hull.segments) {
    if (seg.type === 'tangent') {
      const dx = seg.to.x - seg.from.x;
      const dy = seg.to.y - seg.from.y;
      tangentLength += Math.sqrt(dx * dx + dy * dy);
    } else {
      let diff = seg.endAngle - seg.startAngle;
      while (diff < 0) diff += 2 * Math.PI;
      arcLength += seg.disk.r * diff;
    }
  }

  return {
    totalLength: tangentLength + arcLength,
    tangentLength,
    arcLength
  };
}

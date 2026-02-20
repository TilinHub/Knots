/**
 * outerFace.ts — Outer Contour of Disk Union
 *
 * Computes the boundary of the union of disks as a sequence of
 * EnvelopeSegments (arcs + tangent lines). Guarantees:
 *   - Simple closed curve (no self-intersections)
 *   - Entirely outside all disk interiors
 *   - Deterministic (stable angular sorting)
 *
 * Algorithm:
 *   For overlapping disks: compute exposed arcs per disk, chain via intersection pts.
 *   For non-overlapping disks: use convex hull with outer tangents (à la diskHull.ts).
 *   Mixed: union of overlapping clusters + convex hull of cluster blobs.
 *
 * SCOPE: Envelope display only. Does NOT affect knot-mode, load/save, Dubins.
 */

import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import type { ArcSegment, EnvelopeSegment, TangentSegment } from './contactGraph';

// ── Helpers ──────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const EPS = 1e-9;

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeAngle(a: number): number {
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

/**
 * Compute the two intersection points of two overlapping circles.
 * Returns null if circles don't overlap or are coincident.
 */
function circleCircleIntersections(
  c1: Point2D,
  r1: number,
  c2: Point2D,
  r2: number,
): [Point2D, Point2D] | null {
  const d = dist(c1, c2);
  if (d < EPS) return null; // coincident centers
  if (d > r1 + r2 + EPS) return null; // too far apart
  if (d < Math.abs(r1 - r2) - EPS) return null; // one inside the other

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  if (hSq < 0) return null;
  const h = Math.sqrt(Math.max(0, hSq));

  const px = c1.x + (a * (c2.x - c1.x)) / d;
  const py = c1.y + (a * (c2.y - c1.y)) / d;
  const ox = (h * (c2.y - c1.y)) / d;
  const oy = (h * (c2.x - c1.x)) / d;

  return [
    { x: px + ox, y: py - oy },
    { x: px - ox, y: py + oy },
  ];
}

/**
 * Check if a point is strictly inside any disk (other than the one at `skipIdx`).
 */
function isInsideAnyDisk(
  p: Point2D,
  disks: ContactDisk[],
  skipIdx: number,
  tolerance: number = 1e-6,
): boolean {
  for (let j = 0; j < disks.length; j++) {
    if (j === skipIdx) continue;
    if (dist(p, disks[j].center) < disks[j].radius - tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Check if the midpoint of an arc (on disk `diskIdx`) from angle `a` to `b` (CCW)
 * is inside any other disk.
 */
function isArcCoveredByOtherDisk(
  disks: ContactDisk[],
  diskIdx: number,
  aStart: number,
  aEnd: number,
): boolean {
  // Midpoint of the CCW arc from aStart to aEnd
  let delta = aEnd - aStart;
  while (delta <= 0) delta += TWO_PI;
  const midAngle = aStart + delta / 2;

  const d = disks[diskIdx];
  const mid: Point2D = {
    x: d.center.x + d.radius * Math.cos(midAngle),
    y: d.center.y + d.radius * Math.sin(midAngle),
  };

  return isInsideAnyDisk(mid, disks, diskIdx, 1e-4);
}

// ── Exposed Arc Computation ─────────────────────────────────────

interface ExposedArc {
  diskIdx: number;
  startAngle: number; // CCW start
  endAngle: number; // CCW end
  startPt: Point2D;
  endPt: Point2D;
}

/**
 * For a given disk, compute all angular intervals that are NOT covered
 * by any other disk. Each such interval is an "exposed arc" on the boundary.
 */
function computeExposedArcs(disks: ContactDisk[], diskIdx: number): ExposedArc[] {
  const d = disks[diskIdx];
  const c = d.center;
  const r = d.radius;

  // Collect all intersection angles with other disks
  const cuts: number[] = [];

  for (let j = 0; j < disks.length; j++) {
    if (j === diskIdx) continue;
    const pts = circleCircleIntersections(c, r, disks[j].center, disks[j].radius);
    if (!pts) continue;
    for (const pt of pts) {
      cuts.push(normalizeAngle(Math.atan2(pt.y - c.y, pt.x - c.x)));
    }
  }

  // No intersections: disk is isolated
  if (cuts.length === 0) {
    // Check if fully inside another disk
    const testPt: Point2D = { x: c.x + r, y: c.y };
    if (isInsideAnyDisk(testPt, disks, diskIdx)) {
      return []; // entirely covered
    }
    // Full circle is exposed
    return [
      {
        diskIdx,
        startAngle: 0,
        endAngle: TWO_PI,
        startPt: { x: c.x + r, y: c.y },
        endPt: { x: c.x + r, y: c.y },
      },
    ];
  }

  // Sort angles
  cuts.sort((a, b) => a - b);

  // Remove duplicates (within tolerance)
  const unique: number[] = [cuts[0]];
  for (let i = 1; i < cuts.length; i++) {
    if (Math.abs(cuts[i] - unique[unique.length - 1]) > 1e-8) {
      unique.push(cuts[i]);
    }
  }

  // Check each interval between consecutive cut angles
  const arcs: ExposedArc[] = [];
  for (let i = 0; i < unique.length; i++) {
    const aStart = unique[i];
    const aEnd = unique[(i + 1) % unique.length];

    // Check if the midpoint of this arc is exposed (not inside any other disk)
    if (!isArcCoveredByOtherDisk(disks, diskIdx, aStart, aEnd)) {
      arcs.push({
        diskIdx,
        startAngle: aStart,
        endAngle: aEnd,
        startPt: { x: c.x + r * Math.cos(aStart), y: c.y + r * Math.sin(aStart) },
        endPt: { x: c.x + r * Math.cos(aEnd), y: c.y + r * Math.sin(aEnd) },
      });
    }
  }

  return arcs;
}

// ── Contour Assembly ────────────────────────────────────────────

/**
 * Key for a point (quantized to avoid floating-point mismatches).
 */
function ptKey(p: Point2D): string {
  return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
}

/**
 * Build the outer contour by chaining exposed arcs.
 *
 * At each intersection point between two disks, an exposed arc on disk A
 * ends and an exposed arc on disk B begins (or vice versa). We walk the
 * chain of arcs to form the outer boundary.
 */
function chainExposedArcs(allArcs: ExposedArc[], disks: ContactDisk[]): ExposedArc[][] {
  if (allArcs.length === 0) return [];

  // Build adjacency: endPt of arc -> next arc starting at that point
  const startMap = new Map<string, ExposedArc[]>();
  for (const arc of allArcs) {
    const key = ptKey(arc.startPt);
    if (!startMap.has(key)) startMap.set(key, []);
    startMap.get(key)!.push(arc);
  }

  const used = new Set<number>(); // index into allArcs
  const chains: ExposedArc[][] = [];

  for (let startIdx = 0; startIdx < allArcs.length; startIdx++) {
    if (used.has(startIdx)) continue;

    const chain: ExposedArc[] = [];
    let currentArc = allArcs[startIdx];
    let currentIdx = startIdx;

    while (!used.has(currentIdx)) {
      used.add(currentIdx);
      chain.push(currentArc);

      // Find next arc starting where this one ends
      const endKey = ptKey(currentArc.endPt);
      const candidates = startMap.get(endKey);
      if (!candidates) break;

      // Pick the candidate that is NOT on the same disk (prefer different disk)
      // If all on same disk, pick first unused
      let nextArc: ExposedArc | null = null;
      let nextIdx = -1;

      for (const cand of candidates) {
        const cidx = allArcs.indexOf(cand);
        if (used.has(cidx)) continue;

        // Prefer arc on a DIFFERENT disk (this is the outer-face turn rule)
        if (cand.diskIdx !== currentArc.diskIdx) {
          nextArc = cand;
          nextIdx = cidx;
          break;
        }
      }

      // If no different-disk candidate, try same disk
      if (!nextArc) {
        for (const cand of candidates) {
          const cidx = allArcs.indexOf(cand);
          if (used.has(cidx)) continue;
          nextArc = cand;
          nextIdx = cidx;
          break;
        }
      }

      if (!nextArc || nextIdx < 0) break;
      currentArc = nextArc;
      currentIdx = nextIdx;
    }

    if (chain.length > 0) chains.push(chain);
  }

  return chains;
}

// ── Convex Hull Fallback for Non-Overlapping Disks ──────────────

function convexHullContour(disks: ContactDisk[]): EnvelopeSegment[] {
  if (disks.length === 0) return [];
  if (disks.length === 1) {
    const d = disks[0];
    return [
      {
        type: 'ARC',
        center: d.center,
        radius: d.radius,
        startAngle: 0,
        endAngle: TWO_PI - 0.001, // nearly full circle
        chirality: 'L',
        length: TWO_PI * d.radius,
        diskId: d.id,
      },
    ];
  }

  // Jarvis march on centers
  const hullIndices = jarvisMarchIndices(disks);
  if (hullIndices.length < 2) return [];

  const segments: EnvelopeSegment[] = [];
  const n = hullIndices.length;

  // Compute outer tangents between consecutive hull disks
  const tangents: { from: Point2D; to: Point2D }[] = [];
  for (let i = 0; i < n; i++) {
    const d1 = disks[hullIndices[i]];
    const d2 = disks[hullIndices[(i + 1) % n]];
    const t = outerTangentCCW(d1, d2);
    tangents.push(t);
  }

  // Interleave arcs and tangents
  for (let i = 0; i < n; i++) {
    const d = disks[hullIndices[i]];
    const prevTangent = tangents[(i - 1 + n) % n];
    const currTangent = tangents[i];

    const arrivalAngle = Math.atan2(prevTangent.to.y - d.center.y, prevTangent.to.x - d.center.x);
    const departAngle = Math.atan2(
      currTangent.from.y - d.center.y,
      currTangent.from.x - d.center.x,
    );

    // CCW arc from arrival to departure (short arc for convex hull)
    let arcDelta = departAngle - arrivalAngle;
    while (arcDelta < 0) arcDelta += TWO_PI;
    // For convex hull, arc should be < PI; if > PI, use the other direction
    const chirality: 'L' | 'R' = arcDelta <= Math.PI ? 'L' : 'R';
    const arcLen = chirality === 'L' ? arcDelta * d.radius : (TWO_PI - arcDelta) * d.radius;

    if (arcLen > 1e-4) {
      segments.push({
        type: 'ARC',
        center: d.center,
        radius: d.radius,
        startAngle: arrivalAngle,
        endAngle: departAngle,
        chirality,
        length: arcLen,
        diskId: d.id,
      } as ArcSegment);
    }

    // Tangent segment
    const tLen = dist(currTangent.from, currTangent.to);
    if (tLen > 1e-4) {
      segments.push({
        type: 'LSL', // outer tangent type identifier
        start: currTangent.from,
        end: currTangent.to,
        length: tLen,
        startDiskId: d.id,
        endDiskId: disks[hullIndices[(i + 1) % n]].id,
      } as TangentSegment);
    }
  }

  return segments;
}

function jarvisMarchIndices(disks: ContactDisk[]): number[] {
  if (disks.length <= 1) return disks.map((_, i) => i);

  // Start at topmost (min-y in screen, but we're in Cartesian, so min-y)
  let startIdx = 0;
  for (let i = 1; i < disks.length; i++) {
    if (
      disks[i].center.y < disks[startIdx].center.y ||
      (disks[i].center.y === disks[startIdx].center.y &&
        disks[i].center.x < disks[startIdx].center.x)
    ) {
      startIdx = i;
    }
  }

  const hull: number[] = [];
  let current = startIdx;

  do {
    hull.push(current);
    let next = (current + 1) % disks.length;

    for (let i = 0; i < disks.length; i++) {
      if (i === current) continue;
      const cross = crossProduct(disks[current].center, disks[next].center, disks[i].center);
      const isFurther =
        dist(disks[current].center, disks[i].center) >
        dist(disks[current].center, disks[next].center);
      if (next === current || cross > 0 || (Math.abs(cross) < EPS && isFurther)) {
        next = i;
      }
    }

    current = next;
    if (hull.length > disks.length + 1) break;
  } while (current !== startIdx);

  return hull;
}

function crossProduct(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function outerTangentCCW(d1: ContactDisk, d2: ContactDisk): { from: Point2D; to: Point2D } {
  const dx = d2.center.x - d1.center.x;
  const dy = d2.center.y - d1.center.y;
  const D = Math.hypot(dx, dy);
  if (D < EPS) return { from: d1.center, to: d2.center };

  const ux = dx / D,
    uy = dy / D;
  // Left normal
  const nx = -uy,
    ny = ux;

  return {
    from: { x: d1.center.x + nx * d1.radius, y: d1.center.y + ny * d1.radius },
    to: { x: d2.center.x + nx * d2.radius, y: d2.center.y + ny * d2.radius },
  };
}

// ── Main Public API ─────────────────────────────────────────────

import { computeRobustConvexHull } from './robustHull';

// Flag to toggle the new robust envelope algorithm
export const USE_NEW_ENVELOPE = false;

/**
 * Compute the outer contour of a set of disks.
 * Returns an array of EnvelopeSegments compatible with ContactPathRenderer.
 *
 * Strategy:
 *   1. Check if any disks overlap. If none overlap, use convex hull.
 *   2. If disks overlap, compute exposed arcs and chain them.
 *   3. Select the largest chain as the outer contour.
 */
export function computeOuterContour(disks: ContactDisk[]): EnvelopeSegment[] {
  if (USE_NEW_ENVELOPE) {
    // Option A: Robust Convex Hull of Disks
    // Guarantees no self-intersection and no interior penetration.
    // Acts as an elastic band around the entire set of disks.
    const csDisks = disks.map(
      (d) =>
        ({
          id: d.id,
          center: d.center,
          visualRadius: d.radius,
          kind: 'disk',
        }) as any,
    ); // Cast to CSDisk

    const res = computeRobustConvexHull(csDisks);
    if (res.ok) return res.path;
    return res.fallbackPath || [];
  }

  // --- Legacy Algorithm (fallback) ---

  if (disks.length === 0) return [];
  if (disks.length === 1) {
    return convexHullContour(disks);
  }

  // Check for any overlaps
  let hasOverlap = false;
  for (let i = 0; i < disks.length && !hasOverlap; i++) {
    for (let j = i + 1; j < disks.length; j++) {
      if (dist(disks[i].center, disks[j].center) < disks[i].radius + disks[j].radius - EPS) {
        hasOverlap = true;
        break;
      }
    }
  }

  // No overlaps: use convex hull with outer tangents
  if (!hasOverlap) {
    return convexHullContour(disks);
  }

  // Compute exposed arcs for all disks
  const allArcs: ExposedArc[] = [];
  for (let i = 0; i < disks.length; i++) {
    const exposed = computeExposedArcs(disks, i);
    allArcs.push(...exposed);
  }

  if (allArcs.length === 0) {
    // All disks fully contained in one — find the largest
    let largest = 0;
    for (let i = 1; i < disks.length; i++) {
      if (disks[i].radius > disks[largest].radius) largest = i;
    }
    return convexHullContour([disks[largest]]);
  }

  // Chain exposed arcs into contour cycles
  const chains = chainExposedArcs(allArcs, disks);
  if (chains.length === 0) return convexHullContour(disks);

  // Select the largest chain (outer contour has the most arcs)
  let bestChain = chains[0];
  for (const chain of chains) {
    if (chain.length > bestChain.length) bestChain = chain;
  }

  // Convert ExposedArc[] to EnvelopeSegment[]
  return bestChain.map((arc) => {
    const d = disks[arc.diskIdx];
    let delta = arc.endAngle - arc.startAngle;
    while (delta <= 0) delta += TWO_PI;
    // Exposed arcs always go CCW (counterclockwise)
    const chirality: 'L' | 'R' = 'L';
    return {
      type: 'ARC',
      center: d.center,
      radius: d.radius,
      startAngle: arc.startAngle,
      endAngle: arc.endAngle,
      chirality,
      length: delta * d.radius,
      diskId: d.id,
    } as ArcSegment;
  });
}

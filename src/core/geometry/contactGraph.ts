import { Logger } from '../../core/utils/Logger';
import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';

export type TangentType = 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'PTD-L' | 'PTD-R' | 'DTP-L' | 'DTP-R';

export interface TangentSegment {
  type: TangentType;
  start: Point2D;
  end: Point2D;
  length: number;
  startDiskId: string;
  endDiskId: string;
}

export interface BoundedCurvatureGraph {
  nodes: Map<string, ContactDisk>;
  edges: TangentSegment[]; // All valid spatial edges
}

/**
 * Calculates the 4 bitangent segments between two disks.
 * Does NOT check for collisions with other disks.
 */
export function calculateBitangents(d1: ContactDisk, d2: ContactDisk): TangentSegment[] {
  const segments: TangentSegment[] = [];
  const dx = d2.center.x - d1.center.x;
  const dy = d2.center.y - d1.center.y;
  const D = Math.sqrt(dx * dx + dy * dy);
  const phi = Math.atan2(dy, dx);

  if (D < 1e-9) return []; // Coincident centers

  // Helper to get point on circle
  const pOnC = (c: Point2D, r: number, angle: number): Point2D => ({
    x: c.x + r * Math.cos(angle),
    y: c.y + r * Math.sin(angle),
  });

  const EPSILON = 1e-4;

  // 1. Outer Tangents (LSL, RSR)
  if (D >= Math.abs(d1.radius - d2.radius) - EPSILON) {
    const val = (d1.radius - d2.radius) / D;
    const clampedVal = Math.max(-1, Math.min(1, val));
    const gamma = Math.acos(clampedVal);

    if (!isNaN(gamma)) {
      // RSR: Top Tangent (alpha = phi + gamma)
      const alphaRSR = phi + gamma;
      const p1RSR = pOnC(d1.center, d1.radius, alphaRSR);
      const p2RSR = pOnC(d2.center, d2.radius, alphaRSR);
      segments.push({
        type: 'RSR',
        start: p1RSR,
        end: p2RSR,
        length: Math.sqrt((p2RSR.x - p1RSR.x) ** 2 + (p2RSR.y - p1RSR.y) ** 2),
        startDiskId: d1.id,
        endDiskId: d2.id,
      });

      // LSL: Bottom Tangent (alpha = phi - gamma)
      const alphaLSL = phi - gamma;
      const p1LSL = pOnC(d1.center, d1.radius, alphaLSL);
      const p2LSL = pOnC(d2.center, d2.radius, alphaLSL);
      segments.push({
        type: 'LSL',
        start: p1LSL,
        end: p2LSL,
        length: Math.sqrt((p2LSL.x - p1LSL.x) ** 2 + (p2LSL.y - p1LSL.y) ** 2),
        startDiskId: d1.id,
        endDiskId: d2.id,
      });
    }
  }

  // 2. Inner Tangents (LSR, RSL)
  // [FIX] Relaxed check to allow inner tangents even if disks overlap slightly.
  if (D > 1e-9) {
    const val = (d1.radius + d2.radius) / D;
    const clampedVal = Math.max(-1, Math.min(1, val));
    const beta = Math.acos(clampedVal); // Safe acos

    if (!isNaN(beta)) {
      // LSR (Bottom Start -> Top End)
      const alpha1LSR = phi - beta;
      const alpha2LSR = phi - beta + Math.PI;
      const p1LSR = pOnC(d1.center, d1.radius, alpha1LSR);
      const p2LSR = pOnC(d2.center, d2.radius, alpha2LSR);
      segments.push({
        type: 'LSR',
        start: p1LSR,
        end: p2LSR,
        length: Math.sqrt((p2LSR.x - p1LSR.x) ** 2 + (p2LSR.y - p1LSR.y) ** 2),
        startDiskId: d1.id,
        endDiskId: d2.id,
      });

      // RSL (Top Start -> Bottom End)
      const alpha1RSL = phi + beta;
      const alpha2RSL = phi + beta + Math.PI;
      const p1RSL = pOnC(d1.center, d1.radius, alpha1RSL);
      const p2RSL = pOnC(d2.center, d2.radius, alpha2RSL);
      segments.push({
        type: 'RSL',
        start: p1RSL,
        end: p2RSL,
        length: Math.sqrt((p2RSL.x - p1RSL.x) ** 2 + (p2RSL.y - p1RSL.y) ** 2),
        startDiskId: d1.id,
        endDiskId: d2.id,
      });
    }
  }

  return segments;
}

/**
 * Checks if a line segment intersects a disk (strictly interior).
 * Hybrid approach:
 *   1. Quadratic formula: detects boundary crossings (line enters/exits disk)
 *   2. Midpoint check: detects segments fully inside or chord-like paths
 */
export function intersectsDisk(p1: Point2D, p2: Point2D, disk: ContactDisk): boolean {
  const cx = disk.center.x;
  const cy = disk.center.y;
  const r = disk.radius;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - cx;
  const fy = p1.y - cy;

  const a = dx * dx + dy * dy;

  if (a < 1e-9) {
    // Zero-length segment: check if point is inside disk
    return fx * fx + fy * fy < (r * 0.95) ** 2;
  }

  // --- Method 1: Quadratic (Boundary Crossing) ---
  const bCoeff = 2 * (fx * dx + fy * dy);
  const cCoeff = fx * fx + fy * fy - r * r;
  const discriminant = bCoeff * bCoeff - 4 * a * cCoeff;

  if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-bCoeff - sqrtD) / (2 * a);
    const t2 = (-bCoeff + sqrtD) / (2 * a);

    // [FIX] Allow grazing (shallow intersections)
    // If the chord length is very small, we treat it as a touch/graze, not a collision.
    // Chord length in parametric space: dt = t2 - t1 = sqrtD/a (roughly)
    // Actual chord length approx: dt * segmentLength
    const segmentLenSq = a; // 'a' IS the squared length of the segment (dx*dx + dy*dy)
    const segmentLen = Math.sqrt(segmentLenSq);
    const chordLen = (t2 - t1) * segmentLen;

    // If chord is less than 10% of radius (grazing/touching)
    // 0.01 was too strict (numerical noise rejected valid packed configurations).
    // 0.10 rejects visible overlaps while tolerating numerical noise.
    if (chordLen < r * 0.10) {
      // Grazing/Touching -> Allowed
      return false;
    }

    // Strictly interior crossing: t in (epsilon, 1-epsilon)
    const eps = 0.005;
    if ((t1 > eps && t1 < 1 - eps) || (t2 > eps && t2 < 1 - eps)) {
      return true;
    }
  }

  // --- Method 2: Midpoint Inside Check ---
  // Catches chords where both endpoints are on/near boundary
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const midDistSq = (mx - cx) ** 2 + (my - cy) ** 2;
  if (midDistSq < (r * 0.96) ** 2) {
    return true;
  }

  return false;
}

/**
 * Checks if two line segments intersect strictly (excluding endpoints).
 * Uses robust cross-product orientation test.
 */
export function intersectsSegment(p1: Point2D, p2: Point2D, q1: Point2D, q2: Point2D): boolean {
  const orientation = (p: Point2D, q: Point2D, r: Point2D): number => {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-9) return 0; // Collinear
    return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
  };

  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);

  // General case: strictly crossing
  if (o1 !== o2 && o3 !== o4) {
    // Exclude endpoints: if any orientation is 0, it means touching
    if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
    return true;
  }

  return false;
}

/**
 * Builds the Bounded Curvature Graph mainly by computing all valid pairwise bitangents.
 */
export function buildBoundedCurvatureGraph(
  disks: ContactDisk[],
  checkCollisions: boolean = true,
  obstacleSegments: { p1: Point2D; p2: Point2D }[] = [],
  outerTangentsOnly: boolean = false,
): BoundedCurvatureGraph {
  Logger.debug('ContactGraph', 'Building Bounded Curvature Graph', {
    disksCount: disks.length,
    checkCollisions,
    outerTangentsOnly,
  });
  const validEdges: TangentSegment[] = [];

  for (let i = 0; i < disks.length; i++) {
    for (let j = i + 1; j < disks.length; j++) {
      const candidates = calculateBitangents(disks[i], disks[j]);
      const reverseCandidates = calculateBitangents(disks[j], disks[i]);

      let allCandidates = [...candidates, ...reverseCandidates];

      // Filter out inner tangents (LSR/RSL) for envelope mode.
      // Inner tangents cross between the two disks they connect,
      // creating self-intersecting "star" patterns in the envelope.
      if (outerTangentsOnly) {
        allCandidates = allCandidates.filter((s) => s.type === 'LSL' || s.type === 'RSR');
      }

      for (const seg of allCandidates) {
        // Check against ALL other disks only if checkCollisions is true
        let blocked = false;
        if (checkCollisions) {
          for (let k = 0; k < disks.length; k++) {
            if (k === i || k === j) continue;
            if (intersectsDisk(seg.start, seg.end, disks[k])) {
              blocked = true;
              break;
            }
          }

          // Check OBSTACLE SEGMENTS
          if (!blocked) {
            for (const obs of obstacleSegments) {
              if (intersectsSegment(seg.start, seg.end, obs.p1, obs.p2)) {
                blocked = true;
                break;
              }
            }
          }
        }
        if (!blocked) {
          validEdges.push(seg);
        }
      }

      // [FIX] Virtual Inner Tangents REMOVED.
      // Strict physics only.
    }
  }

  const nodeMap = new Map<string, ContactDisk>();
  disks.forEach((d) => nodeMap.set(d.id, d));

  Logger.debug('ContactGraph', 'Graph Built', { nodes: nodeMap.size, edges: validEdges.length });

  return {
    nodes: nodeMap,
    edges: validEdges,
  };
}

/**
 * Computes the optimal Bounded Curvature Envelope through a sequence of disks.
 * Enforces C1 continuity by matching Arrival Chirality with Departure Chirality.
 * Uses a Viterbi-like approach to find the shortest path of (L/R) states.
 */

export interface ArcSegment {
  type: 'ARC';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  chirality: 'L' | 'R'; // L=CCW, R=CW
  length: number;
  diskId: string;
}

export type EnvelopeSegment = TangentSegment | ArcSegment;

export type EnvelopePathResult = {
  path: EnvelopeSegment[];
  chiralities: ('L' | 'R')[];
};

// Helper: Calculate Arc length (chirality-locked)
const calcArc = (
  d: ContactDisk,
  angleIn: number,
  angleOut: number,
  chirality: 'L' | 'R',
): number => {
  const PI2 = 2 * Math.PI;
  let delta = angleOut - angleIn;
  while (delta <= -Math.PI) delta += PI2;
  while (delta > Math.PI) delta -= PI2;
  if (chirality === 'L') {
    if (delta <= 0) delta += PI2;
  } else {
    if (delta >= 0) delta -= PI2;
    delta = Math.abs(delta);
  }
  return delta * d.radius;
};

// Helper: Calculate SHORTEST arc between two angles on a disk
// Returns the shorter of CW and CCW arcs, plus the chirality that produces it.
const calcShortArc = (
  d: ContactDisk,
  angleIn: number,
  angleOut: number,
): { length: number; chirality: 'L' | 'R' } => {
  const lLen = calcArc(d, angleIn, angleOut, 'L');
  const rLen = calcArc(d, angleIn, angleOut, 'R');
  return lLen <= rLen ? { length: lLen, chirality: 'L' } : { length: rLen, chirality: 'R' };
};

// Original Viterbi-based pathfinder for disk sequences (used by saved knots).
export function findEnvelopePath(
  graph: BoundedCurvatureGraph,
  diskIds: string[],
  fixedChiralities?: ('L' | 'R')[],
  strictChirality: boolean = true,
): EnvelopePathResult {
  Logger.debug('ContactGraph', 'Finding Envelope Path', {
    diskIds,
    fixedChiralities,
    strictChirality,
  });
  if (diskIds.length < 2) return { path: [], chiralities: [] };

  const states: ('L' | 'R')[] = ['L', 'R'];
  const CHIRALITY_MISMATCH_PENALTY = 10000;

  // dp[chirality] = { cost, path, angle }
  type DPEntry = { cost: number; path: EnvelopeSegment[]; angle: number };
  let prev = new Map<string, DPEntry>();

  // Initialize: Start with both chiralities at first disk, cost 0
  states.forEach((s) => {
    // If strict and mismatch, skip (unless strict=false, then penalty)
    if (fixedChiralities && fixedChiralities[0] && fixedChiralities[0] !== s) {
      if (strictChirality) return;
      prev.set(s, { cost: CHIRALITY_MISMATCH_PENALTY, path: [], angle: 0 });
    } else {
      prev.set(s, { cost: 0, path: [], angle: 0 });
    }
  });

  const chirResult: ('L' | 'R')[] = [];

  for (let step = 1; step < diskIds.length; step++) {
    const fromDiskId = diskIds[step - 1];
    const toDiskId = diskIds[step];
    const fromDisk = graph.nodes.get(fromDiskId);
    const toDisk = graph.nodes.get(toDiskId);
    if (!fromDisk || !toDisk) continue;

    const next = new Map<string, DPEntry>();

    // Soft Constraint: Iterate ALL states, apply penalty if mismatch
    const possibleStates = states;

    for (const toChir of possibleStates) {
      let bestCost = Infinity;
      let bestPath: EnvelopeSegment[] = [];
      let bestAngle = 0;

      // Penalty for Arriving State Mismatch
      let arrivalPenalty = 0;
      if (fixedChiralities && fixedChiralities[step] && fixedChiralities[step] !== toChir) {
        if (strictChirality) continue; // Skip in strict mode
        arrivalPenalty = CHIRALITY_MISMATCH_PENALTY;
      }

      for (const fromChir of possibleStates) {
        const prevEntry = prev.get(fromChir);
        if (!prevEntry) continue;
        if (prevEntry.cost === Infinity) continue;

        // Find matching edge in graph — only outer tangents (LSL/RSR)
        // to prevent the envelope from crossing between disks.
        const matchingEdges = graph.edges.filter(
          (e) =>
            e.startDiskId === fromDiskId &&
            e.endDiskId === toDiskId &&
            // Allow ALL tangent types (Outer AND Inner) to support crossings/chiral swaps
            e.type.startsWith(fromChir) &&
            e.type.endsWith(toChir),
        );

        const allEdges = matchingEdges;

        for (const edge of allEdges) {
          // Arc on departure disk
          const depAngle = Math.atan2(
            edge.start.y - fromDisk.center.y,
            edge.start.x - fromDisk.center.x,
          );
          const arcLen = step > 1 ? calcArc(fromDisk, prevEntry.angle, depAngle, fromChir) : 0;

          const totalCost = prevEntry.cost + arcLen + edge.length + arrivalPenalty;
          if (totalCost < bestCost) {
            bestCost = totalCost;
            const newPath = [...prevEntry.path];
            if (arcLen > 1e-4 && step > 1) {
              newPath.push({
                type: 'ARC',
                center: fromDisk.center,
                radius: fromDisk.radius,
                startAngle: prevEntry.angle,
                endAngle: depAngle,
                chirality: fromChir,
                length: arcLen,
                diskId: fromDiskId,
              });
            }
            newPath.push(edge);
            bestPath = newPath;
            bestAngle = Math.atan2(edge.end.y - toDisk.center.y, edge.end.x - toDisk.center.x);
          }
        }
      }

      if (bestCost < Infinity) {
        next.set(toChir, { cost: bestCost, path: bestPath, angle: bestAngle });
      }
    }

    prev = next;
  }

  // Pick best final state
  let bestFinal: DPEntry | null = null;
  let bestChir: 'L' | 'R' = 'L';
  for (const s of states) {
    const entry = prev.get(s);
    if (entry && (!bestFinal || entry.cost < bestFinal.cost)) {
      bestFinal = entry;
      bestChir = s;
    }
  }

  if (!bestFinal) {
    Logger.warn('ContactGraph', 'No valid envelope path found');
    return { path: [], chiralities: [] };
  }

  // [FIX FOR CONTINUITY: Add closing arc if closed sequence]
  if (diskIds.length > 2 && diskIds[0] === diskIds[diskIds.length - 1]) {
    const firstDiskId = diskIds[0];
    const firstDisk = graph.nodes.get(firstDiskId);

    // Find the first tangent segment to get the departure angle
    const firstTangent = bestFinal.path.find(
      (s) => s.type !== 'ARC' && s.startDiskId === firstDiskId,
    ) as TangentSegment | undefined;

    if (firstDisk && firstTangent) {
      const depAngle = Math.atan2(
        firstTangent.start.y - firstDisk.center.y,
        firstTangent.start.x - firstDisk.center.x,
      );
      const arrAngle = bestFinal.angle;

      // Infer starting chirality from the tangent type (e.g., 'RSR' -> 'R', 'LSL' -> 'L')
      let firstChir: 'L' | 'R' = 'L';
      if (firstTangent.type.startsWith('R')) {
        firstChir = 'R';
      }

      const closingArcLen = calcArc(firstDisk, arrAngle, depAngle, firstChir);

      if (closingArcLen > 1e-4) {
        bestFinal.path.push({
          type: 'ARC',
          center: firstDisk.center,
          radius: firstDisk.radius,
          startAngle: arrAngle,
          endAngle: depAngle,
          chirality: firstChir,
          length: closingArcLen,
          diskId: firstDiskId,
        });
      }
    }
  }

  Logger.debug('ContactGraph', 'Envelope Path Found', {
    cost: bestFinal.cost,
    pathLength: bestFinal.path.length,
  });
  return { path: bestFinal.path, chiralities: [] };
}

// ------------------------------------------------------------------
// POINT-TO-POINT PATHFINDING (STRICT PHYSICS)
// ------------------------------------------------------------------

// Helper: Check if an arc on 'disk' is blocked by any 'other' disk in 'obstacles'
function isArcBlocked(
  disk: ContactDisk,
  startAng: number,
  endAng: number,
  chirality: 'L' | 'R',
  obstacles: ContactDisk[],
): boolean {
  const PI2 = 2 * Math.PI;
  const norm = (a: number) => ((a % PI2) + PI2) % PI2;

  // Define Target Interval [a1, a2] in CCW direction
  let a1 = norm(startAng);
  let a2 = norm(endAng);

  if (chirality === 'R') {
    // CW from start to end is CCW from end to start
    const temp = a1;
    a1 = a2;
    a2 = temp;
  }

  // Length of arc: if it's very small, don't over-block
  const sweep = (a2 - a1 + PI2) % PI2;
  if (sweep < 1e-4) return false;

  for (const other of obstacles) {
    if (other.id === disk.id) continue;

    // 1. Quick Disjoint Check
    const dx = other.center.x - disk.center.x;
    const dy = other.center.y - disk.center.y;
    const d2 = dx * dx + dy * dy;
    const rSum = disk.radius + other.radius;
    // Allow a tiny bit of overlap (grazing) before considering it blocked
    if (d2 >= (rSum - 1e-4) * (rSum - 1e-4)) continue; // No functional overlap

    // 2. Overlap detected.
    const d = Math.sqrt(d2);
    // If one disk is completely inside another, is the boundary blocked?
    // If 'disk' is inside 'other', the whole arc is blocked
    if (d + disk.radius <= other.radius + 1e-4) return true;
    // If 'other' is inside 'disk', it doesn't block the outer boundary
    if (d + other.radius <= disk.radius + 1e-4) continue;

    const phi = Math.atan2(dy, dx);
    const cosGamma = (disk.radius ** 2 + d2 - other.radius ** 2) / (2 * disk.radius * d);

    if (Math.abs(cosGamma) >= 1) continue;

    // Check chord length to ignore grazing collisions
    // The chord length on `disk` where `other` intersects
    const gamma = Math.acos(cosGamma);
    const chordLen = 2 * disk.radius * Math.sin(gamma);

    // Only block if the chord is substantive (not just a grazing touch from numerical noise)
    if (chordLen < disk.radius * 0.10) continue;

    const b1 = norm(phi - gamma);
    const b2 = norm(phi + gamma);

    const isAngleIn = (ang: number, s: number, e: number) => {
      const da = (ang - s + PI2) % PI2;
      const ds = (e - s + PI2) % PI2;
      // Allow angles to be slightly outside the block interval due to float issues
      return da <= ds - 1e-5 && da >= 1e-5;
    };

    if (isAngleIn(b1, a1, a2)) return true;
    if (isAngleIn(b2, a1, a2)) return true;
    if (isAngleIn(a1, b1, b2)) return true;
    if (isAngleIn(a2, b1, b2)) return true;
  }
  return false;
}

export function intersectsAnyDiskStrict(
  p1: Point2D,
  p2: Point2D,
  disks: ContactDisk[],
  ignoreId1?: string,
  ignoreId2?: string,
): boolean {
  for (const d of disks) {
    if (d.id === ignoreId1 || d.id === ignoreId2) continue;
    if (intersectsDisk(p1, p2, d)) return true;
  }
  return false;
}

function chooseShortestValidPath(
  candidates: { path: EnvelopeSegment[]; length: number; curtis: string }[],
): { path: EnvelopeSegment[]; length: number } | null {
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

function findSubPathGraph(
  start: Point2D,
  end: Point2D,
  obstacles: ContactDisk[],
  graph: BoundedCurvatureGraph,
  diskMap: Map<string, ContactDisk>,
): EnvelopeSegment[] | null {
  const getPointToDiskTangents = (
    p: Point2D,
    d: ContactDisk,
  ): { type: 'L' | 'R'; pt: Point2D; length: number }[] => {
    const dx = d.center.x - p.x;
    const dy = d.center.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (Math.abs(dist - d.radius) < d.radius * 0.01) {
      return [
        { type: 'R', pt: p, length: 0 },
        { type: 'L', pt: p, length: 0 },
      ];
    }
    if (dist < d.radius) return [];

    const phi = Math.atan2(dy, dx);
    const gamma = Math.acos(Math.min(1, d.radius / dist));
    const backAngle = phi + Math.PI;

    const pt1 = {
      x: d.center.x + d.radius * Math.cos(backAngle + gamma),
      y: d.center.y + d.radius * Math.sin(backAngle + gamma),
    };
    const pt2 = {
      x: d.center.x + d.radius * Math.cos(backAngle - gamma),
      y: d.center.y + d.radius * Math.sin(backAngle - gamma),
    };

    return [
      { type: 'R', pt: pt1, length: Math.sqrt((pt1.x - p.x) ** 2 + (pt1.y - p.y) ** 2) },
      { type: 'L', pt: pt2, length: Math.sqrt((pt2.x - p.x) ** 2 + (pt2.y - p.y) ** 2) },
    ];
  };

  interface SearchNode {
    id: string;
    cost: number;
    path: EnvelopeSegment[];
    angle: number;
    diskId?: string;
  }

  const pq: SearchNode[] = [];
  const visited = new Map<string, number>();

  obstacles.forEach((d) => {
    const tangents = getPointToDiskTangents(start, d);
    tangents.forEach((t) => {
      if (!intersectsAnyDiskStrict(start, t.pt, obstacles, d.id)) {
        const ang = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
        if (t.length < 1e-4) {
          pq.push({ id: `${d.id}:L`, cost: 0, path: [], angle: ang, diskId: d.id });
          pq.push({ id: `${d.id}:R`, cost: 0, path: [], angle: ang, diskId: d.id });
        } else {
          pq.push({
            id: `${d.id}:${t.type}`,
            cost: t.length,
            path: [
              {
                type: t.type === 'L' ? 'PTD-L' : 'PTD-R',
                start: start,
                end: t.pt,
                length: t.length,
                startDiskId: 'point',
                endDiskId: d.id,
              },
            ],
            angle: ang,
            diskId: d.id,
          });
        }
      }
    });
  });

  let bestEnd: SearchNode | null = null;
  let minCost = Infinity;

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const curr = pq.shift()!;

    if (visited.has(curr.id) && visited.get(curr.id)! <= curr.cost) continue;
    visited.set(curr.id, curr.cost);

    if (curr.diskId) {
      const d = diskMap.get(curr.diskId)!;
      const distToEnd = Math.sqrt((end.x - d.center.x) ** 2 + (end.y - d.center.y) ** 2);
      const onEndDisk = Math.abs(distToEnd - d.radius) < d.radius * 0.05;

      if (onEndDisk) {
        const exitAng = Math.atan2(end.y - d.center.y, end.x - d.center.x);
        const shortArc = calcShortArc(d, curr.angle, exitAng);
        if (!isArcBlocked(d, curr.angle, exitAng, shortArc.chirality, obstacles)) {
          const total = curr.cost + shortArc.length;
          if (total < minCost) {
            minCost = total;
            const p = [...curr.path];
            if (shortArc.length > 1e-4) {
              p.push({
                type: 'ARC',
                center: d.center,
                radius: d.radius,
                startAngle: curr.angle,
                endAngle: exitAng,
                chirality: shortArc.chirality,
                length: shortArc.length,
                diskId: d.id,
              });
            }
            bestEnd = { id: 'END', cost: total, path: p, angle: 0 };
          }
        }
      } else {
        const exitTangents = getPointToDiskTangents(end, d);
        exitTangents.forEach((t) => {
          const exitAng = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
          const shortArc = calcShortArc(d, curr.angle, exitAng);
          if (!isArcBlocked(d, curr.angle, exitAng, shortArc.chirality, obstacles)) {
            if (!intersectsAnyDiskStrict(t.pt, end, obstacles, d.id)) {
              const total = curr.cost + shortArc.length + t.length;
              if (total < minCost) {
                minCost = total;
                const p = [...curr.path];
                if (shortArc.length > 1e-4)
                  p.push({
                    type: 'ARC',
                    center: d.center,
                    radius: d.radius,
                    startAngle: curr.angle,
                    endAngle: exitAng,
                    chirality: shortArc.chirality,
                    length: shortArc.length,
                    diskId: d.id,
                  });
                p.push({
                  type: t.type === 'L' ? 'DTP-L' : 'DTP-R',
                  start: t.pt,
                  end: end,
                  length: t.length,
                  startDiskId: d.id,
                  endDiskId: 'end',
                });
                bestEnd = { id: 'END', cost: total, path: p, angle: 0 };
              }
            }
          }
        });
      }

      const edges = graph.edges.filter((e) => e.startDiskId === curr.diskId);
      for (const edge of edges) {
        const nextId = edge.endDiskId;
        const nextDisk = diskMap.get(nextId);
        if (!nextDisk) continue;

        const depAng = Math.atan2(edge.start.y - d.center.y, edge.start.x - d.center.x);
        const shortArc = calcShortArc(d, curr.angle, depAng);

        if (!isArcBlocked(d, curr.angle, depAng, shortArc.chirality, obstacles)) {
          const arrAng = Math.atan2(edge.end.y - nextDisk.center.y, edge.end.x - nextDisk.center.x);
          const newCost = curr.cost + shortArc.length + edge.length;
          const nextChar = edge.type.endsWith('L') ? 'L' : 'R';
          const nextNodeId = `${nextId}:${nextChar}`;
          if (!visited.has(nextNodeId) || visited.get(nextNodeId)! > newCost) {
            const p = [...curr.path];
            if (shortArc.length > 1e-4)
              p.push({
                type: 'ARC',
                center: d.center,
                radius: d.radius,
                startAngle: curr.angle,
                endAngle: depAng,
                chirality: shortArc.chirality,
                length: shortArc.length,
                diskId: d.id,
              });
            p.push(edge);
            pq.push({ id: nextNodeId, cost: newCost, path: p, angle: arrAng, diskId: nextId });
          }
        }
      }
    }
  }

  if (!bestEnd) console.warn('[findSubPathGraph] Failed to find ANY path to END.');
  else console.log('[findSubPathGraph] SUCCESS. Returning path of length', bestEnd.cost);

  return bestEnd ? bestEnd.path : null;
}

export function findEnvelopePathFromPoints(
  anchors: Point2D[],
  obstacles: ContactDisk[],
): EnvelopePathResult {
  if (anchors.length < 2) return { path: [], chiralities: [] };

  const fullPath: EnvelopeSegment[] = [];

  const diskMap = new Map<string, ContactDisk>();
  obstacles.forEach((d) => diskMap.set(d.id, d));

  const findDisk = (p: Point2D): ContactDisk | null => {
    for (const d of obstacles) {
      if (
        Math.abs(Math.sqrt((p.x - d.center.x) ** 2 + (p.y - d.center.y) ** 2) - d.radius) <
        d.radius * 0.05
      ) {
        return d;
      }
    }
    return null;
  };

  // [FIX] outerTangentsOnly = FALSE (Internal tangents allowed for crossings)
  const graph = buildBoundedCurvatureGraph(obstacles, true, [], false);

  for (let i = 0; i < anchors.length - 1; i++) {
    const start = anchors[i];
    const end = anchors[i + 1];

    const startDisk = findDisk(start);
    const endDisk = findDisk(end);

    const candidates: { path: EnvelopeSegment[]; length: number; curtis: string }[] = [];

    // Candidate A: ARC (Same Disk)
    if (startDisk && endDisk && startDisk.id === endDisk.id) {
      const disk = startDisk;
      const ang1 = Math.atan2(start.y - disk.center.y, start.x - disk.center.x);
      const ang2 = Math.atan2(end.y - disk.center.y, end.x - disk.center.x);

      if (!isArcBlocked(disk, ang1, ang2, 'R', obstacles)) {
        const cw = calcArc(disk, ang1, ang2, 'R');
        candidates.push({
          path: [
            {
              type: 'ARC',
              center: disk.center,
              radius: disk.radius,
              startAngle: ang1,
              endAngle: ang2,
              chirality: 'R',
              length: cw,
              diskId: disk.id,
            },
          ],
          length: cw,
          curtis: 'ARC-CW',
        });
      }

      if (!isArcBlocked(disk, ang1, ang2, 'L', obstacles)) {
        const ccw = calcArc(disk, ang1, ang2, 'L');
        candidates.push({
          path: [
            {
              type: 'ARC',
              center: disk.center,
              radius: disk.radius,
              startAngle: ang1,
              endAngle: ang2,
              chirality: 'L',
              length: ccw,
              diskId: disk.id,
            },
          ],
          length: ccw,
          curtis: 'ARC-CCW',
        });
      }
    }

    // Candidate B: DIRECT LINE
    const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    let lineBlocked = false;

    // 1. Check Collisions with OTHER disks
    lineBlocked = intersectsAnyDiskStrict(start, end, obstacles, startDisk?.id, endDisk?.id);

    // 2. Check Valid Departure (Normal check)
    if (!lineBlocked && dist > 1e-6) {
      const dirX = (end.x - start.x) / dist;
      const dirY = (end.y - start.y) / dist;

      if (startDisk) {
        const nx = (start.x - startDisk.center.x) / startDisk.radius;
        const ny = (start.y - startDisk.center.y) / startDisk.radius;
        // Must go OUT or TANGENT
        if (nx * dirX + ny * dirY < -0.01) lineBlocked = true;
      }

      if (endDisk && !lineBlocked) {
        const nx = (end.x - endDisk.center.x) / endDisk.radius;
        const ny = (end.y - endDisk.center.y) / endDisk.radius;
        // Must arrive from OUTSIDE
        if (nx * dirX + ny * dirY > 0.01) lineBlocked = true;
      }
    }

    // Helper to determine L/R chirality of a point relative to a disk based on departure/arrival vector
    const getChirality = (
      disk: ContactDisk,
      point: Point2D,
      dir: Point2D,
      isDeparture: boolean,
    ): 'L' | 'R' => {
      const nx = (point.x - disk.center.x) / disk.radius;
      const ny = (point.y - disk.center.y) / disk.radius;
      // Cross Normal x Dir
      const cross = nx * dir.y - ny * dir.x;
      // Departure: Cross > 0 -> L (CCW), Cross < 0 -> R (CW)
      // Arrival: Cross > 0 -> L (CCW), Cross < 0 -> R (CW)
      // Note: For Arrival, the direction is "entering", so we should reverse it to check tangency *flow*?
      // Actually, standard convention:
      // R-tangent: moves CLOCKWISE around disk.
      // L-tangent: moves COUNTER-CLOCKWISE around disk.

      // If we depart CW (R), the tangent vector T points "right" relative to Normal N.
      // N x T = -1 (Clockwise). So Cross < 0 => R.

      return cross > 0 ? 'L' : 'R';
    };

    if (!lineBlocked) {
      const dirX = (end.x - start.x) / dist;
      const dirY = (end.y - start.y) / dist;

      let startType = 'L'; // Default if point
      let endType = 'L'; // Default if point

      if (startDisk) {
        startType = getChirality(startDisk, start, { x: dirX, y: dirY }, true);
      }
      if (endDisk) {
        // For arrival, the tangent flow matches the line direction.
        endType = getChirality(endDisk, end, { x: dirX, y: dirY }, false);
      }

      const typeStr = `${startType}S${endType}` as TangentType;

      candidates.push({
        path: [
          {
            type: typeStr,
            start,
            end,
            length: dist,
            startDiskId: startDisk ? startDisk.id : 'point',
            endDiskId: endDisk ? endDisk.id : 'point',
          },
        ],
        length: dist,
        curtis: 'LINE',
      });
    }

    // Candidate C: GRAPH SEARCH
    const graphPath = findSubPathGraph(start, end, obstacles, graph, diskMap);
    if (graphPath) {
      const len = graphPath.reduce((sum, s) => sum + s.length, 0);
      candidates.push({
        path: graphPath,
        length: len,
        curtis: 'GRAPH',
      });
    }

    const best = chooseShortestValidPath(candidates);

    if (best) {
      fullPath.push(...best.path);
    } else {
      // Fallback with dynamic type
      const dirX = (end.x - start.x) / dist;
      const dirY = (end.y - start.y) / dist;
      let sT = 'L';
      let eT = 'L';
      if (startDisk)
        sT =
          (start.x - startDisk.center.x) * dirY - (start.y - startDisk.center.y) * dirX > 0
            ? 'L'
            : 'R'; // Simplified inline cross
      if (endDisk)
        eT = (end.x - endDisk.center.x) * dirY - (end.y - endDisk.center.y) * dirX > 0 ? 'L' : 'R';

      fullPath.push({
        type: `${sT}S${eT}` as TangentType,
        start,
        end,
        length: dist,
        startDiskId: startDisk ? startDisk.id : 'point',
        endDiskId: endDisk ? endDisk.id : 'point',
      });
    }
  }

  return { path: fullPath, chiralities: [] };
}

// ------------------------------------------------------------------
// CONTACT MATRIX / RIGIDITY ANALYSIS (Placeholder/Restored)
// ------------------------------------------------------------------

export interface ContactInfo {
  index1: number;
  index2: number;
  point: Point2D;
  normal: Point2D;
}

export function calculateJacobianMatrix(disks: ContactDisk[]): {
  matrix: number[][];
  contacts: ContactInfo[];
} {
  const contacts: ContactInfo[] = [];
  const n = disks.length;
  // Simple contact detection (brute force O(n^2))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d1 = disks[i];
      const d2 = disks[j];
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rSum = d1.radius + d2.radius;

      // Tolerance for contact — proportional to sum of radii to work at any scale
      // (e.g. visualRadius=50 → tolerance=1.0; radius=1 → tolerance=0.02)
      const contactTolerance = rSum * 0.01;
      if (Math.abs(dist - rSum) < contactTolerance || dist < rSum) {
        // Overlap or touching
        // Determine contact point and normal
        const normal = { x: dx / dist, y: dy / dist };
        const point = {
          x: d1.center.x + normal.x * d1.radius,
          y: d1.center.y + normal.y * d1.radius,
        };
        contacts.push({ index1: i, index2: j, point, normal });
      }
    }
  }

  const numContacts = contacts.length;
  const numCoords = n * 2;
  // Initialize matrix
  const matrix: number[][] = [];
  for (let k = 0; k < numContacts; k++) {
    matrix[k] = new Array(numCoords).fill(0);
  }

  contacts.forEach((contact, rowIdx) => {
    const i = contact.index1;
    const j = contact.index2;
    const nx = contact.normal.x;
    const ny = contact.normal.y;

    // Row for contact (i, j):
    // (xi - xj)*nx + (yi - yj)*ny = 0 => linearized constraints
    // Col 2*i:     -nx
    // Col 2*i+1:   -ny
    // Col 2*j:      nx
    // Col 2*j+1:    ny

    matrix[rowIdx][2 * i] = -nx;
    matrix[rowIdx][2 * i + 1] = -ny;
    matrix[rowIdx][2 * j] = nx;
    matrix[rowIdx][2 * j + 1] = ny;
  });

  return { matrix, contacts };
}

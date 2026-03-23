import { Logger } from '../../app/Logger';
import { intersectsAnyDiskStrict } from '../geometry/envelope/collision';
import type { BoundedCurvatureGraph, EnvelopeSegment, TangentSegment, TangentType } from '../geometry/envelope/contactGraph';
import { buildBoundedCurvatureGraph } from '../geometry/envelope/contactGraph';
import { calculateBitangent } from '../geometry/primitives/bitangents';
import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import type { PathCandidate,SearchNode } from '../types/pathfinding';
import type { EnvelopePathResult } from './envelopePath';
import { calcArc, calcShortArc } from './envelopePath';
import { MinHeap } from './MinHeap';

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
    if (chordLen < disk.radius * 0.001) continue;

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

// Returns true if two tangent line segments cross in their interiors (strict)
function lineCross(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const EPSILON = 1e-4;
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) < EPSILON) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
  return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

// Returns true if candidate introduces a crossing with an existing segment that connects
// the SAME pair of disks in the opposite direction (A→B crossing B→A).
// Crossings between DIFFERENT disk pairs are intentional knot crossings and are allowed.
function candidateCrossesReversePair(candidate: PathCandidate, existing: EnvelopeSegment[]): boolean {
  for (const newSeg of candidate.path) {
    if (newSeg.type === 'ARC') continue;
    const nTan = newSeg as TangentSegment;
    for (const existSeg of existing) {
      if (existSeg.type === 'ARC') continue;
      const eTan = existSeg as TangentSegment;
      // Only consider crossings between the same disk pair traversed in opposite directions
      const isReversePair =
        nTan.startDiskId === eTan.endDiskId && nTan.endDiskId === eTan.startDiskId;
      if (!isReversePair) continue;
      if (lineCross(nTan.start, nTan.end, eTan.start, eTan.end)) return true;
    }
  }
  return false;
}

// Prefers candidates that don't create same-pair reverse crossings; falls back to shortest
function chooseShortestNonCrossingPath(
  candidates: PathCandidate[],
  existing: EnvelopeSegment[],
): PathCandidate | null {
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.length - b.length);
  if (existing.length === 0) return candidates[0];
  for (const c of candidates) {
    if (!candidateCrossesReversePair(c, existing)) return c;
  }
  return candidates[0]; // all cross — fall back to shortest
}

function findSubPathGraph(
  start: Point2D,
  end: Point2D,
  obstacles: ContactDisk[],
  graph: BoundedCurvatureGraph,
  diskMap: Map<string, ContactDisk>,
  forbiddenDiskIds: Set<string> = new Set(),
  collisionObstacles?: ContactDisk[], // If provided, use for collision checks (excludes sequence disks)
): EnvelopeSegment[] | null {
  const collisionDisks = collisionObstacles ?? obstacles;
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

  // Definition moved to types/pathfinding

  const pq = new MinHeap<SearchNode>();
  const visited = new Map<string, number>();

  obstacles.forEach((d) => {
    // Skip forbidden intermediate disks during initialisation too.
    // The startDisk is never in forbiddenDiskIds (it was deleted before calling this function),
    // so this check correctly blocks only true intermediaries.
    if (forbiddenDiskIds.has(d.id)) return;

    const tangents = getPointToDiskTangents(start, d);
    tangents.forEach((t) => {
      if (!intersectsAnyDiskStrict(start, t.pt, collisionDisks, d.id)) {
        const ang = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
        if (t.length < 1e-4) {
          pq.push({ id: `${d.id}:L`, cost: 0, path: [], angle: ang, diskId: d.id }, 0);
          pq.push({ id: `${d.id}:R`, cost: 0, path: [], angle: ang, diskId: d.id }, 0);
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
          }, t.length);
        }
      }
    });
  });

  let bestEnd: SearchNode | null = null;
  let minCost = Infinity;

  while (pq.size > 0) {
    const curr = pq.pop()!;

    if (visited.has(curr.id) && visited.get(curr.id)! <= curr.cost) continue;
    visited.set(curr.id, curr.cost);

    if (curr.diskId) {
      const d = diskMap.get(curr.diskId)!;
      const distToEnd = Math.sqrt((end.x - d.center.x) ** 2 + (end.y - d.center.y) ** 2);
      const onEndDisk = Math.abs(distToEnd - d.radius) < d.radius * 0.05;

      if (onEndDisk) {
        const exitAng = Math.atan2(end.y - d.center.y, end.x - d.center.x);
        // Try both arc directions: short first, then long if short is blocked.
        for (const tryChir of ['short', 'long'] as const) {
          const shortArc = calcShortArc(d, curr.angle, exitAng);
          const chir: 'L' | 'R' = tryChir === 'short' ? shortArc.chirality : (shortArc.chirality === 'L' ? 'R' : 'L');
          const arcLen = tryChir === 'short' ? shortArc.length : calcArc(d, curr.angle, exitAng, chir);
          if (!isArcBlocked(d, curr.angle, exitAng, chir, collisionDisks)) {
            const total = curr.cost + arcLen;
            if (total < minCost) {
              minCost = total;
              const p = [...curr.path];
              if (arcLen > 1e-4) {
                p.push({
                  type: 'ARC',
                  center: d.center,
                  radius: d.radius,
                  startAngle: curr.angle,
                  endAngle: exitAng,
                  chirality: chir,
                  length: arcLen,
                  diskId: d.id,
                });
              }
              bestEnd = { id: 'END', cost: total, path: p, angle: 0 };
            }
            break; // Short arc worked
          }
        }
      } else {
        const exitTangents = getPointToDiskTangents(end, d);
        exitTangents.forEach((t) => {
          const exitAng = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
          if (!intersectsAnyDiskStrict(t.pt, end, collisionDisks, d.id)) {
            // Try both arc directions (short first, then long if short is blocked).
            // This ensures the search doesn't miss valid paths where the short arc
            // is blocked by an overlapping disk but the long arc is free.
            for (const tryChir of ['short', 'long'] as const) {
              const shortArc = calcShortArc(d, curr.angle, exitAng);
              const chir: 'L' | 'R' = tryChir === 'short' ? shortArc.chirality : (shortArc.chirality === 'L' ? 'R' : 'L');
              const arcLen = tryChir === 'short' ? shortArc.length : calcArc(d, curr.angle, exitAng, chir);
              if (!isArcBlocked(d, curr.angle, exitAng, chir, collisionDisks)) {
                const total = curr.cost + arcLen + t.length;
                if (total < minCost) {
                  minCost = total;
                  const p = [...curr.path];
                  if (arcLen > 1e-4)
                    p.push({
                      type: 'ARC',
                      center: d.center,
                      radius: d.radius,
                      startAngle: curr.angle,
                      endAngle: exitAng,
                      chirality: chir,
                      length: arcLen,
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
                break; // Short arc worked, no need to try long
              }
            }
          }
        });
      }

      const edges = graph.edges.filter((e) => e.startDiskId === curr.diskId);
      for (const edge of edges) {
        const nextId = edge.endDiskId;
        if (forbiddenDiskIds.has(nextId)) continue; // Skip forbidden intermediate disks
        const nextDisk = diskMap.get(nextId);
        if (!nextDisk) continue;

        const depAng = Math.atan2(edge.start.y - d.center.y, edge.start.x - d.center.x);
        // Try short arc first; if blocked by an overlapping disk, try the long arc.
        // This prevents missing valid paths where the short arc is blocked but the
        // long arc (going the other way around) is geometrically clear.
        for (const tryChir of ['short', 'long'] as const) {
          const shortArc = calcShortArc(d, curr.angle, depAng);
          const chir: 'L' | 'R' = tryChir === 'short' ? shortArc.chirality : (shortArc.chirality === 'L' ? 'R' : 'L');
          const arcLen = tryChir === 'short' ? shortArc.length : calcArc(d, curr.angle, depAng, chir);

          if (!isArcBlocked(d, curr.angle, depAng, chir, collisionDisks)) {
            const arrAng = Math.atan2(edge.end.y - nextDisk.center.y, edge.end.x - nextDisk.center.x);
            const newCost = curr.cost + arcLen + edge.length;
            const nextChar = edge.type.endsWith('L') ? 'L' : 'R';
            const nextNodeId = `${nextId}:${nextChar}`;
            if (!visited.has(nextNodeId) || visited.get(nextNodeId)! > newCost) {
              const p = [...curr.path];
              if (arcLen > 1e-4)
                p.push({
                  type: 'ARC',
                  center: d.center,
                  radius: d.radius,
                  startAngle: curr.angle,
                  endAngle: depAng,
                  chirality: chir,
                  length: arcLen,
                  diskId: d.id,
                });
              p.push(edge);
              pq.push({ id: nextNodeId, cost: newCost, path: p, angle: arrAng, diskId: nextId }, newCost);
            }
            break; // Short arc worked, no need to try long
          }
        }
      }
    }
  }

  if (!bestEnd) Logger.warn('ContactGraph', 'findSubPathGraph: No path found to END');
  else Logger.debug('ContactGraph', 'findSubPathGraph: Path found', { cost: bestEnd.cost });

  return bestEnd ? bestEnd.path : null;
}

/**
 * Elastic path recomputation: rebuilds the envelope path from locked chiralities
 * WITHOUT running A* search. Used during drag to preserve topology.
 *
 * For each consecutive pair (i, i+1) in diskSequence:
 *   1. Determine tangent type from chiralities: `${chir[i]}S${chir[i+1]}`
 *   2. Compute that specific bitangent
 *   3. Compute arc on disk[i] from previous arrival angle to this departure angle
 *
 * This guarantees the envelope only stretches/contracts — never creates new paths.
 */
export function recomputeElasticPath(
  diskIds: string[],
  obstacles: ContactDisk[],
  lockedChiralities: ('L' | 'R')[],
): EnvelopePathResult | null {
  if (diskIds.length < 2 || lockedChiralities.length !== diskIds.length) return null;

  const diskMap = new Map<string, ContactDisk>();
  obstacles.forEach((d) => diskMap.set(d.id, d));

  // In knot mode, the core curve is allowed to pass through disks that are
  // part of the sequence (this creates the crossings). Only block non-sequence disks.
  const sequenceIds = new Set(diskIds);
  const nonSequenceObstacles = obstacles.filter(d => !sequenceIds.has(d.id));

  const path: EnvelopeSegment[] = [];
  let prevArrivalAngle: number | null = null;
  let prevDiskId: string | null = null;

  for (let i = 0; i < diskIds.length - 1; i++) {
    const d1 = diskMap.get(diskIds[i]);
    const d2 = diskMap.get(diskIds[i + 1]);
    if (!d1 || !d2) return null;

    // Determine tangent type from locked chiralities
    const tangentType: TangentType = `${lockedChiralities[i]}S${lockedChiralities[i + 1]}` as TangentType;

    // Compute the specific bitangent
    const bitangent = calculateBitangent(d1, d2, tangentType);
    if (!bitangent) {
      return null; // Geometry degenerate — fallback to full search
    }

    // Collision check: reject if bitangent passes through a non-sequence disk.
    // Sequence disks are allowed (crossings happen where the curve crosses them).
    if (intersectsAnyDiskStrict(bitangent.start, bitangent.end, nonSequenceObstacles, d1.id, d2.id)) {
      return null; // Tangent overlaps a non-sequence disk — fallback to full search
    }

    // Compute transit arc on disk[i] from previous arrival to this departure
    const depAngle = Math.atan2(bitangent.start.y - d1.center.y, bitangent.start.x - d1.center.x);

    if (prevArrivalAngle !== null && prevDiskId === diskIds[i]) {
      const arcLen = calcArc(d1, prevArrivalAngle, depAngle, lockedChiralities[i]);
      if (arcLen > 1e-4) {
        // Check if transit arc is blocked by a non-sequence disk
        if (isArcBlocked(d1, prevArrivalAngle, depAngle, lockedChiralities[i], nonSequenceObstacles)) {
          return null; // Arc blocked — fallback to full search
        }
        path.push({
          type: 'ARC',
          center: d1.center,
          radius: d1.radius,
          startAngle: prevArrivalAngle,
          endAngle: depAngle,
          chirality: lockedChiralities[i],
          length: arcLen,
          diskId: d1.id,
        });
      }
    }

    // Add the tangent segment
    path.push({
      type: tangentType,
      start: bitangent.start,
      end: bitangent.end,
      length: bitangent.length,
      startDiskId: d1.id,
      endDiskId: d2.id,
    });

    // Track arrival angle on disk[i+1]
    prevArrivalAngle = Math.atan2(bitangent.end.y - d2.center.y, bitangent.end.x - d2.center.x);
    prevDiskId = diskIds[i + 1];
  }

  // Closing arc: if the sequence is a closed loop (first == last disk),
  // add an arc on that disk from the final arrival back to the first departure.
  if (diskIds.length >= 3 && diskIds[0] === diskIds[diskIds.length - 1] && prevArrivalAngle !== null) {
    const closingDisk = diskMap.get(diskIds[0]);
    if (closingDisk && path.length > 0) {
      // Find the departure angle of the very first tangent
      const firstTangent = path.find(s => s.type !== 'ARC') as TangentSegment | undefined;
      if (firstTangent) {
        const firstDepAngle = Math.atan2(
          firstTangent.start.y - closingDisk.center.y,
          firstTangent.start.x - closingDisk.center.x,
        );
        const closingArcLen = calcArc(closingDisk, prevArrivalAngle, firstDepAngle, lockedChiralities[0]);
        if (closingArcLen > 1e-4) {
          if (!isArcBlocked(closingDisk, prevArrivalAngle, firstDepAngle, lockedChiralities[0], nonSequenceObstacles)) {
            path.push({
              type: 'ARC',
              center: closingDisk.center,
              radius: closingDisk.radius,
              startAngle: prevArrivalAngle,
              endAngle: firstDepAngle,
              chirality: lockedChiralities[0],
              length: closingArcLen,
              diskId: closingDisk.id,
            });
          }
        }
      }
    }
  }

  return { path, chiralities: lockedChiralities };
}

export function findEnvelopePathFromPoints(
  anchors: Point2D[],
  obstacles: ContactDisk[],
  globalForbiddenDiskIds?: Set<string>,
  anchorDiskIds?: string[], // explicit disk ID for each anchor — avoids spatial misdetection
): EnvelopePathResult {
  if (anchors.length < 2) return { path: [], chiralities: [] };

  const fullPath: EnvelopeSegment[] = [];

  const diskMap = new Map<string, ContactDisk>();
  obstacles.forEach((d) => diskMap.set(d.id, d));

  // If anchorDiskIds are provided, use them directly.
  // Spatial fallback (finding the closest disk boundary) is unreliable when disks overlap or
  // are close together: the first matching disk may not be the correct one, causing
  // startDisk === endDisk for anchors that belong to different disks, which triggers
  // the Candidate A (full-circle arc) path incorrectly.
  const findDisk = (p: Point2D, anchorIndex?: number): ContactDisk | null => {
    if (anchorIndex !== undefined && anchorDiskIds && anchorDiskIds[anchorIndex]) {
      return diskMap.get(anchorDiskIds[anchorIndex]) ?? null;
    }
    // Spatial fallback: pick the disk whose boundary is closest to p (not just first match)
    let bestDisk: ContactDisk | null = null;
    let bestErr = Infinity;
    for (const d of obstacles) {
      const dist = Math.sqrt((p.x - d.center.x) ** 2 + (p.y - d.center.y) ** 2);
      const err = Math.abs(dist - d.radius);
      if (err < d.radius * 0.05 && err < bestErr) {
        bestErr = err;
        bestDisk = d;
      }
    }
    return bestDisk;
  };

  // Sequence disks (anchorDiskIds) are allowed to be crossed — crossings form there.
  // Only non-sequence disks should block tangent lines.
  const sequenceIds = anchorDiskIds ? new Set(anchorDiskIds) : new Set<string>();
  const nonSeqObstacles = obstacles.filter(d => !sequenceIds.has(d.id));

  // [FIX] outerTangentsOnly = FALSE (Internal tangents allowed for crossings)
  // Use nonSeqObstacles for collision checks so edges crossing sequence disks aren't filtered.
  const graph = buildBoundedCurvatureGraph(obstacles, true, [], false, nonSeqObstacles);

  Logger.debug('PointPathSearch', 'findEnvelopePathFromPoints starting', {
    anchors: anchors.length,
    obstacles: obstacles.length,
    graphEdges: graph.edges.length,
  });

  for (let i = 0; i < anchors.length - 1; i++) {
    const start = anchors[i];
    const end = anchors[i + 1];

    const startDisk = findDisk(start, i);
    const endDisk = findDisk(end, i + 1);

    const candidates: PathCandidate[] = [];

    // Candidate A: ARC (Same Disk)
    if (startDisk && endDisk && startDisk.id === endDisk.id) {
      const disk = startDisk;
      const ang1 = Math.atan2(start.y - disk.center.y, start.x - disk.center.x);
      const ang2 = Math.atan2(end.y - disk.center.y, end.x - disk.center.x);

      if (!isArcBlocked(disk, ang1, ang2, 'R', nonSeqObstacles)) {
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
        });
      }

      if (!isArcBlocked(disk, ang1, ang2, 'L', nonSeqObstacles)) {
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
        });
      }
    }

    // Candidate B: DIRECT LINE
    const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    let lineBlocked = false;
    let blockReason = '';

    // 1. Check Collisions with OTHER disks (skip sequence disks — crossings are allowed there)
    lineBlocked = intersectsAnyDiskStrict(start, end, nonSeqObstacles, startDisk?.id, endDisk?.id);
    if (lineBlocked) blockReason = 'intersects-other-disk';

    // 2. Check Valid Departure (Normal check)
    if (!lineBlocked && dist > 1e-6) {
      if (startDisk && endDisk && startDisk.id === endDisk.id) {
        // A straight line between two distinct points on the SAME disk is a chord 
        // passing through its interior, which is strictly invalid for an envelope.
        lineBlocked = true;
      } else {
        const dirX = (end.x - start.x) / dist;
        const dirY = (end.y - start.y) / dist;

        if (startDisk) {
          const nx = (start.x - startDisk.center.x) / startDisk.radius;
          const ny = (start.y - startDisk.center.y) / startDisk.radius;
          // Must go OUT or TANGENT
          if (nx * dirX + ny * dirY < -0.01) { lineBlocked = true; blockReason = `departure-inward(dot=${(nx * dirX + ny * dirY).toFixed(3)})`; }
        }

        if (endDisk && !lineBlocked) {
          const nx = (end.x - endDisk.center.x) / endDisk.radius;
          const ny = (end.y - endDisk.center.y) / endDisk.radius;
          // Must arrive from OUTSIDE
          if (nx * dirX + ny * dirY > 0.01) { lineBlocked = true; blockReason = `arrival-inward(dot=${(nx * dirX + ny * dirY).toFixed(3)})`; }
        }

      }
    }

    // Helper to determine L/R chirality of a point relative to a disk based on departure/arrival vector
    const getChirality = (
      disk: ContactDisk,
      point: Point2D,
      dir: Point2D,
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
        startType = getChirality(startDisk, start, { x: dirX, y: dirY });
      }
      if (endDisk) {
        // For arrival, the tangent flow matches the line direction.
        endType = getChirality(endDisk, end, { x: dirX, y: dirY });
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
      });
    }

    // Candidate C: GRAPH SEARCH
    // Build forbidden set: all anchor disk IDs EXCEPT this segment's start/end disks.
    // This prevents graph search from routing through disks used as anchors elsewhere.
    const forbiddenIds = new Set<string>(globalForbiddenDiskIds ?? []);
    for (let j = 0; j < anchors.length; j++) {
      if (j === i || j === i + 1) continue; // Allow current segment's endpoints
      const anchorDisk = findDisk(anchors[j], j); // Pass index to use explicit disk ID
      if (anchorDisk) forbiddenIds.add(anchorDisk.id);
    }
    // Also remove start/end disk IDs if they were added by other anchors on the same disk
    if (startDisk) forbiddenIds.delete(startDisk.id);
    if (endDisk) forbiddenIds.delete(endDisk.id);

    Logger.debug('PointPathSearch', `Segment ${i}: forbidden intermediates`, {
      forbidden: Array.from(forbiddenIds),
    });

    const graphPath = findSubPathGraph(start, end, obstacles, graph, diskMap, forbiddenIds, nonSeqObstacles);
    if (graphPath) {
      const len = graphPath.reduce((sum, s) => sum + s.length, 0);
      candidates.push({
        path: graphPath,
        length: len,
      });
    }

    const best = chooseShortestNonCrossingPath(candidates, fullPath);

    Logger.debug('PointPathSearch', `Segment ${i}: ${startDisk?.id || 'pt'} → ${endDisk?.id || 'pt'}`, {
      directBlocked: lineBlocked,
      blockReason: blockReason || 'none',
      candidates: candidates.length,
      bestLen: best ? best.length.toFixed(2) : 'NONE',
      bestTypes: best ? best.path.map((s: EnvelopeSegment) => s.type).join(',') : 'NONE',
    });

    if (best) {
      fullPath.push(...best.path);
    } else {
      // SAFETY CHECK: Never draw a line that passes through any disk.
      // Check if the raw fallback line would intersect ANY disk (excluding start/end).
      const rawLineBlocked = intersectsAnyDiskStrict(start, end, nonSeqObstacles, startDisk?.id, endDisk?.id);

      if (rawLineBlocked) {
        // The fallback line would go through a disk — SKIP this segment entirely.
        // A gap is physically more accurate than a line through a solid obstacle.
        Logger.warn('PointPathSearch', `Segment ${i}: SKIPPED (all candidates failed, raw line blocked by disk)`, {
          start: `(${start.x.toFixed(2)},${start.y.toFixed(2)})`,
          end: `(${end.x.toFixed(2)},${end.y.toFixed(2)})`,
          startDisk: startDisk?.id || 'none',
          endDisk: endDisk?.id || 'none',
        });
      } else {
        // Raw line doesn't cross any disk — safe to use as fallback
        const dirX = (end.x - start.x) / dist;
        const dirY = (end.y - start.y) / dist;
        let sT = 'L';
        let eT = 'L';
        if (startDisk)
          sT =
            (start.x - startDisk.center.x) * dirY - (start.y - startDisk.center.y) * dirX > 0
              ? 'L'
              : 'R';
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
  }

  // Post-validation: remove any tangent segment that passes through a non-sequence disk.
  const validatedPath = fullPath.filter((seg) => {
    if (seg.type === 'ARC') return true; // Arcs are always on disk boundaries
    const tan = seg as TangentSegment;
    return !intersectsAnyDiskStrict(tan.start, tan.end, nonSeqObstacles, tan.startDiskId, tan.endDiskId);
  });

  if (validatedPath.length !== fullPath.length) {
    Logger.warn('PointPathSearch', 'Post-validation removed disk-overlapping segments', {
      removed: fullPath.length - validatedPath.length,
    });
  }

  return { path: validatedPath, chiralities: [] };
}

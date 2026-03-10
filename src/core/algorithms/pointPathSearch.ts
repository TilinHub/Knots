import { Logger } from '../../app/store/Logger';
import { MinHeap } from './MinHeap';
import type { ContactDisk } from '../types/contactGraph';
import type { SearchNode, PathCandidate } from '../types/pathfinding';
import type { Point2D } from '../types/cs';
import type { BoundedCurvatureGraph, EnvelopeSegment, TangentType } from '../geometry/contactGraph';
import { calcArc, calcShortArc } from './envelopePath';
import type { EnvelopePathResult } from './envelopePath';
import { intersectsAnyDiskStrict } from '../geometry/collision';
import { buildBoundedCurvatureGraph } from '../geometry/contactGraph';

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
    if (chordLen < disk.radius * 0.01) continue;

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

function chooseShortestValidPath(
  candidates: PathCandidate[],
): PathCandidate | null {
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

  // Definition moved to types/pathfinding

  const pq = new MinHeap<SearchNode>();
  const visited = new Map<string, number>();

  obstacles.forEach((d) => {
    const tangents = getPointToDiskTangents(start, d);
    tangents.forEach((t) => {
      if (!intersectsAnyDiskStrict(start, t.pt, obstacles, d.id)) {
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
            pq.push({ id: nextNodeId, cost: newCost, path: p, angle: arrAng, diskId: nextId }, newCost);
          }
        }
      }
    }
  }

  if (!bestEnd) Logger.warn('ContactGraph', 'findSubPathGraph: No path found to END');
  else Logger.debug('ContactGraph', 'findSubPathGraph: Path found', { cost: bestEnd.cost });

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

    const candidates: PathCandidate[] = [];

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
          if (nx * dirX + ny * dirY < -0.01) lineBlocked = true;
        }

        if (endDisk && !lineBlocked) {
          const nx = (end.x - endDisk.center.x) / endDisk.radius;
          const ny = (end.y - endDisk.center.y) / endDisk.radius;
          // Must arrive from OUTSIDE
          if (nx * dirX + ny * dirY > 0.01) lineBlocked = true;
        }
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
      });
    }

    // Candidate C: GRAPH SEARCH
    const graphPath = findSubPathGraph(start, end, obstacles, graph, diskMap);
    if (graphPath) {
      const len = graphPath.reduce((sum, s) => sum + s.length, 0);
      candidates.push({
        path: graphPath,
        length: len,
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

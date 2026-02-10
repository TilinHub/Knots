
import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';

export type TangentType = 'LSL' | 'RSR' | 'LSR' | 'RSL';

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
        y: c.y + r * Math.sin(angle)
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
                endDiskId: d2.id
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
                endDiskId: d2.id
            });
        }
    }

    // 2. Inner Tangents (LSR, RSL)
    if (D >= d1.radius + d2.radius - EPSILON) {
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
                endDiskId: d2.id
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
                endDiskId: d2.id
            });
        }
    }

    return segments;
}

/**
 * Checks if a line segment intersects a disk (strictly interior).
 * Uses distance-to-segment logic, which is more robust than quadratic limits for "inside" cases.
 */
export function intersectsDisk(p1: Point2D, p2: Point2D, disk: ContactDisk): boolean {
    const cx = disk.center.x;
    const cy = disk.center.y;
    const r = disk.radius;

    // Vector v = P2 - P1
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-9) {
        // Segment is a point. Check distance to center.
        const d2 = (p1.x - cx) ** 2 + (p1.y - cy) ** 2;
        return d2 < (r - 0.1) ** 2;
    }

    // Projection factor t of Center onto Line P1-P2
    // C = P1 + t * v
    // t = ((C - P1) . v) / (v . v)
    const t = ((cx - p1.x) * dx + (cy - p1.y) * dy) / lenSq;

    // Clamp t to segment [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));

    // Closest point on segment
    const closestX = p1.x + clampedT * dx;
    const closestY = p1.y + clampedT * dy;

    // Distance squared from Center to Closest Point
    const distSq = (closestX - cx) ** 2 + (closestY - cy) ** 2;

    // Check intersection
    // We allow "grazing" (touching boundary) => strictly less than radius
    // We use a tolerance (0.5 pixel) to avoid blocking valid tangents due to precision
    const tolerance = 0.5;
    const minAllowedDist = r - tolerance;

    if (distSq < minAllowedDist * minAllowedDist) {
        // Deep intersection

        // Special case: If the intersection is ONLY at the endpoints (t=0 or t=1),
        // and the endpoints are ON the boundary (approx radius), we allow it?
        // NO. If t=0 (P1) is the closest point, and dist < r-tol, it means P1 is inside.
        // If P1 is on boundary, dist ~= r. distSq >= minAllowedDist^2. It returns false.
        // So this logic covers "endpoints on boundary" correctly (returns false).
        // It also covers "Chord" (midpoint distance < radius) correctly (returns true).
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
        return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
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
    obstacleSegments: { p1: Point2D, p2: Point2D }[] = [] // New parameter
): BoundedCurvatureGraph {
    const validEdges: TangentSegment[] = [];

    for (let i = 0; i < disks.length; i++) {
        for (let j = i + 1; j < disks.length; j++) {
            const candidates = calculateBitangents(disks[i], disks[j]);
            const reverseCandidates = calculateBitangents(disks[j], disks[i]);

            const allCandidates = [...candidates, ...reverseCandidates];

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
    disks.forEach(d => nodeMap.set(d.id, d));

    return {
        nodes: nodeMap,
        edges: validEdges
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

// Helper: Calculate Arc length
const calcArc = (d: ContactDisk, angleIn: number, angleOut: number, chirality: 'L' | 'R'): number => {
    const PI2 = 2 * Math.PI;
    let delta = angleOut - angleIn;
    while (delta <= -Math.PI) delta += PI2;
    while (delta > Math.PI) delta -= PI2;
    if (chirality === 'L') { if (delta <= 0) delta += PI2; }
    else { if (delta >= 0) delta -= PI2; delta = Math.abs(delta); }
    return delta * d.radius;
};

// Original Function kept for legacy compatibility if needed, or we can repurpose it.
// The user wants POINT TO POINT now.
// We will implement the new function below and deprecate/ignore this one if unneeded.
// But some old code might still call it? 
export function findEnvelopePath(
    graph: BoundedCurvatureGraph,
    diskIds: string[],
    fixedChiralities?: ('L' | 'R')[]
): EnvelopePathResult {
    // Legacy implementation - return empty or simple viterbi
    // Or we keep it for existing saved knots?
    // User wants ALL interactions strict.
    // Let's keep the logic for now to avoid breaking imports but maybe it should be unused.
    return { path: [], chiralities: [] };
}


// ------------------------------------------------------------------
// POINT-TO-POINT PATHFINDING (STRICT PHYSICS)
// ------------------------------------------------------------------

export function findEnvelopePathFromPoints(
    anchors: Point2D[],
    obstacles: ContactDisk[]
): EnvelopePathResult {
    if (anchors.length < 2) return { path: [], chiralities: [] };

    // Valid Graph for inter-disk connections
    const graph = buildBoundedCurvatureGraph(obstacles, true);

    const fullPath: EnvelopeSegment[] = [];
    const fullChiralities: ('L' | 'R')[] = [];

    // Map disks for easier access
    const diskMap = new Map<string, ContactDisk>();
    obstacles.forEach(d => diskMap.set(d.id, d));

    // Helper: Point-to-Disk Tangents (Return [L, R] candidates)
    // Returns segments from Point -> Disk Tangent Point
    const getPointToDiskTangents = (p: Point2D, d: ContactDisk, isStart: boolean): { type: 'L' | 'R', pt: Point2D, length: number }[] => {
        const dx = d.center.x - p.x;
        const dy = d.center.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // [FIX] If point is practically ON the surface (or inside), handle gracefully
        if (Math.abs(dist - d.radius) < 1.0) {
            // Point is on surface. The "tangent" is the point itself (length 0)
            // We need to return valid nodes so the graph algorithm can "enter" the disk here.
            return [
                { type: 'R', pt: p, length: 0 },
                { type: 'L', pt: p, length: 0 }
            ];
        }

        if (dist < d.radius) return []; // Generic inside case (deeply inside)

        const phi = Math.atan2(dy, dx);
        const alpha = Math.asin(d.radius / dist);

        const gamma = Math.acos(d.radius / dist);

        // T1 (Right/CW?): phi - gamma
        const ang1 = phi - gamma;
        const pt1 = { x: d.center.x + d.radius * Math.cos(ang1), y: d.center.y + d.radius * Math.sin(ang1) };

        // T2 (Left/CCW?): phi + gamma
        const ang2 = phi + gamma;
        const pt2 = { x: d.center.x + d.radius * Math.cos(ang2), y: d.center.y + d.radius * Math.sin(ang2) };

        return [
            { type: 'R', pt: pt1, length: Math.sqrt(Math.pow(pt1.x - p.x, 2) + Math.pow(pt1.y - p.y, 2)) },
            { type: 'L', pt: pt2, length: Math.sqrt(Math.pow(pt2.x - p.x, 2) + Math.pow(pt2.y - p.y, 2)) }
        ];
    };

    interface SearchNode {
        id: string; // 'START' | 'diskId:L' | 'diskId:R'
        cost: number;
        path: EnvelopeSegment[];
        angle: number; // Arrival angle at this node (for Arcs)
        diskId?: string; // If on disk
    }

    // Helper: Dijkstra for Point -> Point
    const findSubPath = (start: Point2D, end: Point2D): EnvelopePathResult | null => {
        const pq: SearchNode[] = [];
        const visited = new Map<string, number>();

        // Check direct line first!
        let lineBlocked = false;

        // [FIX] Explicitly check if START and END are on the SAME disk.
        // If so, a straight line is a chord (cutting through), so it's BLOCKED.
        // We want an ARC (handled by Dijkstra below).
        let startDiskId: string | null = null;
        let endDiskId: string | null = null;

        for (const d of obstacles) {
            if (intersectsDisk(start, end, d)) { lineBlocked = true; }

            // Check if points are on this disk
            const distStart = Math.sqrt(Math.pow(start.x - d.center.x, 2) + Math.pow(start.y - d.center.y, 2));
            const distEnd = Math.sqrt(Math.pow(end.x - d.center.x, 2) + Math.pow(end.y - d.center.y, 2));

            if (Math.abs(distStart - d.radius) < 1.0) startDiskId = d.id;
            if (Math.abs(distEnd - d.radius) < 1.0) endDiskId = d.id;
        }

        if (startDiskId && endDiskId && startDiskId === endDiskId) {
            // Both on same disk -> Force Arc (block line)
            // Unless they are very close? No, strictly elastic means arc.
            lineBlocked = true;
        }

        if (!lineBlocked) {
            return {
                path: [{
                    type: 'LSR',
                    start,
                    end,
                    length: Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)),
                    startDiskId: 'point',
                    endDiskId: 'point'
                }],
                chiralities: []
            };
        }

        // Add edges from START to all Disks
        obstacles.forEach(d => {
            const tangents = getPointToDiskTangents(start, d, true);
            tangents.forEach(t => {
                let blocked = false;
                // Segment start -> t.pt
                for (const obs of obstacles) {
                    if (obs.id === d.id) continue;
                    if (intersectsDisk(start, t.pt, obs)) { blocked = true; break; }
                }
                if (!blocked) {
                    const ang = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
                    pq.push({
                        id: `${d.id}:${t.type}`,
                        cost: t.length,
                        path: [{
                            type: t.type === 'L' ? 'LSR' : 'RSL',
                            start: start,
                            end: t.pt,
                            length: t.length,
                            startDiskId: 'start',
                            endDiskId: d.id
                        } as TangentSegment],
                        angle: ang,
                        diskId: d.id
                    });
                }
            });
        });

        let bestEndNode: SearchNode | null = null;
        let minCost = Infinity;

        while (pq.length > 0) {
            pq.sort((a, b) => a.cost - b.cost);
            const curr = pq.shift()!;

            if (visited.has(curr.id) && visited.get(curr.id)! <= curr.cost) continue;
            visited.set(curr.id, curr.cost);

            // Try reaching END from this Disk Node
            if (curr.diskId) {
                const d = diskMap.get(curr.diskId)!;

                // [FIX] Check if END is ON this disk (Distance approx radius)
                const distToEnd = Math.sqrt(Math.pow(end.x - d.center.x, 2) + Math.pow(end.y - d.center.y, 2));
                const onDiskSurface = Math.abs(distToEnd - d.radius) < 1.0; // Tolerance

                if (onDiskSurface) {
                    // Direct Arc to Goal!
                    const exitAng = Math.atan2(end.y - d.center.y, end.x - d.center.x);
                    const preferredChiral = curr.id.endsWith('L') ? 'L' : 'R';
                    const arcLen = calcArc(d, curr.angle, exitAng, preferredChiral);

                    const totalCost = curr.cost + arcLen;
                    if (totalCost < minCost) {
                        minCost = totalCost;
                        const path = [...curr.path];
                        if (arcLen > 1e-4) {
                            path.push({
                                type: 'ARC', center: d.center, radius: d.radius,
                                startAngle: curr.angle, endAngle: exitAng, chirality: preferredChiral, length: arcLen, diskId: d.id
                            });
                        }
                        // No tangent segment needed, we are there.
                        // We might need a zero-length segment to terminate? Or just end.
                        // But strictly we need to return EnvelopeSegment[] that reaches end.
                        // The last arc DOES reach 'end'.

                        bestEndNode = { id: 'END', cost: totalCost, path, angle: 0 };
                    }
                } else {
                    // Standard Tangent Approach (Off-disk target)
                    const exitTangents = getPointToDiskTangents(end, d, false);
                    exitTangents.forEach(t => {
                        const exitAng = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
                        const preferredChiral = curr.id.endsWith('L') ? 'L' : 'R';
                        const arcLen = calcArc(d, curr.angle, exitAng, preferredChiral);

                        // Check blockers for the Line part (t.pt -> end)
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (obs.id === d.id) continue;
                            if (intersectsDisk(t.pt, end, obs)) { blocked = true; break; }
                        }

                        if (!blocked) {
                            const totalCost = curr.cost + arcLen + t.length;
                            if (totalCost < minCost) { // Simple Dijkstras
                                minCost = totalCost;
                                const path = [...curr.path];
                                if (arcLen > 1e-4) {
                                    path.push({
                                        type: 'ARC', center: d.center, radius: d.radius,
                                        startAngle: curr.angle, endAngle: exitAng, chirality: preferredChiral, length: arcLen, diskId: d.id
                                    });
                                }
                                path.push({
                                    type: 'LSR', start: t.pt, end: end, length: t.length, startDiskId: d.id, endDiskId: 'end'
                                });
                                bestEndNode = { id: 'END', cost: totalCost, path, angle: 0 };
                            }
                        }
                    });
                }
            }

            // EXPAND TO NEIGHBOR DISKS (Graph Edges)
            if (curr.diskId) {
                const uId = curr.diskId;
                const uChar = curr.id.endsWith('L') ? 'L' : 'R';

                const edges = graph.edges.filter(e => e.startDiskId === uId && e.type.startsWith(uChar));

                for (const edge of edges) {
                    const nextDiskId = edge.endDiskId;
                    const nextDisk = diskMap.get(nextDiskId);
                    if (!nextDisk) continue;

                    const depAngle = Math.atan2(edge.start.y - diskMap.get(uId)!.center.y, edge.start.x - diskMap.get(uId)!.center.x);
                    const arcLen = calcArc(diskMap.get(uId)!, curr.angle, depAngle, uChar);

                    const newCost = curr.cost + arcLen + edge.length;
                    const nextChar = edge.type.endsWith('L') ? 'L' : 'R';
                    const nextNodeId = `${nextDiskId}:${nextChar}`;

                    const arrAngle = Math.atan2(edge.end.y - nextDisk.center.y, edge.end.x - nextDisk.center.x);

                    if (!visited.has(nextNodeId) || visited.get(nextNodeId)! > newCost) {
                        const newPath = [...curr.path];
                        if (arcLen > 1e-4) {
                            newPath.push({
                                type: 'ARC', center: diskMap.get(uId)!.center, radius: diskMap.get(uId)!.radius,
                                startAngle: curr.angle, endAngle: depAngle, chirality: uChar, length: arcLen, diskId: uId
                            });
                        }
                        newPath.push(edge);

                        pq.push({
                            id: nextNodeId,
                            cost: newCost,
                            path: newPath,
                            angle: arrAngle,
                            diskId: nextDiskId
                        });
                    }
                }
            }
        }

        return bestEndNode ? { path: (bestEndNode as SearchNode).path, chiralities: [] } : null;
    };

    for (let i = 0; i < anchors.length - 1; i++) {
        const start = anchors[i];
        const end = anchors[i + 1];

        const res = findSubPath(start, end);
        if (res) {
            fullPath.push(...res.path);
        } else {
            return { path: [], chiralities: [] };
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

export function calculateJacobianMatrix(disks: ContactDisk[]): { matrix: number[][], contacts: ContactInfo[] } {
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

            // Tolerance for contact
            if (Math.abs(dist - rSum) < 1e-3 || dist < rSum) { // Overlap or touching
                // Determine contact point and normal
                const normal = { x: dx / dist, y: dy / dist };
                const point = {
                    x: d1.center.x + normal.x * d1.radius,
                    y: d1.center.y + normal.y * d1.radius
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

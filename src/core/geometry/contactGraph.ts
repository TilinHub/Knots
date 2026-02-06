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

    // 3. Fallback: Deep Overlap (Virtual Edges)
    // If no tangents found (one disk inside another), connect centers directly.
    // This creates "Sticks" in degenerate cases but preserves connectivity so envelope doesn't disappear.
    if (segments.length === 0) {
        ['LSL', 'RSR', 'LSR', 'RSL'].forEach(t => {
            segments.push({
                type: t as TangentType,
                start: d1.center,
                end: d2.center,
                length: D, // Center distance
                startDiskId: d1.id,
                endDiskId: d2.id
            });
        });
    }

    return segments;
}

/**
 * Checks if a line segment intersects a disk (considering strictly interior).
 * Touching the boundary is NOT an intersection.
 */
export function intersectsDisk(p1: Point2D, p2: Point2D, disk: ContactDisk): boolean {
    // Vector d = P2 - P1
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    // Vector f = P1 - Center
    const fx = p1.x - disk.center.x;
    const fy = p1.y - disk.center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - disk.radius * disk.radius;

    let discriminant = b * b - 4 * a * c;

    if (discriminant <= 0) {
        // No intersection or purely tangent (1 root)
        return false;
    }

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    // We check if (0 < t < 1) for strictly interior intersection.
    // We use a small epsilon to allow grazing/boundary contact.
    const epsilon = 1e-4;
    return (t1 > epsilon && t1 < 1 - epsilon) || (t2 > epsilon && t2 < 1 - epsilon);
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

export interface EnvelopePathResult {
    path: EnvelopeSegment[];
    chiralities: ('L' | 'R')[];
}

export function findEnvelopePath(
    graph: BoundedCurvatureGraph,
    diskIds: string[],
    fixedChiralities?: ('L' | 'R')[]
): EnvelopePathResult { // CHANGED RETURN TYPE
    if (diskIds.length < 2) return { path: [], chiralities: [] };

    // Helper: Calculate Arc length (Robust)
    const calcArc = (d: ContactDisk, angleIn: number, angleOut: number, chirality: 'L' | 'R'): number => {
        const PI2 = 2 * Math.PI;
        let delta = angleOut - angleIn;
        while (delta <= -Math.PI) delta += PI2;
        while (delta > Math.PI) delta -= PI2;
        if (chirality === 'L') { if (delta <= 0) delta += PI2; }
        else { if (delta >= 0) delta -= PI2; delta = Math.abs(delta); }
        return delta * d.radius;
    };

    // Helper: Dijkstra Shortest Path between two disks
    const findShortestTransition = (
        uId: string,
        uChar: 0 | 1,
        vId: string,
        vChar: 0 | 1,
        arrivalAngleAtU: number,
        isFirstDisk: boolean
    ): { cost: number, segments: EnvelopeSegment[], exitAngleAtSubPath: number } | null => {

        const uDisk = graph.nodes.get(uId)!;
        const startCharStr = uChar === 0 ? 'L' : 'R';

        interface DNode {
            diskId: string;
            chirality: 0 | 1;
            cost: number;
            path: EnvelopeSegment[];
            arrivalAngle: number;
        }

        const pq: DNode[] = [];
        const visited = new Map<string, number>();

        const edgesFromU = graph.edges.filter(e => e.startDiskId === uId && e.type.startsWith(startCharStr));

        for (const edge of edgesFromU) {
            const departureAngle = Math.atan2(edge.start.y - uDisk.center.y, edge.start.x - uDisk.center.x);
            const arcC = isFirstDisk ? 0 : calcArc(uDisk, arrivalAngleAtU, departureAngle, startCharStr);

            const nextDiskId = edge.endDiskId;
            const nextChar = edge.type.endsWith('L') ? 0 : 1;
            const nextDisk = graph.nodes.get(nextDiskId);
            if (!nextDisk) continue;

            const arrAngle = Math.atan2(edge.end.y - nextDisk.center.y, edge.end.x - nextDisk.center.x);
            const cost = arcC + edge.length;

            pq.push({
                diskId: nextDiskId,
                chirality: nextChar,
                cost: cost,
                path: (arcC > 1e-5 ? [{
                    type: 'ARC', center: uDisk.center, radius: uDisk.radius,
                    startAngle: arrivalAngleAtU, endAngle: departureAngle, chirality: startCharStr, length: arcC, diskId: uId
                } as EnvelopeSegment] : []).concat([edge]),
                arrivalAngle: arrAngle
            });
        }

        while (pq.length > 0) {
            pq.sort((a, b) => a.cost - b.cost);
            const curr = pq.shift()!;

            const key = curr.diskId + curr.chirality;
            if (visited.has(key) && visited.get(key)! <= curr.cost) continue;
            visited.set(key, curr.cost);

            if (curr.diskId === vId && curr.chirality === vChar) {
                return { cost: curr.cost, segments: curr.path, exitAngleAtSubPath: curr.arrivalAngle };
            }

            const currDisk = graph.nodes.get(curr.diskId)!;
            const currCharStr = curr.chirality === 0 ? 'L' : 'R';

            const edges = graph.edges.filter(e => e.startDiskId === curr.diskId && e.type.startsWith(currCharStr));
            for (const edge of edges) {
                const departureAngle = Math.atan2(edge.start.y - currDisk.center.y, edge.start.x - currDisk.center.x);
                const arcC = calcArc(currDisk, curr.arrivalAngle, departureAngle, currCharStr);

                const nextCost = curr.cost + arcC + edge.length;
                const nextDiskId = edge.endDiskId;
                const nextChar = edge.type.endsWith('L') ? 0 : 1;
                const nextDisk = graph.nodes.get(nextDiskId);
                if (!nextDisk) continue;

                const arrAngle = Math.atan2(edge.end.y - nextDisk.center.y, edge.end.x - nextDisk.center.x);

                const newPath = [...curr.path];
                if (arcC > 1e-5) {
                    newPath.push({
                        type: 'ARC', center: currDisk.center, radius: currDisk.radius,
                        startAngle: curr.arrivalAngle, endAngle: departureAngle, chirality: currCharStr, length: arcC, diskId: curr.diskId
                    });
                }
                newPath.push(edge);

                pq.push({
                    diskId: nextDiskId,
                    chirality: nextChar,
                    cost: nextCost,
                    path: newPath,
                    arrivalAngle: arrAngle
                });
            }
        }
        return null;
    };

    // 1. FIXED TOPOLOGY MODE
    if (fixedChiralities && fixedChiralities.length === diskIds.length) {
        const path: EnvelopeSegment[] = [];
        let currentArrivalAngle = 0;

        // We need an initial usage if there's a previous tangent?
        // Wait, for the first disk, arrival angle doesn't matter as calcArc uses isFirstDisk=true.
        // But for subsequent steps, we need the arrival angle from the PREVIOUS segment.

        for (let i = 0; i < diskIds.length - 1; i++) {
            const uId = diskIds[i];
            const vId = diskIds[i + 1];
            const currChar = fixedChiralities[i] === 'L' ? 0 : 1;
            const nextChar = fixedChiralities[i + 1] === 'L' ? 0 : 1;

            const result = findShortestTransition(uId, currChar, vId, nextChar, currentArrivalAngle, i === 0);

            if (!result) {
                // Topology invalid/impossible -> Fallback to Viterbi (drop chirals)
                return findEnvelopePath(graph, diskIds);
            }

            path.push(...result.segments);
            currentArrivalAngle = result.exitAngleAtSubPath;
        }

        // [FIX] Inject Closing Arc if loop is physically closed
        if (path.length > 0 && diskIds[0] === diskIds[diskIds.length - 1]) {
            const firstSeg = path[0];
            const lastSeg = path[path.length - 1];
            // Ensure they are tangents (should be for first/last in standard flow)
            if (firstSeg.type !== 'ARC' && lastSeg.type !== 'ARC') {
                const center = graph.nodes.get(diskIds[0])!.center;
                const radius = graph.nodes.get(diskIds[0])!.radius;
                const chirality = fixedChiralities[fixedChiralities.length - 1]; // Use last state

                const startAngle = Math.atan2(lastSeg.end.y - center.y, lastSeg.end.x - center.x);
                const endAngle = Math.atan2(firstSeg.start.y - center.y, firstSeg.start.x - center.x);
                const charStr = chirality === 'L' ? 'L' : 'R';

                const len = calcArc({ center, radius } as any, startAngle, endAngle, charStr);
                if (len > 1e-4) {
                    path.push({
                        type: 'ARC', center, radius, startAngle, endAngle, chirality: charStr, length: len, diskId: diskIds[0]
                    });
                }
            }
        }

        return { path, chiralities: fixedChiralities };
    }

    // 2. VITERBI MODE (Automatic Topology)
    interface State {
        cost: number;
        parent: { chirality: 0 | 1 } | null;
        incomingAngle: number;
        pathSegment: EnvelopeSegment[];
    }
    const dp: State[][] = Array(diskIds.length).fill(null).map(() => [
        { cost: Infinity, parent: null, incomingAngle: 0, pathSegment: [] },
        { cost: Infinity, parent: null, incomingAngle: 0, pathSegment: [] }
    ]);
    dp[0][0].cost = 0;
    dp[0][1].cost = 0;

    for (let i = 0; i < diskIds.length - 1; i++) {
        const uId = diskIds[i];
        const vId = diskIds[i + 1];
        if (!graph.nodes.get(uId) || !graph.nodes.get(vId)) continue;
        for (let curr = 0; curr <= 1; curr++) {
            const state = dp[i][curr];
            if (state.cost === Infinity) continue;
            for (let next = 0; next <= 1; next++) {
                const res = findShortestTransition(uId, curr as 0 | 1, vId, next as 0 | 1, state.incomingAngle, i === 0);
                if (res) {
                    const newCost = state.cost + res.cost;
                    if (newCost < dp[i + 1][next].cost) {
                        dp[i + 1][next] = { cost: newCost, parent: { chirality: curr as 0 | 1 }, incomingAngle: res.exitAngleAtSubPath, pathSegment: res.segments };
                    }
                }
            }
        }
    }

    // Backtrack Viterbi
    const path: EnvelopeSegment[] = [];
    const len = diskIds.length;
    let bestEnd = -1;
    if (dp[len - 1][0].cost < dp[len - 1][1].cost) bestEnd = 0;
    else if (dp[len - 1][1].cost < Infinity) bestEnd = 1;
    if (bestEnd === -1) return { path: [], chiralities: [] };

    const chiralities: ('L' | 'R')[] = new Array(len);
    chiralities[len - 1] = bestEnd === 0 ? 'L' : 'R';
    let currC = bestEnd as 0 | 1;
    for (let i = len - 1; i > 0; i--) {
        const state = dp[i][currC];
        if (!state.parent) break;
        for (let k = state.pathSegment.length - 1; k >= 0; k--) {
            path.unshift(state.pathSegment[k]);
        }
        const prevC = state.parent.chirality;
        chiralities[i - 1] = prevC === 0 ? 'L' : 'R';
        currC = prevC;
    }

    // [FIX] Inject Closing Arc if loop is physically closed (Viterbi Mode)
    if (path.length > 0 && diskIds[0] === diskIds[diskIds.length - 1]) {
        const firstSeg = path[0];
        const lastSeg = path[path.length - 1];
        if (firstSeg.type !== 'ARC' && lastSeg.type !== 'ARC') {
            const center = graph.nodes.get(diskIds[0])!.center;
            const radius = graph.nodes.get(diskIds[0])!.radius;
            const chirality = chiralities[chiralities.length - 1];

            const startAngle = Math.atan2(lastSeg.end.y - center.y, lastSeg.end.x - center.x);
            const endAngle = Math.atan2(firstSeg.start.y - center.y, firstSeg.start.x - center.x);
            const charStr = chirality === 'L' ? 'L' : 'R'; // Viterbi ensures valid char in array

            const len = calcArc({ center, radius } as any, startAngle, endAngle, charStr);
            if (len > 1e-4) {
                path.push({
                    type: 'ARC', center, radius, startAngle, endAngle, chirality: charStr, length: len, diskId: diskIds[0]
                });
            }
        }
    }

    return { path, chiralities };
}

/**
 * Calculates the Adjacency Matrix for a set of disks based on contact.
 * A[i][j] = 1 if disks are in contact (distance approx sum of radii), 0 otherwise.
 */
export function calculateAdjacencyMatrix(disks: { center: Point2D, visualRadius: number }[]): number[][] {
    const n = disks.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const TOLERANCE = 1.0; // Tolerance for contact detection (pixels) 

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d1 = disks[i];
            const d2 = disks[j];
            const dx = d2.center.x - d1.center.x;
            const dy = d2.center.y - d1.center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check for contact
            const touchDist = d1.visualRadius + d2.visualRadius;

            if (Math.abs(dist - touchDist) < TOLERANCE) {
                matrix[i][j] = 1;
                matrix[j][i] = 1;
            }
        }
    }
    return matrix;
}

/**
 * Result of the Jacobian calculation.
 * matrix: The K x 2N Jacobian matrix.
 * contacts: Info about which pair (i, j) corresponds to each row.
 */
export interface JacobianResult {
    matrix: number[][]; // K rows x 2N columns
    contacts: { id1: string, index1: number, id2: string, index2: number }[]; // Mapping for rows
}

/**
 * Calculates the Rigidity Matrix (Jacobian) A(c) for a set of disks.
 * Each row corresponds to a contact constraint.
 * Columns correspond to configuration variables (x0, y0, x1, y1, ...).
 * 
 * Based on Thesis Section 3.3.2:
 * u_ij = (cj - ci) / ||cj - ci||
 * Row k = [ ... -u_ij^x, -u_ij^y ... u_ij^x, u_ij^y ... ]
 *           (cols for i)             (cols for j)
 */
export function calculateJacobianMatrix(disks: { id: string, center: Point2D, visualRadius: number }[]): JacobianResult {
    const n = disks.length;
    const rows: number[][] = [];
    const contactInfo: { id1: string, index1: number, id2: string, index2: number }[] = [];
    const TOLERANCE = 1.0; // Tolerance for contact detection (pixels)

    // Build contacts
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d1 = disks[i];
            const d2 = disks[j];
            const dx = d2.center.x - d1.center.x;
            const dy = d2.center.y - d1.center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const touchDist = d1.visualRadius + d2.visualRadius;

            if (Math.abs(dist - touchDist) < TOLERANCE && dist > 1e-9) {
                // Contact Found
                const u_x = dx / dist; // Unit vector x
                const u_y = dy / dist; // Unit vector y

                // Create Row of length 2N filled with 0
                const row = new Array(2 * n).fill(0);

                // Col indices for disk i: 2*i, 2*i+1
                // Components: -u_ij
                row[2 * i] = -u_x;
                row[2 * i + 1] = -u_y;

                // Col indices for disk j: 2*j, 2*j+1
                // Components: +u_ij
                row[2 * j] = u_x;
                row[2 * j + 1] = u_y;

                rows.push(row);
                contactInfo.push({ id1: d1.id, index1: i, id2: d2.id, index2: j });
            }
        }
    }

    return { matrix: rows, contacts: contactInfo };
}

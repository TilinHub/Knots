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
 * Builds the Bounded Curvature Graph mainly by computing all valid pairwise bitangents.
 */
export function buildBoundedCurvatureGraph(disks: ContactDisk[], checkCollisions: boolean = true): BoundedCurvatureGraph {
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

    // If we have fixed chiralities, we don't need Viterbi. We just compute validity.
    if (fixedChiralities && fixedChiralities.length === diskIds.length) {
        const path: EnvelopeSegment[] = [];
        const chiralities = fixedChiralities;

        // Helper: Get valid edges between two disks
        const getEdges = (id1: string, id2: string) =>
            graph.edges.filter(e => e.startDiskId === id1 && e.endDiskId === id2);

        // Robust Local calcArc 
        const calcArcLocal = (d: ContactDisk, angleIn: number, angleOut: number, chirality: 'L' | 'R'): number => {
            const PI2 = 2 * Math.PI;
            let delta = angleOut - angleIn;
            // Normalize to -PI..PI first to be safe
            while (delta <= -Math.PI) delta += PI2;
            while (delta > Math.PI) delta -= PI2;

            if (chirality === 'L') { // CCW: Want positive angle (0..2PI)
                if (delta <= 0) delta += PI2;
            } else { // CW: Want negative angle (0..-2PI)
                if (delta >= 0) delta -= PI2;
                delta = Math.abs(delta);
            }
            return delta * d.radius;
        };

        for (let i = 0; i < diskIds.length - 1; i++) {
            const uId = diskIds[i];
            const vId = diskIds[i + 1];
            const uDisk = graph.nodes.get(uId);
            const vDisk = graph.nodes.get(vId);

            if (!uDisk || !vDisk) return { path: [], chiralities: [] };

            const currChar = fixedChiralities[i];
            const nextChar = fixedChiralities[i + 1];

            // Find matching edge
            const edges = getEdges(uId, vId);
            const validEdge = edges.find(e =>
                e.type[0] === currChar && e.type[2] === nextChar
            );

            if (!validEdge) {
                // Topology became invalid (geometry changed too much)
                // Fallback to Viterbi to prevent "Sticks" or empty path
                return findEnvelopePath(graph, diskIds);
            }

            // Insert Arc on uDisk (connecting previous tangent to this one)
            if (i > 0) {
                const prevTangent = path[path.length - 1]; // Use last added segment
                if (prevTangent && (prevTangent as TangentSegment).end) {
                    const pt = prevTangent as TangentSegment;
                    const angleIn = Math.atan2(pt.end.y - uDisk.center.y, pt.end.x - uDisk.center.x);
                    const angleOut = Math.atan2(validEdge.start.y - uDisk.center.y, validEdge.start.x - uDisk.center.x);

                    const arcLen = calcArcLocal(uDisk, angleIn, angleOut, currChar);

                    // Always add arc (even if small, to maintain connectivity)
                    // If arcLen is truly 0 (identical points), we can skip, 
                    // but for visual "Sticks" issue, we want even small arcs.
                    if (arcLen > 1e-9) {
                        path.push({
                            type: 'ARC',
                            center: uDisk.center,
                            radius: uDisk.radius,
                            startAngle: angleIn,
                            endAngle: angleOut,
                            chirality: currChar,
                            length: arcLen,
                            diskId: uId
                        });
                    }
                }
            }

            path.push(validEdge);
        }

        return { path, chiralities };
    }

    // ORIGINAL VITERBI LOGIC (Enhanced with Path Finding)

    // State: (DiskIndex, Chirality) -> { Cost, ParentState, TangentSegments }
    // Chirality: 0 = L, 1 = R
    interface State {
        cost: number;
        parent: { chirality: 0 | 1 } | null;
        incomingAngle: number; // Angle at which we arrived at this disk (for arc calc)
        pathSegment: EnvelopeSegment[]; // The segment(s) connecting parent to this
    }

    // Initialize DP Table
    const dp: State[][] = Array(diskIds.length).fill(null).map(() => [
        { cost: Infinity, parent: null, incomingAngle: 0, pathSegment: [] },
        { cost: Infinity, parent: null, incomingAngle: 0, pathSegment: [] }
    ]);

    dp[0][0].cost = 0;
    dp[0][1].cost = 0;

    // Helper: Calculate Arc length (same robust logic)
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
    // From u(uChar) to v(vChar), given arrival angle at u
    const findShortestTransition = (
        uId: string,
        uChar: 0 | 1,
        vId: string,
        vChar: 0 | 1,
        arrivalAngleAtU: number,
        isFirstDisk: boolean
    ): { cost: number, segments: EnvelopeSegment[], exitAngleAtSubPath: number } | null => {

        const uDisk = graph.nodes.get(uId)!;
        const vDisk = graph.nodes.get(vId)!;
        const targetCharStr = vChar === 0 ? 'L' : 'R';
        const startCharStr = uChar === 0 ? 'L' : 'R';

        // Set of visited nodes: Map<diskId + chirality, {cost, parent, edge, totalPath}>
        // Since graph is small, we can use simple Priority Queue or just Array+Sort
        // State: { diskId, chirality, cost, segments }
        // BUT we need to account for Arc Cost on 'u'.
        // This makes 'u' special.
        // We start with NO arc cost at 'u' (it's part of the path), BUT we must include it in the total.

        // Let's search on the Graph.
        // Start Nodes: All edges leaving u with type starting 'uChar'.
        // Initial Cost = Arc(u, arrivalAngle, edge.startAngle) + Edge.Length.

        interface DNode {
            diskId: string;
            chirality: 0 | 1; // Arrival chirality at this disk
            cost: number;
            path: EnvelopeSegment[];
            arrivalAngle: number; // Angle of arrival (tangent.end)
        }

        const pq: DNode[] = [];
        const visited = new Map<string, number>(); // key: id+char -> minCost

        // Initial Expansion from U
        const edgesFromU = graph.edges.filter(e => e.startDiskId === uId && e.type.startsWith(startCharStr));

        for (const edge of edgesFromU) {
            // Arc Cost on U
            const departureAngle = Math.atan2(edge.start.y - uDisk.center.y, edge.start.x - uDisk.center.x);
            const arcC = isFirstDisk ? 0 : calcArc(uDisk, arrivalAngleAtU, departureAngle, startCharStr);

            const nextDiskId = edge.endDiskId;
            const nextChar = edge.type.endsWith('L') ? 0 : 1;
            const arrAngle = Math.atan2(edge.end.y - graph.nodes.get(nextDiskId)!.center.y, edge.end.x - graph.nodes.get(nextDiskId)!.center.x);

            const cost = arcC + edge.length;

            // Optimization: If edge goes to v, check if chirality matches
            // If matches, this is a candidate path.
            // But we push to PQ to find SHORTEST.

            pq.push({
                diskId: nextDiskId,
                chirality: nextChar,
                cost: cost,
                path: (arcC > 1e-9 ? [{
                    type: 'ARC', center: uDisk.center, radius: uDisk.radius,
                    startAngle: arrivalAngleAtU, endAngle: departureAngle, chirality: startCharStr, length: arcC, diskId: uId
                } as EnvelopeSegment] : []).concat([edge]),
                arrivalAngle: arrAngle
            });
        }

        // Dijkstra Loop
        while (pq.length > 0) {
            pq.sort((a, b) => a.cost - b.cost); // Simple sort
            const curr = pq.shift()!;

            // Key check
            const key = curr.diskId + curr.chirality;
            if (visited.has(key) && visited.get(key)! <= curr.cost) continue;
            visited.set(key, curr.cost);

            // Goal Check
            if (curr.diskId === vId && curr.chirality === vChar) {
                return { cost: curr.cost, segments: curr.path, exitAngleAtSubPath: curr.arrivalAngle };
            }

            const currDisk = graph.nodes.get(curr.diskId)!;
            const currCharStr = curr.chirality === 0 ? 'L' : 'R';

            // Expand
            const edges = graph.edges.filter(e => e.startDiskId === curr.diskId && e.type.startsWith(currCharStr));
            for (const edge of edges) {
                const departureAngle = Math.atan2(edge.start.y - currDisk.center.y, edge.start.x - currDisk.center.x);
                // Arc on Current Disk
                const arcC = calcArc(currDisk, curr.arrivalAngle, departureAngle, currCharStr);

                const nextCost = curr.cost + arcC + edge.length;
                const nextDiskId = edge.endDiskId;
                const nextChar = edge.type.endsWith('L') ? 0 : 1;
                const arrAngle = Math.atan2(edge.end.y - graph.nodes.get(nextDiskId)!.center.y, edge.end.x - graph.nodes.get(nextDiskId)!.center.x);

                const newPath = [...curr.path];
                if (arcC > 1e-9) {
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


    // Viterbi Forward
    for (let i = 0; i < diskIds.length - 1; i++) {
        const uId = diskIds[i];
        const vId = diskIds[i + 1];
        if (!graph.nodes.get(uId) || !graph.nodes.get(vId)) continue;

        for (let currChirality = 0; currChirality <= 1; currChirality++) {
            const currState = dp[i][currChirality];
            if (currState.cost === Infinity) continue;

            for (let nextChirality = 0; nextChirality <= 1; nextChirality++) {
                // Find shortest transition
                // This accounts for Direct Edge OR Path via intermediates
                const result = findShortestTransition(uId, currChirality as 0 | 1, vId, nextChirality as 0 | 1, currState.incomingAngle, i === 0);

                if (result) {
                    const newCost = currState.cost + result.cost;
                    if (newCost < dp[i + 1][nextChirality].cost) {
                        dp[i + 1][nextChirality] = {
                            cost: newCost,
                            parent: { chirality: currChirality as 0 | 1 },
                            incomingAngle: result.exitAngleAtSubPath,
                            pathSegment: result.segments
                        };
                    }
                }
            }
        }
    }

    // Backtrack - Simplified as segments are stored in state
    const path: EnvelopeSegment[] = [];
    const len = diskIds.length;
    let bestEndChirality = -1;
    if (dp[len - 1][0].cost < dp[len - 1][1].cost) bestEndChirality = 0;
    else if (dp[len - 1][1].cost < Infinity) bestEndChirality = 1;

    if (bestEndChirality === -1) return { path: [], chiralities: [] };

    const chiralities: ('L' | 'R')[] = new Array(len);
    chiralities[len - 1] = bestEndChirality === 0 ? 'L' : 'R';
    let currC = bestEndChirality as 0 | 1;

    // Collect segments backwards
    // dp[i+1] stores segments leading TO i+1 FROM i.
    // So for i from len-1 down to 1:
    // path.unshift(...dp[i][currC].pathSegment)

    for (let i = len - 1; i > 0; i--) {
        const state = dp[i][currC];
        if (!state.parent) break; // Should not happen

        // Add segments in reverse order (since unshift adds to front)
        // state.pathSegment is [Arc, Tangent, Arc, Tangent...] ordered from i-1 to i.
        // We want to PREPEND them to global path.
        // So we iterate state.pathSegment reversed and unshift?
        // Or just unshift the whole block?
        // path = [...state.pathSegment, ...path]
        // Efficient way:
        for (let k = state.pathSegment.length - 1; k >= 0; k--) {
            path.unshift(state.pathSegment[k]);
        }

        const prevC = state.parent.chirality;
        chiralities[i - 1] = prevC === 0 ? 'L' : 'R';
        currC = prevC;
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

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

    // 1. Outer Tangents (LSL, RSR)
    if (D >= Math.abs(d1.radius - d2.radius)) {
        const gamma = Math.acos((d1.radius - d2.radius) / D);
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
    if (D >= d1.radius + d2.radius) {
        const beta = Math.acos((d1.radius + d2.radius) / D);
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

    // ORIGINAL VITERBI LOGIC

    // State: (DiskIndex, Chirality) -> { Cost, ParentState, TangentSegments }
    // Chirality: 0 = L, 1 = R
    interface State {
        cost: number;
        parent: { chirality: 0 | 1 } | null;
        incomingTangent: TangentSegment | null;
        incomingArcLen: number;
    }

    // Initialize DP Table: [Step][Chirality]
    const dp: State[][] = Array(diskIds.length).fill(null).map(() => [
        { cost: Infinity, parent: null, incomingTangent: null, incomingArcLen: 0 }, // L
        { cost: Infinity, parent: null, incomingTangent: null, incomingArcLen: 0 }  // R
    ]);

    // Initial Step (Step 0)
    // Cost is 0 for both L and R start (or strictly 0? We don't have incoming arc).
    dp[0][0].cost = 0;
    dp[0][1].cost = 0;

    // Helper: Get valid edges between two disks
    const getEdges = (id1: string, id2: string) =>
        graph.edges.filter(e => e.startDiskId === id1 && e.endDiskId === id2);

    // Helper: Calculate Arc length on disk
    const calcArc = (d: ContactDisk, angleIn: number, angleOut: number, chirality: 'L' | 'R'): number => {
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

    // Viterbi Forward
    for (let i = 0; i < diskIds.length - 1; i++) {
        const uId = diskIds[i];
        const vId = diskIds[i + 1];
        const uDisk = graph.nodes.get(uId);
        const vDisk = graph.nodes.get(vId);

        if (!uDisk || !vDisk) continue;

        const edges = getEdges(uId, vId);

        // For each current state (L/R)
        for (let currChirality = 0; currChirality <= 1; currChirality++) {
            const currState = dp[i][currChirality];
            if (currState.cost === Infinity) continue;

            const currChar = currChirality === 0 ? 'L' : 'R';

            // Try to transition to next state via valid edges
            // Edge starts with currChar?
            // e.type: LSL -> Starts L, Ends L.
            // LSR -> Starts L, Ends R.
            // RSR -> Starts R, Ends R.
            // RSL -> Starts R, Ends L.

            for (const edge of edges) {
                const edgeStartChar = edge.type[0]; // 'L' or 'R'
                const edgeEndChar = edge.type[2]; // 'L' or 'R'
                const nextChirality = edgeEndChar === 'L' ? 0 : 1;

                // VALIDITY CHECK: Current Departure MUST match Edge Start
                if (edgeStartChar !== currChar) continue;

                // ARC COST (on current disk u)
                // We arrived at u with some angle, now we depart with edge.start angle.
                let arcCost = 0;
                if (i > 0 && currState.incomingTangent) {
                    // Angle coming in from previous tangent
                    const angleIn = Math.atan2(
                        currState.incomingTangent.end.y - uDisk.center.y,
                        currState.incomingTangent.end.x - uDisk.center.x
                    );
                    // Angle going out to this tangent
                    const angleOut = Math.atan2(
                        edge.start.y - uDisk.center.y,
                        edge.start.x - uDisk.center.x
                    );
                    arcCost = calcArc(uDisk, angleIn, angleOut, currChar);
                }

                // Total new cost
                const newCost = currState.cost + arcCost + edge.length;

                // Update Next State if cheaper
                if (newCost < dp[i + 1][nextChirality].cost) {
                    dp[i + 1][nextChirality] = {
                        cost: newCost,
                        parent: { chirality: currChirality as 0 | 1 },
                        incomingTangent: edge,
                        incomingArcLen: arcCost
                    };
                }
            }
        }
    }

    // Backtrack
    const path: EnvelopeSegment[] = [];
    const len = diskIds.length;
    // Find best end state
    let bestEndChirality = -1;
    if (dp[len - 1][0].cost < dp[len - 1][1].cost) bestEndChirality = 0;
    else if (dp[len - 1][1].cost < Infinity) bestEndChirality = 1;

    if (bestEndChirality === -1) return { path: [], chiralities: [] }; // No path found

    const chiralities: ('L' | 'R')[] = new Array(len);
    chiralities[len - 1] = bestEndChirality === 0 ? 'L' : 'R';

    let currC = bestEndChirality as 0 | 1;
    for (let i = len - 1; i > 0; i--) { // Go back to 1
        const state = dp[i][currC];
        if (!state.incomingTangent || !state.parent) break;

        // Add Tangent (Prepend)
        path.unshift(state.incomingTangent);

        // Add Arc (Prepend)
        // Arc is on disk[i-1] (Previous Node)
        // connecting state.parent.incomingTangent (or nothing) to state.incomingTangent
        const uId = diskIds[i - 1];
        const uDisk = graph.nodes.get(uId)!;
        const prevC = state.parent.chirality;

        // Record chirality
        chiralities[i - 1] = prevC === 0 ? 'L' : 'R';

        // Departure Angle (Start of current tangent)
        const angleOut = Math.atan2(
            state.incomingTangent.start.y - uDisk.center.y,
            state.incomingTangent.start.x - uDisk.center.x
        );

        // Arrival Angle (End of previous tangent)
        // We need to look up the previous step to get the incoming tangent
        const prevState = dp[i - 1][prevC];
        let angleIn = angleOut; // Default 0 len if first
        if (i - 1 > 0 && prevState.incomingTangent) {
            angleIn = Math.atan2(
                prevState.incomingTangent.end.y - uDisk.center.y,
                prevState.incomingTangent.end.x - uDisk.center.x
            );

            // Add Arc Segment
            const chirality = prevC === 0 ? 'L' : 'R';
            const arcLen = calcArc(uDisk, angleIn, angleOut, chirality);

            if (arcLen > 1e-9) {
                path.unshift({
                    type: 'ARC',
                    center: uDisk.center,
                    radius: uDisk.radius,
                    startAngle: angleIn,
                    endAngle: angleOut,
                    chirality,
                    length: arcLen,
                    diskId: uId
                });
            }
        }

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

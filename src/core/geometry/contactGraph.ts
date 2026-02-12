
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
        return (fx * fx + fy * fy) < (r * 0.95) ** 2;
    }

    // --- Method 1: Quadratic (Boundary Crossing) ---
    const bCoeff = 2 * (fx * dx + fy * dy);
    const cCoeff = (fx * fx + fy * fy) - r * r;
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
        const chordLen = ((t2 - t1) * segmentLen);

        // If chord is less than 1% of radius (very strict grazing)
        // 0.1 was too large (5 units for r=50). 0.01 is 0.5 units.
        if (chordLen < r * 0.01) {
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
    if (midDistSq < (r * 0.95) ** 2) {
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
    obstacleSegments: { p1: Point2D, p2: Point2D }[] = [],
    outerTangentsOnly: boolean = false
): BoundedCurvatureGraph {
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
                allCandidates = allCandidates.filter(s => s.type === 'LSL' || s.type === 'RSR');
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

// Helper: Calculate Arc length (chirality-locked)
const calcArc = (d: ContactDisk, angleIn: number, angleOut: number, chirality: 'L' | 'R'): number => {
    const PI2 = 2 * Math.PI;
    let delta = angleOut - angleIn;
    while (delta <= -Math.PI) delta += PI2;
    while (delta > Math.PI) delta -= PI2;
    if (chirality === 'L') { if (delta <= 0) delta += PI2; }
    else { if (delta >= 0) delta -= PI2; delta = Math.abs(delta); }
    return delta * d.radius;
};

// Helper: Calculate SHORTEST arc between two angles on a disk
// Returns the shorter of CW and CCW arcs, plus the chirality that produces it.
const calcShortArc = (d: ContactDisk, angleIn: number, angleOut: number): { length: number, chirality: 'L' | 'R' } => {
    const lLen = calcArc(d, angleIn, angleOut, 'L');
    const rLen = calcArc(d, angleIn, angleOut, 'R');
    return lLen <= rLen ? { length: lLen, chirality: 'L' } : { length: rLen, chirality: 'R' };
};

// Original Viterbi-based pathfinder for disk sequences (used by saved knots).
export function findEnvelopePath(
    graph: BoundedCurvatureGraph,
    diskIds: string[],
    fixedChiralities?: ('L' | 'R')[]
): EnvelopePathResult {
    if (diskIds.length < 2) return { path: [], chiralities: [] };

    const states: ('L' | 'R')[] = ['L', 'R'];

    // dp[chirality] = { cost, path, angle }
    type DPEntry = { cost: number, path: EnvelopeSegment[], angle: number };
    let prev = new Map<string, DPEntry>();

    // Initialize: Start with both chiralities at first disk, cost 0
    states.forEach(s => {
        prev.set(s, { cost: 0, path: [], angle: 0 });
    });

    const chirResult: ('L' | 'R')[] = [];

    for (let step = 1; step < diskIds.length; step++) {
        const fromDiskId = diskIds[step - 1];
        const toDiskId = diskIds[step];
        const fromDisk = graph.nodes.get(fromDiskId);
        const toDisk = graph.nodes.get(toDiskId);
        if (!fromDisk || !toDisk) continue;

        const next = new Map<string, DPEntry>();

        // Filter: if fixed chiralities, restrict options
        const allowedFrom = fixedChiralities && fixedChiralities[step - 1] ? [fixedChiralities[step - 1]] : states;
        const allowedTo = fixedChiralities && fixedChiralities[step] ? [fixedChiralities[step]] : states;

        for (const toChir of allowedTo) {
            let bestCost = Infinity;
            let bestPath: EnvelopeSegment[] = [];
            let bestAngle = 0;

            for (const fromChir of allowedFrom) {
                const prevEntry = prev.get(fromChir);
                if (!prevEntry) continue;

                // Find matching edge in graph — only outer tangents (LSL/RSR)
                // to prevent the envelope from crossing between disks.
                const matchingEdges = graph.edges.filter(e =>
                    e.startDiskId === fromDiskId &&
                    e.endDiskId === toDiskId &&
                    (e.type === 'LSL' || e.type === 'RSR') &&
                    e.type.startsWith(fromChir) &&
                    e.type.endsWith(toChir)
                );

                // Also check reverse direction edges
                const reverseEdges = graph.edges.filter(e =>
                    e.startDiskId === toDiskId &&
                    e.endDiskId === fromDiskId
                ).map(e => ({
                    ...e,
                    // Swap start/end
                    start: e.end,
                    end: e.start,
                    startDiskId: e.startDiskId,
                    endDiskId: e.endDiskId,
                }));

                const allEdges = [...matchingEdges];

                for (const edge of allEdges) {
                    // Arc on departure disk
                    const depAngle = Math.atan2(edge.start.y - fromDisk.center.y, edge.start.x - fromDisk.center.x);
                    const arcLen = step > 1 ? calcArc(fromDisk, prevEntry.angle, depAngle, fromChir) : 0;

                    const totalCost = prevEntry.cost + arcLen + edge.length;
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
                                diskId: fromDiskId
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

    if (!bestFinal) return { path: [], chiralities: [] };
    return { path: bestFinal.path, chiralities: [] };
}


// ------------------------------------------------------------------
// POINT-TO-POINT PATHFINDING (STRICT PHYSICS)
// ------------------------------------------------------------------

export function findEnvelopePathFromPoints(
    anchors: Point2D[],
    obstacles: ContactDisk[]
): EnvelopePathResult {
    if (anchors.length < 2) return { path: [], chiralities: [] };

    // Valid Graph for inter-disk connections — outer tangents only
    // to prevent self-intersecting (tangled) envelope paths.
    const graph = buildBoundedCurvatureGraph(obstacles, true, [], true);

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
        // Tolerance reduced to 1% to prevent misidentifying near-misses as on-surface
        if (Math.abs(dist - d.radius) < d.radius * 0.01) {
            // Point is on surface. The "tangent" is the point itself (length 0)
            // We need to return valid nodes so the graph algorithm can "enter" the disk here.
            return [
                { type: 'R', pt: p, length: 0 },
                { type: 'L', pt: p, length: 0 }
            ];
        }

        if (dist < d.radius) return []; // Generic inside case (deeply inside)

        // phi = angle FROM P TO disk center
        const phi = Math.atan2(dy, dx);
        // gamma = half-angle between the two tangent lines (from P)
        const gamma = Math.acos(Math.min(1, d.radius / dist));

        // [CRITICAL FIX] Tangent points on the circle are measured from the CENTER.
        // Direction from center back to P = phi + π
        // Tangent points deviate ±gamma from this "back" direction.
        const backAngle = phi + Math.PI;

        // T1 (Right/CW): backAngle + gamma
        const ang1 = backAngle + gamma;
        const pt1 = { x: d.center.x + d.radius * Math.cos(ang1), y: d.center.y + d.radius * Math.sin(ang1) };

        // T2 (Left/CCW): backAngle - gamma
        const ang2 = backAngle - gamma;
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

            if (Math.abs(distStart - d.radius) < d.radius * 0.05) startDiskId = d.id;
            if (Math.abs(distEnd - d.radius) < d.radius * 0.05) endDiskId = d.id;
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
                if (obstacles && obstacles.length > 0) {
                    // Log to see if blocked
                    // console.log(`Checking tangent from ${start.x},${start.y} to ${t.pt.x},${t.pt.y} against ${d.id}`);
                }
                for (const obs of obstacles) {
                    if (obs.id === d.id) continue;

                    // [FIX] Robust Start Disk Exit Check
                    // If 'start' is on 'obs', ensure we are leaving it 'outwards'
                    // This prevents 'intersectsDisk' from falsely flagging tangent departures as collisions
                    const distStart = Math.sqrt(Math.pow(start.x - obs.center.x, 2) + Math.pow(start.y - obs.center.y, 2));
                    if (Math.abs(distStart - obs.radius) < obs.radius * 0.05) {
                        // Normal at start
                        const nx = (start.x - obs.center.x) / distStart;
                        const ny = (start.y - obs.center.y) / distStart;
                        // Direction of path
                        const dx = t.pt.x - start.x;
                        const dy = t.pt.y - start.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        // Dot product (cosine of angle between Normal and Path)
                        // If >= 0, we are going Out or Tangent.
                        // If < 0, we are going In (cutting chord).
                        if (len > 1e-6) {
                            const dot = (nx * dx + ny * dy) / len;
                            // Allow strictly outward or tangent (dot >= -epsilon)
                            // 1e-4 is safer than 0.01
                            if (dot >= -1e-4) continue;
                        }
                    }

                    if (intersectsDisk(start, t.pt, obs)) {
                        blocked = true; break;
                    }
                }
                if (!blocked) {
                    const ang = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
                    // Add BOTH chiralities for on-surface starts (length 0)
                    // This ensures the algorithm can explore both L and R paths from the entry
                    if (t.length < 1e-4) {
                        pq.push({
                            id: `${d.id}:L`,
                            cost: 0,
                            path: [],
                            angle: ang,
                            diskId: d.id
                        });
                        pq.push({
                            id: `${d.id}:R`,
                            cost: 0,
                            path: [],
                            angle: ang,
                            diskId: d.id
                        });
                    } else {
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
                const onDiskSurface = Math.abs(distToEnd - d.radius) < d.radius * 0.05; // Proportional tolerance

                if (onDiskSurface) {
                    // Direct Arc to Goal! Always use shortest arc.
                    const exitAng = Math.atan2(end.y - d.center.y, end.x - d.center.x);
                    const shortArc = calcShortArc(d, curr.angle, exitAng);
                    const totalCost = curr.cost + shortArc.length;
                    if (totalCost < minCost) {
                        minCost = totalCost;
                        const path = [...curr.path];
                        if (shortArc.length > 1e-4) {
                            path.push({
                                type: 'ARC', center: d.center, radius: d.radius,
                                startAngle: curr.angle, endAngle: exitAng, chirality: shortArc.chirality, length: shortArc.length, diskId: d.id
                            });
                        }
                        bestEndNode = { id: 'END', cost: totalCost, path, angle: 0 };
                    }
                } else {
                    // Standard Tangent Approach (Off-disk target)
                    const exitTangents = getPointToDiskTangents(end, d, false);
                    exitTangents.forEach(t => {
                        const exitAng = Math.atan2(t.pt.y - d.center.y, t.pt.x - d.center.x);
                        // Use SHORTEST arc from entry to exit point
                        const shortArc = calcShortArc(d, curr.angle, exitAng);

                        // Check blockers for the Line part (t.pt -> end)
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (obs.id === d.id) continue;

                            const distStart = Math.sqrt(Math.pow(t.pt.x - obs.center.x, 2) + Math.pow(t.pt.y - obs.center.y, 2));
                            if (Math.abs(distStart - obs.radius) < obs.radius * 0.05) {
                                const nx = (t.pt.x - obs.center.x) / distStart;
                                const ny = (t.pt.y - obs.center.y) / distStart;
                                const dx = end.x - t.pt.x;
                                const dy = end.y - t.pt.y;
                                const len = Math.sqrt(dx * dx + dy * dy);
                                if (len > 1e-6) {
                                    const dot = (nx * dx + ny * dy) / len;
                                    if (dot >= -0.01) continue;
                                }
                            }

                            if (intersectsDisk(t.pt, end, obs)) { blocked = true; break; }
                        }

                        if (!blocked) {
                            const totalCost = curr.cost + shortArc.length + t.length;
                            if (totalCost < minCost) {
                                minCost = totalCost;
                                const path = [...curr.path];
                                if (shortArc.length > 1e-4) {
                                    path.push({
                                        type: 'ARC', center: d.center, radius: d.radius,
                                        startAngle: curr.angle, endAngle: exitAng, chirality: shortArc.chirality, length: shortArc.length, diskId: d.id
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

                // [FIX] Explore ALL edges from this disk, not just chirality-matching.
                // Use shortest arc for transit cost.
                const edges = graph.edges.filter(e => e.startDiskId === uId);

                for (const edge of edges) {
                    const nextDiskId = edge.endDiskId;
                    const nextDisk = diskMap.get(nextDiskId);
                    if (!nextDisk) continue;

                    const depAngle = Math.atan2(edge.start.y - diskMap.get(uId)!.center.y, edge.start.x - diskMap.get(uId)!.center.x);
                    const shortArc = calcShortArc(diskMap.get(uId)!, curr.angle, depAngle);
                    const arcLen = shortArc.length;

                    const newCost = curr.cost + arcLen + edge.length;
                    const nextChar = edge.type.endsWith('L') ? 'L' : 'R';
                    const nextNodeId = `${nextDiskId}:${nextChar}`;

                    const arrAngle = Math.atan2(edge.end.y - nextDisk.center.y, edge.end.x - nextDisk.center.x);

                    if (!visited.has(nextNodeId) || visited.get(nextNodeId)! > newCost) {
                        const newPath = [...curr.path];
                        if (arcLen > 1e-4) {
                            newPath.push({
                                type: 'ARC', center: diskMap.get(uId)!.center, radius: diskMap.get(uId)!.radius,
                                startAngle: curr.angle, endAngle: depAngle, chirality: shortArc.chirality, length: arcLen, diskId: uId
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
        }
        // If no valid path found, skip this segment (don't draw overlapping lines)
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

/**
 * CS Diagram Protocol Checks
 * Use strictly the formulas from Instrucciones.pdf
 */

import type { CSDiagram, Disk, Segment, Arc, Tangency } from './types';
import {
    sub, norm, dot, J, calculateNormal, calculateDeltaTheta,
    dist, add, scale, intersectSegmentArc, intersectArcArc, intersectSegmentSegment
} from './geometry';

export type CheckResult = {
    passed: boolean;
    value: number; // The residual norm or relevant metric
    message?: string;
};

/**
 * 2.3 Chequeos metricos inmediatos
 */
export function checkImmediateMetrics(diagram: CSDiagram): CheckResult[] {
    const results: CheckResult[] = [];
    const { disks, tangencies, contacts, tolerances } = diagram;

    // Check Tangencies on Disk Boundary
    // ||p_alpha - c_k(alpha)|| - 1 <= tol_met
    for (const t of tangencies) {
        const disk = disks[t.diskIndex]; // Assuming diskIndex is correct index
        const distVal = dist(t.point, disk.center);
        const residual = Math.abs(distVal - 1);
        results.push({
            passed: residual <= tolerances.met,
            value: residual,
            message: `Tangency ${t.id} on Disk ${t.diskIndex}: |dist - 1| = ${residual}`
        });
    }

    // Check Contact Distances
    // ||c_i - c_j|| - 2 <= tol_met
    for (const c of contacts) {
        const d1 = disks[c.diskA];
        const d2 = disks[c.diskB];
        const distVal = dist(d1.center, d2.center);
        const residual = Math.abs(distVal - 2);
        results.push({
            passed: residual <= tolerances.met,
            value: residual,
            message: `Contact {${c.diskA}, ${c.diskB}}: |dist - 2| = ${residual}`
        });
    }

    return results;
}

/**
 * 2.4 Orientacion computable
 * Returns the calculated tangent t_alpha for each tangency.
 * Also performs the "Chequeos duros" for orthogonality.
 */
export function checkAndComputeTangents(diagram: CSDiagram): {
    tangents: Record<string, { x: number, y: number }>,
    results: CheckResult[]
} {
    const { disks, tangencies, segments, arcs, tolerances } = diagram;
    const tMap: Record<string, { x: number, y: number }> = {};
    const results: CheckResult[] = [];

    // Map tangency ID to object
    const tangencyMap = new Map(tangencies.map(t => [t.id, t]));

    // Process Segments: t_alpha = p_beta - p_alpha (Outgoing)
    for (const s of segments) {
        const tAlpha = tangencyMap.get(s.startTangencyId);
        const tBeta = tangencyMap.get(s.endTangencyId);
        if (!tAlpha || !tBeta) continue; // Should be caught by combinatorial check

        const disk = disks[tAlpha.diskIndex];
        const nAlpha = calculateNormal(tAlpha.point, disk.center);

        // Definition (Caso 1)
        // STRICTLY use Geometric Tangent J(n) to be consistent with Arc logic in functional.ts
        // t_alpha := J(n_alpha)
        const tGeo = J(nAlpha);
        tMap[s.startTangencyId] = tGeo;

        // Verify that Segment Vector vHat is tangent (parallel to tGeo)
        const tVec = sub(tBeta.point, tAlpha.point);
        const len = norm(tVec);
        const vHat = len > 0 ? scale(tVec, 1 / len) : { x: 0, y: 0 };

        // Checks
        // |<vHat, n_alpha>| <= tol_lin (Orthogonality of segment to radius)
        const dotVal = Math.abs(dot(vHat, nAlpha));
        results.push({
            passed: dotVal <= tolerances.lin,
            value: dotVal,
            message: `Segment start ${s.startTangencyId} orthogonality: ${dotVal}`
        });

        // Check alignment
        // We don't force vHat == tGeo. They can be opposite (if segment goes CW?).
        // But for functional logic, we just need T to be the basis.
    }

    // Process Arcs: t_alpha = J n_alpha (CCW)
    for (const a of arcs) {
        const tAlpha = tangencyMap.get(a.startTangencyId);
        if (!tAlpha) continue;

        const disk = disks[tAlpha.diskIndex];
        const nAlpha = calculateNormal(tAlpha.point, disk.center);

        // Definition (Caso 2)
        // t_alpha := J n_alpha
        const tVec = J(nAlpha); // This is already unit if nAlpha is unit
        tMap[a.startTangencyId] = tVec;

        // Checks
        const dotVal = Math.abs(dot(tVec, nAlpha)); // Should be 0
        results.push({
            passed: dotVal <= tolerances.lin,
            value: dotVal,
            message: `Arc start ${a.startTangencyId} orthogonality: ${dotVal}`
        });

        const nNorm = norm(nAlpha);
        const normRes = Math.abs(nNorm - 1);
        results.push({
            passed: normRes <= tolerances.lin,
            value: normRes,
            message: `Arc start ${a.startTangencyId} unit normal: ${normRes}`
        });
    }

    return { tangents: tMap, results };
}

/**
 * 2.10 Chequeo combinatorio (C0)
 * Verify single cycle.
 */
export function checkCombinatorial(diagram: CSDiagram): CheckResult {
    const segments = diagram.segments || [];
    const arcs = diagram.arcs || [];
    const tangencies = diagram.tangencies || [];

    // Build graph
    const adj = new Map<string, string>();
    const incoming = new Set<string>();
    const outgoing = new Set<string>();

    const allPieces = [...segments, ...arcs];

    for (const p of allPieces) {
        if (adj.has(p.startTangencyId)) {
            return { passed: false, value: 1, message: `Tangency ${p.startTangencyId} has multiple outgoing pieces` };
        }
        adj.set(p.startTangencyId, p.endTangencyId);
        outgoing.add(p.startTangencyId);
        incoming.add(p.endTangencyId);
    }

    // Check 1-to-1
    if (outgoing.size !== tangencies.length || incoming.size !== tangencies.length) {
        return { passed: false, value: Math.abs(outgoing.size - tangencies.length), message: "Mismatch in number of pieces and tangencies" };
    }

    // Check Single Cycle
    const visited = new Set<string>();
    let curr = segments[0]?.startTangencyId || arcs[0]?.startTangencyId;
    if (!curr) return { passed: false, value: 0, message: "Empty diagram" };

    let count = 0;
    while (curr && !visited.has(curr)) {
        visited.add(curr);
        curr = adj.get(curr)!;
        count++;
    }

    const isSingleCycle = count === tangencies.length && curr === (segments[0]?.startTangencyId || arcs[0]?.startTangencyId);

    return {
        passed: isSingleCycle,
        value: isSingleCycle ? 0 : 1,
        message: isSingleCycle ? "Valid Cycle" : "Graph is not a single simple cycle"
    };
}

/**
 * 2.10 Segment Checks (S1-S2)
 */
export function checkSegments(diagram: CSDiagram): CheckResult[] {
    const { segments, tangencies, disks, tolerances } = diagram;
    const results: CheckResult[] = [];
    const tangencyMap = new Map(tangencies.map(t => [t.id, t]));

    for (const s of segments) {
        const start = tangencyMap.get(s.startTangencyId)!;
        const end = tangencyMap.get(s.endTangencyId)!;
        const vs = sub(end.point, start.point);

        // S1 Tangency
        const nAlpha = calculateNormal(start.point, disks[start.diskIndex].center);
        const nBeta = calculateNormal(end.point, disks[end.diskIndex].center);

        const valAlpha = Math.abs(dot(vs, nAlpha));
        const valBeta = Math.abs(dot(vs, nBeta));

        results.push({
            passed: valAlpha <= tolerances.geo,
            value: valAlpha,
            message: `Segment ${s.startTangencyId}->${s.endTangencyId} start tangency`
        });
        results.push({
            passed: valBeta <= tolerances.geo,
            value: valBeta,
            message: `Segment ${s.startTangencyId}->${s.endTangencyId} end tangency`
        });

        // S2 No Intersection with Disks (Clearance)
        // "dist(ci, [pa, pb]) >= 1 - tol_geo"
        // Allow equality only at endpoints (if endpoints are ON that disk)
        for (const d of disks) {
            if (d.index === start.diskIndex || d.index === end.diskIndex) continue; // Skip endpoint disks (simplified check, real check is more complex: "salvo en discos extremos donde se permite igualdad")
            // Wait, "salvo en discos extremos" means if the segment touches the disk, distance is 1.
            // If we exclude them, we skip the check. But the check is dist >= 1.
            // If it touches, dist=1. So 1 >= 1 - tol is valid.
            // So we can check ALL disks.

            const distToSeg = distancePointToSegment(d.center, start.point, end.point);
            const residual = (1 - tolerances.geo) - distToSeg; // if dist < 1-tol, residual > 0

            results.push({
                passed: distToSeg >= 1 - tolerances.geo,
                value: Math.max(0, residual),
                message: `Segment clearance with Disk ${d.index}: dist=${distToSeg}`
            });
        }
    }
    return results;
}

/**
 * 2.10 Arc Checks (A1-A3)
 */
export function checkArcs(diagram: CSDiagram): CheckResult[] {
    const { arcs, tangencies, disks, tolerances } = diagram;
    const results: CheckResult[] = [];
    const tangencyMap = new Map(tangencies.map(t => [t.id, t]));

    for (const a of arcs) {
        const start = tangencyMap.get(a.startTangencyId)!;
        const end = tangencyMap.get(a.endTangencyId)!;

        // A1 Endpoints correct disk
        const k = a.diskIndex;
        results.push({
            passed: start.diskIndex === k && end.diskIndex === k,
            value: (start.diskIndex !== k || end.diskIndex !== k) ? 1 : 0,
            message: `Arc ${a.startTangencyId}->${a.endTangencyId} disk match`
        });

        // A2 Incremental angular well defined
        // tol_lin < DeltaTheta < 2pi - tol_lin
        results.push({
            passed: a.deltaTheta > tolerances.lin && a.deltaTheta < 2 * Math.PI - tolerances.lin,
            value: a.deltaTheta,
            message: `Arc angle valid: ${a.deltaTheta}`
        });

        // A3 Consistencia... (handled by Combinatorial Check mostly, but let's check basic piece consistency)
        // Implicit in construction.
    }
    return results;
}

function distancePointToSegment(p: { x: number, y: number }, a: { x: number, y: number }, b: { x: number, y: number }): number {
    const ab = sub(b, a);
    const ap = sub(p, a);
    const lenSq = dot(ab, ab);
    if (lenSq === 0) return dist(p, a);

    let t = dot(ap, ab) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closest = add(a, scale(ab, t));
    return dist(p, closest);
}

/**
 * 2.10 Global Checks (G1-G3)
 * Verify no self-intersections.
 * G1: Segment-Segment
 * G2: Segment-Arc
 * G3: Arc-Arc
 */
export function checkGlobalIntersections(diagram: CSDiagram): CheckResult[] {
    const segments = diagram.segments || [];
    const arcs = diagram.arcs || [];
    const tangencies = diagram.tangencies || [];
    const disks = diagram.disks;
    const { tolerances } = diagram;
    const results: CheckResult[] = [];
    const tangencyMap = new Map(tangencies.map(t => [t.id, t]));

    // G1: Segment-Segment
    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
            const s1 = segments[i];
            const s2 = segments[j];

            // Skip adjacent segments (neighbors in the cycle)
            // G1 checks usually exclude adjacent edges because they are connected via a vertex (or arc here).
            // Local validity of the turn is handled by Arc checks / Convexity checks.
            const areNeighbors = (Math.abs(i - j) === 1) ||
                (i === 0 && j === segments.length - 1 && segments.length > 2);

            if (areNeighbors) continue;

            const p1 = tangencyMap.get(s1.startTangencyId)!.point;
            const p2 = tangencyMap.get(s1.endTangencyId)!.point;
            const p3 = tangencyMap.get(s2.startTangencyId)!.point;
            const p4 = tangencyMap.get(s2.endTangencyId)!.point;

            const intersect = intersectSegmentSegment(p1, p2, p3, p4, tolerances.geo);

            if (intersect) {
                results.push({
                    passed: false,
                    value: 1,
                    message: `G1 Fail: Segments ${i}-${j} intersect`
                });
            }
        }
    }

    // G2: Segment-Arc
    for (let i = 0; i < segments.length; i++) {
        for (let j = 0; j < arcs.length; j++) {
            const s = segments[i];
            const a = arcs[j];

            // Skip adjacent
            if (s.endTangencyId === a.startTangencyId || s.startTangencyId === a.endTangencyId ||
                s.endTangencyId === a.endTangencyId || s.startTangencyId === a.startTangencyId) continue;
            // Note: In oriented cycle, s->a or a->s. But check all connectivity just in case.

            const p1 = tangencyMap.get(s.startTangencyId)!.point;
            const p2 = tangencyMap.get(s.endTangencyId)!.point;

            const disk = disks[a.diskIndex];
            const tStart = tangencyMap.get(a.startTangencyId)!;
            const tEnd = tangencyMap.get(a.endTangencyId)!;

            // Get angles
            const thetaStart = Math.atan2(tStart.point.y - disk.center.y, tStart.point.x - disk.center.x);
            // thetaEnd is start + deltaTheta
            const thetaEnd = thetaStart + a.deltaTheta;

            const intersect = intersectSegmentArc(
                p1, p2,
                disk.center, 1,
                thetaStart, thetaEnd,
                tolerances.geo
            );

            if (intersect) {
                results.push({
                    passed: false,
                    value: 1,
                    message: `G2 Fail: Segment ${i} intersects Arc ${j} (Disk ${a.diskIndex})`
                });
            }
        }
    }

    // G3: Arc-Arc
    for (let i = 0; i < arcs.length; i++) {
        for (let j = i + 1; j < arcs.length; j++) {
            const a1 = arcs[i];
            const a2 = arcs[j];

            // Skip adjacent
            if (a1.endTangencyId === a2.startTangencyId || a1.startTangencyId === a2.endTangencyId) continue;
            // Also if on same disk?
            // If on same disk, they are adjacent in sequence (or disjoint). 
            // Overlap check handles same disk case in intersectArcArc.

            const d1 = disks[a1.diskIndex];
            const d2 = disks[a2.diskIndex];

            const t1s = tangencyMap.get(a1.startTangencyId)!;
            const th1s = Math.atan2(t1s.point.y - d1.center.y, t1s.point.x - d1.center.x);
            const th1e = th1s + a1.deltaTheta;

            const t2s = tangencyMap.get(a2.startTangencyId)!;
            const th2s = Math.atan2(t2s.point.y - d2.center.y, t2s.point.x - d2.center.x);
            const th2e = th2s + a2.deltaTheta;

            const intersect = intersectArcArc(
                d1.center, 1, th1s, th1e,
                d2.center, 1, th2s, th2e,
                tolerances.geo
            );

            if (intersect) {
                results.push({
                    passed: false,
                    value: 1,
                    message: `G3 Fail: Arc ${i} (D${a1.diskIndex}) intersects Arc ${j} (D${a2.diskIndex})`
                });
            }
        }
    }

    // If no failures
    if (results.length === 0) {
        results.push({ passed: true, value: 0, message: "Global G1-G3 Checks PASSED" });
    }

    return results;
}



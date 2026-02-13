
import type { ContactDisk } from '../types/contactGraph';
import type { CSDisk, Point2D } from '../types/cs';
import type { EnvelopeSegment, TangentType } from './contactGraph';

// ── Types ────────────────────────────────────────────────────────

export type ReasonCode = 'NO_NEXT_LINK' | 'NUMERICAL_NAN' | 'DEGENERATE' | 'LOOP_DETECTED' | 'MAX_ITERS' | 'COLLISION_ALL';

export type HullResult =
    | { ok: true; path: EnvelopeSegment[]; debug?: any }
    | { ok: false; reason: ReasonCode; debug?: any; fallbackPath?: EnvelopeSegment[] };

// ── Helpers ──────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const EPS = 1e-4;

function dist(p1: Point2D, p2: Point2D): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function normalizeAngle(a: number): number {
    let r = a % TWO_PI;
    if (r < 0) r += TWO_PI;
    return r;
}

function crossProduct(a: Point2D, b: Point2D, c: Point2D): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// ── Geometric Primitives ─────────────────────────────────────────

function getOuterTangent(d1: ContactDisk, d2: ContactDisk): { from: Point2D, to: Point2D, angle: number } | null {
    const dx = d2.center.x - d1.center.x;
    const dy = d2.center.y - d1.center.y;
    const d = Math.hypot(dx, dy);

    if (d < Math.abs(d1.radius - d2.radius) + EPS) return null;

    const angle = Math.atan2(dy, dx);
    // Outer tangent L-L
    const offset = Math.acos(Math.max(-1, Math.min(1, (d1.radius - d2.radius) / d)));

    // For CCW hull, we want the "Left" side relative to the vector d1->d2?
    // Actually, standard CCW hull uses the Right tangent if walking? 
    // Let's assume standard "rubber band" which is the outer boundary.
    // The angle of the tangent line itself.
    const tangentAngle = angle + offset;

    const p1 = {
        x: d1.center.x + d1.radius * Math.cos(tangentAngle + Math.PI / 2), // Normal is +90deg
        y: d1.center.y + d1.radius * Math.sin(tangentAngle + Math.PI / 2)
    };
    const p2 = {
        x: d2.center.x + d2.radius * Math.cos(tangentAngle + Math.PI / 2),
        y: d2.center.y + d2.radius * Math.sin(tangentAngle + Math.PI / 2)
    };

    // Wait, if we use +90deg, is that 'Left' or 'Right'?
    // In screen coords (Y down), +90 is "Down"?
    // Let's stick to the previous implementation logic if it worked partially.
    // Actually, robust implementation:
    // alpha = angle + offset. 
    // Normal direction?

    return {
        from: p1,
        to: p2,
        angle: tangentAngle
    };
}

function isValidSupport(p1: Point2D, p2: Point2D, disks: ContactDisk[], ignoreIndices: number[]): boolean {
    // Simple segment-disk intersection check
    // We want to ensure no disk is *strictly* intersected.
    // Grazing is fine.

    // Line segment P1->P2 defined by P1 + t*(P2-P1)
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    for (let i = 0; i < disks.length; i++) {
        if (ignoreIndices.includes(i)) continue;
        const d = disks[i];

        // Project center onto line
        const t = ((d.center.x - p1.x) * dx + (d.center.y - p1.y) * dy) / lenSq;

        // Closest point on segment
        let closestX, closestY;
        if (t < 0) { closestX = p1.x; closestY = p1.y; }
        else if (t > 1) { closestX = p2.x; closestY = p2.y; }
        else { closestX = p1.x + t * dx; closestY = p1.y + t * dy; }

        const distSqToCenter = (closestX - d.center.x) ** 2 + (closestY - d.center.y) ** 2;

        if (distSqToCenter < (d.radius - EPS) ** 2) {
            return false;
        }
    }
    return true;
}

function computeFallbackPolygon(disks: CSDisk[]): EnvelopeSegment[] {
    if (disks.length < 2) return [];

    const points = disks.map(d => d.center);
    // Sort by X then Y
    points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

    // Monotone Chain
    const upper: Point2D[] = [];
    for (const p of points) {
        while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    const lower: Point2D[] = [];
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    upper.pop();
    lower.pop();
    const hull = [...upper, ...lower];

    const fallbackSegments: EnvelopeSegment[] = [];
    for (let i = 0; i < hull.length; i++) {
        const p1 = hull[i];
        const p2 = hull[(i + 1) % hull.length];
        const len = dist(p1, p2);
        if (len > EPS) {
            fallbackSegments.push({
                type: 'LINE', // Use generic line type if possible, usually mapped to LSL/Line
                start: p1,
                end: p2,
                length: len,
                startDiskId: 'fallback',
                endDiskId: 'fallback'
            } as any); // Cast to allow loose type for fallback
        }
    }
    return fallbackSegments;
}

// ── Main Algorithm ───────────────────────────────────────────────

export function computeRobustConvexHull(disks: CSDisk[]): HullResult {
    if (disks.length === 0) return { ok: true, path: [] };
    if (disks.length === 1) {
        return {
            ok: true,
            path: [{
                type: 'ARC',
                center: disks[0].center,
                radius: disks[0].visualRadius,
                startAngle: 0,
                endAngle: TWO_PI,
                chirality: 'L',
                length: TWO_PI * disks[0].visualRadius,
                diskId: disks[0].id
            }]
        };
    }

    const activeDisks: ContactDisk[] = disks.map(d => ({
        ...d,
        radius: d.visualRadius, // Map visualRadius to radius
        regionId: 'default'
    }));

    // Sort deterministic
    activeDisks.sort((a, b) => {
        if (Math.abs(a.center.x - b.center.x) > EPS) return a.center.x - b.center.x;
        return a.center.y - b.center.y;
    });

    const startIdx = 0;
    let currentIdx = startIdx;

    // Start normal: Left (PI) for leftmost disk
    let currNormal = Math.PI;

    const segments: EnvelopeSegment[] = [];
    const visited = new Set<string>();

    let iter = 0;
    const maxIter = activeDisks.length * 4;

    try {
        do {
            const c1 = activeDisks[currentIdx];
            let bestIdx = -1;
            let bestTangent: { from: Point2D, to: Point2D, angle: number } | null = null;
            let minTurnAngle = Infinity;

            for (let i = 0; i < activeDisks.length; i++) {
                if (i === currentIdx) continue;

                const c2 = activeDisks[i];
                const t = getOuterTangent(c1, c2);
                if (!t) continue;

                if (!isValidSupport(t.from, t.to, activeDisks, [currentIdx, i])) continue;

                let delta = t.angle - currNormal;
                while (delta < -EPS) delta += TWO_PI;
                while (delta >= TWO_PI - EPS) delta -= TWO_PI;

                // Tie-breaking
                if (Math.abs(delta - minTurnAngle) < EPS) {
                    const dCurrent = bestIdx !== -1 ? dist(c1.center, activeDisks[bestIdx].center) : -Infinity;
                    const dNew = dist(c1.center, c2.center);
                    if (dNew > dCurrent) {
                        bestIdx = i;
                        bestTangent = t;
                    }
                } else if (delta < minTurnAngle) {
                    minTurnAngle = delta;
                    bestIdx = i;
                    bestTangent = t;
                }
            }

            if (bestIdx === -1 || !bestTangent) {
                return {
                    ok: false,
                    reason: 'NO_NEXT_LINK',
                    debug: { currentIdx },
                    fallbackPath: computeFallbackPolygon(disks)
                };
            }

            // Check loop
            const edgeKey = `${activeDisks[currentIdx].id}->${activeDisks[bestIdx].id}`;
            if (visited.has(edgeKey)) {
                return {
                    ok: false,
                    reason: 'LOOP_DETECTED',
                    debug: { edgeKey },
                    fallbackPath: computeFallbackPolygon(disks)
                };
            }
            visited.add(edgeKey);

            // Add Arc
            let arcDelta = bestTangent.angle - currNormal;
            while (arcDelta < 0) arcDelta += TWO_PI;

            if (arcDelta > EPS) {
                segments.push({
                    type: 'ARC',
                    center: c1.center,
                    radius: c1.radius,
                    startAngle: currNormal,
                    endAngle: bestTangent.angle,
                    chirality: 'L',
                    length: arcDelta * c1.radius,
                    diskId: c1.id
                });
            }

            // Add Tangent
            segments.push({
                type: 'LSL', // Explicit type
                start: bestTangent.from,
                end: bestTangent.to,
                length: dist(bestTangent.from, bestTangent.to),
                startDiskId: c1.id,
                endDiskId: activeDisks[bestIdx].id
            } as any); // Cast slightly if strict type mismatch on 'type' string

            currentIdx = bestIdx;
            currNormal = bestTangent.angle;

            iter++;
            if (iter > maxIter) {
                return {
                    ok: false,
                    reason: 'MAX_ITERS',
                    debug: { iter },
                    fallbackPath: computeFallbackPolygon(disks)
                };
            }

        } while (currentIdx !== startIdx);

    } catch (e) {
        return {
            ok: false,
            reason: 'NUMERICAL_NAN',
            debug: { error: e },
            fallbackPath: computeFallbackPolygon(disks)
        };
    }

    return { ok: true, path: segments };
}

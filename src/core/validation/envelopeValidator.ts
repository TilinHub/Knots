import { Logger } from '../../core/utils/Logger';
import type { ArcSegment, EnvelopeSegment, TangentSegment } from '../geometry/contactGraph';
import type { CSArc, CSSegment,Point2D } from '../types/cs';

const EPSILON = 1e-4; // Slightly loose for floating point noise

/**
 * Check if the envelope path self-intersects.
 * Returns true if valid (no self-intersection), false otherwise.
 */
export function validateNoSelfIntersection(path: EnvelopeSegment[]): { valid: boolean; error?: string } {
    if (path.length < 3) return { valid: true };

    for (let i = 0; i < path.length; i++) {
        for (let j = i + 2; j < path.length; j++) {
            // Skip adjacent (i, i+1) - checked by loop start (j=i+2)
            // But also need to check wrap-around if closed loop:
            // If i=0, j=last -> adjacent.
            if (i === 0 && j === path.length - 1) continue;

            const seg1 = path[i];
            const seg2 = path[j];

            if (segmentsIntersect(seg1, seg2)) {
                Logger.warn('Validator', `Self-intersection detected`, { segment1: i, segment2: j });
                return { valid: false, error: `Self-intersection between segment ${i} and ${j}` };
            }
        }
    }

    return { valid: true };
}

/**
 * Check if the envelope path intersects with strict obstacles.
 * Obstacles are typically line segments (e.g. previous knot strands).
 */
export function validateNoObstacleIntersection(
    path: EnvelopeSegment[],
    obstacles: { p1: Point2D; p2: Point2D }[]
): { valid: boolean; error?: string } {
    for (let i = 0; i < path.length; i++) {
        const seg = path[i];

        for (let k = 0; k < obstacles.length; k++) {
            const obs = obstacles[k];
            // Convert obstacle to pseudo-segment for checking
            const obsSeg: TangentSegment = {
                type: 'LSL', // Dummy valid type
                start: obs.p1,
                end: obs.p2,
                length: 0,
                startDiskId: '',
                endDiskId: ''
            };

            if (segmentsIntersect(seg, obsSeg)) {
                Logger.warn('Validator', `Obstacle intersection detected`, { segment: i, obstacle: k });
                return { valid: false, error: `Intersection with obstacle ${k} at segment ${i}` };
            }
        }
    }
    return { valid: true };
}

// ── INTERNAL INTERSECTION HELPERS ────────────────────────────────────

function segmentsIntersect(s1: EnvelopeSegment, s2: EnvelopeSegment): boolean {
    if (s1.type === 'ARC' && s2.type === 'ARC') return arcArc(s1, s2);
    if (s1.type === 'ARC' && s2.type !== 'ARC') return arcSeg(s1, s2 as TangentSegment);
    if (s1.type !== 'ARC' && s2.type === 'ARC') return arcSeg(s2 as ArcSegment, s1 as TangentSegment);
    return segSeg(s1 as TangentSegment, s2 as TangentSegment);
}

function segSeg(s1: TangentSegment, s2: TangentSegment): boolean {
    return intersectSegmentSegment(s1.start, s1.end, s2.start, s2.end);
}

function arcSeg(arc: ArcSegment, seg: TangentSegment): boolean {
    // Check intersection between arc (circle subset) and segment
    // 1. Find line-circle intersections
    // 2. Check if points are on segment
    // 3. Check if points are on arc angle range
    return intersectArcSegment(arc, seg.start, seg.end);
}

function arcArc(a1: ArcSegment, a2: ArcSegment): boolean {
    // 1. Find circle-circle intersections
    // 2. Check if points are on both arc angle ranges
    return intersectArcArc(a1, a2);
}

// -- MATH PRIMITIVES --

function intersectSegmentSegment(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
    const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(denom) < EPSILON) return false;

    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
    const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;

    // Strict interior intersection (ignore endpoints)
    return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

function intersectArcSegment(arc: ArcSegment, p1: Point2D, p2: Point2D): boolean {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - arc.center.x;
    const fy = p1.y - arc.center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - arc.radius * arc.radius;

    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;

    const t1 = (-b - Math.sqrt(disc)) / (2 * a);
    const t2 = (-b + Math.sqrt(disc)) / (2 * a);

    // Check t1
    if (t1 > EPSILON && t1 < 1 - EPSILON) {
        const x = p1.x + t1 * dx;
        const y = p1.y + t1 * dy;
        if (isAngleOnArc({ x, y }, arc)) return true;
    }
    // Check t2
    if (t2 > EPSILON && t2 < 1 - EPSILON) {
        const x = p1.x + t2 * dx;
        const y = p1.y + t2 * dy;
        if (isAngleOnArc({ x, y }, arc)) return true;
    }

    return false;
}

function intersectArcArc(a1: ArcSegment, a2: ArcSegment): boolean {
    const d2 = distSq(a1.center, a2.center);
    const d = Math.sqrt(d2);

    if (d > a1.radius + a2.radius || d < Math.abs(a1.radius - a2.radius) || d === 0) return false;

    const a = (a1.radius * a1.radius - a2.radius * a2.radius + d2) / (2 * d);
    const h = Math.sqrt(Math.max(0, a1.radius * a1.radius - a * a));

    const x2 = a1.center.x + a * (a2.center.x - a1.center.x) / d;
    const y2 = a1.center.y + a * (a2.center.y - a1.center.y) / d;

    const p1 = {
        x: x2 + h * (a2.center.y - a1.center.y) / d,
        y: y2 - h * (a2.center.x - a1.center.x) / d
    };
    const p2 = {
        x: x2 - h * (a2.center.y - a1.center.y) / d,
        y: y2 + h * (a2.center.x - a1.center.x) / d
    };

    if (isAngleOnArc(p1, a1) && isAngleOnArc(p1, a2)) return true;
    // Check strict inequality to avoid single point contact if that counts? 
    // Usually single point contact is fine for arcs, but here "crossing" is bad.
    // Let's assume strict crossing for now.

    if (isAngleOnArc(p2, a1) && isAngleOnArc(p2, a2)) return true;

    return false;
}

function isAngleOnArc(p: Point2D, arc: ArcSegment): boolean {
    let angle = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
    if (angle < 0) angle += 2 * Math.PI;

    let start = arc.startAngle;
    let end = arc.endAngle;
    if (start < 0) start += 2 * Math.PI;
    if (end < 0) end += 2 * Math.PI;

    // Normalize to [0, 2pi)
    start = start % (2 * Math.PI);
    end = end % (2 * Math.PI);

    // Chirality check? EnvelopeSegment doesn't strictly have chirality on ArcSegment type sometimes?
    // It does: chirality: 'L' | 'R'.
    // Assuming CCW (L) for range checks usually.
    // But if chirality is R (CW), we should swap or handle specifically.
    // Standardizing to CCW range:
    if (arc.chirality === 'R') {
        // Swap start/end logic implies the "active" sector is the other way
        // But startAngle/endAngle are usually defined in flow direction.
        // Let's assume start->end in CCW is the "L" path.
        // And start->end in CW is the "R" path.

        // If R, the arc goes CW from start to end.
        // Equivalent to CCW from end to start.
        const temp = start;
        start = end;
        end = temp;
    }

    if (start <= end) {
        return angle >= start - EPSILON && angle <= end + EPSILON;
    } else {
        return angle >= start - EPSILON || angle <= end + EPSILON;
    }
}

function distSq(p1: Point2D, p2: Point2D) {
    return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

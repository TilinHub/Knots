
import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import type { EnvelopeSegment, ArcSegment, TangentSegment } from './contactGraph';

// ── Helpers ──────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const EPS = 1e-9;

function dist(a: Point2D, b: Point2D): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeAngle(a: number): number {
    let r = a % TWO_PI;
    if (r < 0) r += TWO_PI;
    return r;
}

function crossProduct(a: Point2D, b: Point2D, c: Point2D): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// ── Strict Tangent Logic ─────────────────────────────────────────

/**
 * Calculates the Left-Left (outer) tangent between two disks.
 * Returns the segment from d1 to d2.
 */
function getOuterTangent(d1: ContactDisk, d2: ContactDisk): { from: Point2D, to: Point2D, angle: number } | null {
    const dx = d2.center.x - d1.center.x;
    const dy = d2.center.y - d1.center.y;
    const dist = Math.hypot(dx, dy);

    if (dist < Math.abs(d1.radius - d2.radius) + EPS) return null; // One inside other

    const angle = Math.atan2(dy, dx);
    const offsetAngle = Math.acos((d1.radius - d2.radius) / dist);
    
    // Outer tangent (Left side relative to d1->d2 direction)
    // For CCW hull, we want the "Left" tangent which is +offsetAngle relative to the center-center line?
    // Actually, let's derive:
    // We want the line that touches d1 at (r, theta) and d2 at (r, theta).
    // The normal to the tangent is (cos(theta), sin(theta)).
    // The direction of the tangent is (-sin(theta), cos(theta)).
    // 
    // Wait, let's use the standard formula.
    // LSL tangent: angle = phi + acos((r1-r2)/d)  <-- Wait, checking sign
    // If r1=r2, acos(0) = PI/2.
    // phi + PI/2 means we are at the "top" if moving right.
    // So the normal is +90 deg. The tangent direction is +180 deg (Left).
    // Correct for CCW hull traversal.
    
    const alpha = angle + offsetAngle;
    
    return {
        from: {
            x: d1.center.x + d1.radius * Math.cos(alpha),
            y: d1.center.y + d1.radius * Math.sin(alpha)
        },
        to: {
            x: d2.center.x + d2.radius * Math.cos(alpha),
            y: d2.center.y + d2.radius * Math.sin(alpha)
        },
        angle: alpha // Angle of the normal!
    };
}

/**
 * Checks if a directed line segment L (from p1 to p2) is a valid supporting line 
 * for the set of disks.
 * A valid support means all disks lie to the LEFT (or on) the line.
 * Equivalently, signed distance of center to line >= radius - epsilon.
 */
function isValidSupport(
    from: Point2D, 
    to: Point2D, 
    disks: ContactDisk[], 
    ignoreIndices: number[] = []
): boolean {
    // Line direction
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return false;
    
    // Normal vector (Left pointing) -> (-dy, dx)
    const nx = -dy / len;
    const ny = dx / len;
    
    // Line equation: nx*x + ny*y - C = 0
    // C = nx*from.x + ny*from.y
    const C = nx * from.x + ny * from.y;
    
    for (let i = 0; i < disks.length; i++) {
        if (ignoreIndices.includes(i)) continue;
        
        const d = disks[i];
        // Signed distance of center to line: D = nx*cx + ny*cy - C
        // If D > radius, center is far to the left.
        // If D = radius, touching.
        // If D < radius, penetrating (center is too close to the line, on the left side)
        // If D < -radius, center is on the right side!
        
        // Wait, "Left" of directed line P1->P2.
        // Cross product (P2-P1) x (C-P1) > 0 means C is Left.
        // Using normal (-dy, dx) which points Left.
        // Dot((cx,cy)-from, n) is the distance in the direction of n (Left).
        // We want disk to be on the Left side, so distance should be positive.
        // Specifically, we want the disk to NOT cross to the Right.
        // The "Rightmost" point of the disk is Center - Radius * Normal.
        // Its distance to line is D - Radius.
        // We want D - Radius >= -epsilon.  (Strictly, D >= Radius)
        
        const dist = nx * d.center.x + ny * d.center.y - C;
        
        // Check strict containment
        // If dist < radius - epsilon, then the disk protrudes across the line to the right.
        if (dist < d.radius - 1e-4) {
             return false;
        }
    }
    return true;
}

// ── Robust Convex Hull of Disks ──────────────────────────────────

/**
 * Computes the Convex Hull of a set of Disks.
 * Returns a list of EnvelopeSegments (Tangents and Arcs).
 * 
 * Algorithm: Jarvis March (Gift Wrapping) for Disks.
 * 1. Find the starting disk (the one with minimum X, then min Y).
 *    Actually, finding the disk that supports the vertical tangent at min-x is safer.
 * 
 * 2. Iteratively find the next disk/tangent that makes the largest Left turn 
 *    (smallest angle relative to current direction) AND is a valid support line.
 */
export function computeRobustConvexHull(disks: ContactDisk[]): EnvelopeSegment[] {
    if (disks.length === 0) return [];
    
    // Filter out disks that are fully contained inside others
    // (A disk inside another has no effect on the convex hull)
    const activeDisks = disks.filter((d, i) => {
        for (let j = 0; j < disks.length; j++) {
            if (i === j) continue;
            // If d is inside disks[j]
            const dist = Math.hypot(d.center.x - disks[j].center.x, d.center.y - disks[j].center.y);
            if (dist + d.radius <= disks[j].radius - EPS) return false;
        }
        return true;
    });
    
    if (activeDisks.length === 0) return [];
    if (activeDisks.length === 1) {
        const d = activeDisks[0];
         return [{
            type: 'ARC',
            center: d.center,
            radius: d.radius,
            startAngle: 0,
            endAngle: TWO_PI - 0.0001,
            chirality: 'L',
            length: TWO_PI * d.radius,
            diskId: d.id
        } as ArcSegment];
    }
    
    // 1. Find Start Disk: The one with the minimum X - Radius (leftmost point).
    let startIdx = 0;
    let minX = Infinity;
    
    for(let i=0; i<activeDisks.length; i++) {
        const val = activeDisks[i].center.x - activeDisks[i].radius;
        if(val < minX) {
            minX = val;
            startIdx = i;
        } else if (Math.abs(val - minX) < EPS) {
            // Tie-break: min Y
            if (activeDisks[i].center.y < activeDisks[startIdx].center.y) {
                startIdx = i;
            }
        }
    }
    
    // 2. Start direction: Down (0, 1) ? 
    // The tangent at the leftmost point is vertical, pointing Up (0, -1) in screen coords?
    // Let's assume standard math coords. Standard hull algorithms start at min-y.
    // Let's stick to min-min logic.
    // 
    // We are at the leftmost point of startDisk. The tangent is vertical.
    // Initial "current point" is (center.x - r, center.y).
    // Initial "direction" is Up (0, 1) (if Y is Up) or Down (0, 1) (if Y is Down).
    // Let's imagine we are wrapping the string.
    
    const segments: EnvelopeSegment[] = [];
    let currentIdx = startIdx;
    let currentAngle = Math.PI; // Normal angle at the starting point (pointing Left)
    
    // We store the *normal* angle at the current disk. 
    // At start (leftmost point), the normal is pointing Left (PI).
    // The tangent direction is Normal + 90deg (3PI/2 = -PI/2 = Up in Y-down??)
    // Let's use Normal Angle for consistency.
    
    const startNormalAngle = Math.PI;
    let currNormal = startNormalAngle;
    
    // Safety check for infinite loops
    const maxIter = activeDisks.length * 3; 
    let iter = 0;
    
    do {
        const c1 = activeDisks[currentIdx];
        let bestIdx = -1;
        let bestTangent: { from: Point2D, to: Point2D, angle: number } | null = null;
        let minTurnAngle = Infinity; // We want the smallest RIGHT turn (or largest Left turn?)
        
        // We are at disk c1 with normal 'currNormal'.
        // We want to find the next tangent point that minimizes the angle change.
        // Iterate all other disks.
        
        for (let i = 0; i < activeDisks.length; i++) {
            // Even check itself? No, hull edge must go to another disk.
            // Exception: if only 1 disk, handled above.
            if (i === currentIdx) continue; 
            
            const c2 = activeDisks[i];
            const t = getOuterTangent(c1, c2);
            if (!t) continue;
            
            // Check if this tangent is valid (doesn't intersect other disks)
            if (!isValidSupport(t.from, t.to, activeDisks, [currentIdx, i])) continue;
            
            // Calculate turn angle (CCW change in normal)
            let delta = t.angle - currNormal;
            while (delta < 0) delta += TWO_PI; // Ensure positive CCW turn
            
            // We want the *smallest* delta (tightest wrap)
            if (delta < minTurnAngle) {
                minTurnAngle = delta;
                bestIdx = i;
                bestTangent = t;
            }
        }
        
        if (bestIdx === -1 || !bestTangent) {
            // Should not happen for valid input >= 2 disks
            console.error("RobustHull: Failed to find next link", currentIdx);
            break;
        }
        
        // Add Arc on current disk
        // From currNormal to bestTangent.angle
        // Arc is from (currAngle) to (bestTangent.angle)
        // Wait, 'currNormal' is the normal at the *end* of the previous segment (or start point).
        // The tangent leaves at 'bestTangent.angle'.
        // So we need an arc from currNormal to bestTangent.angle.
        
        // Add ARC
        let arcDelta = bestTangent.angle - currNormal;
        while (arcDelta < 0) arcDelta += TWO_PI;
        
        if (arcDelta > EPS) {
             segments.push({
                type: 'ARC',
                center: c1.center,
                radius: c1.radius,
                startAngle: currNormal, // Angles are Normals (same as point angles)
                endAngle: bestTangent.angle,
                chirality: 'L',
                length: arcDelta * c1.radius,
                diskId: c1.id
            } as ArcSegment);
        }
        
        // Add TANGENT
        const tanLen = dist(bestTangent.from, bestTangent.to);
        segments.push({
            type: 'LSL',
            start: bestTangent.from,
            end: bestTangent.to,
            length: tanLen,
            startDiskId: c1.id,
            endDiskId: activeDisks[bestIdx].id
        } as TangentSegment);
        
        // Advance
        currentIdx = bestIdx;
        currNormal = bestTangent.angle;
        
        // Stop if we returned to start
        // Condition: currentIdx == startIdx AND currNormal approx startNormalAngle?
        // Actually, just checking disk is enough if we trust convexity.
        // But for tangent graph, we might hit the same disk twice? 
        // Convex hull of disks visits each disk at most once (or contiguous arc).
        if (currentIdx === startIdx) {
            // Close the final arc
             let finalDelta = startNormalAngle - currNormal;
             while (finalDelta < 0) finalDelta += TWO_PI;
             
             if (finalDelta > EPS) {
                 segments.push({
                    type: 'ARC',
                    center: activeDisks[startIdx].center,
                    radius: activeDisks[startIdx].radius,
                    startAngle: currNormal,
                    endAngle: startNormalAngle,
                    chirality: 'L',
                    length: finalDelta * activeDisks[startIdx].radius,
                    diskId: activeDisks[startIdx].id
                } as ArcSegment);
             }
             break;
        }
        
        iter++;
        if (iter > maxIter) {
            console.error("RobustHull: Max iterations reached");
            break;
        }
        
    } while (true);
    
    return segments;
}


import type { CSDisk, Point2D } from '../types/cs';

/**
 * Calculates the center position of a rolling disk at a given angle theta around a pivot disk.
 */
export function calculateRollingPosition(
    pivot: CSDisk,
    rolling: CSDisk,
    theta: number
): Point2D {
    const dist = pivot.visualRadius + rolling.visualRadius;
    return {
        x: pivot.center.x + dist * Math.cos(theta),
        y: pivot.center.y + dist * Math.sin(theta)
    };
}

/**
 * Solves for the angle(s) theta around 'pivot' where 'rolling' would touch 'obstacle'.
 * Returns null if they cannot touch (too far or too close).
 * Returns array of angles (usually 2).
 */
export function solveIntersectionAngles(
    pivot: CSDisk,
    rolling: CSDisk,
    obstacle: CSDisk
): number[] | null {
    // We are looking for intersection of two circles:
    // 1. Center Pivot, Radius R1 = r_p + r_r
    // 2. Center Obstacle, Radius R2 = r_o + r_r

    const r1 = pivot.visualRadius + rolling.visualRadius;
    const r2 = obstacle.visualRadius + rolling.visualRadius;

    const dx = obstacle.center.x - pivot.center.x;
    const dy = obstacle.center.y - pivot.center.y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2);

    // Triangle inequality checks
    if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
        return null;
    }

    // Law of cosines / intersection math
    const a = (r1 * r1 - r2 * r2 + d2) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

    // P2 = P0 + a ( P1 - P0 ) / d
    const x2 = pivot.center.x + a * (dx / d);
    const y2 = pivot.center.y + a * (dy / d);

    // Two intersection points
    const ix1 = x2 + h * (dy / d);
    const iy1 = y2 - h * (dx / d);

    const ix2 = x2 - h * (dy / d);
    const iy2 = y2 + h * (dx / d);

    // Convert to angles relative to pivot
    const theta1 = Math.atan2(iy1 - pivot.center.y, ix1 - pivot.center.x);
    const theta2 = Math.atan2(iy2 - pivot.center.y, ix2 - pivot.center.x);

    return [theta1, theta2];
}

export interface CollisionResult {
    disk: CSDisk;
    theta: number;
    distance: number; // Angular distance from start
}

/**
 * Finds the nearest collision when rolling 'rolling' disk around 'pivot' 
 * starting from 'currentTheta' in 'direction'.
 */
export function findNextCollision(
    pivot: CSDisk,
    rolling: CSDisk,
    otherDisks: CSDisk[],
    currentTheta: number,
    direction: 1 | -1 // 1 for CCW, -1 for CW
): CollisionResult | null {
    let bestCollision: CollisionResult | null = null;
    let minAngDist = Infinity;

    // Normalize angle to [0, 2PI) for easier comparison if needed, 
    // but typically we just work with differences.
    const normalize = (ang: number) => {
        let a = ang % (2 * Math.PI);
        if (a < 0) a += 2 * Math.PI;
        return a;
    };

    for (const other of otherDisks) {
        if (other.id === pivot.id || other.id === rolling.id) continue;

        const angles = solveIntersectionAngles(pivot, rolling, other);
        if (!angles) continue;

        for (const targetTheta of angles) {
            // Calculate angular distance in the direction of rolling
            let diff = direction * (targetTheta - currentTheta);

            // Normalize diff to [0, 2PI)
            // If direction is 1 (CCW), we want positive diff (0 to 2PI)
            // If direction is -1 (CW), we want diff that represents "positive" time in that direction?
            // Actually simpler:
            // CCW: target > current. If target < current, target += 2PI.
            // CW: target < current. If target > current, target -= 2PI.

            // Let's use standard modulo arithmetic to find minimal positive forward distance
            // Forward distance in CCW (1): (target - current) modulo 2PI
            // Forward distance in CW (-1): (current - target) modulo 2PI

            let angDist = 0;
            if (direction === 1) {
                angDist = (targetTheta - currentTheta) % (2 * Math.PI);
                if (angDist < 0) angDist += 2 * Math.PI;
            } else {
                angDist = (currentTheta - targetTheta) % (2 * Math.PI);
                if (angDist < 0) angDist += 2 * Math.PI;
            }

            // Filter very small distances (floating point noise)
            // If it's effectively 0, it might be the contact we just left or are currently at.
            // We usually want the *next* collision.
            if (angDist < 1e-5) {
                // But wait, if we are at contact A, and roll away, we shouldn't hit A immediately.
                // If we are at contact A, angDist to A is 0. We want > 0.
                continue;
            }

            if (angDist < minAngDist) {
                minAngDist = angDist;
                bestCollision = {
                    disk: other,
                    theta: targetTheta,
                    distance: angDist
                };
            }
        }
    }

    return bestCollision;
}

/**
 * Checks if a specific configuration (theta) is valid (collision free).
 * Strictly checks for overlap < sum of radii.
 */
export function checkCollisionAt(
    pivot: CSDisk,
    rolling: CSDisk,
    otherDisks: CSDisk[],
    theta: number
): CSDisk | null {
    const pos = calculateRollingPosition(pivot, rolling, theta);

    for (const other of otherDisks) {
        if (other.id === pivot.id || other.id === rolling.id) continue;

        const dx = pos.x - other.center.x;
        const dy = pos.y - other.center.y;
        const distSq = dx * dx + dy * dy;
        const minById = rolling.visualRadius + other.visualRadius;
        // Using squared distance for perf
        if (distSq < (minById - 1e-4) ** 2) {
            return other;
        }
    }
    return null;
}

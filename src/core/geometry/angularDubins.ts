import { type Config, type DubinsPath, calculateDubinsPaths } from './dubins';
import { checkDubinsPathCollision } from './collision';
import { type Point2D } from '../types/cs';

export interface AngularRange {
    centerAngle: number;
    delta: number; // +/- radians
}

export interface DiskAnchor {
    disk: {
        id: string;
        center: Point2D;
        radius: number;
    };
    angle: number; // Anchor angle
    range: number; // Delta
}

/**
 * Solves the Restricted Dubins problem between two angular ranges on disks.
 * 
 * Strategy:
 * 1. Discretize the angular range on both disks.
 * 2. For each pair of angles (alpha, beta):
 *    - Construct Start Config at Disk A: (x, y, theta = alpha + pi/2 or alpha - pi/2)
 *    - Construct End Config at Disk B: (x, y, theta = beta + pi/2 or beta - pi/2)
 *    - We must try both Tangent directions (CW/CCW) unless chirality is constrained?
 *      - Usually, "Connections" imply a consistent flow. 
 *      - But without a defined sequence chirality, we should probably try all 4 combinations 
 *        (Left-Left, Left-Right, Right-Left, Right-Right) and pick the shortest?
 *      - Or rely on the `calculateDubinsPaths` to find the optimal LSL/RSR etc.
 * 3. Filter paths that:
 *    - Are valid Dubins paths.
 *    - Do not collide with the disks themselves (except at start/end).
 * 4. Return the global minimum length path.
 */
export function solveAngularDubins(
    start: DiskAnchor,
    end: DiskAnchor,
    obstacles: { x: number, y: number, radius: number }[] = [],
    samples: number = 5
): DubinsPath | null {

    const d1 = start.disk;
    const d2 = end.disk;

    const candidates: DubinsPath[] = [];

    // Helper to get samples
    const getSamples = (anchor: DiskAnchor) => {
        const angles: number[] = [];
        if (anchor.range <= 1e-6) return [anchor.angle];

        const step = (2 * anchor.range) / (samples - 1);
        for (let i = 0; i < samples; i++) {
            angles.push(anchor.angle - anchor.range + i * step);
        }
        return angles;
    };

    const startAngles = getSamples(start);
    const endAngles = getSamples(end);

    // Tangent Directions: +PI/2 (CCW/Left), -PI/2 (CW/Right)
    const offsets = [Math.PI / 2, -Math.PI / 2];

    for (const alpha of startAngles) {
        const p1 = {
            x: d1.center.x + d1.radius * Math.cos(alpha),
            y: d1.center.y + d1.radius * Math.sin(alpha)
        };

        for (const beta of endAngles) {
            const p2 = {
                x: d2.center.x + d2.radius * Math.cos(beta),
                y: d2.center.y + d2.radius * Math.sin(beta)
            };

            // Heuristic to verify if a straight line is "close enough"
            // If the geometric tangent angles align with alpha/beta, we might want a line.
            // But calculateDubinsPaths handles line logic (LSL/RSR with param1=0, param3=0 is a line segment).

            // Try all heading combinations
            for (const off1 of offsets) {
                const head1 = alpha + off1;

                for (const off2 of offsets) {
                    const head2 = beta + off2;

                    const c1: Config = { ...p1, theta: head1 };
                    const c2: Config = { ...p2, theta: head2 };

                    // Use the standard Dubins solver (Fixed Radius = avg or min?)
                    // The problem asks for "Continuity and min curvature".
                    // Usually we use the disk's own radius as the min turning radius (rho).
                    // Dubins solver takes a single rho.
                    // If radii differ, we need more complex solver or use min(r1, r2) or max?
                    // Safe be: use min radius to ensure navigability, or use the specific start/end rho if solver supported it.
                    // dubins.ts `calculateDubinsPaths` takes `rho`.
                    // Let's use the smaller radius as the constraint (tighter turns allowed).
                    const rho = Math.min(d1.radius, d2.radius);

                    const paths = calculateDubinsPaths(c1, c2, rho);
                    candidates.push(...paths);
                }
            }
        }
    }

    if (candidates.length === 0) return null;

    // Filter valid paths (sanity checks, e.g. collisions if we had obstacles)
    const validCandidates = obstacles ? candidates.filter(p => !checkDubinsPathCollision(p, obstacles)) : candidates;

    if (validCandidates.length === 0) return null;

    // Sort by length
    validCandidates.sort((a, b) => a.length - b.length);

    // Filter degenerate cases? 
    // If the shortest path is essentially a straight line (very low curvature use or param1/3 ~ 0), it's good.

    return validCandidates[0];
}

import { DubinsPathCalculator, type Pose2D } from '../../math/DubinsPath';
import { type Point2D } from '../../types/cs'; // Fixed relative import
import { checkDubinsPathCollision } from '../collision';
import { calculateDubinsPaths,type Config, type DubinsPath } from './dubins';

/**
 * Defines an angular range used for flexible contact points.
 */
export interface AngularRangeConfig { // Renamed to avoid partial overlap if any, but actually AngularRange is strict
    center: number; // Central angle in radians
    delta: number;  // Half-width of the range (range is [center - delta, center + delta])
}

// Re-using the name AngularRange from AngularRangeDubins but checking conflict 
// Existing angularDubins has: export interface AngularRange { centerAngle: number; delta: number; }
// They are different! center vs centerAngle.
// I should unify them or keep both.
// existing: centerAngle
// incoming: center
// I will keep the incoming one as `AngularRange` (it's what EnvelopePathCalculator uses)
// and rename the existing one or let them be compatible if I can?
// EnvelopePathCalculator uses `AngularRange` { center, delta }.
// So I must export `AngularRange` with `center`.
// Existing `AngularRange` in `angularDubins.ts` is `centerAngle`.
// I will Rename existing `AngularRange` to `DiskAngularRange` to avoid conflict, or just comment it out if unused?
// I'll stick to appending for now, but I need to handle the name collision.

// Actually, `solveAngularDubins` uses `DiskAnchor` which HAS `range: number`, doesn't use `AngularRange` interface directly?
// `export interface AngularRange` in lines 5-8 of angularDubins.ts.
// It IS exported.
// I'll rename the EXISTING one to `SimpleAngularRange` to avoid breaking changes if possible, but simpler to just replace/unify.
// I will replace `AngularRange` definition with the one from `AngularRangeDubins` (center, delta) if compatible.
// `solveAngularDubins` does NOT use `AngularRange` interface. It uses `DiskAnchor`.
// So I can safely replace/rename the interface.

/**
 * Represents a contact point on a disk with an associated allowed angular range.
 */
export interface ContactPointWithRange {
    disk: { center: Point2D; radius: number };
    range: AngularRange; // Uses the interface below
}

/**
 * configuration for the angular sampling
 */
export interface AngularSamplingConfig {
    numSamples: number; // Number of samples per range (must be >= 1)
    minRadius?: number; // Minimum turning radius for Dubins paths
}

export interface AngularRange {
    center: number;
    delta: number;
}


/**
 * Generates a list of angles uniformly sampled from the given angular range.
 */
export function generateAngularSamples(range: AngularRange, numSamples: number): number[] {
    if (numSamples <= 1) return [range.center];

    const start = range.center - range.delta;
    const end = range.center + range.delta;
    const step = (end - start) / (numSamples - 1);

    const samples: number[] = [];
    for (let i = 0; i < numSamples; i++) {
        samples.push(start + i * step);
    }
    return samples;
}

/**
 * Computes multiple candidate Dubins paths between two disks with angular ranges.
 * 
 * @param start - The starting contact point configuration.
 * @param end - The ending contact point configuration.
 * @param config - Sampling and Dubins configuration.
 * @returns An array of valid Dubins paths, sorted by total length (shortest first).
 */
export function computeDubinsWithRanges(
    start: ContactPointWithRange,
    end: ContactPointWithRange,
    config: AngularSamplingConfig
): DubinsPath[] {
    const startAngles = generateAngularSamples(start.range, config.numSamples);
    const endAngles = generateAngularSamples(end.range, config.numSamples);

    const rho = config.minRadius ?? 1.0;
    const calculator = new DubinsPathCalculator(rho);
    const paths: DubinsPath[] = [];

    for (const thetaStart of startAngles) {
        const startPos: Point2D = {
            x: start.disk.center.x + start.disk.radius * Math.cos(thetaStart),
            y: start.disk.center.y + start.disk.radius * Math.sin(thetaStart)
        };

        // Tangents: CCW and CW (Leaving the disk)
        const startHeadings = [thetaStart + Math.PI / 2, thetaStart - Math.PI / 2];

        for (const thetaEnd of endAngles) {
            const endPos: Point2D = {
                x: end.disk.center.x + end.disk.radius * Math.cos(thetaEnd),
                y: end.disk.center.y + end.disk.radius * Math.sin(thetaEnd)
            };

            const endHeadings = [thetaEnd + Math.PI / 2, thetaEnd - Math.PI / 2];

            for (const hStart of startHeadings) {
                const startPose: Pose2D = { position: startPos, theta: hStart };

                for (const hEnd of endHeadings) {
                    const endPose: Pose2D = { position: endPos, theta: hEnd };

                    const path = calculator.computeOptimalPath(startPose, endPose);
                    if (path && path.isValid && path.segments.length === 3) {
                        paths.push({
                            type: path.type as any, // Cast if DubinsType differs
                            length: path.totalLength,
                            param1: path.segments[0].length,
                            param2: path.segments[1].length,
                            param3: path.segments[2].length,
                            rho: rho,
                            start: { x: startPose.position.x, y: startPose.position.y, theta: startPose.theta },
                            end: { x: endPose.position.x, y: endPose.position.y, theta: endPose.theta }
                        });
                    }
                }
            }
        }
    }

    // Sort by length
    paths.sort((a, b) => a.length - b.length);

    return paths;
}


// Old AngularRange removed in favor of consolidated definition

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

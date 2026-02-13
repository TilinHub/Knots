import { DubinsPathCalculator, type Pose2D, type Point2D } from '../../core/math/DubinsPath';
import type { DubinsPath } from '../../core/geometry/dubins';

/**
 * Defines an angular range used for flexible contact points.
 */
export interface AngularRange {
    center: number; // Central angle in radians
    delta: number;  // Half-width of the range (range is [center - delta, center + delta])
}

/**
 * Represents a contact point on a disk with an associated allowed angular range.
 */
export interface ContactPointWithRange {
    disk: { center: Point2D; radius: number };
    range: AngularRange;
}

/**
 * configuration for the angular sampling
 */
export interface AngularSamplingConfig {
    numSamples: number; // Number of samples per range (must be >= 1)
    minRadius?: number; // Minimum turning radius for Dubins paths
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
                            type: path.type,
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

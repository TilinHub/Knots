/**
 * Public facade for Dubins paths.
 *
 * Source of truth: src/core/math/DubinsPath.ts
 * This module exposes a stable API under src/math/dubins.
 */

export {
  DubinsPathCalculator,
} from '../../core/math/DubinsPath';

export type {
  Point2D,
  Pose2D,
  DubinsSegment,
  DubinsPath,
} from '../../core/math/DubinsPath';

import { DubinsPathCalculator } from '../../core/math/DubinsPath';
import type { DubinsPath, Pose2D } from '../../core/math/DubinsPath';

export function calculateDubinsPath(
  start: Pose2D,
  end: Pose2D,
  minRadius: number = 1.0,
): DubinsPath | null {
  const calculator = new DubinsPathCalculator(minRadius);
  return calculator.computeOptimalPath(start, end);
}

/**
 * Total length of a Dubins path.
 * Falls back to summing segments if totalLength is missing.
 */
export function calculatePathLength(path: DubinsPath): number {
  if (Number.isFinite(path.totalLength)) return path.totalLength;
  return path.segments.reduce((sum, seg) => sum + seg.length, 0);
}

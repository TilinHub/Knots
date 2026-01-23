/**
 * Compatibility shim for Dubins utilities.
 *
 * Source of truth lives in: src/core/math/DubinsPath.ts
 *
 * This file exists to keep older imports working while the repository is being
 * refactored. Prefer importing from `src/core/math/DubinsPath` (or from the
 * public module `src/math/dubins`) going forward.
 */

import { DubinsPathCalculator, type DubinsPath } from './core/math/DubinsPath';

export type {
  Point2D,
  Pose2D,
  DubinsSegment,
  DubinsPath,
} from './core/math/DubinsPath';

export { DubinsPathCalculator };

/**
 * Legacy pose shape used by early code in this repo.
 *
 * Prefer `Pose2D` from `src/core/math/DubinsPath`.
 */
export interface LegacyPose2D {
  x: number;
  y: number;
  theta: number;
}

/**
 * Legacy wrapper kept for backwards compatibility.
 *
 * Prefer `DubinsPathCalculator`.
 */
export class DubinsPath2D {
  private readonly calc: DubinsPathCalculator;

  constructor(minRadius: number = 1.0) {
    this.calc = new DubinsPathCalculator(minRadius);
  }

  public computeOptimalPath(start: LegacyPose2D, end: LegacyPose2D): DubinsPath {
    const path = this.calc.computeOptimalPath(
      { position: { x: start.x, y: start.y }, theta: start.theta },
      { position: { x: end.x, y: end.y }, theta: end.theta },
    );

    return (
      path ?? {
        type: 'LSL',
        segments: [],
        totalLength: Infinity,
        isValid: false,
      }
    );
  }
}

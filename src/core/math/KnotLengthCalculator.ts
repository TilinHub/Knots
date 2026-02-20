/**
 * Knot Length Calculator using Dubins Paths
 *
 * Calculates the length of a knot's planar embedding using bounded curvature paths.
 * Based on the theory that any smooth curve can be approximated by Dubins paths,
 * which respect a maximum curvature constraint κ = 1/r.
 *
 * Mathematical Foundation:
 * ----------------------
 * Given a knot embedding as a sequence of control points P₀, P₁, ..., Pₙ in R²,
 * we construct a piecewise C² path with bounded curvature by:
 *
 * 1. Estimating tangent directions at each control point
 * 2. Creating poses (pᵢ, θᵢ) ∈ TR² at each point
 * 3. Computing Dubins paths between consecutive poses
 * 4. Summing the lengths: L_total = Σ L(pᵢ → pᵢ₊₁)
 *
 * For closed curves (knots), pₙ₊₁ = p₀
 */

import type { DubinsPath, Point2D, Pose2D } from './DubinsPath';
import { DubinsPathCalculator } from './DubinsPath';

/**
 * Knot embedding representation
 */
export interface KnotEmbedding {
  controlPoints: Point2D[];
  isClosed: boolean; // true for closed curves (knots)
  curvatureConstraint?: number; // κ = 1/r, default: 1.0
}

/**
 * Detailed length analysis result
 */
export interface KnotLengthAnalysis {
  totalLength: number;
  segmentLengths: number[];
  dubinsPaths: (DubinsPath | null)[];
  poses: Pose2D[];
  averageCurvature: number;
  maxCurvature: number;
  minRadius: number;
}

/**
 * Configuration for length calculation
 */
export interface LengthCalculationConfig {
  minRadius: number; // minimum turning radius
  tangentMethod: 'centered' | 'forward' | 'backward' | 'catmullrom';
  smoothing: boolean; // apply smoothing to tangent estimation
  tension?: number; // for Catmull-Rom, default: 0.5
}

/**
 * Calculator for knot lengths using Dubins path theory
 */
export class KnotLengthCalculator {
  private dubinsCalculator: DubinsPathCalculator;
  private config: LengthCalculationConfig;

  constructor(config?: Partial<LengthCalculationConfig>) {
    this.config = {
      minRadius: config?.minRadius ?? 1.0,
      tangentMethod: config?.tangentMethod ?? 'catmullrom',
      smoothing: config?.smoothing ?? true,
      tension: config?.tension ?? 0.5,
    };

    this.dubinsCalculator = new DubinsPathCalculator(this.config.minRadius);
  }

  /**
   * Compute total length of knot embedding
   *
   * @param embedding - Knot control points and configuration
   * @returns Total length in units (assuming minRadius = 1)
   */
  public computeLength(embedding: KnotEmbedding): number {
    const analysis = this.computeDetailedAnalysis(embedding);
    return analysis.totalLength;
  }

  /**
   * Compute detailed length analysis with all Dubins paths
   *
   * @param embedding - Knot control points
   * @returns Complete analysis including all segments
   */
  public computeDetailedAnalysis(embedding: KnotEmbedding): KnotLengthAnalysis {
    const poses = this.computePoses(embedding.controlPoints, embedding.isClosed);
    const numSegments = embedding.isClosed ? poses.length : poses.length - 1;

    const dubinsPaths: (DubinsPath | null)[] = [];
    const segmentLengths: number[] = [];
    let totalLength = 0;

    // Compute Dubins path for each consecutive pair
    for (let i = 0; i < numSegments; i++) {
      const start = poses[i];
      const end = poses[(i + 1) % poses.length];

      const path = this.dubinsCalculator.computeOptimalPath(start, end);
      dubinsPaths.push(path);

      const segmentLength = path ? path.totalLength : 0;
      segmentLengths.push(segmentLength);
      totalLength += segmentLength;
    }

    // Compute curvature statistics
    const curvatures = dubinsPaths
      .filter((p): p is DubinsPath => p !== null)
      .flatMap((p) =>
        p.segments.map((s) => (s.type !== 'S' ? 1 / (s.radius || this.config.minRadius) : 0)),
      );

    const maxCurvature = Math.max(...curvatures, 0);
    const averageCurvature =
      curvatures.length > 0 ? curvatures.reduce((a, b) => a + b, 0) / curvatures.length : 0;

    return {
      totalLength,
      segmentLengths,
      dubinsPaths,
      poses,
      averageCurvature,
      maxCurvature,
      minRadius: this.config.minRadius,
    };
  }

  /**
   * Convert control points to poses in tangent bundle TR²
   *
   * Each pose consists of (point, tangent_direction)
   *
   * @param points - Control points of the curve
   * @param isClosed - Whether the curve is closed (knot)
   * @returns Array of poses
   */
  private computePoses(points: Point2D[], isClosed: boolean): Pose2D[] {
    const n = points.length;
    const poses: Pose2D[] = [];

    for (let i = 0; i < n; i++) {
      const theta = this.estimateTangent(points, i, isClosed);

      poses.push({
        position: points[i],
        theta,
      });
    }

    return poses;
  }

  /**
   * Estimate tangent direction at a control point
   *
   * Methods:
   * - 'centered': (pᵢ₊₁ - pᵢ₋₁) / 2  [default for smooth curves]
   * - 'forward': pᵢ₊₁ - pᵢ
   * - 'backward': pᵢ - pᵢ₋₁
   * - 'catmullrom': Catmull-Rom tangent with tension parameter
   *
   * @param points - All control points
   * @param index - Current point index
   * @param isClosed - Is curve closed
   * @returns Tangent angle θ in radians
   */
  private estimateTangent(points: Point2D[], index: number, isClosed: boolean): number {
    const n = points.length;

    // Get neighboring indices
    const prevIdx = isClosed ? (index - 1 + n) % n : Math.max(0, index - 1);
    const nextIdx = isClosed ? (index + 1) % n : Math.min(n - 1, index + 1);

    const prev = points[prevIdx];
    const curr = points[index];
    const next = points[nextIdx];

    let dx: number, dy: number;

    switch (this.config.tangentMethod) {
      case 'forward':
        dx = next.x - curr.x;
        dy = next.y - curr.y;
        break;

      case 'backward':
        dx = curr.x - prev.x;
        dy = curr.y - prev.y;
        break;

      case 'catmullrom':
        // Catmull-Rom tangent: (1-tension) * (pᵢ₊₁ - pᵢ₋₁) / 2
        const tension = this.config.tension || 0.5;
        dx = ((1 - tension) * (next.x - prev.x)) / 2;
        dy = ((1 - tension) * (next.y - prev.y)) / 2;
        break;

      case 'centered':
      default:
        // Central difference
        dx = (next.x - prev.x) / 2;
        dy = (next.y - prev.y) / 2;
        break;
    }

    // Handle zero-length tangent
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
      // Fallback to forward difference
      dx = next.x - curr.x;
      dy = next.y - curr.y;
    }

    return Math.atan2(dy, dx);
  }

  /**
   * Smooth tangent angles to reduce oscillation
   * Applies moving average filter
   *
   * @param angles - Raw tangent angles
   * @param windowSize - Smoothing window (default: 3)
   * @returns Smoothed angles
   */
  private smoothAngles(angles: number[], windowSize: number = 3): number[] {
    if (!this.config.smoothing || windowSize < 2) {
      return angles;
    }

    const n = angles.length;
    const smoothed: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -halfWindow; j <= halfWindow; j++) {
        const idx = (i + j + n) % n;
        sum += angles[idx];
        count++;
      }

      smoothed.push(sum / count);
    }

    return smoothed;
  }

  /**
   * Validate knot embedding
   * Checks for degenerate cases
   */
  public validateEmbedding(embedding: KnotEmbedding): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum number of points
    if (embedding.controlPoints.length < 3) {
      errors.push('Knot must have at least 3 control points');
    }

    // Check for duplicate consecutive points
    for (let i = 0; i < embedding.controlPoints.length - 1; i++) {
      const p1 = embedding.controlPoints[i];
      const p2 = embedding.controlPoints[i + 1];
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

      if (dist < 1e-6) {
        warnings.push(`Duplicate points at indices ${i} and ${i + 1}`);
      }
    }

    // Check if points are too close relative to min radius
    const avgDistance = this.computeAverageDistance(embedding.controlPoints);
    if (avgDistance < this.config.minRadius) {
      warnings.push(
        `Average point spacing (${avgDistance.toFixed(2)}) is less than ` +
          `minimum radius (${this.config.minRadius}). ` +
          `This may cause issues with Dubins paths.`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Compute average distance between consecutive points
   */
  private computeAverageDistance(points: Point2D[]): number {
    if (points.length < 2) return 0;

    let totalDist = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      totalDist += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    return totalDist / (points.length - 1);
  }

  /**
   * Compare two embeddings
   * Useful for analyzing different representations of the same knot
   */
  public compareEmbeddings(embedding1: KnotEmbedding, embedding2: KnotEmbedding): ComparisonResult {
    const analysis1 = this.computeDetailedAnalysis(embedding1);
    const analysis2 = this.computeDetailedAnalysis(embedding2);

    const lengthDiff = Math.abs(analysis1.totalLength - analysis2.totalLength);
    const lengthRatio = analysis1.totalLength / analysis2.totalLength;

    const curvatureDiff = Math.abs(analysis1.averageCurvature - analysis2.averageCurvature);

    return {
      lengthDifference: lengthDiff,
      lengthRatio,
      curvatureDifference: curvatureDiff,
      embedding1Analysis: analysis1,
      embedding2Analysis: analysis2,
      isSimilar: lengthRatio > 0.95 && lengthRatio < 1.05,
    };
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComparisonResult {
  lengthDifference: number;
  lengthRatio: number;
  curvatureDifference: number;
  embedding1Analysis: KnotLengthAnalysis;
  embedding2Analysis: KnotLengthAnalysis;
  isSimilar: boolean;
}

/**
 * Helper function to create simple knot embeddings
 */
export function createKnotFromPoints(
  points: [number, number][],
  isClosed: boolean = true,
): KnotEmbedding {
  return {
    controlPoints: points.map(([x, y]) => ({ x, y })),
    isClosed,
  };
}

/**
 * Create a trefoil knot example
 * Classic 3-crossing knot in standard form
 */
export function createTrefoilKnot(scale: number = 2): KnotEmbedding {
  const points: Point2D[] = [];
  const numPoints = 100;

  for (let i = 0; i < numPoints; i++) {
    const t = (2 * Math.PI * i) / numPoints;

    // Trefoil parametric equations
    // x(t) = sin(t) + 2*sin(2t)
    // y(t) = cos(t) - 2*cos(2t)
    const x = scale * (Math.sin(t) + 2 * Math.sin(2 * t));
    const y = scale * (Math.cos(t) - 2 * Math.cos(2 * t));

    points.push({ x, y });
  }

  return {
    controlPoints: points,
    isClosed: true,
    curvatureConstraint: 1.0,
  };
}

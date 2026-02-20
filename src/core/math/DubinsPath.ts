/**
 * Dubins Path Implementation
 *
 * Based on the theory of bounded curvature paths from:
 * "Census of Bounded Curvature Paths" - Jean Díaz and José Ayala (2020)
 *
 * A bounded curvature path is a C¹ piecewise C² path with bounded absolute
 * curvature κ = 1/r connecting two points in the tangent bundle of a surface.
 *
 * Mathematical Foundation:
 * ------------------------
 * Given two elements in the tangent bundle TR² = (x, X), (y, Y) where:
 * - x, y ∈ R² are points in the plane
 * - X, Y are unit tangent vectors at those points
 * - κ = 1/r is the maximum allowed curvature (r = minimum turning radius)
 *
 * Dubins (1957) proved that minimal length paths are composed of:
 * 1. CSC paths: Circle-Straight-Circle (LSL, RSR, LSR, RSL)
 * 2. CCC paths: Circle-Circle-Circle (LRL, RLR)
 *
 * Where L = left turn, R = right turn, S = straight line
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Pose in tangent bundle TR²
 * Represents a point with tangent direction
 */
export interface Pose2D {
  position: Point2D;
  theta: number; // angle in radians, tangent direction
}

/**
 * Dubins segment: atomic piece of a Dubins path
 */
export interface DubinsSegment {
  type: 'L' | 'R' | 'S'; // Left arc, Right arc, Straight
  length: number;
  startPose: Pose2D;
  endPose: Pose2D;

  // For circular arcs (L, R)
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;

  // For straight segments (S)
  direction?: Point2D;
}

/**
 * Complete Dubins path with all segments
 */
export interface DubinsPath {
  type: 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'LRL' | 'RLR';
  segments: DubinsSegment[];
  totalLength: number;
  isValid: boolean;
}

/**
 * Dubins Path Calculator
 *
 * Implements all 6 types of Dubins paths for planar curves with bounded curvature
 */
export class DubinsPathCalculator {
  private readonly minRadius: number;
  private readonly kappa: number; // curvature κ = 1/r

  /**
   * @param minRadius - Minimum turning radius (default: 1.0)
   */
  constructor(minRadius: number = 1.0) {
    this.minRadius = minRadius;
    this.kappa = 1.0 / minRadius;
  }

  /**
   * Compute the optimal Dubins path between two poses
   * Returns the shortest valid path among all 6 types
   *
   * @param start - Starting pose (x, X) ∈ TR²
   * @param end - Ending pose (y, Y) ∈ TR²
   * @returns The shortest Dubins path or null if no valid path exists
   */
  public computeOptimalPath(start: Pose2D, end: Pose2D): DubinsPath | null {
    const paths: (DubinsPath | null)[] = [
      this.computeLSL(start, end),
      this.computeRSR(start, end),
      this.computeLSR(start, end),
      this.computeRSL(start, end),
      this.computeLRL(start, end),
      this.computeRLR(start, end),
    ];

    // Filter valid paths
    const validPaths = paths.filter((p): p is DubinsPath => p !== null && p.isValid);

    if (validPaths.length === 0) {
      return null;
    }

    // Return path with minimum length
    return validPaths.reduce((shortest, current) =>
      current.totalLength < shortest.totalLength ? current : shortest,
    );
  }

  /**
   * Compute all 6 Dubins paths
   * Useful for visualization and analysis
   */
  public computeAllPaths(start: Pose2D, end: Pose2D): DubinsPath[] {
    const paths = [
      this.computeLSL(start, end),
      this.computeRSR(start, end),
      this.computeLSR(start, end),
      this.computeRSL(start, end),
      this.computeLRL(start, end),
      this.computeRLR(start, end),
    ];

    return paths.filter((p): p is DubinsPath => p !== null && p.isValid);
  }

  // ============================================================================
  // CSC PATHS: Circle-Straight-Circle
  // ============================================================================

  /**
   * LSL Path: Left-Straight-Left
   *
   * Construction:
   * 1. Compute left circle centers at start and end: C_l(start), C_l(end)
   * 2. Find external tangent between circles
   * 3. Path: Arc from start to tangent point on C_l(start)
   *          → Straight line along tangent
   *          → Arc from tangent point to end on C_l(end)
   */
  public computeLSL(start: Pose2D, end: Pose2D): DubinsPath | null {
    const clStart = this.getLeftCircleCenter(start);
    const clEnd = this.getLeftCircleCenter(end);

    // Check if circles are too close (distance < 2r)
    const centerDist = this.distance(clStart, clEnd);
    if (centerDist < 2 * this.minRadius - 1e-6) {
      return null;
    }

    // External tangent for left-left configuration
    const tangent = this.computeExternalTangent(clStart, clEnd, 'left');
    if (!tangent) {
      return null;
    }

    // Compute arc lengths
    const arc1Length = this.computeLeftArcLength(start, tangent.startPoint, clStart);
    const lineLength = this.distance(tangent.startPoint, tangent.endPoint);
    const arc2Length = this.computeLeftArcLength(tangent.endPoint, end, clEnd);

    const totalLength = arc1Length + lineLength + arc2Length;

    // Build segments
    const segments: DubinsSegment[] = [
      {
        type: 'L',
        length: arc1Length,
        startPose: start,
        endPose: { position: tangent.startPoint, theta: tangent.angle },
        center: clStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: tangent.angle,
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { position: tangent.startPoint, theta: tangent.angle },
        endPose: { position: tangent.endPoint, theta: tangent.angle },
        direction: this.normalize({
          x: tangent.endPoint.x - tangent.startPoint.x,
          y: tangent.endPoint.y - tangent.startPoint.y,
        }),
      },
      {
        type: 'L',
        length: arc2Length,
        startPose: { position: tangent.endPoint, theta: tangent.angle },
        endPose: end,
        center: clEnd,
        radius: this.minRadius,
        startAngle: tangent.angle,
        endAngle: end.theta,
      },
    ];

    return {
      type: 'LSL',
      segments,
      totalLength,
      isValid: true,
    };
  }

  /**
   * RSR Path: Right-Straight-Right
   * Analogous to LSL but using right circles
   */
  public computeRSR(start: Pose2D, end: Pose2D): DubinsPath | null {
    const crStart = this.getRightCircleCenter(start);
    const crEnd = this.getRightCircleCenter(end);

    const centerDist = this.distance(crStart, crEnd);
    if (centerDist < 2 * this.minRadius - 1e-6) {
      return null;
    }

    const tangent = this.computeExternalTangent(crStart, crEnd, 'right');
    if (!tangent) {
      return null;
    }

    const arc1Length = this.computeRightArcLength(start, tangent.startPoint, crStart);
    const lineLength = this.distance(tangent.startPoint, tangent.endPoint);
    const arc2Length = this.computeRightArcLength(tangent.endPoint, end, crEnd);

    const totalLength = arc1Length + lineLength + arc2Length;

    const segments: DubinsSegment[] = [
      {
        type: 'R',
        length: arc1Length,
        startPose: start,
        endPose: { position: tangent.startPoint, theta: tangent.angle },
        center: crStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: tangent.angle,
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { position: tangent.startPoint, theta: tangent.angle },
        endPose: { position: tangent.endPoint, theta: tangent.angle },
        direction: this.normalize({
          x: tangent.endPoint.x - tangent.startPoint.x,
          y: tangent.endPoint.y - tangent.startPoint.y,
        }),
      },
      {
        type: 'R',
        length: arc2Length,
        startPose: { position: tangent.endPoint, theta: tangent.angle },
        endPose: end,
        center: crEnd,
        radius: this.minRadius,
        startAngle: tangent.angle,
        endAngle: end.theta,
      },
    ];

    return {
      type: 'RSR',
      segments,
      totalLength,
      isValid: true,
    };
  }

  /**
   * LSR Path: Left-Straight-Right
   * Uses internal tangent between left and right circles
   */
  public computeLSR(start: Pose2D, end: Pose2D): DubinsPath | null {
    const clStart = this.getLeftCircleCenter(start);
    const crEnd = this.getRightCircleCenter(end);

    const tangent = this.computeInternalTangent(clStart, crEnd);
    if (!tangent) {
      return null;
    }

    const arc1Length = this.computeLeftArcLength(start, tangent.startPoint, clStart);
    const lineLength = this.distance(tangent.startPoint, tangent.endPoint);
    const arc2Length = this.computeRightArcLength(tangent.endPoint, end, crEnd);

    const totalLength = arc1Length + lineLength + arc2Length;

    const segments: DubinsSegment[] = [
      {
        type: 'L',
        length: arc1Length,
        startPose: start,
        endPose: { position: tangent.startPoint, theta: tangent.angle },
        center: clStart,
        radius: this.minRadius,
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { position: tangent.startPoint, theta: tangent.angle },
        endPose: { position: tangent.endPoint, theta: tangent.angle },
      },
      {
        type: 'R',
        length: arc2Length,
        startPose: { position: tangent.endPoint, theta: tangent.angle },
        endPose: end,
        center: crEnd,
        radius: this.minRadius,
      },
    ];

    return {
      type: 'LSR',
      segments,
      totalLength,
      isValid: true,
    };
  }

  /**
   * RSL Path: Right-Straight-Left
   * Mirror of LSR
   */
  public computeRSL(start: Pose2D, end: Pose2D): DubinsPath | null {
    const crStart = this.getRightCircleCenter(start);
    const clEnd = this.getLeftCircleCenter(end);

    const tangent = this.computeInternalTangent(crStart, clEnd);
    if (!tangent) {
      return null;
    }

    const arc1Length = this.computeRightArcLength(start, tangent.startPoint, crStart);
    const lineLength = this.distance(tangent.startPoint, tangent.endPoint);
    const arc2Length = this.computeLeftArcLength(tangent.endPoint, end, clEnd);

    const totalLength = arc1Length + lineLength + arc2Length;

    const segments: DubinsSegment[] = [
      {
        type: 'R',
        length: arc1Length,
        startPose: start,
        endPose: { position: tangent.startPoint, theta: tangent.angle },
        center: crStart,
        radius: this.minRadius,
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { position: tangent.startPoint, theta: tangent.angle },
        endPose: { position: tangent.endPoint, theta: tangent.angle },
      },
      {
        type: 'L',
        length: arc2Length,
        startPose: { position: tangent.endPoint, theta: tangent.angle },
        endPose: end,
        center: clEnd,
        radius: this.minRadius,
      },
    ];

    return {
      type: 'RSL',
      segments,
      totalLength,
      isValid: true,
    };
  }

  // ============================================================================
  // CCC PATHS: Circle-Circle-Circle
  // ============================================================================

  /**
   * LRL Path: Left-Right-Left
   * Three circles with a middle circle tangent to both outer circles
   */
  public computeLRL(start: Pose2D, end: Pose2D): DubinsPath | null {
    const clStart = this.getLeftCircleCenter(start);
    const clEnd = this.getLeftCircleCenter(end);

    const centerDist = this.distance(clStart, clEnd);

    // For LRL, the middle circle must fit between the two left circles
    // Maximum distance is 4r (two radii from each circle to middle circle)
    if (centerDist > 4 * this.minRadius) {
      return null;
    }

    // Compute middle right circle center
    // It must be at distance 2r from both clStart and clEnd
    const middleCircle = this.computeMiddleCircleLRL(clStart, clEnd);
    if (!middleCircle) {
      return null;
    }

    // Tangent points
    const tangent1 = this.computeTangentPoint(clStart, middleCircle, 'left-right');
    const tangent2 = this.computeTangentPoint(middleCircle, clEnd, 'right-left');

    const arc1Length = this.computeLeftArcLength(start, tangent1, clStart);
    const arc2Length = this.computeRightArcLength(tangent1, tangent2, middleCircle);
    const arc3Length = this.computeLeftArcLength(tangent2, end, clEnd);

    const totalLength = arc1Length + arc2Length + arc3Length;

    const segments: DubinsSegment[] = [
      {
        type: 'L',
        length: arc1Length,
        startPose: start,
        endPose: { position: tangent1, theta: this.getTangentAngle(clStart, tangent1, 'left') },
        center: clStart,
        radius: this.minRadius,
      },
      {
        type: 'R',
        length: arc2Length,
        startPose: { position: tangent1, theta: this.getTangentAngle(clStart, tangent1, 'left') },
        endPose: {
          position: tangent2,
          theta: this.getTangentAngle(middleCircle, tangent2, 'right'),
        },
        center: middleCircle,
        radius: this.minRadius,
      },
      {
        type: 'L',
        length: arc3Length,
        startPose: {
          position: tangent2,
          theta: this.getTangentAngle(middleCircle, tangent2, 'right'),
        },
        endPose: end,
        center: clEnd,
        radius: this.minRadius,
      },
    ];

    return {
      type: 'LRL',
      segments,
      totalLength,
      isValid: true,
    };
  }

  /**
   * RLR Path: Right-Left-Right
   * Mirror of LRL
   */
  public computeRLR(start: Pose2D, end: Pose2D): DubinsPath | null {
    const crStart = this.getRightCircleCenter(start);
    const crEnd = this.getRightCircleCenter(end);

    const centerDist = this.distance(crStart, crEnd);

    if (centerDist > 4 * this.minRadius) {
      return null;
    }

    const middleCircle = this.computeMiddleCircleRLR(crStart, crEnd);
    if (!middleCircle) {
      return null;
    }

    const tangent1 = this.computeTangentPoint(crStart, middleCircle, 'right-left');
    const tangent2 = this.computeTangentPoint(middleCircle, crEnd, 'left-right');

    const arc1Length = this.computeRightArcLength(start, tangent1, crStart);
    const arc2Length = this.computeLeftArcLength(tangent1, tangent2, middleCircle);
    const arc3Length = this.computeRightArcLength(tangent2, end, crEnd);

    const totalLength = arc1Length + arc2Length + arc3Length;

    const segments: DubinsSegment[] = [
      {
        type: 'R',
        length: arc1Length,
        startPose: start,
        endPose: { position: tangent1, theta: this.getTangentAngle(crStart, tangent1, 'right') },
        center: crStart,
        radius: this.minRadius,
      },
      {
        type: 'L',
        length: arc2Length,
        startPose: { position: tangent1, theta: this.getTangentAngle(crStart, tangent1, 'right') },
        endPose: {
          position: tangent2,
          theta: this.getTangentAngle(middleCircle, tangent2, 'left'),
        },
        center: middleCircle,
        radius: this.minRadius,
      },
      {
        type: 'R',
        length: arc3Length,
        startPose: {
          position: tangent2,
          theta: this.getTangentAngle(middleCircle, tangent2, 'left'),
        },
        endPose: end,
        center: crEnd,
        radius: this.minRadius,
      },
    ];

    return {
      type: 'RLR',
      segments,
      totalLength,
      isValid: true,
    };
  }

  // ============================================================================
  // GEOMETRIC HELPER FUNCTIONS
  // ============================================================================

  /**
   * Get center of left turning circle at given pose
   * Center is at position + r * perpendicular(left)
   */
  private getLeftCircleCenter(pose: Pose2D): Point2D {
    return {
      x: pose.position.x - this.minRadius * Math.sin(pose.theta),
      y: pose.position.y + this.minRadius * Math.cos(pose.theta),
    };
  }

  /**
   * Get center of right turning circle at given pose
   * Center is at position + r * perpendicular(right)
   */
  private getRightCircleCenter(pose: Pose2D): Point2D {
    return {
      x: pose.position.x + this.minRadius * Math.sin(pose.theta),
      y: pose.position.y - this.minRadius * Math.cos(pose.theta),
    };
  }

  /**
   * Compute external tangent between two circles
   */
  private computeExternalTangent(
    c1: Point2D,
    c2: Point2D,
    side: 'left' | 'right',
  ): { startPoint: Point2D; endPoint: Point2D; angle: number } | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 2 * this.minRadius - 1e-6) {
      return null;
    }

    // Angle between circle centers
    const baseAngle = Math.atan2(dy, dx);

    // Tangent angle offset (for external tangent of equal radii circles)
    const offset = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    const tangentAngle = baseAngle + offset;

    const startPoint: Point2D = {
      x: c1.x + this.minRadius * Math.cos(tangentAngle),
      y: c1.y + this.minRadius * Math.sin(tangentAngle),
    };

    const endPoint: Point2D = {
      x: c2.x + this.minRadius * Math.cos(tangentAngle),
      y: c2.y + this.minRadius * Math.sin(tangentAngle),
    };

    return {
      startPoint,
      endPoint,
      angle: baseAngle,
    };
  }

  /**
   * Compute internal tangent between two circles (for LSR, RSL)
   */
  private computeInternalTangent(
    c1: Point2D,
    c2: Point2D,
  ): { startPoint: Point2D; endPoint: Point2D; angle: number } | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    // Internal tangent requires minimum distance of 2r
    if (d < 2 * this.minRadius - 1e-6) {
      return null;
    }

    const baseAngle = Math.atan2(dy, dx);

    // For internal tangent, angle is perpendicular to line between centers
    const alpha = Math.asin((2 * this.minRadius) / d);
    const tangentAngle = baseAngle + alpha;

    const startPoint: Point2D = {
      x: c1.x + this.minRadius * Math.cos(tangentAngle + Math.PI / 2),
      y: c1.y + this.minRadius * Math.sin(tangentAngle + Math.PI / 2),
    };

    const endPoint: Point2D = {
      x: c2.x - this.minRadius * Math.cos(tangentAngle + Math.PI / 2),
      y: c2.y - this.minRadius * Math.sin(tangentAngle + Math.PI / 2),
    };

    return {
      startPoint,
      endPoint,
      angle: tangentAngle,
    };
  }

  /**
   * Compute middle circle for LRL path
   */
  private computeMiddleCircleLRL(c1: Point2D, c2: Point2D): Point2D | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 4 * this.minRadius || d < 1e-6) {
      return null;
    }

    // Middle point between circles
    const mid: Point2D = {
      x: (c1.x + c2.x) / 2,
      y: (c1.y + c2.y) / 2,
    };

    // Distance from midpoint to middle circle center
    const h = Math.sqrt(4 * this.minRadius * this.minRadius - (d / 2) * (d / 2));

    // Perpendicular direction
    const angle = Math.atan2(dy, dx) + Math.PI / 2;

    return {
      x: mid.x + h * Math.cos(angle),
      y: mid.y + h * Math.sin(angle),
    };
  }

  /**
   * Compute middle circle for RLR path
   */
  private computeMiddleCircleRLR(c1: Point2D, c2: Point2D): Point2D | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 4 * this.minRadius || d < 1e-6) {
      return null;
    }

    const mid: Point2D = {
      x: (c1.x + c2.x) / 2,
      y: (c1.y + c2.y) / 2,
    };

    const h = Math.sqrt(4 * this.minRadius * this.minRadius - (d / 2) * (d / 2));
    const angle = Math.atan2(dy, dx) - Math.PI / 2;

    return {
      x: mid.x + h * Math.cos(angle),
      y: mid.y + h * Math.sin(angle),
    };
  }

  /**
   * Compute tangent point between two circles
   */
  private computeTangentPoint(
    c1: Point2D,
    c2: Point2D,
    config: 'left-right' | 'right-left',
  ): Point2D {
    const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
    const offset = config === 'left-right' ? -Math.PI / 2 : Math.PI / 2;

    return {
      x: c1.x + this.minRadius * Math.cos(angle + offset),
      y: c1.y + this.minRadius * Math.sin(angle + offset),
    };
  }

  /**
   * Compute arc length for left turn
   */
  private computeLeftArcLength(
    start: Pose2D | Point2D,
    end: Pose2D | Point2D,
    center: Point2D,
  ): number {
    const startPos = 'position' in start ? start.position : start;
    const endPos = 'position' in end ? end.position : end;

    const angle1 = Math.atan2(startPos.y - center.y, startPos.x - center.x);
    const angle2 = Math.atan2(endPos.y - center.y, endPos.x - center.x);

    let deltaAngle = angle2 - angle1;
    if (deltaAngle < 0) {
      deltaAngle += 2 * Math.PI;
    }

    return this.minRadius * deltaAngle;
  }

  /**
   * Compute arc length for right turn
   */
  private computeRightArcLength(
    start: Pose2D | Point2D,
    end: Pose2D | Point2D,
    center: Point2D,
  ): number {
    const startPos = 'position' in start ? start.position : start;
    const endPos = 'position' in end ? end.position : end;

    const angle1 = Math.atan2(startPos.y - center.y, startPos.x - center.x);
    const angle2 = Math.atan2(endPos.y - center.y, endPos.x - center.x);

    let deltaAngle = angle1 - angle2;
    if (deltaAngle < 0) {
      deltaAngle += 2 * Math.PI;
    }

    return this.minRadius * deltaAngle;
  }

  /**
   * Get tangent angle at a point on a circle
   */
  private getTangentAngle(center: Point2D, point: Point2D, side: 'left' | 'right'): number {
    const radialAngle = Math.atan2(point.y - center.y, point.x - center.x);
    return side === 'left' ? radialAngle + Math.PI / 2 : radialAngle - Math.PI / 2;
  }

  /**
   * Distance between two points
   */
  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Normalize a vector
   */
  private normalize(v: Point2D): Point2D {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    return mag > 0 ? { x: v.x / mag, y: v.y / mag } : { x: 0, y: 0 };
  }
}

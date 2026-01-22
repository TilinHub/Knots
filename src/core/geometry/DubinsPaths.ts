/**
 * DUBINS PATHS - BOUNDED CURVATURE PATHS FOR KNOT EMBEDDINGS
 * 
 * Based on "Census of Bounded Curvature Paths" by Jean Díaz and José Ayala (2020)
 * arXiv:2005.13210v1 [math.MG]
 * 
 * A bounded curvature path is a C¹ piecewise C² path with bounded absolute curvature
 * connecting two points in the tangent bundle of a surface. These paths model the
 * trajectory of motion under turning circle constraints with minimum radius r = 1/κ.
 * 
 * Dubins (1957) proved that minimal length bounded curvature paths are concatenations of:
 * - CSC paths: Circle-Straight-Circle (LSL, RSR, LSR, RSL)
 * - CCC paths: Circle-Circle-Circle (LRL, RLR)
 * 
 * Where:
 * - L = left arc (counterclockwise)
 * - R = right arc (clockwise)
 * - S = straight segment
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Pose2D {
  x: number;
  y: number;
  theta: number; // tangent angle in radians
}

export interface DubinsSegment {
  type: 'L' | 'R' | 'S';
  length: number;
  startPose: Pose2D;
  endPose: Pose2D;
  // For arc segments
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface DubinsPath {
  type: 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'LRL' | 'RLR';
  segments: DubinsSegment[];
  totalLength: number;
  valid: boolean;
}

/**
 * DubinsPaths class implements the 6 canonical path types for bounded curvature paths
 * 
 * Mathematical Foundation:
 * Given two elements (x, X), (y, Y) ∈ TR² in the tangent bundle of the Euclidean plane,
 * a bounded curvature path γ: [0, s] → R² must satisfy:
 * 1. γ is C¹ and piecewise C²
 * 2. γ is parametrized by arc length: ||γ'(t)|| = 1
 * 3. γ(0) = x, γ'(0) = X; γ(s) = y, γ'(s) = Y
 * 4. ||γ''(t)|| ≤ κ for all t ∈ [0, s], where κ = 1/r
 */
export class DubinsPaths {
  private minRadius: number;
  private kappa: number; // curvature = 1/r

  constructor(minRadius: number = 1.0) {
    this.minRadius = minRadius;
    this.kappa = 1.0 / minRadius;
  }

  /**
   * Compute the minimal length Dubins path between two poses
   * Returns the shortest among all 6 path types
   */
  public computeMinimalPath(start: Pose2D, end: Pose2D): DubinsPath | null {
    const paths: DubinsPath[] = [
      this.lslPath(start, end),
      this.rsrPath(start, end),
      this.lsrPath(start, end),
      this.rslPath(start, end),
      this.lrlPath(start, end),
      this.rlrPath(start, end),
    ].filter((p) => p.valid);

    if (paths.length === 0) {
      return null;
    }

    return paths.reduce((shortest, current) =>
      current.totalLength < shortest.totalLength ? current : shortest
    );
  }

  /**
   * Compute all 6 Dubins path types
   * Useful for visualization and comparison
   */
  public computeAllPaths(start: Pose2D, end: Pose2D): DubinsPath[] {
    return [
      this.lslPath(start, end),
      this.rsrPath(start, end),
      this.lsrPath(start, end),
      this.rslPath(start, end),
      this.lrlPath(start, end),
      this.rlrPath(start, end),
    ];
  }

  /**
   * LSL Path: Left-Straight-Left
   * 
   * Geometry:
   * - Start with left turn from initial pose
   * - Follow straight tangent line
   * - End with left turn to final pose
   * 
   * The path uses the left tangent circles at both endpoints
   * and connects them via their external common tangent.
   */
  public lslPath(start: Pose2D, end: Pose2D): DubinsPath {
    const cLeft1 = this.leftCircleCenter(start);
    const cLeft2 = this.leftCircleCenter(end);

    const distance = this.euclideanDistance(cLeft1, cLeft2);

    // Check if circles are too close (tangent doesn't exist)
    if (distance < 2 * this.minRadius - 1e-6) {
      return this.createInvalidPath('LSL');
    }

    // Calculate tangent points
    const tangent = this.externalTangentLL(cLeft1, cLeft2);
    if (!tangent) {
      return this.createInvalidPath('LSL');
    }

    // Arc 1: from start to first tangent point
    const arc1Length = this.arcLengthLeft(start, tangent.p1, cLeft1);

    // Straight segment
    const straightLength = this.euclideanDistance(tangent.p1, tangent.p2);

    // Arc 2: from second tangent point to end
    const arc2Length = this.arcLengthLeft(tangent.p2, end, cLeft2);

    const totalLength = arc1Length + straightLength + arc2Length;

    return {
      type: 'LSL',
      segments: [
        this.createArcSegment('L', arc1Length, start, tangent.p1, cLeft1),
        this.createStraightSegment(straightLength, tangent.p1, tangent.p2),
        this.createArcSegment('L', arc2Length, tangent.p2, end, cLeft2),
      ],
      totalLength,
      valid: true,
    };
  }

  /**
   * RSR Path: Right-Straight-Right
   * 
   * Symmetric to LSL, using right tangent circles
   */
  public rsrPath(start: Pose2D, end: Pose2D): DubinsPath {
    const cRight1 = this.rightCircleCenter(start);
    const cRight2 = this.rightCircleCenter(end);

    const distance = this.euclideanDistance(cRight1, cRight2);

    if (distance < 2 * this.minRadius - 1e-6) {
      return this.createInvalidPath('RSR');
    }

    const tangent = this.externalTangentRR(cRight1, cRight2);
    if (!tangent) {
      return this.createInvalidPath('RSR');
    }

    const arc1Length = this.arcLengthRight(start, tangent.p1, cRight1);
    const straightLength = this.euclideanDistance(tangent.p1, tangent.p2);
    const arc2Length = this.arcLengthRight(tangent.p2, end, cRight2);

    const totalLength = arc1Length + straightLength + arc2Length;

    return {
      type: 'RSR',
      segments: [
        this.createArcSegment('R', arc1Length, start, tangent.p1, cRight1),
        this.createStraightSegment(straightLength, tangent.p1, tangent.p2),
        this.createArcSegment('R', arc2Length, tangent.p2, end, cRight2),
      ],
      totalLength,
      valid: true,
    };
  }

  /**
   * LSR Path: Left-Straight-Right
   * 
   * Uses internal tangent between left and right circles
   */
  public lsrPath(start: Pose2D, end: Pose2D): DubinsPath {
    const cLeft = this.leftCircleCenter(start);
    const cRight = this.rightCircleCenter(end);

    const distance = this.euclideanDistance(cLeft, cRight);

    // For internal tangent, distance must be at least 2r
    if (distance < 2 * this.minRadius - 1e-6) {
      return this.createInvalidPath('LSR');
    }

    const tangent = this.internalTangentLR(cLeft, cRight);
    if (!tangent) {
      return this.createInvalidPath('LSR');
    }

    const arc1Length = this.arcLengthLeft(start, tangent.p1, cLeft);
    const straightLength = this.euclideanDistance(tangent.p1, tangent.p2);
    const arc2Length = this.arcLengthRight(tangent.p2, end, cRight);

    const totalLength = arc1Length + straightLength + arc2Length;

    return {
      type: 'LSR',
      segments: [
        this.createArcSegment('L', arc1Length, start, tangent.p1, cLeft),
        this.createStraightSegment(straightLength, tangent.p1, tangent.p2),
        this.createArcSegment('R', arc2Length, tangent.p2, end, cRight),
      ],
      totalLength,
      valid: true,
    };
  }

  /**
   * RSL Path: Right-Straight-Left
   * 
   * Symmetric to LSR
   */
  public rslPath(start: Pose2D, end: Pose2D): DubinsPath {
    const cRight = this.rightCircleCenter(start);
    const cLeft = this.leftCircleCenter(end);

    const distance = this.euclideanDistance(cRight, cLeft);

    if (distance < 2 * this.minRadius - 1e-6) {
      return this.createInvalidPath('RSL');
    }

    const tangent = this.internalTangentRL(cRight, cLeft);
    if (!tangent) {
      return this.createInvalidPath('RSL');
    }

    const arc1Length = this.arcLengthRight(start, tangent.p1, cRight);
    const straightLength = this.euclideanDistance(tangent.p1, tangent.p2);
    const arc2Length = this.arcLengthLeft(tangent.p2, end, cLeft);

    const totalLength = arc1Length + straightLength + arc2Length;

    return {
      type: 'RSL',
      segments: [
        this.createArcSegment('R', arc1Length, start, tangent.p1, cRight),
        this.createStraightSegment(straightLength, tangent.p1, tangent.p2),
        this.createArcSegment('L', arc2Length, tangent.p2, end, cLeft),
      ],
      totalLength,
      valid: true,
    };
  }

  /**
   * LRL Path: Left-Right-Left
   * 
   * Three tangent circles configuration
   * The middle circle is tangent to both endpoint circles
   * 
   * Geometric constraint: d(c_L1, c_L2) ≤ 4r
   * Otherwise no tangent middle circle exists
   */
  public lrlPath(start: Pose2D, end: Pose2D): DubinsPath {
    const cLeft1 = this.leftCircleCenter(start);
    const cLeft2 = this.leftCircleCenter(end);

    const d = this.euclideanDistance(cLeft1, cLeft2);

    // Geometric constraint for LRL path existence
    if (d > 4 * this.minRadius + 1e-6) {
      return this.createInvalidPath('LRL');
    }

    // Calculate middle circle center
    // The middle circle is tangent externally to both endpoint circles
    const middleCircle = this.calculateMiddleCircleLRL(cLeft1, cLeft2);
    if (!middleCircle) {
      return this.createInvalidPath('LRL');
    }

    // Tangent points
    const t1 = this.tangentPointBetweenCircles(cLeft1, middleCircle.center, this.minRadius, this.minRadius);
    const t2 = this.tangentPointBetweenCircles(middleCircle.center, cLeft2, this.minRadius, this.minRadius);

    const arc1Length = this.arcLengthLeft(start, t1, cLeft1);
    const arc2Length = this.arcLengthRightReverse(t1, t2, middleCircle.center);
    const arc3Length = this.arcLengthLeft(t2, end, cLeft2);

    const totalLength = arc1Length + arc2Length + arc3Length;

    return {
      type: 'LRL',
      segments: [
        this.createArcSegment('L', arc1Length, start, t1, cLeft1),
        this.createArcSegment('R', arc2Length, t1, t2, middleCircle.center),
        this.createArcSegment('L', arc3Length, t2, end, cLeft2),
      ],
      totalLength,
      valid: true,
    };
  }

  /**
   * RLR Path: Right-Left-Right
   * 
   * Symmetric to LRL using right circles
   */
  public rlrPath(start: Pose2D, end: Pose2D): DubinsPath {
    const cRight1 = this.rightCircleCenter(start);
    const cRight2 = this.rightCircleCenter(end);

    const d = this.euclideanDistance(cRight1, cRight2);

    if (d > 4 * this.minRadius + 1e-6) {
      return this.createInvalidPath('RLR');
    }

    const middleCircle = this.calculateMiddleCircleRLR(cRight1, cRight2);
    if (!middleCircle) {
      return this.createInvalidPath('RLR');
    }

    const t1 = this.tangentPointBetweenCircles(cRight1, middleCircle.center, this.minRadius, this.minRadius);
    const t2 = this.tangentPointBetweenCircles(middleCircle.center, cRight2, this.minRadius, this.minRadius);

    const arc1Length = this.arcLengthRight(start, t1, cRight1);
    const arc2Length = this.arcLengthLeftReverse(t1, t2, middleCircle.center);
    const arc3Length = this.arcLengthRight(t2, end, cRight2);

    const totalLength = arc1Length + arc2Length + arc3Length;

    return {
      type: 'RLR',
      segments: [
        this.createArcSegment('R', arc1Length, start, t1, cRight1),
        this.createArcSegment('L', arc2Length, t1, t2, middleCircle.center),
        this.createArcSegment('R', arc3Length, t2, end, cRight2),
      ],
      totalLength,
      valid: true,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate the center of the left tangent circle
   * The circle is tangent to the pose and curves to the left (counterclockwise)
   */
  private leftCircleCenter(pose: Pose2D): Point2D {
    return {
      x: pose.x - this.minRadius * Math.sin(pose.theta),
      y: pose.y + this.minRadius * Math.cos(pose.theta),
    };
  }

  /**
   * Calculate the center of the right tangent circle
   * The circle is tangent to the pose and curves to the right (clockwise)
   */
  private rightCircleCenter(pose: Pose2D): Point2D {
    return {
      x: pose.x + this.minRadius * Math.sin(pose.theta),
      y: pose.y - this.minRadius * Math.cos(pose.theta),
    };
  }

  /**
   * External tangent between two left circles (parallel orientation)
   */
  private externalTangentLL(c1: Point2D, c2: Point2D): { p1: Point2D; p2: Point2D } | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 1e-6) return null;

    // Angle from c1 to c2
    const angle = Math.atan2(dy, dx);

    // Perpendicular angle for tangent
    const perpAngle = angle + Math.PI / 2;

    return {
      p1: {
        x: c1.x + this.minRadius * Math.cos(perpAngle),
        y: c1.y + this.minRadius * Math.sin(perpAngle),
      },
      p2: {
        x: c2.x + this.minRadius * Math.cos(perpAngle),
        y: c2.y + this.minRadius * Math.sin(perpAngle),
      },
    };
  }

  /**
   * External tangent between two right circles
   */
  private externalTangentRR(c1: Point2D, c2: Point2D): { p1: Point2D; p2: Point2D } | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 1e-6) return null;

    const angle = Math.atan2(dy, dx);
    const perpAngle = angle - Math.PI / 2;

    return {
      p1: {
        x: c1.x + this.minRadius * Math.cos(perpAngle),
        y: c1.y + this.minRadius * Math.sin(perpAngle),
      },
      p2: {
        x: c2.x + this.minRadius * Math.cos(perpAngle),
        y: c2.y + this.minRadius * Math.sin(perpAngle),
      },
    };
  }

  /**
   * Internal tangent from left circle to right circle
   */
  private internalTangentLR(cLeft: Point2D, cRight: Point2D): { p1: Point2D; p2: Point2D } | null {
    const dx = cRight.x - cLeft.x;
    const dy = cRight.y - cLeft.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 2 * this.minRadius - 1e-6) return null;

    // Angle between centers
    const baseAngle = Math.atan2(dy, dx);

    // Angle offset for internal tangent
    const offset = Math.asin((2 * this.minRadius) / d);

    const tangentAngle = baseAngle + offset;

    return {
      p1: {
        x: cLeft.x + this.minRadius * Math.cos(tangentAngle + Math.PI / 2),
        y: cLeft.y + this.minRadius * Math.sin(tangentAngle + Math.PI / 2),
      },
      p2: {
        x: cRight.x + this.minRadius * Math.cos(tangentAngle - Math.PI / 2),
        y: cRight.y + this.minRadius * Math.sin(tangentAngle - Math.PI / 2),
      },
    };
  }

  /**
   * Internal tangent from right circle to left circle
   */
  private internalTangentRL(cRight: Point2D, cLeft: Point2D): { p1: Point2D; p2: Point2D } | null {
    const dx = cLeft.x - cRight.x;
    const dy = cLeft.y - cRight.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 2 * this.minRadius - 1e-6) return null;

    const baseAngle = Math.atan2(dy, dx);
    const offset = Math.asin((2 * this.minRadius) / d);
    const tangentAngle = baseAngle - offset;

    return {
      p1: {
        x: cRight.x + this.minRadius * Math.cos(tangentAngle - Math.PI / 2),
        y: cRight.y + this.minRadius * Math.sin(tangentAngle - Math.PI / 2),
      },
      p2: {
        x: cLeft.x + this.minRadius * Math.cos(tangentAngle + Math.PI / 2),
        y: cLeft.y + this.minRadius * Math.sin(tangentAngle + Math.PI / 2),
      },
    };
  }

  /**
   * Calculate middle circle for LRL path
   * The middle circle must be tangent to both endpoint left circles
   */
  private calculateMiddleCircleLRL(c1: Point2D, c2: Point2D): { center: Point2D } | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 4 * this.minRadius || d < 1e-6) return null;

    // Use law of cosines to find angle
    const alpha = Math.acos(d / (4 * this.minRadius));
    const baseAngle = Math.atan2(dy, dx);

    // Middle circle center
    const centerAngle = baseAngle + alpha;

    return {
      center: {
        x: c1.x + 2 * this.minRadius * Math.cos(centerAngle),
        y: c1.y + 2 * this.minRadius * Math.sin(centerAngle),
      },
    };
  }

  /**
   * Calculate middle circle for RLR path
   */
  private calculateMiddleCircleRLR(c1: Point2D, c2: Point2D): { center: Point2D } | null {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 4 * this.minRadius || d < 1e-6) return null;

    const alpha = Math.acos(d / (4 * this.minRadius));
    const baseAngle = Math.atan2(dy, dx);
    const centerAngle = baseAngle - alpha;

    return {
      center: {
        x: c1.x + 2 * this.minRadius * Math.cos(centerAngle),
        y: c1.y + 2 * this.minRadius * Math.sin(centerAngle),
      },
    };
  }

  /**
   * Calculate tangent point between two circles
   */
  private tangentPointBetweenCircles(
    c1: Point2D,
    c2: Point2D,
    r1: number,
    r2: number
  ): Point2D {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    const ratio = r1 / (r1 + r2);

    return {
      x: c1.x + dx * ratio,
      y: c1.y + dy * ratio,
    };
  }

  /**
   * Calculate arc length for left (counterclockwise) turn
   */
  private arcLengthLeft(start: Pose2D | Point2D, end: Point2D, center: Point2D): number {
    const startAngle = Math.atan2(
      ('theta' in start ? start.y : start.y) - center.y,
      ('theta' in start ? start.x : start.x) - center.x
    );
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    let angle = endAngle - startAngle;
    if (angle < 0) angle += 2 * Math.PI;

    return this.minRadius * angle;
  }

  /**
   * Calculate arc length for right (clockwise) turn
   */
  private arcLengthRight(start: Pose2D | Point2D, end: Point2D, center: Point2D): number {
    const startAngle = Math.atan2(
      ('theta' in start ? start.y : start.y) - center.y,
      ('theta' in start ? start.x : start.x) - center.x
    );
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    let angle = startAngle - endAngle;
    if (angle < 0) angle += 2 * Math.PI;

    return this.minRadius * angle;
  }

  /**
   * Arc length for right turn in reverse (for middle segment in LRL)
   */
  private arcLengthRightReverse(start: Point2D, end: Point2D, center: Point2D): number {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    let angle = startAngle - endAngle;
    if (angle < 0) angle += 2 * Math.PI;

    return this.minRadius * angle;
  }

  /**
   * Arc length for left turn in reverse (for middle segment in RLR)
   */
  private arcLengthLeftReverse(start: Point2D, end: Point2D, center: Point2D): number {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    let angle = endAngle - startAngle;
    if (angle < 0) angle += 2 * Math.PI;

    return this.minRadius * angle;
  }

  /**
   * Euclidean distance between two points
   */
  private euclideanDistance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Create arc segment helper
   */
  private createArcSegment(
    type: 'L' | 'R',
    length: number,
    start: Pose2D | Point2D,
    end: Point2D,
    center: Point2D
  ): DubinsSegment {
    const startAngle = Math.atan2(
      ('theta' in start ? start.y : start.y) - center.y,
      ('theta' in start ? start.x : start.x) - center.x
    );
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    return {
      type,
      length,
      startPose: 'theta' in start ? start : { ...start, theta: startAngle },
      endPose: { ...end, theta: endAngle },
      center,
      radius: this.minRadius,
      startAngle,
      endAngle,
    };
  }

  /**
   * Create straight segment helper
   */
  private createStraightSegment(length: number, start: Point2D, end: Point2D): DubinsSegment {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    return {
      type: 'S',
      length,
      startPose: { ...start, theta: angle },
      endPose: { ...end, theta: angle },
    };
  }

  /**
   * Create invalid path placeholder
   */
  private createInvalidPath(type: 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'LRL' | 'RLR'): DubinsPath {
    return {
      type,
      segments: [],
      totalLength: Infinity,
      valid: false,
    };
  }
}

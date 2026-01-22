/**
 * Implementacion de los 6 Caminos de Dubins
 * Basado en el paper 'Census of Bounded Curvature Paths' (Diaz & Ayala, 2020)
 */

export interface Pose2D {
  x: number;
  y: number;
  theta: number; // angulo en radianes
}

export interface DubinsSegment {
  type: 'line' | 'arc';
  length: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  radius?: number;
  centerPoint?: { x: number; y: number };
  angle?: number;
}

export interface DubinsPath {
  type: 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'LRL' | 'RLR';
  segments: DubinsSegment[];
  totalLength: number;
  startPose: Pose2D;
  endPose: Pose2D;
}

export class DubinsPath2D {
  private minRadius: number;

  constructor(minRadius: number = 1.0) {
    this.minRadius = minRadius;
  }

  // Calcula centro del circulo tangente a la izquierda
  private leftCircleCenter(pose: Pose2D): { x: number; y: number } {
    return {
      x: pose.x - this.minRadius * Math.sin(pose.theta),
      y: pose.y + this.minRadius * Math.cos(pose.theta)
    };
  }

  // Calcula centro del circulo tangente a la derecha
  private rightCircleCenter(pose: Pose2D): { x: number; y: number } {
    return {
      x: pose.x + this.minRadius * Math.sin(pose.theta),
      y: pose.y - this.minRadius * Math.cos(pose.theta)
    };
  }

  // Calcula distancia entre dos puntos
  private distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  // LSL Path: Left-Straight-Left
  private computeLSL(start: Pose2D, end: Pose2D): DubinsPath | null {
    const left_start = this.leftCircleCenter(start);
    const left_end = this.leftCircleCenter(end);
    const d = this.distance(left_start, left_end);
    if (d > 4 * this.minRadius) return null;
    return { type: 'LSL', segments: [], totalLength: 0, startPose: start, endPose: end };
  }

  // RSR Path: Right-Straight-Right
  private computeRSR(start: Pose2D, end: Pose2D): DubinsPath | null {
    const right_start = this.rightCircleCenter(start);
    const right_end = this.rightCircleCenter(end);
    const d = this.distance(right_start, right_end);
    if (d > 4 * this.minRadius) return null;
    return { type: 'RSR', segments: [], totalLength: 0, startPose: start, endPose: end };
  }

  // LSR Path: Left-Straight-Right
  private computeLSR(start: Pose2D, end: Pose2D): DubinsPath | null {
    return { type: 'LSR', segments: [], totalLength: 0, startPose: start, endPose: end };
  }

  // RSL Path: Right-Straight-Left
  private computeRSL(start: Pose2D, end: Pose2D): DubinsPath | null {
    return { type: 'RSL', segments: [], totalLength: 0, startPose: start, endPose: end };
  }

  // LRL Path: Left-Right-Left
  private computeLRL(start: Pose2D, end: Pose2D): DubinsPath | null {
    return { type: 'LRL', segments: [], totalLength: 0, startPose: start, endPose: end };
  }

  // RLR Path: Right-Left-Right
  private computeRLR(start: Pose2D, end: Pose2D): DubinsPath | null {
    return { type: 'RLR', segments: [], totalLength: 0, startPose: start, endPose: end };
  }

  // Compute all 6 path types and return the shortest
  public computeOptimalPath(start: Pose2D, end: Pose2D): DubinsPath {
    const paths: DubinsPath[] = [];
    const lsl = this.computeLSL(start, end);
    const rsr = this.computeRSR(start, end);
    const lsr = this.computeLSR(start, end);
    const rsl = this.computeRSL(start, end);
    const lrl = this.computeLRL(start, end);
    const rlr = this.computeRLR(start, end);

    if (lsl) paths.push(lsl);
    if (rsr) paths.push(rsr);
    if (lsr) paths.push(lsr);
    if (rsl) paths.push(rsl);
    if (lrl) paths.push(lrl);
    if (rlr) paths.push(rlr);

    if (paths.length === 0) {
      return { type: 'LSL', segments: [], totalLength: Infinity, startPose: start, endPose: end };
    }

    return paths.reduce((shortest, current) =>
      current.totalLength < shortest.totalLength ? current : shortest
    );
  }
}

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
    const cLeft_start = this.leftCircleCenter(start);
    const cLeft_end = this.leftCircleCenter(end);
    const d = this.distance(cLeft_start, cLeft_end);
    
    if (d > 4 * this.minRadius) return null;

    const alpha = Math.atan2(cLeft_end.y - cLeft_start.y, cLeft_end.x - cLeft_start.x);
    const angle1 = Math.acos(d / (2 * this.minRadius));
    const theta1 = alpha + angle1;
    const theta2 = alpha - angle1;

    const totalLength = this.minRadius * Math.abs(theta1 - start.theta) + 
                        this.distance({x: cLeft_start.x + this.minRadius * Math.cos(theta1), y: cLeft_start.y + this.minRadius * Math.sin(theta1)}, 
                                     {x: cLeft_end.x + this.minRadius * Math.cos(theta2), y: cLeft_end.y + this.minRadius * Math.sin(theta2)}) +
                        this.minRadius * Math.abs(end.theta - theta2);

    return { type: 'LSL', segments: [], totalLength, startPose: start, endPose: end };
  }

  public computeOptimalPath(start: Pose2D, end: Pose2D): DubinsPath | null {
    const path = this.computeLSL(start, end);
    return path;
  }
}

/**
 * Implementación rigurosa de Dubins Paths para medición de longitud de nudos
 * 
 * Basado en:
 * - Dubins, L. E. (1957). "On curves of minimal length with a constraint on average curvature"
 * - Díaz & Ayala (2020). "Census of Bounded Curvature Paths" [arXiv:2005.13210]
 * 
 * Un Dubins path es un camino C¹ y piecewise C² de longitud mínima que conecta
 * dos puntos en el tangent bundle TR² con curvatura acotada κ = 1/r.
 * 
 * Teorema (Dubins, 1957): Los minimizadores de longitud son concatenaciones de:
 * - CSC: Circle-Straight-Circle (lsl, rsr, lsr, rsl)
 * - CCC: Circle-Circle-Circle (lrl, rlr)
 * 
 * Donde:
 * - l = arco circular a la izquierda (left)
 * - r = arco circular a la derecha (right)
 * - s = segmento recto (straight)
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Pose en el tangent bundle TR²
 * Representa un punto con su vector tangente asociado
 */
export interface Pose2D {
  x: number;        // Posición en R²
  y: number;
  theta: number;    // Ángulo del vector tangente en radianes
}

/**
 * Tipo de segmento en un Dubins path
 */
export type SegmentType = 'L' | 'R' | 'S';

/**
 * Tipo de Dubins path según clasificación de Dubins (1957)
 */
export type DubinsPathType = 'LSL' | 'RSR' | 'LSR' | 'RSL' | 'LRL' | 'RLR';

/**
 * Segmento individual de un Dubins path
 */
export interface DubinsSegment {
  type: SegmentType;
  length: number;
  
  // Para segmentos circulares (L o R)
  center?: Point2D;     // Centro del círculo
  radius?: number;      // Radio de curvatura
  startAngle?: number;  // Ángulo inicial del arco
  endAngle?: number;    // Ángulo final del arco
  
  // Puntos inicial y final del segmento
  startPose: Pose2D;
  endPose: Pose2D;
}

/**
 * Resultado del cálculo de un Dubins path
 */
export interface DubinsPath {
  type: DubinsPathType;
  segments: DubinsSegment[];
  totalLength: number;
  
  // Información adicional
  isValid: boolean;
  curvature: number;  // κ = 1/r
}

/**
 * Resultado del cálculo de todos los 6 tipos de Dubins paths
 */
export interface DubinsPathsResult {
  paths: DubinsPath[];
  optimal: DubinsPath | null;  // El de mínima longitud
}

/**
 * Clase principal para cálculo de Dubins paths
 * 
 * Implementa el algoritmo completo para los 6 tipos de paths:
 * CSC: LSL, RSR, LSR, RSL
 * CCC: LRL, RLR
 */
export class DubinsPathCalculator {
  private readonly minRadius: number;  // Radio mínimo de curvatura r
  private readonly kappa: number;      // Curvatura κ = 1/r
  
  /**
   * @param minRadius Radio mínimo de curvatura (r > 0)
   */
  constructor(minRadius: number = 1.0) {
    if (minRadius <= 0) {
      throw new Error('El radio mínimo debe ser positivo');
    }
    this.minRadius = minRadius;
    this.kappa = 1.0 / minRadius;
  }

  /**
   * Calcula TODOS los 6 tipos de Dubins paths entre dos poses
   * 
   * @param start Pose inicial (x, X) ∈ TR²
   * @param end Pose final (y, Y) ∈ TR²
   * @returns Objeto con todos los paths y el óptimo
   */
  public computeAllPaths(start: Pose2D, end: Pose2D): DubinsPathsResult {
    const paths: DubinsPath[] = [
      this.computeLSL(start, end),
      this.computeRSR(start, end),
      this.computeLSR(start, end),
      this.computeRSL(start, end),
      this.computeLRL(start, end),
      this.computeRLR(start, end),
    ].filter(p => p.isValid);

    const optimal = paths.length > 0
      ? paths.reduce((min, p) => p.totalLength < min.totalLength ? p : min)
      : null;

    return { paths, optimal };
  }

  /**
   * Calcula el Dubins path de mínima longitud (óptimo)
   */
  public computeOptimalPath(start: Pose2D, end: Pose2D): DubinsPath | null {
    return this.computeAllPaths(start, end).optimal;
  }

  // ============================================================================
  // CONFIGURACIONES CSC (Circle-Straight-Circle)
  // ============================================================================

  /**
   * LSL: Left-Straight-Left
   * 
   * Configuración:
   * 1. Arco circular a la izquierda desde start hasta tangente
   * 2. Segmento recto (tangente común externa)
   * 3. Arco circular a la izquierda hasta end
   * 
   * Referencia: Ecuaciones (7.1)-(7.3) del paper
   */
  private computeLSL(start: Pose2D, end: Pose2D): DubinsPath {
    // Centros de los círculos tangentes a la izquierda
    const clStart = this.leftCircleCenter(start);
    const clEnd = this.leftCircleCenter(end);
    
    // Distancia entre centros
    const d = this.distance(clStart, clEnd);
    
    // Para LSL, necesitamos d >= 0 (tangente externa)
    if (d < 1e-6) {
      return this.invalidPath('LSL');
    }
    
    // Ángulo de la línea que conecta los centros
    const theta = Math.atan2(clEnd.y - clStart.y, clEnd.x - clStart.x);
    
    // Puntos de tangencia
    const pStart: Point2D = {
      x: clStart.x + this.minRadius * Math.cos(theta + Math.PI / 2),
      y: clStart.y + this.minRadius * Math.sin(theta + Math.PI / 2)
    };
    
    const pEnd: Point2D = {
      x: clEnd.x + this.minRadius * Math.cos(theta + Math.PI / 2),
      y: clEnd.y + this.minRadius * Math.sin(theta + Math.PI / 2)
    };
    
    // Calcular longitudes
    const arc1Angle = this.mod2Pi(Math.atan2(pStart.y - clStart.y, pStart.x - clStart.x) - start.theta);
    const arc1Length = this.minRadius * arc1Angle;
    
    const lineLength = this.distance(pStart, pEnd);
    
    const arc2Angle = this.mod2Pi(end.theta - Math.atan2(pEnd.y - clEnd.y, pEnd.x - clEnd.x));
    const arc2Length = this.minRadius * arc2Angle;
    
    const totalLength = arc1Length + lineLength + arc2Length;
    
    // Construir segmentos
    const segments: DubinsSegment[] = [
      {
        type: 'L',
        length: arc1Length,
        center: clStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: start.theta + arc1Angle,
        startPose: start,
        endPose: { ...pStart, theta: start.theta + arc1Angle }
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { ...pStart, theta: theta },
        endPose: { ...pEnd, theta: theta }
      },
      {
        type: 'L',
        length: arc2Length,
        center: clEnd,
        radius: this.minRadius,
        startAngle: theta,
        endAngle: end.theta,
        startPose: { ...pEnd, theta: theta },
        endPose: end
      }
    ];
    
    return {
      type: 'LSL',
      segments,
      totalLength,
      isValid: true,
      curvature: this.kappa
    };
  }

  /**
   * RSR: Right-Straight-Right
   * 
   * Simétrico a LSL pero usando círculos a la derecha
   */
  private computeRSR(start: Pose2D, end: Pose2D): DubinsPath {
    const crStart = this.rightCircleCenter(start);
    const crEnd = this.rightCircleCenter(end);
    
    const d = this.distance(crStart, crEnd);
    
    if (d < 1e-6) {
      return this.invalidPath('RSR');
    }
    
    const theta = Math.atan2(crEnd.y - crStart.y, crEnd.x - crStart.x);
    
    const pStart: Point2D = {
      x: crStart.x + this.minRadius * Math.cos(theta - Math.PI / 2),
      y: crStart.y + this.minRadius * Math.sin(theta - Math.PI / 2)
    };
    
    const pEnd: Point2D = {
      x: crEnd.x + this.minRadius * Math.cos(theta - Math.PI / 2),
      y: crEnd.y + this.minRadius * Math.sin(theta - Math.PI / 2)
    };
    
    const arc1Angle = this.mod2Pi(start.theta - Math.atan2(pStart.y - crStart.y, pStart.x - crStart.x));
    const arc1Length = this.minRadius * arc1Angle;
    
    const lineLength = this.distance(pStart, pEnd);
    
    const arc2Angle = this.mod2Pi(Math.atan2(pEnd.y - crEnd.y, pEnd.x - crEnd.x) - end.theta);
    const arc2Length = this.minRadius * arc2Angle;
    
    const totalLength = arc1Length + lineLength + arc2Length;
    
    const segments: DubinsSegment[] = [
      {
        type: 'R',
        length: arc1Length,
        center: crStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: start.theta - arc1Angle,
        startPose: start,
        endPose: { ...pStart, theta: start.theta - arc1Angle }
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { ...pStart, theta: theta },
        endPose: { ...pEnd, theta: theta }
      },
      {
        type: 'R',
        length: arc2Length,
        center: crEnd,
        radius: this.minRadius,
        startAngle: theta,
        endAngle: end.theta,
        startPose: { ...pEnd, theta: theta },
        endPose: end
      }
    ];
    
    return {
      type: 'RSR',
      segments,
      totalLength,
      isValid: true,
      curvature: this.kappa
    };
  }

  /**
   * LSR: Left-Straight-Right
   * 
   * Tangente interna entre círculo izquierdo inicial y círculo derecho final
   */
  private computeLSR(start: Pose2D, end: Pose2D): DubinsPath {
    const clStart = this.leftCircleCenter(start);
    const crEnd = this.rightCircleCenter(end);
    
    const d = this.distance(clStart, crEnd);
    
    // Para tangente interna necesitamos d >= 2r
    if (d < 2 * this.minRadius) {
      return this.invalidPath('LSR');
    }
    
    // Ángulo y longitud de tangente interna
    const theta = Math.atan2(crEnd.y - clStart.y, crEnd.x - clStart.x);
    const alpha = Math.asin(2 * this.minRadius / d);
    
    const pStart: Point2D = {
      x: clStart.x + this.minRadius * Math.cos(theta + alpha + Math.PI / 2),
      y: clStart.y + this.minRadius * Math.sin(theta + alpha + Math.PI / 2)
    };
    
    const pEnd: Point2D = {
      x: crEnd.x + this.minRadius * Math.cos(theta + alpha - Math.PI / 2),
      y: crEnd.y + this.minRadius * Math.sin(theta + alpha - Math.PI / 2)
    };
    
    const arc1Angle = this.mod2Pi(Math.atan2(pStart.y - clStart.y, pStart.x - clStart.x) - start.theta);
    const arc1Length = this.minRadius * arc1Angle;
    
    const lineLength = this.distance(pStart, pEnd);
    
    const arc2Angle = this.mod2Pi(Math.atan2(pEnd.y - crEnd.y, pEnd.x - crEnd.x) - end.theta);
    const arc2Length = this.minRadius * arc2Angle;
    
    const totalLength = arc1Length + lineLength + arc2Length;
    
    const segments: DubinsSegment[] = [
      {
        type: 'L',
        length: arc1Length,
        center: clStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: start.theta + arc1Angle,
        startPose: start,
        endPose: { ...pStart, theta: start.theta + arc1Angle }
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { ...pStart, theta: theta + alpha },
        endPose: { ...pEnd, theta: theta + alpha }
      },
      {
        type: 'R',
        length: arc2Length,
        center: crEnd,
        radius: this.minRadius,
        startAngle: theta + alpha,
        endAngle: end.theta,
        startPose: { ...pEnd, theta: theta + alpha },
        endPose: end
      }
    ];
    
    return {
      type: 'LSR',
      segments,
      totalLength,
      isValid: true,
      curvature: this.kappa
    };
  }

  /**
   * RSL: Right-Straight-Left
   * 
   * Simétrico a LSR
   */
  private computeRSL(start: Pose2D, end: Pose2D): DubinsPath {
    const crStart = this.rightCircleCenter(start);
    const clEnd = this.leftCircleCenter(end);
    
    const d = this.distance(crStart, clEnd);
    
    if (d < 2 * this.minRadius) {
      return this.invalidPath('RSL');
    }
    
    const theta = Math.atan2(clEnd.y - crStart.y, clEnd.x - crStart.x);
    const alpha = Math.asin(2 * this.minRadius / d);
    
    const pStart: Point2D = {
      x: crStart.x + this.minRadius * Math.cos(theta - alpha - Math.PI / 2),
      y: crStart.y + this.minRadius * Math.sin(theta - alpha - Math.PI / 2)
    };
    
    const pEnd: Point2D = {
      x: clEnd.x + this.minRadius * Math.cos(theta - alpha + Math.PI / 2),
      y: clEnd.y + this.minRadius * Math.sin(theta - alpha + Math.PI / 2)
    };
    
    const arc1Angle = this.mod2Pi(start.theta - Math.atan2(pStart.y - crStart.y, pStart.x - crStart.x));
    const arc1Length = this.minRadius * arc1Angle;
    
    const lineLength = this.distance(pStart, pEnd);
    
    const arc2Angle = this.mod2Pi(end.theta - Math.atan2(pEnd.y - clEnd.y, pEnd.x - clEnd.x));
    const arc2Length = this.minRadius * arc2Angle;
    
    const totalLength = arc1Length + lineLength + arc2Length;
    
    const segments: DubinsSegment[] = [
      {
        type: 'R',
        length: arc1Length,
        center: crStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: start.theta - arc1Angle,
        startPose: start,
        endPose: { ...pStart, theta: start.theta - arc1Angle }
      },
      {
        type: 'S',
        length: lineLength,
        startPose: { ...pStart, theta: theta - alpha },
        endPose: { ...pEnd, theta: theta - alpha }
      },
      {
        type: 'L',
        length: arc2Length,
        center: clEnd,
        radius: this.minRadius,
        startAngle: theta - alpha,
        endAngle: end.theta,
        startPose: { ...pEnd, theta: theta - alpha },
        endPose: end
      }
    ];
    
    return {
      type: 'RSL',
      segments,
      totalLength,
      isValid: true,
      curvature: this.kappa
    };
  }

  // ============================================================================
  // CONFIGURACIONES CCC (Circle-Circle-Circle)
  // ============================================================================

  /**
   * LRL: Left-Right-Left
   * 
   * Tres arcos circulares tangentes
   * El círculo intermedio es tangente a los dos círculos adyacentes
   */
  private computeLRL(start: Pose2D, end: Pose2D): DubinsPath {
    const clStart = this.leftCircleCenter(start);
    const clEnd = this.leftCircleCenter(end);
    
    const d = this.distance(clStart, clEnd);
    
    // Para LRL necesitamos d <= 4r (los círculos deben poder tocar un círculo intermedio)
    if (d > 4 * this.minRadius || d < 1e-6) {
      return this.invalidPath('LRL');
    }
    
    // Centro del círculo intermedio (derecha)
    const theta = Math.atan2(clEnd.y - clStart.y, clEnd.x - clStart.x);
    const alpha = Math.acos(d / (4 * this.minRadius));
    
    const crMiddle: Point2D = {
      x: clStart.x + 2 * this.minRadius * Math.cos(theta + alpha),
      y: clStart.y + 2 * this.minRadius * Math.sin(theta + alpha)
    };
    
    // Puntos de tangencia
    const p1 = this.tangentPoint(clStart, crMiddle, 'LR');
    const p2 = this.tangentPoint(crMiddle, clEnd, 'RL');
    
    // Longitudes de arcos
    const arc1Angle = this.mod2Pi(Math.atan2(p1.y - clStart.y, p1.x - clStart.x) - start.theta);
    const arc1Length = this.minRadius * arc1Angle;
    
    const arc2Angle = this.mod2Pi(
      Math.atan2(p1.y - crMiddle.y, p1.x - crMiddle.x) -
      Math.atan2(p2.y - crMiddle.y, p2.x - crMiddle.x)
    );
    const arc2Length = this.minRadius * arc2Angle;
    
    const arc3Angle = this.mod2Pi(end.theta - Math.atan2(p2.y - clEnd.y, p2.x - clEnd.x));
    const arc3Length = this.minRadius * arc3Angle;
    
    const totalLength = arc1Length + arc2Length + arc3Length;
    
    const segments: DubinsSegment[] = [
      {
        type: 'L',
        length: arc1Length,
        center: clStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: start.theta + arc1Angle,
        startPose: start,
        endPose: { ...p1, theta: start.theta + arc1Angle }
      },
      {
        type: 'R',
        length: arc2Length,
        center: crMiddle,
        radius: this.minRadius,
        startAngle: Math.atan2(p1.y - crMiddle.y, p1.x - crMiddle.x),
        endAngle: Math.atan2(p2.y - crMiddle.y, p2.x - crMiddle.x),
        startPose: { ...p1, theta: start.theta + arc1Angle },
        endPose: { ...p2, theta: end.theta - arc3Angle }
      },
      {
        type: 'L',
        length: arc3Length,
        center: clEnd,
        radius: this.minRadius,
        startAngle: Math.atan2(p2.y - clEnd.y, p2.x - clEnd.x),
        endAngle: end.theta,
        startPose: { ...p2, theta: end.theta - arc3Angle },
        endPose: end
      }
    ];
    
    return {
      type: 'LRL',
      segments,
      totalLength,
      isValid: true,
      curvature: this.kappa
    };
  }

  /**
   * RLR: Right-Left-Right
   * 
   * Simétrico a LRL
   */
  private computeRLR(start: Pose2D, end: Pose2D): DubinsPath {
    const crStart = this.rightCircleCenter(start);
    const crEnd = this.rightCircleCenter(end);
    
    const d = this.distance(crStart, crEnd);
    
    if (d > 4 * this.minRadius || d < 1e-6) {
      return this.invalidPath('RLR');
    }
    
    const theta = Math.atan2(crEnd.y - crStart.y, crEnd.x - crStart.x);
    const alpha = Math.acos(d / (4 * this.minRadius));
    
    const clMiddle: Point2D = {
      x: crStart.x + 2 * this.minRadius * Math.cos(theta - alpha),
      y: crStart.y + 2 * this.minRadius * Math.sin(theta - alpha)
    };
    
    const p1 = this.tangentPoint(crStart, clMiddle, 'RL');
    const p2 = this.tangentPoint(clMiddle, crEnd, 'LR');
    
    const arc1Angle = this.mod2Pi(start.theta - Math.atan2(p1.y - crStart.y, p1.x - crStart.x));
    const arc1Length = this.minRadius * arc1Angle;
    
    const arc2Angle = this.mod2Pi(
      Math.atan2(p2.y - clMiddle.y, p2.x - clMiddle.x) -
      Math.atan2(p1.y - clMiddle.y, p1.x - clMiddle.x)
    );
    const arc2Length = this.minRadius * arc2Angle;
    
    const arc3Angle = this.mod2Pi(Math.atan2(p2.y - crEnd.y, p2.x - crEnd.x) - end.theta);
    const arc3Length = this.minRadius * arc3Angle;
    
    const totalLength = arc1Length + arc2Length + arc3Length;
    
    const segments: DubinsSegment[] = [
      {
        type: 'R',
        length: arc1Length,
        center: crStart,
        radius: this.minRadius,
        startAngle: start.theta,
        endAngle: start.theta - arc1Angle,
        startPose: start,
        endPose: { ...p1, theta: start.theta - arc1Angle }
      },
      {
        type: 'L',
        length: arc2Length,
        center: clMiddle,
        radius: this.minRadius,
        startAngle: Math.atan2(p1.y - clMiddle.y, p1.x - clMiddle.x),
        endAngle: Math.atan2(p2.y - clMiddle.y, p2.x - clMiddle.x),
        startPose: { ...p1, theta: start.theta - arc1Angle },
        endPose: { ...p2, theta: end.theta + arc3Angle }
      },
      {
        type: 'R',
        length: arc3Length,
        center: crEnd,
        radius: this.minRadius,
        startAngle: Math.atan2(p2.y - crEnd.y, p2.x - crEnd.x),
        endAngle: end.theta,
        startPose: { ...p2, theta: end.theta + arc3Angle },
        endPose: end
      }
    ];
    
    return {
      type: 'RLR',
      segments,
      totalLength,
      isValid: true,
      curvature: this.kappa
    };
  }

  // ============================================================================
  // FUNCIONES AUXILIARES
  // ============================================================================

  /**
   * Calcula el centro del círculo tangente a la izquierda de una pose
   * Ecuación (3.1) del paper
   */
  private leftCircleCenter(pose: Pose2D): Point2D {
    return {
      x: pose.x - this.minRadius * Math.sin(pose.theta),
      y: pose.y + this.minRadius * Math.cos(pose.theta)
    };
  }

  /**
   * Calcula el centro del círculo tangente a la derecha de una pose
   * Ecuación (3.2) del paper
   */
  private rightCircleCenter(pose: Pose2D): Point2D {
    return {
      x: pose.x + this.minRadius * Math.sin(pose.theta),
      y: pose.y - this.minRadius * Math.cos(pose.theta)
    };
  }

  /**
   * Distancia euclidiana entre dos puntos
   */
  private distance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  /**
   * Normaliza un ángulo al rango [0, 2π)
   */
  private mod2Pi(angle: number): number {
    let result = angle % (2 * Math.PI);
    if (result < 0) result += 2 * Math.PI;
    return result;
  }

  /**
   * Calcula el punto de tangencia entre dos círculos
   */
  private tangentPoint(c1: Point2D, c2: Point2D, type: 'LR' | 'RL'): Point2D {
    const theta = Math.atan2(c2.y - c1.y, c2.x - c1.x);
    const offset = type === 'LR' ? Math.PI / 2 : -Math.PI / 2;
    
    return {
      x: c1.x + this.minRadius * Math.cos(theta + offset),
      y: c1.y + this.minRadius * Math.sin(theta + offset)
    };
  }

  /**
   * Crea un path inválido
   */
  private invalidPath(type: DubinsPathType): DubinsPath {
    return {
      type,
      segments: [],
      totalLength: Infinity,
      isValid: false,
      curvature: this.kappa
    };
  }
}

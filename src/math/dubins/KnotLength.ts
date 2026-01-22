/**
 * Utilidad para calcular la longitud de la envolvente de un nudo
 * usando Dubins paths como aproximación de caminos con curvatura acotada
 * 
 * Basado en el paper de Díaz & Ayala (2020) sobre bounded curvature paths
 */

import { DubinsPathCalculator, Point2D, Pose2D, DubinsPath } from './DubinsPaths';

/**
 * Resultado del cálculo de longitud de un nudo
 */
export interface KnotLengthResult {
  totalLength: number;
  segments: DubinsPath[];
  averageCurvature: number;
  maxCurvature: number;
  
  // Estadísticas sobre tipos de paths usados
  statistics: {
    LSL: number;
    RSR: number;
    LSR: number;
    RSL: number;
    LRL: number;
    RLR: number;
  };
}

/**
 * Opciones para el cálculo de longitud
 */
export interface KnotLengthOptions {
  /** Radio mínimo de curvatura */
  minRadius?: number;
  
  /** Método de estimación de tangentes */
  tangentMethod?: 'centered' | 'forward' | 'custom';
  
  /** Función personalizada para estimar tangentes */
  customTangentEstimator?: (points: Point2D[], index: number) => number;
  
  /** Si el nudo es cerrado (conecta último punto con primero) */
  closed?: boolean;
}

/**
 * Clase para calcular la longitud de nudos usando Dubins paths
 */
export class KnotLengthCalculator {
  private calculator: DubinsPathCalculator;
  private options: Required<KnotLengthOptions>;
  
  constructor(options: KnotLengthOptions = {}) {
    this.options = {
      minRadius: options.minRadius ?? 1.0,
      tangentMethod: options.tangentMethod ?? 'centered',
      customTangentEstimator: options.customTangentEstimator ?? this.centeredDifference.bind(this),
      closed: options.closed ?? true
    };
    
    this.calculator = new DubinsPathCalculator(this.options.minRadius);
  }
  
  /**
   * Calcula la longitud total de un nudo dado sus puntos de control
   * 
   * @param controlPoints Puntos de control del nudo (al menos 3)
   * @returns Resultado detallado con longitud y estadísticas
   */
  public computeLength(controlPoints: Point2D[]): KnotLengthResult {
    if (controlPoints.length < 3) {
      throw new Error('Se requieren al menos 3 puntos de control');
    }
    
    const n = controlPoints.length;
    const segments: DubinsPath[] = [];
    const statistics = {
      LSL: 0, RSR: 0, LSR: 0, RSL: 0, LRL: 0, RLR: 0
    };
    
    let totalLength = 0;
    let totalCurvature = 0;
    let maxCurvature = 0;
    
    // Calcular Dubins path entre cada par consecutivo de puntos
    const iterations = this.options.closed ? n : n - 1;
    
    for (let i = 0; i < iterations; i++) {
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      
      // Estimar ángulos tangentes
      const theta1 = this.estimateTangent(controlPoints, i);
      const theta2 = this.estimateTangent(controlPoints, (i + 1) % n);
      
      // Construir poses
      const start: Pose2D = { ...p1, theta: theta1 };
      const end: Pose2D = { ...p2, theta: theta2 };
      
      // Calcular Dubins path óptimo
      const path = this.calculator.computeOptimalPath(start, end);
      
      if (path && path.isValid) {
        segments.push(path);
        totalLength += path.totalLength;
        totalCurvature += path.curvature * path.totalLength;
        maxCurvature = Math.max(maxCurvature, path.curvature);
        
        // Actualizar estadísticas
        statistics[path.type]++;
      } else {
        console.warn(`No se pudo calcular Dubins path entre puntos ${i} y ${(i + 1) % n}`);
      }
    }
    
    return {
      totalLength,
      segments,
      averageCurvature: totalLength > 0 ? totalCurvature / totalLength : 0,
      maxCurvature,
      statistics
    };
  }
  
  /**
   * Calcula todos los 6 tipos de Dubins paths para cada segmento
   * Útil para visualización y análisis
   */
  public computeAllPathsPerSegment(controlPoints: Point2D[]): {
    segment: number;
    paths: DubinsPath[];
    optimal: DubinsPath | null;
  }[] {
    const n = controlPoints.length;
    const results = [];
    const iterations = this.options.closed ? n : n - 1;
    
    for (let i = 0; i < iterations; i++) {
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      
      const theta1 = this.estimateTangent(controlPoints, i);
      const theta2 = this.estimateTangent(controlPoints, (i + 1) % n);
      
      const start: Pose2D = { ...p1, theta: theta1 };
      const end: Pose2D = { ...p2, theta: theta2 };
      
      const { paths, optimal } = this.calculator.computeAllPaths(start, end);
      
      results.push({
        segment: i,
        paths,
        optimal
      });
    }
    
    return results;
  }
  
  /**
   * Genera puntos a lo largo del Dubins path para visualización
   * 
   * @param path Dubins path
   * @param numPoints Número de puntos a generar
   * @returns Array de puntos (x, y, θ)
   */
  public samplePath(path: DubinsPath, numPoints: number = 100): Pose2D[] {
    if (!path.isValid || path.segments.length === 0) {
      return [];
    }
    
    const points: Pose2D[] = [];
    const stepSize = path.totalLength / numPoints;
    
    let currentLength = 0;
    let segmentIndex = 0;
    let segmentLocalLength = 0;
    
    for (let i = 0; i <= numPoints; i++) {
      // Encontrar segmento actual
      while (segmentIndex < path.segments.length - 1 &&
             segmentLocalLength >= path.segments[segmentIndex].length) {
        segmentLocalLength -= path.segments[segmentIndex].length;
        segmentIndex++;
      }
      
      if (segmentIndex >= path.segments.length) break;
      
      const segment = path.segments[segmentIndex];
      const t = segment.length > 0 ? segmentLocalLength / segment.length : 0;
      
      // Interpolar punto en el segmento
      const point = this.interpolateSegment(segment, t);
      points.push(point);
      
      currentLength += stepSize;
      segmentLocalLength += stepSize;
    }
    
    return points;
  }
  
  // ============================================================================
  // MÉTODOS DE ESTIMACIÓN DE TANGENTES
  // ============================================================================
  
  /**
   * Estima el ángulo tangente en un punto usando diferencias centradas
   * 
   * Método más preciso para puntos interiores
   */
  private centeredDifference(points: Point2D[], index: number): number {
    const n = points.length;
    const prev = points[(index - 1 + n) % n];
    const next = points[(index + 1) % n];
    
    const dx = (next.x - prev.x) / 2;
    const dy = (next.y - prev.y) / 2;
    
    return Math.atan2(dy, dx);
  }
  
  /**
   * Estima el ángulo tangente usando diferencias hacia adelante
   * 
   * Útil en extremos de curvas abiertas
   */
  private forwardDifference(points: Point2D[], index: number): number {
    const n = points.length;
    const current = points[index];
    const next = points[(index + 1) % n];
    
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    
    return Math.atan2(dy, dx);
  }
  
  /**
   * Estima tangente según el método configurado
   */
  private estimateTangent(points: Point2D[], index: number): number {
    switch (this.options.tangentMethod) {
      case 'centered':
        return this.centeredDifference(points, index);
      case 'forward':
        return this.forwardDifference(points, index);
      case 'custom':
        return this.options.customTangentEstimator(points, index);
      default:
        return this.centeredDifference(points, index);
    }
  }
  
  // ============================================================================
  // UTILIDADES
  // ============================================================================
  
  /**
   * Interpola un punto en un segmento de Dubins path
   * 
   * @param segment Segmento (L, R, o S)
   * @param t Parámetro [0, 1]
   */
  private interpolateSegment(segment: any, t: number): Pose2D {
    t = Math.max(0, Math.min(1, t)); // Clamp a [0, 1]
    
    if (segment.type === 'S') {
      // Segmento recto: interpolación lineal
      const x = segment.startPose.x + t * (segment.endPose.x - segment.startPose.x);
      const y = segment.startPose.y + t * (segment.endPose.y - segment.startPose.y);
      const theta = segment.startPose.theta;
      return { x, y, theta };
    } else {
      // Arco circular
      const center = segment.center!;
      const radius = segment.radius!;
      const startAngle = segment.startAngle!;
      const endAngle = segment.endAngle!;
      
      // Interpolar ángulo
      let deltaAngle = endAngle - startAngle;
      
      // Normalizar para tomar el camino más corto
      if (segment.type === 'L') {
        // Left: counterclockwise
        if (deltaAngle < 0) deltaAngle += 2 * Math.PI;
      } else {
        // Right: clockwise
        if (deltaAngle > 0) deltaAngle -= 2 * Math.PI;
      }
      
      const angle = startAngle + t * deltaAngle;
      
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      const theta = segment.type === 'L' 
        ? angle + Math.PI / 2  // Tangente para left arc
        : angle - Math.PI / 2; // Tangente para right arc
      
      return { x, y, theta };
    }
  }
  
  /**
   * Calcula la energía de curvatura del nudo
   * Integral de κ² sobre la longitud
   */
  public computeCurvatureEnergy(controlPoints: Point2D[]): number {
    const result = this.computeLength(controlPoints);
    
    let energy = 0;
    for (const segment of result.segments) {
      // Para Dubins paths, la curvatura es constante en cada segmento
      const kappa = segment.curvature;
      energy += kappa * kappa * segment.totalLength;
    }
    
    return energy;
  }
  
  /**
   * Genera un reporte detallado de la longitud del nudo
   */
  public generateReport(controlPoints: Point2D[]): string {
    const result = this.computeLength(controlPoints);
    
    let report = '=== REPORTE DE LONGITUD DE NUDO (Dubins Paths) ===\n\n';
    report += `Número de puntos de control: ${controlPoints.length}\n`;
    report += `Nudo cerrado: ${this.options.closed ? 'Sí' : 'No'}\n`;
    report += `Radio mínimo de curvatura: ${this.options.minRadius}\n\n`;
    
    report += `--- Longitud ---\n`;
    report += `Longitud total: ${result.totalLength.toFixed(4)}\n`;
    report += `Curvatura promedio: ${result.averageCurvature.toFixed(4)}\n`;
    report += `Curvatura máxima: ${result.maxCurvature.toFixed(4)}\n\n`;
    
    report += `--- Estadísticas de Paths ---\n`;
    const total = Object.values(result.statistics).reduce((a, b) => a + b, 0);
    for (const [type, count] of Object.entries(result.statistics)) {
      const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0.0';
      report += `${type}: ${count} (${percentage}%)\n`;
    }
    
    report += `\n--- Segmentos Individuales ---\n`;
    result.segments.forEach((seg, i) => {
      report += `Segmento ${i}: ${seg.type} - Longitud: ${seg.totalLength.toFixed(4)}\n`;
    });
    
    return report;
  }
}

/**
 * Función de utilidad para cálculo rápido de longitud
 */
export function computeKnotLength(
  controlPoints: Point2D[],
  options?: KnotLengthOptions
): number {
  const calculator = new KnotLengthCalculator(options);
  return calculator.computeLength(controlPoints).totalLength;
}

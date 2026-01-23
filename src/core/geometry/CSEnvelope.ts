/**
 * CSEnvelope - Envolvente suave e interactiva para curvas CS
 * Calcula y renderiza una envolvente que se ajusta dinámicamente con los discos
 * con interpolación mejorada y transiciones suaves
 */

import { Point2D } from '../types/cs';

export interface Circle {
  center: Point2D;
  radius: number;
  id?: string;
}

interface TangentLine {
  p1: Point2D;
  p2: Point2D;
  angle1: number;
  angle2: number;
}

interface ExternalTangents {
  outer: TangentLine;
  inner: TangentLine;
}

interface TangentSegment {
  circle1: Circle;
  circle2: Circle;
  tangent1: TangentLine;
  tangent2: TangentLine;
  arcPoints: Point2D[];
  transitionPoints: Point2D[];
}

export class SmoothCSEnvelope {
  private circles: Circle[] = [];
  private envelopePoints: Point2D[] = [];
  private smoothness: number = 40; // Puntos de interpolación (más = más suave)
  private minDistanceThreshold: number = 1; // Umbral para círculos muy juntos
  private bezierTension: number = 0.5; // Tensión de curvas Bézier (0-1)
  private adaptiveSmoothing: boolean = true; // Suavizado adaptativo basado en curvatura

  constructor(circles: Circle[] = []) {
    this.circles = circles;
    if (circles.length > 0) {
      this.calculateEnvelope();
    }
  }

  /**
   * Calcula la envolvente suave alrededor de los círculos
   */
  calculateEnvelope(): Point2D[] {
    if (this.circles.length === 0) {
      this.envelopePoints = [];
      return [];
    }

    if (this.circles.length === 1) {
      // Para un solo círculo, la envolvente es el círculo mismo
      this.envelopePoints = this.createCirclePoints(this.circles[0], 60);
      return this.envelopePoints;
    }

    const tangentSegments = this.calculateTangentSegments();
    const smoothPath = this.interpolateSmoothPath(tangentSegments);

    this.envelopePoints = smoothPath;
    return smoothPath;
  }

  /**
   * Crea puntos alrededor de un círculo completo
   */
  private createCirclePoints(circle: Circle, steps: number): Point2D[] {
    const points: Point2D[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      points.push({
        x: circle.center.x + circle.radius * Math.cos(angle),
        y: circle.center.y + circle.radius * Math.sin(angle),
      });
    }
    return points;
  }

  /**
   * Calcula segmentos tangentes entre círculos consecutivos
   */
  private calculateTangentSegments(): TangentSegment[] {
    const segments: TangentSegment[] = [];

    for (let i = 0; i < this.circles.length; i++) {
      const current = this.circles[i];
      const next = this.circles[(i + 1) % this.circles.length];

      // Tangentes externas entre círculos
      const tangents = this.calculateExternalTangents(current, next);

      if (tangents) {
        const arcPoints = this.calculateArcPoints(
          current,
          tangents.inner.angle1,
          tangents.outer.angle1
        );

        // Calcula puntos de transición suaves
        const transitionPoints = this.calculateTransitionPoints(
          arcPoints[arcPoints.length - 1],
          tangents.outer.p1,
          tangents.outer.p2,
          current,
          next
        );

        segments.push({
          circle1: current,
          circle2: next,
          tangent1: tangents.outer,
          tangent2: tangents.inner,
          arcPoints,
          transitionPoints,
        });
      } else {
        // Maneja caso de círculos superpuestos
        segments.push(this.createFallbackSegment(current, next, i));
      }
    }

    return segments;
  }

  /**
   * Crea un segmento de respaldo cuando los círculos están muy juntos
   */
  private createFallbackSegment(c1: Circle, c2: Circle, index: number): TangentSegment {
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const centerAngle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Factor de contracción basado en distancia
    const maxDist = c1.radius + c2.radius;
    const collapseFactor = Math.max(0.1, Math.min(1, dist / maxDist));
    const angleSpread = (Math.PI / 4) * collapseFactor;

    const angle1 = centerAngle + angleSpread;
    const angle2 = centerAngle - angleSpread;

    const arcPoints = this.calculateArcPoints(c1, angle2, angle1);

    const tangent: TangentLine = {
      p1: arcPoints[arcPoints.length - 1],
      p2: {
        x: c2.center.x + c2.radius * Math.cos(angle1),
        y: c2.center.y + c2.radius * Math.sin(angle1),
      },
      angle1,
      angle2,
    };

    return {
      circle1: c1,
      circle2: c2,
      tangent1: tangent,
      tangent2: tangent,
      arcPoints,
      transitionPoints: [tangent.p1, tangent.p2],
    };
  }

  /**
   * Calcula las tangentes externas entre dos círculos con mejor manejo de casos límite
   */
  private calculateExternalTangents(
    c1: Circle,
    c2: Circle
  ): ExternalTangents | null {
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Si los círculos están demasiado cerca
    if (dist < this.minDistanceThreshold) {
      return null;
    }

    const radiusSum = c1.radius + c2.radius;

    // Si los círculos se superponen significativamente
    if (dist < radiusSum * 0.5) {
      return null;
    }

    // Ángulo entre centros
    const centerAngle = Math.atan2(dy, dx);

    // Calcula ángulo de tangencia con manejo seguro
    const sinValue = Math.min(1, Math.max(-1, radiusSum / dist));
    const tangentAngle = Math.asin(sinValue);

    // Tangente externa superior
    const outerAngle = centerAngle + tangentAngle;
    const outer: TangentLine = {
      p1: {
        x: c1.center.x + c1.radius * Math.cos(outerAngle + Math.PI / 2),
        y: c1.center.y + c1.radius * Math.sin(outerAngle + Math.PI / 2),
      },
      p2: {
        x: c2.center.x + c2.radius * Math.cos(outerAngle + Math.PI / 2),
        y: c2.center.y + c2.radius * Math.sin(outerAngle + Math.PI / 2),
      },
      angle1: outerAngle + Math.PI / 2,
      angle2: outerAngle + Math.PI / 2,
    };

    // Tangente externa inferior
    const innerAngle = centerAngle - tangentAngle;
    const inner: TangentLine = {
      p1: {
        x: c1.center.x + c1.radius * Math.cos(innerAngle - Math.PI / 2),
        y: c1.center.y + c1.radius * Math.sin(innerAngle - Math.PI / 2),
      },
      p2: {
        x: c2.center.x + c2.radius * Math.cos(innerAngle - Math.PI / 2),
        y: c2.center.y + c2.radius * Math.sin(innerAngle - Math.PI / 2),
      },
      angle1: innerAngle - Math.PI / 2,
      angle2: innerAngle - Math.PI / 2,
    };

    return { outer, inner };
  }

  /**
   * Calcula puntos de transición suaves entre arco y tangente
   */
  private calculateTransitionPoints(
    arcEnd: Point2D,
    tangentStart: Point2D,
    tangentEnd: Point2D,
    c1: Circle,
    c2: Circle
  ): Point2D[] {
    const dist = this.distance(c1.center, c2.center);
    const radiusSum = c1.radius + c2.radius;
    
    // Más puntos para transiciones más largas
    const transitionLength = this.distance(tangentStart, tangentEnd);
    const steps = Math.max(10, Math.floor(transitionLength / 5));

    // Usa spline cúbico para transición ultra suave
    return this.catmullRomSpline(
      [arcEnd, tangentStart, tangentEnd],
      steps,
      this.bezierTension
    );
  }

  /**
   * Implementa spline Catmull-Rom para interpolación suave
   */
  private catmullRomSpline(
    points: Point2D[],
    steps: number,
    tension: number = 0.5
  ): Point2D[] {
    if (points.length < 3) {
      return this.linearInterpolation(points, steps);
    }

    const result: Point2D[] = [];
    const segments = points.length - 1;

    for (let seg = 0; seg < segments; seg++) {
      const p0 = seg > 0 ? points[seg - 1] : points[seg];
      const p1 = points[seg];
      const p2 = points[seg + 1];
      const p3 = seg < segments - 1 ? points[seg + 2] : points[seg + 1];

      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const point = this.catmullRomPoint(p0, p1, p2, p3, t, tension);
        result.push(point);
      }
    }

    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Calcula un punto en curva Catmull-Rom
   */
  private catmullRomPoint(
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    t: number,
    tension: number
  ): Point2D {
    const t2 = t * t;
    const t3 = t2 * t;

    const v0x = (p2.x - p0.x) * tension;
    const v0y = (p2.y - p0.y) * tension;
    const v1x = (p3.x - p1.x) * tension;
    const v1y = (p3.y - p1.y) * tension;

    return {
      x:
        (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 +
        (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 +
        v0x * t +
        p1.x,
      y:
        (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 +
        (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 +
        v0y * t +
        p1.y,
    };
  }

  /**
   * Interpolación lineal simple como fallback
   */
  private linearInterpolation(points: Point2D[], steps: number): Point2D[] {
    const result: Point2D[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        result.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        });
      }
    }
    
    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Calcula puntos de arco circular entre dos ángulos con suavizado adaptativo
   */
  private calculateArcPoints(
    circle: Circle,
    startAngle: number,
    endAngle: number
  ): Point2D[] {
    const points: Point2D[] = [];
    
    // Normaliza ángulos
    let angle1 = this.normalizeAngle(startAngle);
    let angle2 = this.normalizeAngle(endAngle);

    if (angle2 < angle1) {
      angle2 += 2 * Math.PI;
    }

    const angleSpan = angle2 - angle1;
    
    // Más puntos para arcos más grandes
    const steps = this.adaptiveSmoothing
      ? Math.max(15, Math.floor((angleSpan / (2 * Math.PI)) * 40))
      : 20;

    const angleStep = angleSpan / steps;

    for (let i = 0; i <= steps; i++) {
      const angle = angle1 + angleStep * i;
      points.push({
        x: circle.center.x + circle.radius * Math.cos(angle),
        y: circle.center.y + circle.radius * Math.sin(angle),
      });
    }

    return points;
  }

  /**
   * Normaliza ángulo a rango [0, 2π]
   */
  private normalizeAngle(angle: number): number {
    let normalized = angle % (2 * Math.PI);
    if (normalized < 0) normalized += 2 * Math.PI;
    return normalized;
  }

  /**
   * Interpola suavemente entre segmentos usando splines
   */
  private interpolateSmoothPath(segments: TangentSegment[]): Point2D[] {
    const smoothPath: Point2D[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Agrega puntos de arco del círculo actual
      smoothPath.push(...segment.arcPoints);

      // Agrega puntos de transición suave
      if (segment.transitionPoints.length > 2) {
        smoothPath.push(...segment.transitionPoints.slice(1));
      } else {
        // Fallback a línea directa
        smoothPath.push(segment.tangent1.p2);
      }
    }

    return smoothPath;
  }

  /**
   * Calcula distancia entre dos puntos
   */
  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Actualiza círculos y recalcula envolvente de forma eficiente
   * (llamar cuando se mueven discos)
   */
  updateCircles(circles: Circle[]): void {
    // Detecta si hubo cambios significativos
    const hasChanged = 
      circles.length !== this.circles.length ||
      circles.some((c, i) => {
        const old = this.circles[i];
        return !old || 
          this.distance(c.center, old.center) > 0.5 ||
          Math.abs(c.radius - old.radius) > 0.1;
      });

    if (hasChanged) {
      this.circles = circles;
      this.calculateEnvelope();
    }
  }

  /**
   * Actualiza círculos sin validación (para animaciones fluidas)
   */
  updateCirclesImmediate(circles: Circle[]): void {
    this.circles = circles;
    this.calculateEnvelope();
  }

  /**
   * Ajusta nivel de suavidad (10-100)
   */
  setSmoothness(value: number): void {
    this.smoothness = Math.max(10, Math.min(100, value));
    if (this.circles.length > 0) {
      this.calculateEnvelope();
    }
  }

  /**
   * Ajusta tensión de curvas Bézier (0-1)
   */
  setBezierTension(value: number): void {
    this.bezierTension = Math.max(0, Math.min(1, value));
    if (this.circles.length > 0) {
      this.calculateEnvelope();
    }
  }

  /**
   * Activa/desactiva suavizado adaptativo
   */
  setAdaptiveSmoothing(enabled: boolean): void {
    this.adaptiveSmoothing = enabled;
    if (this.circles.length > 0) {
      this.calculateEnvelope();
    }
  }

  /**
   * Obtiene los puntos de la envolvente calculada
   */
  getEnvelopePoints(): Point2D[] {
    return this.envelopePoints;
  }

  /**
   * Obtiene el número de círculos
   */
  getCircleCount(): number {
    return this.circles.length;
  }

  /**
   * Verifica si la envolvente está vacía
   */
  isEmpty(): boolean {
    return this.envelopePoints.length === 0;
  }

  /**
   * Obtiene los círculos actuales
   */
  getCircles(): Circle[] {
    return [...this.circles];
  }
}

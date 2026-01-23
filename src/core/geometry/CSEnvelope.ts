/**
 * CSEnvelope - Envolvente suave e interactiva para curvas CS
 * Calcula y renderiza una envolvente que se ajusta dinámicamente con los discos
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
}

export class SmoothCSEnvelope {
  private circles: Circle[] = [];
  private envelopePoints: Point2D[] = [];
  private smoothness: number = 30; // Puntos de interpolación
  private minDistanceThreshold: number = 0.01; // Umbral para círculos muy juntos

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
      this.envelopePoints = this.createCirclePoints(this.circles[0], 50);
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
        segments.push({
          circle1: current,
          circle2: next,
          tangent1: tangents.outer,
          tangent2: tangents.inner,
          arcPoints: this.calculateArcPoints(
            current,
            tangents.inner.angle1,
            tangents.outer.angle1
          ),
        });
      }
    }

    return segments;
  }

  /**
   * Calcula las tangentes externas entre dos círculos
   */
  private calculateExternalTangents(
    c1: Circle,
    c2: Circle
  ): ExternalTangents | null {
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Si los círculos están demasiado cerca o se superponen
    const minDist = Math.abs(c1.radius - c2.radius);
    if (dist < minDist + this.minDistanceThreshold) {
      // Contrae la envolvente - usa puntos del círculo más grande
      return this.calculateCollapsedTangents(c1, c2, dist);
    }

    // Ángulo entre centros
    const centerAngle = Math.atan2(dy, dx);

    // Ángulo de tangencia para tangente externa
    const radiusSum = c1.radius + c2.radius;
    const tangentAngle = Math.asin(Math.min(1, radiusSum / dist));

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
   * Maneja el caso cuando los círculos están muy juntos o se superponen
   */
  private calculateCollapsedTangents(
    c1: Circle,
    c2: Circle,
    dist: number
  ): ExternalTangents | null {
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const centerAngle = Math.atan2(dy, dx);

    // Usa un ángulo reducido para la contracción
    const collapseFactor = Math.max(0, dist / (c1.radius + c2.radius));
    const reducedAngle = (Math.PI / 6) * collapseFactor;

    const outer: TangentLine = {
      p1: {
        x: c1.center.x + c1.radius * Math.cos(centerAngle + reducedAngle),
        y: c1.center.y + c1.radius * Math.sin(centerAngle + reducedAngle),
      },
      p2: {
        x: c2.center.x + c2.radius * Math.cos(centerAngle + reducedAngle),
        y: c2.center.y + c2.radius * Math.sin(centerAngle + reducedAngle),
      },
      angle1: centerAngle + reducedAngle,
      angle2: centerAngle + reducedAngle,
    };

    const inner: TangentLine = {
      p1: {
        x: c1.center.x + c1.radius * Math.cos(centerAngle - reducedAngle),
        y: c1.center.y + c1.radius * Math.sin(centerAngle - reducedAngle),
      },
      p2: {
        x: c2.center.x + c2.radius * Math.cos(centerAngle - reducedAngle),
        y: c2.center.y + c2.radius * Math.sin(centerAngle - reducedAngle),
      },
      angle1: centerAngle - reducedAngle,
      angle2: centerAngle - reducedAngle,
    };

    return { outer, inner };
  }

  /**
   * Calcula puntos de arco circular entre dos ángulos
   */
  private calculateArcPoints(
    circle: Circle,
    startAngle: number,
    endAngle: number
  ): Point2D[] {
    const points: Point2D[] = [];
    const steps = 20;

    // Normaliza ángulos para ir en sentido antihorario
    let angle1 = this.normalizeAngle(startAngle);
    let angle2 = this.normalizeAngle(endAngle);

    if (angle2 < angle1) {
      angle2 += 2 * Math.PI;
    }

    const angleStep = (angle2 - angle1) / steps;

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
   * Interpola suavemente entre segmentos usando curvas de Bézier
   */
  private interpolateSmoothPath(segments: TangentSegment[]): Point2D[] {
    const smoothPath: Point2D[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Agrega puntos de arco del círculo actual
      smoothPath.push(...segment.arcPoints);

      // Conecta con curva de Bézier suave a la siguiente tangente
      const nextSegment = segments[(i + 1) % segments.length];

      const bezierPoints = this.createBezierTransition(
        segment.arcPoints[segment.arcPoints.length - 1],
        segment.tangent1.p1,
        segment.tangent1.p2,
        nextSegment.arcPoints[0]
      );

      smoothPath.push(...bezierPoints.slice(1)); // Evita duplicar el primer punto
    }

    return smoothPath;
  }

  /**
   * Crea transición suave usando curva de Bézier cúbica
   */
  private createBezierTransition(
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    p3: Point2D
  ): Point2D[] {
    const points: Point2D[] = [];
    const steps = this.smoothness;

    // Puntos de control para Bézier cúbica
    const cp1 = {
      x: p0.x + (p1.x - p0.x) * 0.4,
      y: p0.y + (p1.y - p0.y) * 0.4,
    };

    const cp2 = {
      x: p2.x + (p3.x - p2.x) * 0.4,
      y: p2.y + (p3.y - p2.y) * 0.4,
    };

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.cubicBezier(p1, cp1, cp2, p2, t);
      points.push(point);
    }

    return points;
  }

  /**
   * Calcula punto en curva de Bézier cúbica
   */
  private cubicBezier(
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    t: number
  ): Point2D {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
  }

  /**
   * Actualiza círculos y recalcula envolvente (llamar cuando se mueven discos)
   */
  updateCircles(circles: Circle[]): void {
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
}

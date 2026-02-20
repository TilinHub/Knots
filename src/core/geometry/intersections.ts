/**
 * Detección de intersecciones (cruces) entre bloques CS
 */

import type { CrossPoint, CSArc, CSBlock, CSDisk, CSSegment, Point2D } from '../types/cs';

const EPSILON = 1e-6;

/**
 * Detectar todas las intersecciones en un diagrama CS
 */
export function findAllCrossings(blocks: CSBlock[]): CrossPoint[] {
  const crossings: CrossPoint[] = [];
  let crossId = 1;

  // Comparar cada par de bloques
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const intersections = findBlockIntersections(blocks[i], blocks[j]);

      for (const point of intersections) {
        crossings.push({
          id: `cross${crossId++}`,
          position: point,
          block1: blocks[i].id,
          block2: blocks[j].id,
        });
      }
    }
  }

  return crossings;
}

/**
 * Encontrar intersecciones entre dos bloques CS
 * Nota: Los discos no generan intersecciones (no son curvas)
 */
function findBlockIntersections(b1: CSBlock, b2: CSBlock): Point2D[] {
  // Los discos no tienen intersecciones con otros elementos
  if (b1.kind === 'disk' || b2.kind === 'disk') {
    return [];
  }

  if (b1.kind === 'segment' && b2.kind === 'segment') {
    return segmentSegmentIntersection(b1, b2);
  }

  if (b1.kind === 'segment' && b2.kind === 'arc') {
    return segmentArcIntersection(b1, b2);
  }

  if (b1.kind === 'arc' && b2.kind === 'segment') {
    return segmentArcIntersection(b2, b1);
  }

  if (b1.kind === 'arc' && b2.kind === 'arc') {
    return arcArcIntersection(b1, b2);
  }

  return [];
}

/**
 * Intersección segmento-segmento
 */
function segmentSegmentIntersection(s1: CSSegment, s2: CSSegment): Point2D[] {
  const { p1: a, p2: b } = s1;
  const { p1: c, p2: d } = s2;

  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);

  // Paralelos o coincidentes
  if (Math.abs(denom) < EPSILON) return [];

  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;

  // Intersección dentro de ambos segmentos (excluyendo extremos)
  if (t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON) {
    return [
      {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
      },
    ];
  }

  return [];
}

/**
 * Intersección segmento-arco
 */
function segmentArcIntersection(seg: CSSegment, arc: CSArc): Point2D[] {
  const { p1, p2 } = seg;
  const { center, radius } = arc;

  // Vector dirección del segmento
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Vector desde centro del círculo al inicio del segmento
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;

  // Ecuación cuadrática: at² + bt + c = 0
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return []; // No hay intersección

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const intersections: Point2D[] = [];

  // Verificar si t1 está en el segmento y en el arco
  if (t1 > EPSILON && t1 < 1 - EPSILON) {
    const point = {
      x: p1.x + t1 * dx,
      y: p1.y + t1 * dy,
    };
    if (isPointOnArc(point, arc)) {
      intersections.push(point);
    }
  }

  // Verificar t2 (solo si es diferente de t1)
  if (Math.abs(t2 - t1) > EPSILON && t2 > EPSILON && t2 < 1 - EPSILON) {
    const point = {
      x: p1.x + t2 * dx,
      y: p1.y + t2 * dy,
    };
    if (isPointOnArc(point, arc)) {
      intersections.push(point);
    }
  }

  return intersections;
}

/**
 * Intersección arco-arco
 */
function arcArcIntersection(a1: CSArc, a2: CSArc): Point2D[] {
  const { center: c1, radius: r1 } = a1;
  const { center: c2, radius: r2 } = a2;

  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);

  // Casos sin intersección
  if (d < EPSILON) return []; // Mismos centros
  if (d > r1 + r2 + EPSILON) return []; // Muy separados
  if (d < Math.abs(r1 - r2) - EPSILON) return []; // Uno dentro del otro

  // Calcular puntos de intersección
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);

  const px = c1.x + (a * (c2.x - c1.x)) / d;
  const py = c1.y + (a * (c2.y - c1.y)) / d;

  const intersections: Point2D[] = [];

  // Primer punto
  const p1 = {
    x: px + (h * (c2.y - c1.y)) / d,
    y: py - (h * (c2.x - c1.x)) / d,
  };
  if (isPointOnArc(p1, a1) && isPointOnArc(p1, a2)) {
    intersections.push(p1);
  }

  // Segundo punto (si hay dos intersecciones)
  if (h > EPSILON) {
    const p2 = {
      x: px - (h * (c2.y - c1.y)) / d,
      y: py + (h * (c2.x - c1.x)) / d,
    };
    if (isPointOnArc(p2, a1) && isPointOnArc(p2, a2)) {
      intersections.push(p2);
    }
  }

  return intersections;
}

/**
 * Verificar si un punto está sobre el arco (dentro del rango angular)
 */
function isPointOnArc(point: Point2D, arc: CSArc): boolean {
  const { center, startAngle, endAngle } = arc;

  let angle = Math.atan2(point.y - center.y, point.x - center.x);

  // Normalizar ángulo a [0, 2π)
  if (angle < 0) angle += 2 * Math.PI;

  let start = startAngle;
  let end = endAngle;

  // Normalizar ángulos del arco
  while (start < 0) start += 2 * Math.PI;
  while (end < 0) end += 2 * Math.PI;
  while (start >= 2 * Math.PI) start -= 2 * Math.PI;
  while (end >= 2 * Math.PI) end -= 2 * Math.PI;

  // Verificar si el ángulo está en el rango
  if (start <= end) {
    return angle >= start - EPSILON && angle <= end + EPSILON;
  } else {
    // Arco cruza 0°
    return angle >= start - EPSILON || angle <= end + EPSILON;
  }
}

export interface DiskContact {
  point: Point2D;
  disk1Id: string;
  disk2Id: string;
  tangentAngle: number; // Angle of the common tangent
  normalAngle: number; // Angle of the line connecting centers
}

export function findDiskContacts(disks: CSDisk[]): DiskContact[] {
  const contacts: DiskContact[] = [];
  const TOLERANCE = 20.0; // Relaxed tolerance for visual contact

  for (let i = 0; i < disks.length; i++) {
    for (let j = i + 1; j < disks.length; j++) {
      const d1 = disks[i];
      const d2 = disks[j];
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if touching (dist approx r1 + r2)
      const touchDist = d1.visualRadius + d2.visualRadius;
      if (Math.abs(dist - touchDist) < TOLERANCE) {
        // Calculate contact point (weighted by radii if needed, but here r is visualRadius)
        // P = C1 + (C2-C1) * r1 / (r1+r2)
        const ratio = d1.visualRadius / (d1.visualRadius + d2.visualRadius);
        const cx = d1.center.x + dx * ratio;
        const cy = d1.center.y + dy * ratio;

        const normalAngle = Math.atan2(dy, dx);
        const tangentAngle = normalAngle + Math.PI / 2; // Perpendicular

        contacts.push({
          point: { x: cx, y: cy },
          disk1Id: d1.id,
          disk2Id: d2.id,
          tangentAngle,
          normalAngle,
        });
      }
    }
  }
  return contacts;
}

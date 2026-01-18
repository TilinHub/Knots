/**
 * Validación de continuidad posicional y tangencial para diagramas CS
 */

import type { CSBlock, CSSegment, CSArc, ValidationResult, Point2D } from '../types/cs';

const EPSILON = 1e-6; // Tolerancia para comparaciones numéricas

/**
 * Obtener el punto inicial de un bloque CS
 */
export function getStartPoint(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    return block.p1;
  }
  // Arco: punto inicial en startAngle
  return {
    x: block.center.x + block.radius * Math.cos(block.startAngle),
    y: block.center.y + block.radius * Math.sin(block.startAngle),
  };
}

/**
 * Obtener el punto final de un bloque CS
 */
export function getEndPoint(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    return block.p2;
  }
  // Arco: punto final en endAngle
  return {
    x: block.center.x + block.radius * Math.cos(block.endAngle),
    y: block.center.y + block.radius * Math.sin(block.endAngle),
  };
}

/**
 * Calcular el vector tangente al inicio de un bloque
 */
export function getStartTangent(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    // Segmento: tangente = dirección normalizada
    const dx = block.p2.x - block.p1.x;
    const dy = block.p2.y - block.p1.y;
    const len = Math.hypot(dx, dy);
    return len > EPSILON ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
  }
  // Arco: tangente perpendicular al radio en startAngle
  return {
    x: -Math.sin(block.startAngle),
    y: Math.cos(block.startAngle),
  };
}

/**
 * Calcular el vector tangente al final de un bloque
 */
export function getEndTangent(block: CSBlock): Point2D {
  if (block.kind === 'segment') {
    // Segmento: misma tangente en ambos extremos
    return getStartTangent(block);
  }
  // Arco: tangente perpendicular al radio en endAngle
  return {
    x: -Math.sin(block.endAngle),
    y: Math.cos(block.endAngle),
  };
}

/**
 * Verificar si dos puntos son iguales (dentro de EPSILON)
 */
function pointsEqual(p1: Point2D, p2: Point2D): boolean {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y) < EPSILON;
}

/**
 * Verificar si dos vectores tangentes son paralelos (mismo sentido)
 */
function tangentsAlign(t1: Point2D, t2: Point2D): boolean {
  // Producto escalar debe ser cercano a 1 (vectores unitarios alineados)
  const dot = t1.x * t2.x + t1.y * t2.y;
  return Math.abs(dot - 1) < 0.01; // Tolerancia de ~5 grados
}

/**
 * Validar continuidad de un diagrama CS
 */
export function validateContinuity(blocks: CSBlock[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (blocks.length === 0) {
    return { valid: false, errors: ['Diagrama vacío'], warnings: [] };
  }

  if (blocks.length === 1) {
    warnings.push('Solo un bloque. No hay continuidad que validar.');
    return { valid: true, errors: [], warnings };
  }

  // Validar conexiones entre bloques consecutivos
  for (let i = 0; i < blocks.length - 1; i++) {
    const current = blocks[i];
    const next = blocks[i + 1];

    const endPoint = getEndPoint(current);
    const startPoint = getStartPoint(next);

    // 1. Continuidad posicional
    if (!pointsEqual(endPoint, startPoint)) {
      const distance = Math.hypot(startPoint.x - endPoint.x, startPoint.y - endPoint.y);
      errors.push(
        `Discontinuidad entre ${current.id} y ${next.id}: ` +
        `distancia = ${distance.toFixed(4)}`
      );
      continue; // No tiene sentido verificar tangencia si no hay conexión
    }

    // 2. Continuidad tangencial
    const endTangent = getEndTangent(current);
    const startTangent = getStartTangent(next);

    if (!tangentsAlign(endTangent, startTangent)) {
      warnings.push(
        `${current.id} → ${next.id}: tangentes no alineadas ` +
        `(puede no ser C¹)`
      );
    }
  }

  // Verificar si el diagrama es cerrado (opcional)
  const firstStart = getStartPoint(blocks[0]);
  const lastEnd = getEndPoint(blocks[blocks.length - 1]);
  const isClosed = pointsEqual(firstStart, lastEnd);

  if (isClosed) {
    // Verificar tangencia en el cierre
    const lastTangent = getEndTangent(blocks[blocks.length - 1]);
    const firstTangent = getStartTangent(blocks[0]);

    if (!tangentsAlign(lastTangent, firstTangent)) {
      warnings.push('Diagrama cerrado pero tangencia no continua en el cierre');
    }
  } else {
    warnings.push('Diagrama abierto (primer y último punto no conectan)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calcular longitud de un bloque CS
 */
export function getBlockLength(block: CSBlock): number {
  if (block.kind === 'segment') {
    return Math.hypot(block.p2.x - block.p1.x, block.p2.y - block.p1.y);
  }
  // Arco: longitud = radio * ángulo
  let angle = block.endAngle - block.startAngle;
  if (angle < 0) angle += 2 * Math.PI;
  return block.radius * angle;
}

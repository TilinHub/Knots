import type { CSBlock, Point2D } from '../types/cs';
import { blockLength } from './arcLength';

/**
 * Estado de un punto en la curva con información de tangente
 */
export interface CurveState {
  position: Point2D;
  tangent: Point2D; // Vector tangente unitario
}

/**
 * Obtiene la posición y tangente de un punto en la curva CS
 * dada una longitud de arco desde el inicio
 */
export function getCurvePointAtLength(
  blocks: CSBlock[],
  targetLength: number
): CurveState | null {
  if (blocks.length === 0 || targetLength < 0) return null;

  let accumulatedLength = 0;

  for (const block of blocks) {
    const length = blockLength(block);

    if (accumulatedLength + length >= targetLength) {
      // El punto está en este bloque
      const localLength = targetLength - accumulatedLength;
      const t = length > 0 ? localLength / length : 0;

      return getPointOnBlock(block, t);
    }

    accumulatedLength += length;
  }

  // Si llegamos aquí, targetLength excede la longitud total
  // Retornar el último punto
  if (blocks.length > 0) {
    const lastBlock = blocks[blocks.length - 1];
    return getPointOnBlock(lastBlock, 1);
  }

  return null;
}

/**
 * Obtiene la posición y tangente en un bloque específico
 * @param t Parámetro normalizado [0, 1] a lo largo del bloque
 */
function getPointOnBlock(block: CSBlock, t: number): CurveState {
  t = Math.max(0, Math.min(1, t)); // Clamp entre 0 y 1

  if (block.kind === 'segment') {
    // Interpolación lineal
    const x = block.p1.x + (block.p2.x - block.p1.x) * t;
    const y = block.p1.y + (block.p2.y - block.p1.y) * t;

    // Tangente (vector dirección normalizado)
    const dx = block.p2.x - block.p1.x;
    const dy = block.p2.y - block.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    const tangent: Point2D =
      length > 0
        ? { x: dx / length, y: dy / length }
        : { x: 1, y: 0 };

    return {
      position: { x, y },
      tangent,
    };
  } else {
    // Arco
    const startAngle = block.startAngle;
    const endAngle = block.endAngle;
    const angleSpan = endAngle - startAngle;
    const currentAngle = startAngle + angleSpan * t;

    // Posición en el arco
    const x = block.center.x + block.radius * Math.cos(currentAngle);
    const y = block.center.y + block.radius * Math.sin(currentAngle);

    // Tangente en el arco (derivada de la posición respecto al ángulo)
    // dx/dθ = -r*sin(θ), dy/dθ = r*cos(θ)
    // Normalizado
    const tangent: Point2D = {
      x: -Math.sin(currentAngle) * Math.sign(angleSpan),
      y: Math.cos(currentAngle) * Math.sign(angleSpan),
    };

    return {
      position: { x, y },
      tangent,
    };
  }
}

/**
 * Divide la curva en N puntos equidistantes
 * Útil para generar trazados completos
 */
export function sampleCurve(
  blocks: CSBlock[],
  numPoints: number
): CurveState[] {
  if (blocks.length === 0 || numPoints < 2) return [];

  const points: CurveState[] = [];
  let totalLength = 0;

  for (const block of blocks) {
    totalLength += blockLength(block);
  }

  if (totalLength === 0) return [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const length = t * totalLength;
    const state = getCurvePointAtLength(blocks, length);

    if (state) {
      points.push(state);
    }
  }

  return points;
}

/**
 * Calcula la curvatura en un punto específico de la curva
 * Útil para detectar cambios bruscos en la dirección
 */
export function getCurvatureAt(
  blocks: CSBlock[],
  arcLength: number,
  epsilon = 0.01
): number | null {
  const state1 = getCurvePointAtLength(blocks, arcLength - epsilon);
  const state2 = getCurvePointAtLength(blocks, arcLength + epsilon);

  if (!state1 || !state2) return null;

  // Aproximación de curvatura mediante diferencias finitas
  const dTangentX = state2.tangent.x - state1.tangent.x;
  const dTangentY = state2.tangent.y - state1.tangent.y;
  const ds = 2 * epsilon;

  const curvature = Math.sqrt(dTangentX * dTangentX + dTangentY * dTangentY) / ds;

  return curvature;
}

import type { CSBlock, CSSegment, CSArc } from '../types/cs';
import { findContinuousChains } from '../validation/continuity';

/**
 * Calcula la longitud de un segmento
 */
export function segmentLength(segment: CSSegment): number {
  const dx = segment.p2.x - segment.p1.x;
  const dy = segment.p2.y - segment.p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula la longitud de un arco
 * L = r * θ donde θ es el ángulo en radianes
 */
export function arcLength(arc: CSArc): number {
  let angleDiff = arc.endAngle - arc.startAngle;
  
  // Normalizar para arcos que cruzan 0
  if (angleDiff < 0) {
    angleDiff += 2 * Math.PI;
  }
  
  return arc.radius * angleDiff;
}

/**
 * Calcula la longitud de un bloque CS
 * Nota: Los discos no tienen longitud de curva (retorna 0)
 */
export function blockLength(block: CSBlock): number {
  if (block.kind === 'segment') {
    return segmentLength(block);
  }
  if (block.kind === 'arc') {
    return arcLength(block);
  }
  // Los discos no tienen longitud
  return 0;
}

/**
 * Calcula la longitud total de todos los bloques (excluyendo discos)
 */
export function totalCurveLength(blocks: CSBlock[]): number {
  return blocks
    .filter(b => b.kind !== 'disk')
    .reduce((sum, block) => sum + blockLength(block), 0);
}

/**
 * Obtiene información detallada de longitudes
 */
export interface LengthInfo {
  totalLength: number;
  blockLengths: Array<{
    id: string;
    kind: 'segment' | 'arc';
    length: number;
  }>;
}

export function getCurveLengthInfo(blocks: CSBlock[]): LengthInfo {
  // Filtrar discos antes de encontrar cadenas
  const nonDiskBlocks = blocks.filter(b => b.kind !== 'disk');
  
  // Encontrar la cadena continua más larga
  const chains = findContinuousChains(nonDiskBlocks);
  const mainChain = chains.length > 0 ? chains[0] : [];

  // Calcular longitudes solo de la cadena principal
  const blockLengths = mainChain
    .filter(b => b.kind !== 'disk')
    .map(block => ({
      id: block.id,
      kind: block.kind as 'segment' | 'arc',
      length: blockLength(block),
    }));

  const totalLength = blockLengths.reduce((sum, info) => sum + info.length, 0);

  return {
    totalLength,
    blockLengths,
  };
}

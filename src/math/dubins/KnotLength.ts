/**
 * Utilidad para calcular la longitud de la envolvente de un nudo
 * usando Dubins paths como aproximación de caminos con curvatura acotada
 *
 * Basado en el paper de Díaz & Ayala (2020) sobre bounded curvature paths
 */

import { DubinsPath } from './DubinsPaths';

/**
 * Resultado del cálculo de longitud de un nudo
 */
export interface KnotLengthResult {
  totalLength: number;
  segmentCount: number;
  avgSegmentLength: number;
  minSegmentLength: number;
  maxSegmentLength: number;
}

/**
 * Opciones para el cálculo de longitud
 */
export interface KnotLengthOptions {
  minRadius?: number;
  tolerance?: number;
}

/**
 * Calcula la longitud total de un nudo usando caminos de Dubins
 */
export function calculateKnotLength(paths: DubinsPath[], options?: KnotLengthOptions): KnotLengthResult {
  const lengths = paths.map(p => p.totalLength || 0);
  const totalLength = lengths.reduce((sum, len) => sum + len, 0);
  const minLength = Math.min(...lengths, Infinity);
  const maxLength = Math.max(...lengths, -Infinity);
  const avgLength = totalLength / Math.max(lengths.length, 1);

  return {
    totalLength,
    segmentCount: paths.length,
    avgSegmentLength: avgLength,
    minSegmentLength: minLength === Infinity ? 0 : minLength,
    maxSegmentLength: maxLength === -Infinity ? 0 : maxLength,
  };
}

/**
 * Estima la curvatura promedio a lo largo de una ruta
 */
export function estimateAverageCurvature(path: DubinsPath, minRadius: number = 1.0): number {
  return 1.0 / minRadius;
}

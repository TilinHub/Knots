/**
 * Módulo Dubins Paths para cálculo de longitud de nudos con curvatura acotada
 *
 * Este módulo implementa la teoría completa de Dubins paths basada en:
 * - Dubins, L.E. (1957)
 * - Díaz & Ayala (2020) - arXiv:2005.13210
 *
 * @module dubins
 */

// Exportar funciones y calculadora de DubinsPaths
export { DubinsPathCalculator, calculateDubinsPath, calculatePathLength } from './DubinsPaths';

// Exportar utilidades de cálculo de longitud
export { calculateKnotLength, estimateAverageCurvature } from './KnotLength';
export type { KnotLengthResult, KnotLengthOptions } from './KnotLength';

// Exportar ejemplos
export { DUBINS_EXAMPLES, validatePathType } from './examples';

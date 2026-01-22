/**
 * Módulo Dubins Paths para cálculo de longitud de nudos con curvatura acotada
 * 
 * Este módulo implementa la teoría completa de Dubins paths basada en:
 * - Dubins, L.E. (1957)
 * - Díaz & Ayala (2020) - arXiv:2005.13210
 * 
 * @module dubins
 */

// Exportar tipos y clases principales
export {
  // Tipos básicos
  Point2D,
  Pose2D,
  SegmentType,
  DubinsPathType,
  
  // Estructuras de datos
  DubinsSegment,
  DubinsPath,
  DubinsPathsResult,
  
  // Calculadora principal
  DubinsPathCalculator
} from './DubinsPaths';

export {
  // Resultados y opciones
  KnotLengthResult,
  KnotLengthOptions,
  
  // Calculadora de longitud de nudos
  KnotLengthCalculator,
  
  // Función de utilidad
  computeKnotLength
} from './KnotLength';

export {
  // Ejemplos predefinidos
  DUBINS_EXAMPLES,
  
  // Funciones de demostración
  runAllExamples,
  trefoilKnotExample,
  curvatureComparison,
  visualizePath,
  uturnComparison,
  runAllDemos
} from './examples';

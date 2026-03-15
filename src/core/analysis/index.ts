/**
 * core/analysis — Mathematical analysis of CS diagrams
 *
 * Provides the foundational computation for:
 *   - Contact matrices A(c), Tc(c), L(c) and their kernels
 *   - First variation functional (gradient assembly and reduction)
 *   - Second variation quadratic form Q_red (stability)
 *   - Ribbonlength computation and separation bounds
 *   - Dense linear algebra (Matrix, QR, nullspace)
 */

// Types
export type {
  Arc,
  CSDiagram,
  Contact,
  Disk,
  Point,
  Segment,
  Tangency,
  Tolerances,
  Vector,
} from './types';

// Linear algebra
export {
  Matrix,
  nullspace,
  orth,
  qr,
  rank,
} from './linearAlgebra';

// Contact matrices
export {
  calculateJacobianMatrix,
  computeTangentMap,
  constructA,
  constructL,
  constructTc,
  constructTw,
  getKerL,
  getRoll,
} from './contactMatrix';
export type { ContactInfo } from './contactMatrix';

// First variation
export {
  assembleFunctional,
  computeReducedGradient,
  reduceFunctional,
} from './firstVariation';

// Second variation
export {
  evaluateQuadratic,
  testCriticality,
} from './secondVariation';
export type { CriticalityResult } from './secondVariation';

// Ribbonlength
export {
  checkSeparationBound,
  computePathLength,
  computeRibbonlength,
} from './ribbonlength';
export type { RibbonDisk } from './ribbonlength';

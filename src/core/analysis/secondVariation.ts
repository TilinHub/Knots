/**
 * Second Variation (Quadratic Form) for CS Diagrams
 *
 * Sections 2.15 -- 2.16.  Evaluates Q_red on gauge-fixed directions
 * to test local stability of critical configurations.
 */

import { computeTangentMap, constructTc } from './contactMatrix';
import { Matrix } from './linearAlgebra';
import type { CSDiagram, Vector } from './types';

// ----------------------------------------------------------------
// Local vector helpers
// ----------------------------------------------------------------

function sub(a: { x: number; y: number }, b: { x: number; y: number }): Vector {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

function norm(v: Vector): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function scale(v: Vector, s: number): Vector {
  return { x: v.x * s, y: v.y * s };
}

// ----------------------------------------------------------------
// Criticality result
// ----------------------------------------------------------------

export type CriticalityResult = {
  /** Residual vector r = Ug^T g_red */
  r: Matrix;
  normR: number;
  normGred: number;
  ratio: number;
  isCritical: boolean;
  message: string;
};

/**
 * Section 2.15 -- Criticality test.
 *
 * Given the reduced gradient g_red and a gauge basis Ug, computes
 * r = Ug^T g_red.  The configuration is critical when ||r|| is
 * small relative to ||g_red||.
 */
export function testCriticality(
  gred: Matrix,
  Ug: Matrix,
  tolerance: number,
): CriticalityResult {
  const r = Ug.transpose().multiply(gred);
  const normR = r.norm();
  const normGred = gred.norm();

  const ratio = normGred > 1e-15 ? normR / normGred : 0;
  const isCritical = normR <= tolerance * normGred || normGred < 1e-12;

  return {
    r,
    normR,
    normGred,
    ratio,
    isCritical,
    message: isCritical
      ? `CRITICAL (Ratio ${ratio.toExponential(4)} <= ${tolerance})`
      : `NOT CRITICAL (Ratio ${ratio.toExponential(4)})`,
  };
}

// ----------------------------------------------------------------
// Quadratic form evaluation
// ----------------------------------------------------------------

/**
 * Section 2.16 -- Evaluate the reduced quadratic form Q_red.
 *
 * Given a gauge basis Ug and coefficient vector z, computes
 *   delta_c = Ug * z
 *   omega   = -Tc * delta_c
 *   delta_p_alpha = delta_c_{k(alpha)} + omega_alpha * t_alpha
 *
 * Then sums over segments:
 *   Q_s = (1 / l_s) * || P_s * (delta_p_beta - delta_p_alpha) ||^2
 * where P_s = I - vHat vHat^T is the projection orthogonal to the segment.
 */
export function evaluateQuadratic(
  diagram: CSDiagram,
  Ug: Matrix,
  z: Matrix,
): number {
  const deltaC = Ug.multiply(z);

  // omega = -Tc * deltaC
  const Tc = constructTc(diagram);
  const omega = Tc.multiply(deltaC);
  for (let r = 0; r < omega.rows; r++) omega.set(r, 0, -omega.get(r, 0));

  // Precompute tangent map and delta_p for every tangency
  const { tangencies, segments } = diagram;
  const tangentsMap = computeTangentMap(diagram);
  const tangencyIndex = new Map(tangencies.map((t, i) => [t.id, i]));

  const deltaP = new Map<string, Vector>();

  tangencies.forEach((t, i) => {
    const k = t.diskIndex;
    const tVec = tangentsMap[t.id];
    const dcx = deltaC.get(2 * k, 0);
    const dcy = deltaC.get(2 * k + 1, 0);
    const w = omega.get(i, 0);

    deltaP.set(t.id, {
      x: dcx + w * tVec.x,
      y: dcy + w * tVec.y,
    });
  });

  // Sum Q_s over all segments
  let Q_total = 0;

  for (const s of segments) {
    const dpAlpha = deltaP.get(s.startTangencyId)!;
    const dpBeta = deltaP.get(s.endTangencyId)!;

    const tAlphaPoint = tangencies[tangencyIndex.get(s.startTangencyId)!].point;
    const tBetaPoint = tangencies[tangencyIndex.get(s.endTangencyId)!].point;

    const vs = sub(tBetaPoint, tAlphaPoint);
    const ls = norm(vs);
    const vHat = ls > 0 ? scale(vs, 1 / ls) : { x: 0, y: 0 };

    // P_s * (dpBeta - dpAlpha) where P_s = I - vHat vHat^T
    const diffDp = sub(dpBeta, dpAlpha);
    const dotVal = dot(vHat, diffDp);
    const proj = scale(vHat, dotVal);
    const Ps_diffDp = sub(diffDp, proj);

    const term = norm(Ps_diffDp);
    Q_total += (1 / ls) * (term * term);
  }

  return Q_total;
}

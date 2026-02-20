/**
 * Criticality and Stability Testing
 * Sections 2.15, 2.16
 */

import { checkAndComputeTangents } from './checks';
import type { GaugeResult } from './gauge';
import { dot, norm, normalize, scale, sub } from './geometry';
import { Matrix } from './linearAlgebra';
import { constructTc } from './matrices';
import type { CSDiagram } from './types';

export type CriticalityResult = {
  r: Matrix;
  normR: number;
  normGred: number;
  ratio: number;
  isCritical: boolean;
  message: string;
};

/**
 * 2.15 Test de criticidad
 * Method 1: r = Ug^T * g_red
 */
export function testCriticality(
  gred: Matrix,
  gauge: GaugeResult,
  diagram: CSDiagram,
): CriticalityResult {
  // r := Ug^T g_red
  const r = gauge.Ug.transpose().multiply(gred);

  const normR = r.norm();
  const normGred = gred.norm();

  // Handle case where gred is zero (already critical)
  const ratio = normGred > 1e-15 ? normR / normGred : 0;

  const isCritical = normR <= diagram.tolerances.lin * normGred || normGred < 1e-12; // Safety for zero gradient

  return {
    r,
    normR,
    normGred,
    ratio,
    isCritical,
    message: isCritical
      ? `CRITICAL (Ratio ${ratio.toExponential(4)} <= ${diagram.tolerances.lin})`
      : `NOT CRITICAL (Ratio ${ratio.toExponential(4)})`,
  };
}

/**
 * 2.16 Test cuadratico opcional
 * Evaluate Q_red(U_g z)
 */
export function evaluateQuadratic(diagram: CSDiagram, gauge: GaugeResult, z: Matrix): number {
  // z: vector of coeffs for Ug
  // delta c = Ug * z
  const deltaC = gauge.Ug.multiply(z);

  // Calculate omega = -Tc(c) * deltaC
  // Need Tc
  const Tc = constructTc(diagram); // This re-computes Tc, could pass it in for efficiency
  const omega = Tc.multiply(deltaC).multiply(Matrix.fromArray([-1])); // -1 * Tc * dc ???
  // Wait, omega = -Tc deltaC.
  // My Matrix mult: A.mult(B).
  // scale by -1
  const mOne = Matrix.identity(omega.rows);
  for (let i = 0; i < omega.rows; i++) mOne.set(i, i, -1);
  // Actually easier: just loop and negate
  for (let r = 0; r < omega.rows; r++) omega.set(r, 0, -omega.get(r, 0));

  // Compute delta p_alpha = delta c_k(alpha) + omega_alpha t_alpha
  const { tangencies, disks, segments } = diagram;
  const tangentsMap = checkAndComputeTangents(diagram).tangents;
  const tangencyIndex = new Map(tangencies.map((t, i) => [t.id, i]));

  // Precompute delta P for all tangencies
  const deltaP = new Map<string, { x: number; y: number }>();

  tangencies.forEach((t, i) => {
    const k = t.diskIndex;
    const tVec = tangentsMap[t.id];

    const dcx = deltaC.get(2 * k, 0);
    const dcy = deltaC.get(2 * k + 1, 0);
    const w = omega.get(i, 0);

    // dp = dc + w * t
    deltaP.set(t.id, {
      x: dcx + w * tVec.x,
      y: dcy + w * tVec.y,
    });
  });

  // Calculate Sum Q_s
  let Q_total = 0;

  for (const s of segments) {
    const dpAlpha = deltaP.get(s.startTangencyId)!;
    const dpBeta = deltaP.get(s.endTangencyId)!;

    // Get segment data (need current geometry geometry)
    const tAlphaPoint = tangencies[tangencyIndex.get(s.startTangencyId)!].point;
    const tBetaPoint = tangencies[tangencyIndex.get(s.endTangencyId)!].point;

    const vs = sub(tBetaPoint, tAlphaPoint);
    const ls = norm(vs);
    const vHat = ls > 0 ? scale(vs, 1 / ls) : { x: 0, y: 0 };

    // delta p_beta - delta p_alpha
    const diffDp = sub(dpBeta, dpAlpha);

    // Ps = I - vHat vHat^T
    // Qs = 1/ls * || Ps * diffDp ||^2
    // Ps * v = v - vHat (vHat^T v)

    const dotVal = dot(vHat, diffDp);
    const proj = scale(vHat, dotVal);
    const Ps_diffDp = sub(diffDp, proj);

    const term = norm(Ps_diffDp); // ||Ps ... ||
    Q_total += (1 / ls) * (term * term);
  }

  return Q_total;
}

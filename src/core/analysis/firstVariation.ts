/**
 * First Variation Functional for CS Diagrams
 *
 * Section 2.13 -- Assembles the gradient vectors g_c and g_w of the
 * length functional, and computes the reduced gradient g_red used for
 * criticality testing.
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
// Assembly
// ----------------------------------------------------------------

/**
 * Section 2.13 -- Mechanical assembly of the first variation.
 *
 * Returns { gc, gw } where:
 *   gc (2N x 1) -- gradient with respect to center displacements
 *   gw (|T| x 1) -- gradient with respect to tangency angle shifts
 *
 * Segments contribute directional terms; arcs contribute +/-1 counting.
 */
export function assembleFunctional(
  diagram: CSDiagram,
  tangentsMap?: Record<string, Vector>,
): { gc: Matrix; gw: Matrix } {
  const { disks, tangencies, segments, arcs } = diagram;
  const N = disks.length;
  const numTangencies = tangencies.length;

  const gc = Matrix.zeros(2 * N, 1);
  const gw = Matrix.zeros(numTangencies, 1);

  const tangencyIndex = new Map(tangencies.map((t, i) => [t.id, i]));
  const tangencyObj = new Map(tangencies.map((t) => [t.id, t]));

  const tMap = tangentsMap ?? computeTangentMap(diagram);

  // Segment contributions
  for (const s of segments) {
    const alphaId = s.startTangencyId;
    const betaId = s.endTangencyId;
    const alphaIdx = tangencyIndex.get(alphaId)!;
    const betaIdx = tangencyIndex.get(betaId)!;

    const tAlpha = tangencyObj.get(alphaId)!;
    const tBeta = tangencyObj.get(betaId)!;

    const vs = sub(tBeta.point, tAlpha.point);
    const ls = norm(vs);
    const vHat = ls > 0 ? scale(vs, 1 / ls) : { x: 0, y: 0 };

    const kAlpha = tAlpha.diskIndex;
    const kBeta = tBeta.diskIndex;

    const T_alpha = tMap[alphaId];
    const T_beta = tMap[betaId];

    // gc: disk k(alpha) gets -vHat, disk k(beta) gets +vHat
    gc.set(2 * kAlpha, 0, gc.get(2 * kAlpha, 0) - vHat.x);
    gc.set(2 * kAlpha + 1, 0, gc.get(2 * kAlpha + 1, 0) - vHat.y);
    gc.set(2 * kBeta, 0, gc.get(2 * kBeta, 0) + vHat.x);
    gc.set(2 * kBeta + 1, 0, gc.get(2 * kBeta + 1, 0) + vHat.y);

    // gw: tangency alpha gets -<vHat, t_alpha>, beta gets +<vHat, t_beta>
    gw.set(alphaIdx, 0, gw.get(alphaIdx, 0) - dot(vHat, T_alpha));
    gw.set(betaIdx, 0, gw.get(betaIdx, 0) + dot(vHat, T_beta));
  }

  // Arc contributions: alpha gets -1, beta gets +1
  for (const a of arcs) {
    const alphaIdx = tangencyIndex.get(a.startTangencyId)!;
    const betaIdx = tangencyIndex.get(a.endTangencyId)!;

    gw.set(alphaIdx, 0, gw.get(alphaIdx, 0) - 1);
    gw.set(betaIdx, 0, gw.get(betaIdx, 0) + 1);
  }

  return { gc, gw };
}

// ----------------------------------------------------------------
// Reduction
// ----------------------------------------------------------------

/**
 * Section 2.13 -- Reduced gradient.
 *
 *   g_red = g_c - Tc^T * g_w
 *
 * This eliminates the omega variables so that criticality can be
 * tested purely in the center-displacement space.
 */
export function reduceFunctional(gc: Matrix, gw: Matrix, Tc: Matrix): Matrix {
  const term2 = Tc.transpose().multiply(gw);
  return gc.sub(term2);
}

/**
 * Convenience: assemble and reduce in one call.
 */
export function computeReducedGradient(
  diagram: CSDiagram,
  tangentsMap?: Record<string, Vector>,
): Matrix {
  const tMap = tangentsMap ?? computeTangentMap(diagram);
  const { gc, gw } = assembleFunctional(diagram, tMap);
  const Tc = constructTc(diagram, tMap);
  return reduceFunctional(gc, gw, Tc);
}

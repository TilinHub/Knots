/**
 * First Variation Functional for CS Diagram Protocol
 * Section 2.13
 */

import type { CSDiagram, Disk } from './types';
import { Matrix } from './linearAlgebra';
import { sub, norm, scale, dot } from './geometry';
import { checkAndComputeTangents } from './checks';

/**
 * 2.13 Ensamble mecanico de Phi
 * Returns { gc, gw }
 */
export function assembleFunctional(diagram: CSDiagram, tangentsMap?: Record<string, { x: number, y: number }>): { gc: Matrix, gw: Matrix } {
    const { disks, tangencies, segments, arcs } = diagram;
    const N = disks.length;
    const numTangencies = tangencies.length;

    const gc = Matrix.zeros(2 * N, 1);
    const gw = Matrix.zeros(numTangencies, 1);

    // Tangency index lookup
    const tangencyIndex = new Map(tangencies.map((t, i) => [t.id, i]));
    const tangencyObj = new Map(tangencies.map(t => [t.id, t]));

    let tMap = tangentsMap;
    if (!tMap) {
        tMap = checkAndComputeTangents(diagram).tangents;
    }

    // Regla por segmento s: alpha -> beta
    for (const s of segments) {
        const alphaId = s.startTangencyId;
        const betaId = s.endTangencyId;
        const alphaIdx = tangencyIndex.get(alphaId)!;
        const betaIdx = tangencyIndex.get(betaId)!;

        const tAlpha = tangencyObj.get(alphaId)!;
        const tBeta = tangencyObj.get(betaId)!;

        const pAlpha = tAlpha.point;
        const pBeta = tBeta.point;
        const kAlpha = tAlpha.diskIndex;
        const kBeta = tBeta.diskIndex;

        const vs = sub(pBeta, pAlpha);
        const ls = norm(vs);
        const vHat = ls > 0 ? scale(vs, 1 / ls) : { x: 0, y: 0 };

        const T_alpha = tMap[alphaId];
        const T_beta = tMap[betaId];

        // En el bloque del disco k(alpha): sumar -v_hat a gc
        gc.set(2 * kAlpha, 0, gc.get(2 * kAlpha, 0) - vHat.x);
        gc.set(2 * kAlpha + 1, 0, gc.get(2 * kAlpha + 1, 0) - vHat.y);

        // En el bloque del disco k(beta): sumar +v_hat a gc
        gc.set(2 * kBeta, 0, gc.get(2 * kBeta, 0) + vHat.x);
        gc.set(2 * kBeta + 1, 0, gc.get(2 * kBeta + 1, 0) + vHat.y);

        // En la componente alpha de gw: sumar -<v_hat, t_alpha>
        const termAlpha = -dot(vHat, T_alpha);
        gw.set(alphaIdx, 0, gw.get(alphaIdx, 0) + termAlpha);

        // En la componente beta de gw: sumar +<v_hat, t_beta>
        const termBeta = dot(vHat, T_beta);
        gw.set(betaIdx, 0, gw.get(betaIdx, 0) + termBeta);
    }

    // Regla por arco a = (alpha -> beta, k, DeltaTheta)
    for (const a of arcs) {
        const alphaIdx = tangencyIndex.get(a.startTangencyId)!;
        const betaIdx = tangencyIndex.get(a.endTangencyId)!;

        // En la componente alpha de gw: sumar -1
        gw.set(alphaIdx, 0, gw.get(alphaIdx, 0) - 1);

        // En la componente beta de gw: sumar +1
        gw.set(betaIdx, 0, gw.get(betaIdx, 0) + 1);
    }

    return { gc, gw };
}

/**
 * 2.13 Reduccion
 * g_red = g_c - Tc^T * g_w
 */
export function reduceFunctional(gc: Matrix, gw: Matrix, Tc: Matrix): Matrix {
    // Tc: cols = 2N, rows = |T|. Transpose -> 2N x |T|
    // gw: |T| x 1
    // Tc^T * gw -> 2N x 1
    const term2 = Tc.transpose().multiply(gw);
    return gc.sub(term2);
}

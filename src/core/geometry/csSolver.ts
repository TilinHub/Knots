import * as math from 'mathjs';

import type { Point2D } from '../types/cs';
import type { CSDiagramState } from './csProtocol';

// Vector operations
const vecSub = (p1: Point2D, p2: Point2D): Point2D => ({ x: p1.x - p2.x, y: p1.y - p2.y });
const vecMult = (p: Point2D, s: number): Point2D => ({ x: p.x * s, y: p.y * s });
const vecNorm = (v: Point2D): number => Math.sqrt(v.x * v.x + v.y * v.y);
const vecNormalize = (v: Point2D): Point2D => {
    const norm = vecNorm(v);
    return norm === 0 ? { x: 0, y: 0 } : vecMult(v, 1 / norm);
};

export interface CSDeltaResult {
    deltaC: Map<string, Point2D>;
    omega: Map<string, number>;
}

/**
 * Solves the First-Order Variation of a CS Diagram to move the given target disks,
 * while constrained to the configuration stratum `Roll(c)`.
 *
 * Mathematically corresponds to calculating the admissible directions 
 * ker L(c) = { (δc, ω) : L(c)(δc, ω) = 0 }
 * and projecting the user's intended displacement onto this kernel.
 */
export function solveCSDiagramDelta(
    state: CSDiagramState,
    targetDisplacements: Map<string, Point2D>,
): CSDeltaResult | null {

    // Create indexed mappings to construct the matrices
    const diskIds = Array.from(state.disks.keys());
    const numDisks = diskIds.length;
    const tangencyIds = Array.from(state.tangencies.keys());
    const numTangencies = tangencyIds.length;

    const diskIndexMap = new Map<string, number>();
    diskIds.forEach((id, idx) => diskIndexMap.set(id, idx));

    // Construct A(c) block: Contacts ||ci - cj|| = 2
    // Size: |E| rows by 2N columns
    const numContacts = state.contacts.length;
    const A_c = math.zeros(numContacts, 2 * numDisks) as math.Matrix;

    state.contacts.forEach((contact, contactIdx) => {
        const d1 = state.disks.get(contact.diskId1)!;
        const d2 = state.disks.get(contact.diskId2)!;

        // u_ij = (ci - cj)/||ci - cj||
        const diff = vecSub(d1.center, d2.center);
        const u_ij = vecNormalize(diff);

        const idx1 = diskIndexMap.get(d1.id)!;
        const idx2 = diskIndexMap.get(d2.id)!;

        // block u_ij^T in columns of disk i
        A_c.set([contactIdx, idx1 * 2], u_ij.x);
        A_c.set([contactIdx, idx1 * 2 + 1], u_ij.y);

        // block -u_ij^T in columns of disk j
        A_c.set([contactIdx, idx2 * 2], -u_ij.x);
        A_c.set([contactIdx, idx2 * 2 + 1], -u_ij.y);
    });

    // Construct T_c(c) block: Tangencies <t_alpha, delta c_k(alpha)> + omega_alpha = 0
    // Size: |T| rows by 2N columns
    const T_c = math.zeros(numTangencies, 2 * numDisks) as math.Matrix;

    state.tangencies.forEach((tangency, tangencyId) => {
        const tIdx = tangencyIds.indexOf(tangencyId);
        const diskIdx = diskIndexMap.get(tangency.diskId)!;

        // block t_alpha^T in columns of disk k(alpha)
        T_c.set([tIdx, diskIdx * 2], tangency.tangent.x);
        T_c.set([tIdx, diskIdx * 2 + 1], tangency.tangent.y);
    });

    // In this model T_omega(c) is the identity Matrix I_T.
    // The full linear operator L(c) acts on (delta c, omega).
    // L(c) = [ A(c)     0    ]
    //        [ T_c(c)  I_T   ]

    // What we want is the projection of the user's `targetDisplacements` onto the kernel.
    // From the paper (1.6 Elimination of omega): ω = -T_c(c) * δc.
    // So the admisible motions are exactly δc ∈ Roll(c) = ker A(c).

    // Ensure the target displacement delta c0 resides in ker A(c)
    // Build the target displacement vector 2Nx1
    const targetVecArray = Array(2 * numDisks).fill(0);
    targetDisplacements.forEach((delta, diskId) => {
        const idx = diskIndexMap.get(diskId);
        if (idx !== undefined) {
            targetVecArray[idx * 2] = delta.x;
            targetVecArray[idx * 2 + 1] = delta.y;
        }
    });

    const targetVec = math.transpose(math.matrix([targetVecArray])) as math.Matrix;

    // We need to project `targetVec` onto `ker(A(c))` using Orthogonal Projection
    // P_{ker(A)} = I - A^T (A A^T)^+ A
    // If rank(A) == 0, then P_{ker(A)} is the identity matrix.

    let deltaC_mat: math.Matrix;

    if (numContacts === 0) {
        // No constraints, projection is the identity
        deltaC_mat = targetVec;
    } else {
        const A_c_T = math.transpose(A_c);
        const A_A_T = math.multiply(A_c, A_c_T) as math.Matrix;

        try {
            // A_A_T might not be invertible if there are redundant constraints. Using pseudo-inverse.
            const pinv_A_A_T = math.pinv(A_A_T);
            // A^T * (A A^T)^+ * A
            const proj_OrthA = math.multiply(math.multiply(A_c_T, pinv_A_A_T), A_c) as math.Matrix;
            const It = math.identity(2 * numDisks) as math.Matrix;
            // P_{ker(A)}
            const proj_kerA = math.subtract(It, proj_OrthA) as math.Matrix;

            deltaC_mat = math.multiply(proj_kerA, targetVec) as math.Matrix;
        } catch (e) {
            console.error("csSolver: Could not compute projection onto ker A(c)", e);
            return null;
        }
    }

    // Calculate omega = -T_c(c) * deltaC
    const omega_mat = math.multiply(math.multiply(T_c, -1), deltaC_mat) as math.Matrix;

    // Reconstruct resulting maps
    const deltaC = new Map<string, Point2D>();
    diskIds.forEach((id, idx) => {
        deltaC.set(id, {
            x: deltaC_mat.get([idx * 2, 0]) as number,
            y: deltaC_mat.get([idx * 2 + 1, 0]) as number
        });
    });

    const omega = new Map<string, number>();
    tangencyIds.forEach((id, idx) => {
        omega.set(id, omega_mat.get([idx, 0]) as number);
    });

    return { deltaC, omega };
}

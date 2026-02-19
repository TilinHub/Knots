/**
 * Gauge Fixing for CS Diagram Protocol
 * Section 2.14
 */

import { Matrix, orth,qr } from './linearAlgebra';
import { constructA } from './matrices';
import type { CSDiagram } from './types';

/**
 * Movimientos rigidos en el espacio ambiente V
 * 2N x 3
 */
export function constructV(diagram: CSDiagram): Matrix {
    const N = diagram.disks.length;
    const V = Matrix.zeros(2 * N, 3);

    for (let i = 0; i < N; i++) {
        const cx = diagram.disks[i].center.x;
        const cy = diagram.disks[i].center.y;

        // v(x): delta c_i = (1, 0)
        V.set(2 * i, 0, 1);
        V.set(2 * i + 1, 0, 0);

        // v(y): delta c_i = (0, 1)
        V.set(2 * i, 1, 0);
        V.set(2 * i + 1, 1, 1);

        // v(rot): delta c_i = J ci = (-y, x)
        V.set(2 * i, 2, -cy);
        V.set(2 * i + 1, 2, cx);
    }
    return V;
}

export type GaugeResult = {
    U: Matrix;
    V_Roll: Matrix;
    W: Matrix;
    P_perp: Matrix;
    Ug: Matrix;
    checks: {
        AUc: number;
        UtU_I: number;
        WtW_I: number;
        UgtW: number;
    }
};

/**
 * Construccion de la base con gauge U_g
 */
export function constructGaugeBasis(diagram: CSDiagram, U_roll: Matrix): GaugeResult {
    // U_roll is orthonormal basis of Roll(c) (Kernel of A)
    // Dimensions: 2N x d where d = 2N - rank(A)

    const V = constructV(diagram); // 2N x 3

    // V_Roll := U U^T V
    // U: 2N x d. U^T: d x 2N. V: 2N x 3.
    // U^T V: d x 3
    // V_Roll: 2N x 3
    const UtV = U_roll.transpose().multiply(V);
    const VRoll = U_roll.multiply(UtV);

    // Sea W una base ortonormal de im(V_Roll)
    // Obtained by QR or SVD, discarding columns with norm <= tol_lin
    // My orth function just orthnormalizes.
    // Since V has 3 columns (usually independent unless diagram is degenerate?), W will have 3 cols (or less).
    // We should check rank.
    const { Q: Q_W, R: R_W } = qr(VRoll);

    // Rank check
    let rankW = 0;
    for (let i = 0; i < 3; i++) {
        if (Math.abs(R_W.get(i, i)) > diagram.tolerances.lin) {
            rankW++;
        }
    }

    // W is first rankW columns of Q_W
    const W = Matrix.zeros(VRoll.rows, rankW);
    for (let r = 0; r < VRoll.rows; r++) {
        for (let c = 0; c < rankW; c++) {
            W.set(r, c, Q_W.get(r, c));
        }
    }

    // P_perp := I - W W^T
    const I = Matrix.identity(VRoll.rows); // 2N x 2N
    const WWt = W.multiply(W.transpose());
    const P_perp = I.sub(WWt);

    // Ug := orth(P_perp U)
    const PpU = P_perp.multiply(U_roll);

    // NOTE: orth(.) here needs to return basis for Range(PpU).
    // Dimensions of PpU: 2N x d.
    // We expect d - rank(V_Roll) dimensions?
    // Let's use generic QR orth.
    const Ug_full = orth(PpU);

    // But wait! PpU has d columns. Some might be zero (those in V_Roll).
    // Typically strict "orth" would remove zero columns.
    // The PDF says "descartando columnas con norma <= tol_lin" implicit in "re-ortonormalizar".
    // My simple `orth` just returns simplified Q from QR (first n cols).
    // If a column is dependent (zero), Q will pick an arbitrary orthogonal direction from the nullspace. We don't want that if we want strictly the range basis.
    // Let's implement a safer extraction:
    const { Q: Q_g, R: R_g } = qr(PpU);
    let rankUg = 0;
    const maxRank = Math.min(PpU.rows, PpU.cols);
    for (let i = 0; i < maxRank; i++) {
        if (Math.abs(R_g.get(i, i)) > diagram.tolerances.lin) {
            rankUg++;
        }
    }

    const Ug = Matrix.zeros(PpU.rows, rankUg);
    for (let r = 0; r < PpU.rows; r++) {
        for (let c = 0; c < rankUg; c++) {
            Ug.set(r, c, Q_g.get(r, c));
        }
    }

    // Check metrics
    // ||A U|| (requires A)
    const A = constructA(diagram);
    const AUc_mat = A.multiply(U_roll);
    const AUc = AUc_mat.norm();

    // ||U^T U - I||
    const UtU = U_roll.transpose().multiply(U_roll);
    const UtU_I = UtU.sub(Matrix.identity(UtU.rows)).norm();

    // ||W^T W - I||
    const WtW = W.transpose().multiply(W);
    const WtW_I = WtW.sub(Matrix.identity(WtW.rows)).norm();

    // ||Ug^T W||
    const UgtW = Ug.transpose().multiply(W).norm();

    return {
        U: U_roll, V_Roll: VRoll, W, P_perp, Ug,
        checks: { AUc, UtU_I, WtW_I, UgtW }
    };
}

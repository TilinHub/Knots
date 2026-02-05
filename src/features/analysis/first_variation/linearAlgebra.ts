/**
 * Minimal Linear Algebra Library for CS Diagram Protocol
 * Implements Dense Matrix, QR Decomposition, and Nullspace.
 */

export class Matrix {
    rows: number;
    cols: number;
    data: number[][]; // Row-major

    constructor(rows: number, cols: number, data?: number[][]) {
        this.rows = rows;
        this.cols = cols;
        if (data) {
            if (data.length !== rows || data[0].length !== cols) {
                throw new Error("Invalid data dimensions");
            }
            this.data = data;
        } else {
            this.data = Array(rows).fill(0).map(() => Array(cols).fill(0));
        }
    }

    static zeros(rows: number, cols: number): Matrix {
        return new Matrix(rows, cols);
    }

    static identity(n: number): Matrix {
        const m = new Matrix(n, n);
        for (let i = 0; i < n; i++) m.data[i][i] = 1;
        return m;
    }

    static fromArray(arr: number[]): Matrix {
        return new Matrix(arr.length, 1, arr.map(v => [v]));
    }

    get(r: number, c: number): number {
        return this.data[r][c];
    }

    set(r: number, c: number, val: number): void {
        this.data[r][c] = val;
    }

    /** Matrix Multiplication C = A * B */
    multiply(B: Matrix): Matrix {
        if (this.cols !== B.rows) throw new Error(`Dim mismatch: ${this.rows}x${this.cols} * ${B.rows}x${B.cols}`);
        const C = Matrix.zeros(this.rows, B.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < B.cols; j++) {
                let sum = 0;
                for (let k = 0; k < this.cols; k++) {
                    sum += this.data[i][k] * B.data[k][j];
                }
                C.data[i][j] = sum;
            }
        }
        return C;
    }

    transpose(): Matrix {
        const T = Matrix.zeros(this.cols, this.rows);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                T.data[j][i] = this.data[i][j];
            }
        }
        return T;
    }

    add(B: Matrix): Matrix {
        if (this.rows !== B.rows || this.cols !== B.cols) throw new Error("Dim mismatch add");
        const C = Matrix.zeros(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                C.data[i][j] = this.data[i][j] + B.data[i][j];
            }
        }
        return C;
    }

    sub(B: Matrix): Matrix {
        if (this.rows !== B.rows || this.cols !== B.cols) throw new Error("Dim mismatch sub");
        const C = Matrix.zeros(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                C.data[i][j] = this.data[i][j] - B.data[i][j];
            }
        }
        return C;
    }

    /** Frobenius Norm */
    norm(): number {
        let sum = 0;
        for (const row of this.data) for (const val of row) sum += val * val;
        return Math.sqrt(sum);
    }

    toString(): string {
        return this.data.map(r => r.map(x => x.toFixed(4)).join("\t")).join("\n");
    }
}

/**
 * QR Decomposition using Householder Reflections
 * A = Q * R
 * A: mxn
 * Q: mxm (Orthogonal)
 * R: mxn (Upper triangular)
 */
export function qr(A: Matrix): { Q: Matrix, R: Matrix } {
    const m = A.rows;
    const n = A.cols;
    let Q = Matrix.identity(m);
    let R = new Matrix(m, n, A.data.map(r => [...r])); // Copy A

    const numHouseholder = Math.min(m - 1, n);

    for (let k = 0; k < numHouseholder; k++) {
        // Construct vector x = R[k:m, k]
        const xSize = m - k;
        const x = new Float64Array(xSize);
        for (let i = 0; i < xSize; i++) x[i] = R.data[k + i][k];

        const normX = Math.sqrt(x.reduce((acc, val) => acc + val * val, 0));
        if (normX < 1e-12) continue; // Already zero

        // Vector v = x + sign(x[0]) * ||x|| * e1
        const s = x[0] >= 0 ? 1 : -1;
        const v = new Float64Array(xSize);
        for (let i = 0; i < xSize; i++) v[i] = x[i];
        v[0] += s * normX;

        const normVSq = v.reduce((acc, val) => acc + val * val, 0);
        if (normVSq < 1e-12) continue;

        // H_k = I - 2 v v^T / (v^T v)
        // Apply H_k to R from left: R' = H_k * R
        // Apply H_k to Q from right: Q' = Q * H_k

        // Optimized application:
        // H_k applies to rows/cols k..m-1
        // R[k:m, j] = R[k:m, j] - 2 * v * (v^T * R[k:m, j]) / (v^T v)

        // Apply to R
        for (let j = k; j < n; j++) {
            let dot = 0;
            for (let i = 0; i < xSize; i++) dot += v[i] * R.data[k + i][j];
            const factor = (2 * dot) / normVSq;
            for (let i = 0; i < xSize; i++) R.data[k + i][j] -= factor * v[i];
        }

        // Apply to Q (accumulate Q)
        // Q = Q * H_k
        // H_k is symmetric. Q_new column i = Q_old * H_k_col_i ?? No.
        // Q * H_k: Q[i, k:m] -= ...
        for (let i = 0; i < m; i++) {
            let dot = 0;
            for (let l = 0; l < xSize; l++) dot += Q.data[i][k + l] * v[l];
            const factor = (2 * dot) / normVSq;
            for (let l = 0; l < xSize; l++) Q.data[i][k + l] -= factor * v[l];
        }
    }

    return { Q, R };
}

/**
 * Calculates Nullspace using QR Decomposition of Transpose.
 * A: mxn
 * Kernel(A) has dim n - rank(A).
 * A^T = Q * R. Range(A^T) spanned by first 'rank' cols of Q.
 * Null(A) spanned by remaining cols of Q.
 * Returns Matrix whose columns form a basis of Kernel(A).
 */
export function nullspace(A: Matrix, tol: number = 1e-9): Matrix {
    const At = A.transpose();
    const { Q, R } = qr(At);

    // Determine rank based on diagonal of R
    let rank = 0;
    const minDim = Math.min(R.rows, R.cols);
    for (let i = 0; i < minDim; i++) {
        if (Math.abs(R.data[i][i]) > tol) {
            rank++;
        }
    }

    // Nullspace basis are columns of Q from rank to end
    // Q is mxm. A^T is nxm. So Q is nxn.
    const nullDim = Q.cols - rank;
    if (nullDim <= 0) return Matrix.zeros(A.cols, 0);

    const K = Matrix.zeros(A.cols, nullDim);
    for (let r = 0; r < A.cols; r++) {
        for (let c = 0; c < nullDim; c++) {
            K.data[r][c] = Q.data[r][rank + c];
        }
    }

    return K;
}

/** 
 * Orthogonalize columns of A using QR.
 * Returns basis Q.
 */
export function orth(A: Matrix): Matrix {
    const { Q, R } = qr(A);
    // Discard columns where R diagonal is small?
    // "orth(.) significa re-ortonormalizar por QR" (PDF 2.14)
    // If A is approximately a basis, Q from QR is the orthonormalized version.
    // If A has dependent columns, we should truncate?
    // PDF says "descartando columnas con norma <= tol_lin" before calling orth.
    // So assume A inputs are roughly independent, we just want Q.
    // return Q.multiply(Matrix.identity(A.cols)); // Careful, qr returns Full Q (mxm). We want Thin Q if A is tall?
    // My QR returns Full Q. 
    // If A is m x n, Q is m x m.
    // If we want basis for Range(A), we take first n columns of Q?
    // Only if A has full column rank.
    // Let's implement Thin QR selector.

    // For `orth` in the context of the PDF "Ug := orth(P_perp U)", 
    // U is 2N x d. P_perp U is 2N x d.
    // We want to orthonormalize columns of P_perp U.
    // So we just run QR on it and take the first d columns of Q?
    // Yes, provided dimension doesn't drop.
    // But `qr` output Q is square. R is m x n.
    // Basis is first n columns of Q *if* rank is full.
    // Let's return the simplified Thin Q.
    const m = A.rows;
    const n = A.cols;
    // Hack: My QR returns m x m Q.
    // The basis for the columns of A are the first n columns of Q (assuming full rank).
    const ThinQ = Matrix.zeros(m, n);
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            ThinQ.data[i][j] = Q.data[i][j];
        }
    }
    return ThinQ;
}
/**
 * Computes numerical rank using QR decomposition.
 */
export function rank(A: Matrix, tol: number = 1e-9): number {
    const { R } = qr(A);
    let r = 0;
    const minDim = Math.min(R.rows, R.cols);
    for (let i = 0; i < minDim; i++) {
        if (Math.abs(R.data[i][i]) > tol) {
            r++;
        }
    }
    return r;
}

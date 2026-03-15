/**
 * Minimal Dense Linear Algebra Library
 *
 * Implements Matrix, QR decomposition (Householder), nullspace,
 * orthonormalization, and numerical rank.  Self-contained -- no
 * external dependencies.
 */

export class Matrix {
  rows: number;
  cols: number;
  data: number[][]; // Row-major

  constructor(rows: number, cols: number, data?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    if (data) {
      if (data.length !== rows) {
        throw new Error('Invalid data dimensions (rows)');
      }
      if (rows > 0 && data[0].length !== cols) {
        throw new Error('Invalid data dimensions (cols)');
      }
      this.data = data;
    } else {
      this.data = Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(0));
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
    return new Matrix(
      arr.length,
      1,
      arr.map((v) => [v]),
    );
  }

  get(r: number, c: number): number {
    return this.data[r][c];
  }

  set(r: number, c: number, val: number): void {
    this.data[r][c] = val;
  }

  /** Matrix multiplication C = this * B */
  multiply(B: Matrix): Matrix {
    if (this.cols !== B.rows)
      throw new Error(`Dim mismatch: ${this.rows}x${this.cols} * ${B.rows}x${B.cols}`);
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
    if (this.rows !== B.rows || this.cols !== B.cols) throw new Error('Dim mismatch add');
    const C = Matrix.zeros(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        C.data[i][j] = this.data[i][j] + B.data[i][j];
      }
    }
    return C;
  }

  sub(B: Matrix): Matrix {
    if (this.rows !== B.rows || this.cols !== B.cols) throw new Error('Dim mismatch sub');
    const C = Matrix.zeros(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        C.data[i][j] = this.data[i][j] - B.data[i][j];
      }
    }
    return C;
  }

  /** Frobenius norm */
  norm(): number {
    let sum = 0;
    for (const row of this.data) for (const val of row) sum += val * val;
    return Math.sqrt(sum);
  }

  toString(): string {
    return this.data.map((r) => r.map((x) => x.toFixed(4)).join('\t')).join('\n');
  }
}

/**
 * QR decomposition using Householder reflections.
 * A = Q * R  where Q is m x m orthogonal, R is m x n upper-triangular.
 */
export function qr(A: Matrix): { Q: Matrix; R: Matrix } {
  const m = A.rows;
  const n = A.cols;
  const Q = Matrix.identity(m);
  const R = new Matrix(
    m,
    n,
    A.data.map((r) => [...r]),
  );

  const numHouseholder = Math.min(m - 1, n);

  for (let k = 0; k < numHouseholder; k++) {
    const xSize = m - k;
    const x = new Float64Array(xSize);
    for (let i = 0; i < xSize; i++) x[i] = R.data[k + i][k];

    const normX = Math.sqrt(x.reduce((acc, val) => acc + val * val, 0));
    if (normX < 1e-12) continue;

    const s = x[0] >= 0 ? 1 : -1;
    const v = new Float64Array(xSize);
    for (let i = 0; i < xSize; i++) v[i] = x[i];
    v[0] += s * normX;

    const normVSq = v.reduce((acc, val) => acc + val * val, 0);
    if (normVSq < 1e-12) continue;

    // Apply Householder to R
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = 0; i < xSize; i++) dot += v[i] * R.data[k + i][j];
      const factor = (2 * dot) / normVSq;
      for (let i = 0; i < xSize; i++) R.data[k + i][j] -= factor * v[i];
    }

    // Accumulate into Q
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
 * Computes a basis for the nullspace (kernel) of A using QR of A^T.
 * Returns a Matrix whose columns span ker(A).
 */
export function nullspace(A: Matrix, tol: number = 1e-9): Matrix {
  const At = A.transpose();
  const { Q, R } = qr(At);

  let rank = 0;
  const minDim = Math.min(R.rows, R.cols);
  for (let i = 0; i < minDim; i++) {
    if (Math.abs(R.data[i][i]) > tol) {
      rank++;
    }
  }

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
 * Orthonormalizes the columns of A via QR (thin Q).
 * Assumes A has approximately full column rank.
 */
export function orth(A: Matrix): Matrix {
  const { Q } = qr(A);
  const m = A.rows;
  const n = A.cols;
  const ThinQ = Matrix.zeros(m, n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      ThinQ.data[i][j] = Q.data[i][j];
    }
  }
  return ThinQ;
}

/**
 * Computes numerical rank of A using QR.
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

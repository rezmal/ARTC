import { abs, Complex, CMat, cx, div, mul, sub, ZERO } from './complex';

/**
 * Solve the complex linear system A x = b by Gaussian elimination with partial pivoting.
 * Returns null when A is numerically singular.
 *
 * (The MATLAB code solved a Tikhonov-regularised normal equation
 * (G'G + 1e-5 I) \ G'b instead, which biases every coefficient.)
 */
export function solveComplex(A: CMat, b: Complex[]): Complex[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  let maxEntry = 0;
  for (const row of A) for (const z of row) maxEntry = Math.max(maxEntry, abs(z));
  const tiny = maxEntry * 1e-14;

  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (abs(M[r][col]) > abs(M[piv][col])) piv = r;
    if (abs(M[piv][col]) <= tiny) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = div(M[r][col], M[col][col]);
      if (f.re === 0 && f.im === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] = sub(M[r][c], mul(f, M[col][c]));
    }
  }
  const x: Complex[] = new Array(n).fill(ZERO);
  for (let r = n - 1; r >= 0; r--) {
    let acc = M[r][n];
    for (let c = r + 1; c < n; c++) acc = sub(acc, mul(M[r][c], x[c]));
    x[r] = div(acc, M[r][r]);
  }
  return x;
}

export function matVec(A: CMat, x: Complex[]): Complex[] {
  return A.map((row) => row.reduce((s, a, j) => {
    const p = mul(a, x[j]);
    return cx(s.re + p.re, s.im + p.im);
  }, ZERO));
}

/**
 * Eigen-decomposition of a real symmetric 3x3 matrix (cyclic Jacobi).
 * Returns eigenvalues in DESCENDING order with matching unit eigenvectors.
 *
 * (The MATLAB code used eigs(), whose output ordering changed between releases;
 * it assumed ascending order, so on current MATLAB the qP and qS2 modes swap.)
 */
export function eigSym3(A: number[][]): { values: number[]; vectors: number[][] } {
  const a = A.map((r) => [...r]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
    const diag = a[0][0] ** 2 + a[1][1] ** 2 + a[2][2] ** 2;
    if (off <= 1e-30 * diag || off === 0) break;
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (a[p][q] === 0) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: order.map((i) => a[i][i]),
    vectors: order.map((i) => [v[0][i], v[1][i], v[2][i]]),
  };
}

/** Cholesky test for positive definiteness of a real symmetric matrix. */
export function isPositiveDefinite(A: number[][]): boolean {
  const n = A.length;
  const L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0)) return false;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return true;
}

export const asComplexMatrix = (A: number[][]): CMat => A.map((r) => r.map((x) => cx(x)));

import { isPositiveDefinite } from './linalg';

/** 6x6 Voigt stiffness matrix in GPa. */
export type Stiffness = number[][];

/** One half-space: stiffness (GPa) and density (g/cm^3). Velocities come out in km/s. */
export interface Medium {
  C: Stiffness;
  rho: number;
}

/** Voigt index (0-based) of the tensor index pair (i, j), 0-based. */
export const VOIGT = [
  [0, 5, 4],
  [5, 1, 3],
  [4, 3, 2],
];

const tensorCache = new WeakMap<Stiffness, Float64Array>();

/** Full 3x3x3x3 tensor, flattened as ((i*3 + j)*3 + k)*3 + l. Cached per matrix object. */
function tensorOf(C: Stiffness): Float64Array {
  let t = tensorCache.get(C);
  if (!t) {
    t = new Float64Array(81);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++)
          for (let l = 0; l < 3; l++) t[((i * 3 + j) * 3 + k) * 3 + l] = C[VOIGT[i][j]][VOIGT[k][l]];
    tensorCache.set(C, t);
  }
  return t;
}

/**
 * C_ijkl from the Voigt matrix (all indices 0-based). Matrices are treated as immutable:
 * build a new matrix instead of editing one in place.
 */
export const cijkl = (C: Stiffness, i: number, j: number, k: number, l: number): number =>
  tensorOf(C)[((i * 3 + j) * 3 + k) * 3 + l];

export const zeros6 = (): Stiffness => Array.from({ length: 6 }, () => new Array(6).fill(0));

export function symmetrize(C: Stiffness): Stiffness {
  const out = zeros6();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) out[i][j] = i <= j ? C[i][j] : C[j][i];
  return out;
}

export function isotropicFromLame(lambda: number, mu: number): Stiffness {
  const C = zeros6();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] = lambda + (i === j ? 2 * mu : 0);
  for (let i = 3; i < 6; i++) C[i][i] = mu;
  return C;
}

export function isotropicFromVelocities(vp: number, vs: number, rho: number): Stiffness {
  const mu = rho * vs * vs;
  return isotropicFromLame(rho * vp * vp - 2 * mu, mu);
}

/** VTI medium (symmetry axis x3) from Thomsen (1986) parameters. */
export function vtiFromThomsen(
  vp0: number,
  vs0: number,
  epsilon: number,
  delta: number,
  gamma: number,
  rho: number,
): Stiffness {
  const C33 = rho * vp0 * vp0;
  const C44 = rho * vs0 * vs0;
  const C11 = C33 * (1 + 2 * epsilon);
  const C66 = C44 * (1 + 2 * gamma);
  const disc = 2 * delta * C33 * (C33 - C44) + (C33 - C44) ** 2;
  const C13 = Math.sqrt(Math.max(disc, 0)) - C44;
  const C = zeros6();
  C[0][0] = C11;
  C[1][1] = C11;
  C[2][2] = C33;
  C[0][1] = C11 - 2 * C66;
  C[0][2] = C13;
  C[1][2] = C13;
  C[3][3] = C44;
  C[4][4] = C44;
  C[5][5] = C66;
  return symmetrize(C);
}

/**
 * Rotate the medium: first tilt its x3 axis by `tiltDeg` towards x1 (rotation about x2),
 * then rotate by `azimuthDeg` about the vertical x3 axis. Works on the full 4th-order
 * tensor, so it is exact for any symmetry class.
 *
 * (The MATLAB helper rot_psi.m only tilts, its comment names the wrong axis, and two
 * entries of its Bond matrix use the wrong direction cosines.)
 */
export function rotateStiffness(C: Stiffness, tiltDeg: number, azimuthDeg: number): Stiffness {
  if (tiltDeg === 0 && azimuthDeg === 0) return C.map((r) => [...r]);
  const t = (tiltDeg * Math.PI) / 180;
  const f = (azimuthDeg * Math.PI) / 180;
  const Ry = [
    [Math.cos(t), 0, Math.sin(t)],
    [0, 1, 0],
    [-Math.sin(t), 0, Math.cos(t)],
  ];
  const Rz = [
    [Math.cos(f), -Math.sin(f), 0],
    [Math.sin(f), Math.cos(f), 0],
    [0, 0, 1],
  ];
  const R = Rz.map((row) => [0, 1, 2].map((j) => row.reduce((s, r, k) => s + r * Ry[k][j], 0)));

  const out = zeros6();
  const pairs: [number, number][] = [
    [0, 0],
    [1, 1],
    [2, 2],
    [1, 2],
    [0, 2],
    [0, 1],
  ];
  for (let I = 0; I < 6; I++) {
    for (let J = I; J < 6; J++) {
      const [i, j] = pairs[I];
      const [k, l] = pairs[J];
      let s = 0;
      for (let p = 0; p < 3; p++)
        for (let q = 0; q < 3; q++) {
          const a = R[i][p] * R[j][q];
          if (a === 0) continue;
          for (let r = 0; r < 3; r++)
            for (let u = 0; u < 3; u++) {
              const b = R[k][r] * R[l][u];
              if (b !== 0) s += a * b * cijkl(C, p, q, r, u);
            }
        }
      out[I][J] = Math.abs(s) < 1e-12 ? 0 : s;
    }
  }
  return symmetrize(out);
}

export interface MediumIssue {
  level: 'error' | 'warning';
  message: string;
}

export function checkMedium(m: Medium): MediumIssue[] {
  const issues: MediumIssue[] = [];
  const flat = m.C.flat();
  if (flat.some((x) => !Number.isFinite(x))) {
    issues.push({ level: 'error', message: 'Every stiffness entry must be a number.' });
    return issues;
  }
  if (!(m.rho > 0)) issues.push({ level: 'error', message: 'Density must be greater than zero.' });
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      if (Math.abs(m.C[i][j] - m.C[j][i]) > 1e-9 * (1 + Math.abs(m.C[i][j])))
        issues.push({ level: 'error', message: 'Stiffness matrix must be symmetric.' });
  if (!isPositiveDefinite(m.C))
    issues.push({
      level: 'error',
      message: 'Stiffness matrix is not positive definite (strain energy would be negative).',
    });
  return issues.filter((v, i, a) => a.findIndex((w) => w.message === v.message) === i);
}

/** Classify the symmetry class roughly, for display only. */
export function describeSymmetry(C: Stiffness): string {
  const tol = 1e-9 * Math.max(...C.flat().map(Math.abs));
  const z = (i: number, j: number) => Math.abs(C[i - 1][j - 1]) <= tol;
  const eq = (a: number, b: number) => Math.abs(a - b) <= tol * 10;
  const offBlock = [
    [1, 4], [1, 5], [1, 6], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6], [4, 5], [4, 6], [5, 6],
  ].every(([i, j]) => z(i, j));
  if (!offBlock) {
    const monoclinic = [[1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5], [4, 6], [5, 6]].every(([i, j]) =>
      z(i, j),
    );
    return monoclinic ? 'Monoclinic (horizontal mirror plane)' : 'General / tilted anisotropy';
  }
  const c = (i: number, j: number) => C[i - 1][j - 1];
  const vti = eq(c(1, 1), c(2, 2)) && eq(c(4, 4), c(5, 5)) && eq(c(1, 3), c(2, 3)) &&
    eq(c(1, 2), c(1, 1) - 2 * c(6, 6));
  if (vti) {
    const iso = eq(c(1, 1), c(3, 3)) && eq(c(4, 4), c(6, 6)) && eq(c(1, 3), c(1, 2));
    return iso ? 'Isotropic' : 'VTI (transversely isotropic, vertical axis)';
  }
  return 'Orthorhombic (axes aligned)';
}

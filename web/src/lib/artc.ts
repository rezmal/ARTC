/**
 * ARTc solver: plane-wave reflection and transmission at a welded, horizontal interface
 * between two arbitrarily anisotropic elastic half-spaces.
 *
 * Coordinates: x3 points UP, the interface is x3 = 0, the upper medium is x3 > 0. The
 * incident wave travels downward in the upper medium. Plane waves are
 * u = A p exp(i w (s . x - t)), so an evanescent reflected wave has Im(s3) > 0 and an
 * evanescent transmitted wave has Im(s3) < 0.
 *
 * Units: stiffness in GPa, density in g/cm^3, so velocity is km/s and slowness s/km.
 *
 * Method (after Malehmir & Schmitt, 2016, Comput. Geosci. 93, 114-126):
 *  1. Christoffel eigen-problem along the incidence direction gives the incident slowness.
 *  2. Snell's law fixes (s1, s2); det(Gamma(s) - I) = 0 is a sextic in s3 for each medium.
 *  3. Roots are split into up/down going waves by energy flux (or decay for evanescent
 *     waves); polarizations are null vectors of Gamma(s) - I.
 *  4. Continuity of displacement and traction gives a 6x6 complex linear system.
 */
import {
  abs,
  abs2,
  arg,
  Complex,
  conj,
  cross,
  CVec3,
  cx,
  div,
  dot,
  mul,
  neg,
  norm,
  normalize,
  scale,
  sqrt,
  sub,
  ZERO,
} from './complex';
import { cijkl, Medium } from './elastic';
import { eigSym3, solveComplex } from './linalg';
import { Poly, polyAdd, polyMul, polyRoots, polySub } from './poly';

export type Mode = 0 | 1 | 2;
export const MODE_NAMES = ['qP', 'qS1', 'qS2'] as const;

export interface Wave {
  kind: 'incident' | 'reflected' | 'transmitted';
  mode: Mode;
  /** Slowness vector (s/km); s3 is complex for inhomogeneous waves. */
  slowness: CVec3;
  /** True when s3 is real, i.e. the wave carries energy away from the interface. */
  propagating: boolean;
  /** Phase velocity (km/s); null for evanescent waves. */
  velocity: number | null;
  /** Angle from the vertical in degrees (0-90 for every wave); null if evanescent. */
  angle: number | null;
  /** Propagation azimuth in degrees (0-360). */
  azimuth: number;
  /** Unit polarization vector; complex for evanescent waves, normalised so that p . p = 1. */
  polarization: CVec3;
  /** Displacement amplitude ratio to the incident wave (1 for the incident wave). */
  coefficient: Complex;
  magnitude: number;
  /** Phase of the coefficient in degrees, -180..180 (atan2, all four quadrants). */
  phase: number;
  /** Fraction of the incident vertical energy flux carried by this wave. */
  energy: number;
}

export interface Solution {
  incident: Wave;
  reflected: [Wave, Wave, Wave];
  transmitted: [Wave, Wave, Wave];
  /** Sum of the energy fractions; 1 when energy is conserved. */
  energyBalance: number;
  /** Relative residual of the boundary-condition solve. */
  residual: number;
  warnings: string[];
}

export interface Incidence {
  mode: Mode;
  /** Inclination from the vertical, degrees (0 <= inc < 90). */
  inclination: number;
  /** Azimuth from x1 towards x2, degrees. */
  azimuth: number;
}

const DEG = Math.PI / 180;
/** Relative distance below which two roots are treated as one degenerate (double) root. */
const DEGENERATE_TOL = 1e-6;

/** Christoffel matrix minus identity: Gamma_ik = C_ijkl s_j s_l / rho - delta_ik. */
function christoffelMinusI(m: Medium, s: CVec3): Complex[][] {
  const G: Complex[][] = [0, 1, 2].map(() => [ZERO, ZERO, ZERO]);
  for (let i = 0; i < 3; i++)
    for (let k = i; k < 3; k++) {
      let re = 0;
      let im = 0;
      for (let j = 0; j < 3; j++)
        for (let l = 0; l < 3; l++) {
          const c = cijkl(m.C, i, j, k, l);
          if (c === 0) continue;
          const p = mul(s[j], s[l]);
          re += c * p.re;
          im += c * p.im;
        }
      G[i][k] = cx(re / m.rho - (i === k ? 1 : 0), im / m.rho);
      G[k][i] = G[i][k];
    }
  return G;
}

/** Sextic det(Gamma(s1, s2, s3) - I) = 0 in s3 (highest power first). */
export function slownessSextic(m: Medium, s1: number, s2: number): Poly {
  const sh = [s1, s2];
  const T: Poly[][] = [0, 1, 2].map(() => [[0], [0], [0]]);
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 3; k++) {
      const a2 = cijkl(m.C, i, 2, k, 2);
      let a1 = 0;
      let a0 = 0;
      for (let j = 0; j < 2; j++) {
        a1 += (cijkl(m.C, i, j, k, 2) + cijkl(m.C, i, 2, k, j)) * sh[j];
        for (let l = 0; l < 2; l++) a0 += cijkl(m.C, i, j, k, l) * sh[j] * sh[l];
      }
      T[i][k] = [a2 / m.rho, a1 / m.rho, a0 / m.rho - (i === k ? 1 : 0)];
    }
  const minor = (a: number, b: number, c: number, d: number) =>
    polySub(polyMul(T[1][a], T[2][b]), polyMul(T[1][c], T[2][d]));
  return polyAdd(
    polySub(polyMul(T[0][0], minor(1, 2, 2, 1)), polyMul(T[0][1], minor(0, 2, 2, 0))),
    polyMul(T[0][2], minor(0, 1, 1, 0)),
  );
}

/**
 * Roots in s3 of the sextic. When every odd power vanishes (a horizontal mirror plane:
 * isotropic, VTI, aligned orthorhombic, ...) we solve the cubic in s3^2 instead, which is
 * better conditioned. The MATLAB code ALWAYS did this, silently discarding the odd
 * coefficients, so tilted (TTI) and general media gave wrong slownesses there.
 */
export function verticalSlownesses(m: Medium, s1: number, s2: number): Complex[] {
  const P = slownessSextic(m, s1, s2);
  const big = Math.max(...P.map(Math.abs));
  const oddNegligible = P.every((c, i) => i % 2 === 0 || Math.abs(c) <= 1e-12 * big);
  if (!oddNegligible) return mergeNearConjugates(polyRoots(P));
  const q = mergeNearConjugates(polyRoots(P.filter((_, i) => i % 2 === 0)));
  return q.flatMap((qi) => {
    const r = sqrt(qi);
    return [r, neg(r)];
  });
}

/**
 * A double real root comes out of the root finder as a conjugate pair split by ~1e-8.
 * Snap such pairs back onto the real axis so they are not mistaken for evanescent waves.
 */
function mergeNearConjugates(roots: Complex[]): Complex[] {
  const out = roots.map((r) => ({ ...r }));
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i];
      const b = out[j];
      const scaleRef = Math.max(abs(a), abs(b), 1e-12);
      if (abs(sub(a, conj(b))) <= DEGENERATE_TOL * scaleRef && Math.abs(a.im) <= DEGENERATE_TOL * scaleRef) {
        const re = (a.re + b.re) / 2;
        out[i] = cx(re);
        out[j] = cx(re);
      }
    }
  return out;
}

/** True when s3 has a non-negligible imaginary part relative to the whole slowness vector. */
function isEvanescent(s1: number, s2: number, s3: Complex): boolean {
  const scaleRef = Math.sqrt(s1 * s1 + s2 * s2 + abs2(s3)) || 1;
  return Math.abs(s3.im) > 1e-7 * scaleRef;
}

/** Traction on the horizontal plane: tau_j = C_3jkl p_k s_l (full stiffness, GPa * s/km). */
function traction(m: Medium, p: CVec3, s: CVec3): CVec3 {
  const t: Complex[] = [];
  for (let j = 0; j < 3; j++) {
    let re = 0;
    let im = 0;
    for (let k = 0; k < 3; k++)
      for (let l = 0; l < 3; l++) {
        const c = cijkl(m.C, 2, j, k, l);
        if (c === 0) continue;
        const z = mul(p[k], s[l]);
        re += c * z.re;
        im += c * z.im;
      }
    t.push(cx(re, im));
  }
  return t as CVec3;
}

/** Time-averaged vertical energy flux (up to the common factor w^2 / 2). */
function verticalFlux(m: Medium, p: CVec3, s: CVec3): number {
  const t = traction(m, p, s);
  return t.reduce((acc, tj, j) => acc + mul(tj, conj(p[j])).re, 0);
}

/** Null vector of a rank-2 complex symmetric 3x3 matrix (best-conditioned row cross product). */
function nullVector(M: Complex[][]): CVec3 {
  const rows = M as CVec3[];
  const candidates = [cross(rows[0], rows[1]), cross(rows[0], rows[2]), cross(rows[1], rows[2])];
  let best = candidates[0];
  for (const c of candidates) if (norm(c) > norm(best)) best = c;
  return normalize(best);
}

/**
 * Orthonormal basis of the 2-D null space at a degenerate (double) shear root:
 * [SV-like, SH-like]. SH lies along eSH (horizontal, normal to the incidence plane).
 * The MATLAB code instead nudged C44/C55 by 1e-5 (CC.m), which picks shear polarizations
 * along the crystal axes rather than SV/SH and changes the user's medium.
 */
function degenerateBasis(M: Complex[][], eSH: CVec3): [CVec3, CVec3] {
  const rows = M as CVec3[];
  let r = rows[0];
  for (const row of rows) if (norm(row) > norm(r)) r = row;
  const rr = dot(r, r);
  let sh = eSH;
  if (abs(rr) > 1e-30) {
    const f = div(dot(r, eSH), rr);
    sh = eSH.map((z, i) => sub(z, mul(f, r[i]))) as CVec3;
  }
  sh = normalize(sh);
  const sv = normalize(cross(r, sh));
  return [sv, sh];
}

/**
 * Fix the arbitrary sign/phase of a polarization so results are reproducible:
 * qP along the propagation direction; shear waves along SH = eSH, or along
 * SV = eSH x direction, whichever they are closer to.
 */
function orient(p: CVec3, s: CVec3, mode: Mode, eSH: CVec3): CVec3 {
  const sre = s.map((z) => z.re);
  const len = Math.hypot(...sre) || 1;
  const dir = sre.map((x) => cx(x / len)) as CVec3;
  let ref: CVec3;
  if (mode === 0) {
    ref = dir;
  } else {
    const sv = cross(eSH, dir);
    ref = abs(dot(p, eSH)) >= abs(dot(p, sv)) ? eSH : sv;
  }
  const d = dot(p, ref);
  const m = abs(d);
  if (m < 1e-12) return p;
  const f = scale(conj(d), 1 / m);
  return p.map((z) => mul(z, f)) as CVec3;
}

interface RawWave {
  s3: Complex;
  propagating: boolean;
  slowness: CVec3;
  polarization: CVec3;
}

/**
 * The three waves of one medium that leave the interface (up = reflected, down =
 * transmitted), ordered qP, qS1, qS2 (increasing vertical slowness).
 */
function outgoingWaves(m: Medium, s1: number, s2: number, up: boolean, eSH: CVec3): RawWave[] {
  const roots = verticalSlownesses(m, s1, s2);
  const sign = up ? 1 : -1;
  const scored = roots.map((s3, idx) => {
    if (isEvanescent(s1, s2, s3)) return { s3, score: s3.im / abs(s3) };
    // Real root: up or down is decided by the direction of energy flow, not by the sign of
    // s3 (the two differ for backward waves in strongly anisotropic media).
    const sReal: CVec3 = [cx(s1), cx(s2), cx(s3.re)];
    const M = christoffelMinusI(m, sReal);
    const double = roots.some((r, j) => j !== idx && isDegenerate(r, s3));
    const p = double ? degenerateBasis(M, eSH)[0] : nullVector(M);
    const ref = norm(traction(m, p, sReal)) * norm(p);
    const f = verticalFlux(m, p, sReal);
    const score = ref > 0 && Math.abs(f) > 1e-9 * ref ? f / ref : Math.sign(s3.re) * 1e-3;
    return { s3: cx(s3.re), score };
  });
  scored.sort((a, b) => sign * (b.score - a.score));
  const chosen = scored.slice(0, 3).map((x) => x.s3);
  // qP has the smallest vertical slowness (and is the first to become evanescent).
  chosen.sort((a, b) => mul(a, a).re - mul(b, b).re);

  const waves: RawWave[] = chosen.map((s3) => ({
    s3,
    propagating: !isEvanescent(s1, s2, s3),
    slowness: [cx(s1), cx(s2), s3],
    polarization: [ZERO, ZERO, ZERO],
  }));
  for (let i = 0; i < 3; i++) {
    const j = i + 1;
    if (j < 3 && isDegenerate(waves[i].s3, waves[j].s3)) {
      const avg = scale(add2(waves[i].s3, waves[j].s3), 0.5);
      for (const w of [waves[i], waves[j]]) {
        w.s3 = avg;
        w.slowness = [cx(s1), cx(s2), avg];
      }
      const [a, b] = degenerateBasis(christoffelMinusI(m, waves[i].slowness), eSH);
      waves[i].polarization = a;
      waves[j].polarization = b;
      i++;
      continue;
    }
    waves[i].polarization = nullVector(christoffelMinusI(m, waves[i].slowness));
  }
  waves.forEach((w, i) => {
    const p = w.propagating ? w.polarization : bilinearNormalize(w.polarization);
    w.polarization = orient(p, w.slowness, i as Mode, eSH);
  });
  return waves;
}

/**
 * Evanescent polarizations are complex. Normalise them so that p . p = 1 (no conjugate),
 * the convention of the Zoeppritz equations (e.g. p = (sin i, 0, cos i) with complex
 * cos i); for real vectors this is the ordinary unit length.
 */
function bilinearNormalize(p: CVec3): CVec3 {
  const pp = dot(p, p);
  if (abs(pp) < 1e-8) return p;
  const f = div(cx(1), sqrt(pp));
  return p.map((z) => mul(z, f)) as CVec3;
}

const add2 = (a: Complex, b: Complex) => cx(a.re + b.re, a.im + b.im);

function isDegenerate(a: Complex, b: Complex): boolean {
  return abs(sub(a, b)) <= DEGENERATE_TOL * Math.max(abs(a), abs(b), 1e-12);
}

function anglesOf(s: CVec3, propagating: boolean): { angle: number | null; azimuth: number } {
  const h = Math.hypot(s[0].re, s[1].re);
  let az = Math.atan2(s[1].re, s[0].re) / DEG;
  if (az < 0) az += 360;
  if (!propagating) return { angle: null, azimuth: az };
  return { angle: Math.atan2(h, Math.abs(s[2].re)) / DEG, azimuth: az };
}

/** Incident wave: phase velocity from the Christoffel eigen-problem along n. */
function incidentWave(top: Medium, inc: Incidence, eSH: CVec3): RawWave & { velocity: number } {
  const i = inc.inclination * DEG;
  const a = inc.azimuth * DEG;
  const n = [Math.sin(i) * Math.cos(a), Math.sin(i) * Math.sin(a), -Math.cos(i)];
  const G = [0, 1, 2].map((ii) =>
    [0, 1, 2].map((k) => {
      let g = 0;
      for (let j = 0; j < 3; j++) for (let l = 0; l < 3; l++) g += cijkl(top.C, ii, j, k, l) * n[j] * n[l];
      return g / top.rho;
    }),
  );
  const { values } = eigSym3(G);
  const v = values.map((x) => Math.sqrt(Math.max(x, 0)));
  const velocity = v[inc.mode];
  const slowness = n.map((x) => cx(x / velocity)) as CVec3;
  const M = christoffelMinusI(top, slowness);
  let polarization: CVec3;
  const shearDegenerate = Math.abs(v[1] - v[2]) <= DEGENERATE_TOL * v[1];
  if (inc.mode !== 0 && shearDegenerate) {
    const [sv, sh] = degenerateBasis(M, eSH);
    polarization = inc.mode === 1 ? sv : sh;
  } else {
    polarization = nullVector(M);
  }
  polarization = orient(polarization, slowness, inc.mode, eSH);
  return { s3: slowness[2], propagating: true, slowness, polarization, velocity };
}

export function solve(top: Medium, bottom: Medium, inc: Incidence): Solution {
  const warnings: string[] = [];
  if (!(inc.inclination >= 0 && inc.inclination < 90))
    throw new RangeError('Inclination must satisfy 0 <= inclination < 90 degrees.');

  const az = inc.azimuth * DEG;
  // SH direction: horizontal and normal to the plane of incidence.
  const eSH: CVec3 = [cx(-Math.sin(az)), cx(Math.cos(az)), ZERO];

  const I = incidentWave(top, inc, eSH);
  const s1 = I.slowness[0].re;
  const s2 = I.slowness[1].re;
  const R = outgoingWaves(top, s1, s2, true, eSH);
  const T = outgoingWaves(bottom, s1, s2, false, eSH);

  // Unknowns [R1 R2 R3 T1 T2 T3]:  -sum R u_R + sum T u_T = u_I ; same for traction.
  const tI = traction(top, I.polarization, I.slowness);
  const tR = R.map((w) => traction(top, w.polarization, w.slowness));
  const tT = T.map((w) => traction(bottom, w.polarization, w.slowness));
  const A: Complex[][] = [];
  const b: Complex[] = [];
  for (let j = 0; j < 3; j++) {
    A.push([...R.map((w) => neg(w.polarization[j])), ...T.map((w) => w.polarization[j])]);
    b.push(I.polarization[j]);
  }
  for (let j = 0; j < 3; j++) {
    A.push([...tR.map((t) => neg(t[j])), ...tT.map((t) => t[j])]);
    b.push(tI[j]);
  }
  const x = solveComplex(A, b);
  if (!x) throw new Error('Boundary-condition system is singular for this geometry.');

  let resid = 0;
  for (let r = 0; r < 6; r++) {
    let acc = b[r];
    for (let c = 0; c < 6; c++) acc = sub(acc, mul(A[r][c], x[c]));
    resid = Math.max(resid, abs(acc) / Math.max(abs(b[r]), ...A[r].map(abs), 1e-300));
  }
  if (resid > 1e-6) warnings.push(`Boundary conditions satisfied only to ${resid.toExponential(1)}.`);

  const fluxI = verticalFlux(top, I.polarization, I.slowness);

  const build = (w: RawWave, medium: Medium, kind: Wave['kind'], mode: Mode, coef: Complex): Wave => {
    const propagating = w.propagating;
    const smag = Math.sqrt(w.slowness.reduce((acc, z) => acc + z.re * z.re, 0));
    const { angle, azimuth } = anglesOf(w.slowness, propagating);
    const flux = propagating ? verticalFlux(medium, w.polarization, w.slowness) : 0;
    return {
      kind,
      mode,
      slowness: w.slowness,
      propagating,
      velocity: propagating ? 1 / smag : null,
      angle,
      azimuth,
      polarization: w.polarization,
      coefficient: coef,
      magnitude: abs(coef),
      phase: arg(coef) / DEG,
      energy: kind === 'incident' ? 1 : (abs2(coef) * Math.abs(flux)) / Math.abs(fluxI),
    };
  };

  const incident = build(I, top, 'incident', inc.mode, cx(1));
  incident.velocity = I.velocity;
  const reflected = R.map((w, k) => build(w, top, 'reflected', k as Mode, x[k])) as Solution['reflected'];
  const transmitted = T.map((w, k) =>
    build(w, bottom, 'transmitted', k as Mode, x[k + 3]),
  ) as Solution['transmitted'];

  const energyBalance = [...reflected, ...transmitted].reduce((acc, w) => acc + w.energy, 0);
  const allEvanescentPairs = [...reflected, ...transmitted].filter((w) => !w.propagating).length;
  if (Math.abs(energyBalance - 1) > 1e-4 && allEvanescentPairs < 2)
    warnings.push(`Energy balance is ${energyBalance.toFixed(5)} (expected 1).`);

  return { incident, reflected, transmitted, energyBalance, residual: resid, warnings };
}

/** Grid sweep helper. Failed points are returned as null. */
export function sweep(
  top: Medium,
  bottom: Medium,
  mode: Mode,
  inclinations: number[],
  azimuths: number[],
): (Solution | null)[][] {
  return azimuths.map((azimuth) =>
    inclinations.map((inclination) => {
      try {
        return solve(top, bottom, { mode, inclination, azimuth });
      } catch {
        return null;
      }
    }),
  );
}

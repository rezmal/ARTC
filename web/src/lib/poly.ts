import { abs, add, Complex, cx, div, mul, sub, ZERO } from './complex';

/** Real polynomials are stored with the HIGHEST power first (MATLAB convention). */
export type Poly = number[];

export function polyMul(a: Poly, b: Poly): Poly {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}

function align(a: Poly, n: number): Poly {
  return [...new Array(n - a.length).fill(0), ...a];
}

export function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const A = align(a, n);
  const B = align(b, n);
  return A.map((x, i) => x + B[i]);
}

export function polySub(a: Poly, b: Poly): Poly {
  return polyAdd(a, b.map((x) => -x));
}

export function polyEval(p: Poly, z: Complex): Complex {
  let acc = ZERO;
  for (const c of p) acc = add(mul(acc, z), cx(c));
  return acc;
}

function polyEvalWithDerivative(p: Poly, z: Complex): [Complex, Complex] {
  let f = ZERO;
  let d = ZERO;
  for (const c of p) {
    d = add(mul(d, z), f);
    f = add(mul(f, z), cx(c));
  }
  return [f, d];
}

/**
 * All complex roots of a real polynomial (Aberth–Ehrlich iteration followed by guarded
 * Newton polishing). Leading zero coefficients are stripped first.
 */
export function polyRoots(pIn: Poly): Complex[] {
  const scaleRef = Math.max(...pIn.map(Math.abs));
  let start = 0;
  while (start < pIn.length && Math.abs(pIn[start]) <= 1e-14 * scaleRef) start++;
  const p = pIn.slice(start);
  const n = p.length - 1;
  if (n < 1) return [];
  const monic = p.map((c) => c / p[0]);

  // Initial guesses on a circle of the geometric-mean root radius.
  const radius = Math.max(Math.abs(monic[n]) ** (1 / n), 1e-12);
  const z: Complex[] = Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n + 0.4;
    return cx(radius * Math.cos(t), radius * Math.sin(t));
  });
  const done = new Array(n).fill(false);
  const lastStep = new Array(n).fill(Infinity);

  for (let iter = 0; iter < 200 && done.some((d) => !d); iter++) {
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      const [f, d] = polyEvalWithDerivative(monic, z[i]);
      if (f.re === 0 && f.im === 0) {
        done[i] = true;
        continue;
      }
      const ratio = div(f, d); // Newton correction f/f'
      let sum = cx(0);
      for (let j = 0; j < n; j++) if (j !== i) sum = add(sum, div(cx(1), sub(z[i], z[j])));
      const w = div(ratio, sub(cx(1), mul(ratio, sum)));
      z[i] = sub(z[i], w);
      // Simple roots converge cubically and are finished by the Newton polish below;
      // double roots (isotropic shear waves) converge only linearly, so stop early.
      const rel = abs(w) / Math.max(abs(z[i]), radius * 1e-3);
      if (rel <= 1e-11 || (rel <= 1e-7 && rel > 0.3 * lastStep[i])) done[i] = true;
      lastStep[i] = rel;
    }
  }

  // Newton polishing; only accept steps that reduce the residual.
  return z.map((zi) => {
    let cur = zi;
    for (let k = 0; k < 3; k++) {
      const [fv, dv] = polyEvalWithDerivative(monic, cur);
      if (abs(dv) === 0) break;
      const cand = sub(cur, div(fv, dv));
      if (abs(polyEval(monic, cand)) >= abs(fv)) break;
      cur = cand;
    }
    return cur;
  });
}

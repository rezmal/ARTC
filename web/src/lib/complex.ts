/** Minimal complex arithmetic used by the solver. Values are immutable. */
export interface Complex {
  re: number;
  im: number;
}

export type CVec3 = [Complex, Complex, Complex];
export type CMat = Complex[][];

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const ZERO = cx(0);
export const ONE = cx(1);

export const add = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const neg = (a: Complex): Complex => cx(-a.re, -a.im);
export const conj = (a: Complex): Complex => cx(a.re, -a.im);
export const scale = (a: Complex, k: number): Complex => cx(a.re * k, a.im * k);
export const mul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const arg = (a: Complex): number => Math.atan2(a.im, a.re);

export function div(a: Complex, b: Complex): Complex {
  // Smith's algorithm: avoids overflow/underflow for badly scaled operands.
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return cx((a.re + a.im * r) / d, (a.im - a.re * r) / d);
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return cx((a.re * r + a.im) / d, (a.im * r - a.re) / d);
}

/** Principal square root. */
export function sqrt(a: Complex): Complex {
  const m = abs(a);
  if (m === 0) return ZERO;
  const re = Math.sqrt((m + a.re) / 2);
  const im = Math.sqrt((m - a.re) / 2);
  return cx(re, a.im < 0 ? -im : im);
}

/** Bilinear dot product (no conjugation): sum a_i b_i. */
export function dot(a: Complex[], b: Complex[]): Complex {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.length; i++) {
    re += a[i].re * b[i].re - a[i].im * b[i].im;
    im += a[i].re * b[i].im + a[i].im * b[i].re;
  }
  return cx(re, im);
}

/** Bilinear cross product (no conjugation). */
export function cross(a: CVec3, b: CVec3): CVec3 {
  return [
    sub(mul(a[1], b[2]), mul(a[2], b[1])),
    sub(mul(a[2], b[0]), mul(a[0], b[2])),
    sub(mul(a[0], b[1]), mul(a[1], b[0])),
  ];
}

/** Hermitian (Euclidean) norm. */
export const norm = (a: Complex[]): number => Math.sqrt(a.reduce((s, z) => s + abs2(z), 0));

export function normalize(a: CVec3): CVec3 {
  const n = norm(a);
  return n === 0 ? a : (a.map((z) => scale(z, 1 / n)) as CVec3);
}

export const realVec = (v: number[]): Complex[] => v.map((x) => cx(x));

import { describe, expect, it } from 'vitest';
import { solve, slownessSextic, verticalSlownesses } from './artc';
import { abs, add, Complex, cx, div, mul, sqrt, sub } from './complex';
import { isotropicFromVelocities, Medium, rotateStiffness, vtiFromThomsen } from './elastic';
import { polyEval } from './poly';

const iso = (vp: number, vs: number, rho: number): Medium => ({
  C: isotropicFromVelocities(vp, vs, rho),
  rho,
});

/** Exact isotropic P-incidence coefficients, Aki & Richards (2002) eq. 5.40. */
function zoeppritzP(top: [number, number, number], bot: [number, number, number], incDeg: number) {
  const [a1, b1, r1] = top;
  const [a2, b2, r2] = bot;
  const p = Math.sin((incDeg * Math.PI) / 180) / a1;
  const c = (v: number): Complex => {
    // vertical slowness, evanescent branch chosen to decay away from the interface
    const q = 1 / (v * v) - p * p;
    return q >= 0 ? cx(Math.sqrt(q)) : cx(0, Math.sqrt(-q));
  };
  const ci1 = c(a1), cj1 = c(b1), ci2 = c(a2), cj2 = c(b2);
  const k = (x: number) => cx(x);
  const a = r2 * (1 - 2 * b2 * b2 * p * p) - r1 * (1 - 2 * b1 * b1 * p * p);
  const b = r2 * (1 - 2 * b2 * b2 * p * p) + 2 * r1 * b1 * b1 * p * p;
  const cc = r1 * (1 - 2 * b1 * b1 * p * p) + 2 * r2 * b2 * b2 * p * p;
  const d = 2 * (r2 * b2 * b2 - r1 * b1 * b1);
  const E = add(mul(k(b), ci1), mul(k(cc), ci2));
  const F = add(mul(k(b), cj1), mul(k(cc), cj2));
  const G = sub(k(a), mul(k(d), mul(ci1, cj2)));
  const H = sub(k(a), mul(k(d), mul(ci2, cj1)));
  const D = add(mul(E, F), mul(mul(G, H), k(p * p)));
  const Rpp = div(
    sub(mul(sub(mul(k(b), ci1), mul(k(cc), ci2)), F), mul(mul(add(k(a), mul(k(d), mul(ci1, cj2))), H), k(p * p))),
    D,
  );
  const Rps = div(
    mul(k(-2 * p * a1 / b1), mul(ci1, add(k(a * b), mul(k(cc * d), mul(ci2, cj2))))),
    D,
  );
  const Tpp = div(mul(k((2 * r1 * a1) / a2), mul(ci1, F)), D);
  const Tps = div(mul(k((2 * r1 * p * a1) / b2), mul(ci1, H)), D);
  return { Rpp, Rps, Tpp, Tps };
}

describe('isotropic interface against exact Zoeppritz', () => {
  const T: [number, number, number] = [2, 1, 2];
  const B: [number, number, number] = [3, 1.5, 2.4];
  const top = iso(...T);
  const bot = iso(...B);

  it('normal-incidence P matches (Z2 - Z1)/(Z2 + Z1) including sign', () => {
    const sol = solve(top, bot, { mode: 0, inclination: 0, azimuth: 0 });
    const z1 = 2 * 2;
    const z2 = 3 * 2.4;
    expect(sol.reflected[0].coefficient.re).toBeCloseTo((z2 - z1) / (z2 + z1), 10);
    expect(sol.transmitted[0].coefficient.re).toBeCloseTo((2 * z1) / (z1 + z2), 10);
    expect(sol.reflected[1].magnitude).toBeLessThan(1e-10);
  });

  for (const azimuth of [0, 37, 120]) {
    it(`P-wave magnitudes, pre- and post-critical, azimuth ${azimuth}`, () => {
      for (let inc = 1; inc < 89; inc += 4) {
        const sol = solve(top, bot, { mode: 0, inclination: inc, azimuth });
        const z = zoeppritzP(T, B, inc);
        expect(sol.reflected[0].magnitude).toBeCloseTo(abs(z.Rpp), 8);
        expect(sol.reflected[1].magnitude).toBeCloseTo(abs(z.Rps), 8); // qS1 = SV when degenerate
        expect(sol.transmitted[0].magnitude).toBeCloseTo(abs(z.Tpp), 8);
        expect(sol.transmitted[1].magnitude).toBeCloseTo(abs(z.Tps), 8);
        expect(sol.reflected[2].magnitude).toBeLessThan(1e-8); // no SH from P in isotropic media
        expect(sol.energyBalance).toBeCloseTo(1, 8);
      }
    });
  }

  it('SH incidence matches the analytic SH coefficient', () => {
    for (let inc = 0; inc < 80; inc += 7) {
      const sol = solve(top, bot, { mode: 2, inclination: inc, azimuth: 30 });
      const p = Math.sin((inc * Math.PI) / 180) / 1;
      const q1 = cx(Math.sqrt(1 - p * p));
      const q2 = sqrt(cx(1 / 1.5 ** 2 - p * p));
      const m1 = mul(cx(2 * 1 * 1), q1);
      const m2 = mul(cx(2.4 * 1.5 * 1.5), q2);
      const r = div(sub(m1, m2), add(m1, m2));
      expect(sol.reflected[2].magnitude).toBeCloseTo(abs(r), 8);
      expect(sol.reflected[0].magnitude).toBeLessThan(1e-8);
      expect(sol.energyBalance).toBeCloseTo(1, 8);
    }
  });

  it('identical media transmit everything', () => {
    for (const mode of [0, 1, 2] as const) {
      const sol = solve(top, top, { mode, inclination: 33, azimuth: 71 });
      expect(sol.transmitted[mode].magnitude).toBeCloseTo(1, 9);
      for (const w of sol.reflected) expect(w.magnitude).toBeLessThan(1e-8);
    }
  });
});

describe('anisotropic media', () => {
  const shale = { C: vtiFromThomsen(3.0, 1.5, 0.25, 0.1, 0.2, 2.4), rho: 2.4 };
  const sand = iso(3.5, 2.0, 2.2);

  it('VTI conserves energy for every incident mode', () => {
    for (const mode of [0, 1, 2] as const)
      for (let inc = 0; inc < 85; inc += 5)
        expect(solve(shale, sand, { mode, inclination: inc, azimuth: 20 }).energyBalance).toBeCloseTo(1, 7);
  });

  it('tilted TI needs the odd powers of the sextic', () => {
    const tti = { C: rotateStiffness(shale.C, 40, 25), rho: 2.4 };
    const P = slownessSextic(tti, 0.15, 0.05);
    expect(Math.max(...P.filter((_, i) => i % 2 === 1).map(Math.abs))).toBeGreaterThan(1e-3);
    for (const r of verticalSlownesses(tti, 0.15, 0.05)) expect(abs(polyEval(P, r))).toBeLessThan(1e-9);
    // The original MATLAB code dropped the odd powers; those "roots" are not roots:
    const evenOnly = P.map((c, i) => (i % 2 === 1 ? 0 : c));
    const wrong = verticalSlownesses({ C: shale.C, rho: 2.4 }, 0.15, 0.05);
    expect(evenOnly.length).toBe(7);
    expect(Math.max(...wrong.map((r) => abs(polyEval(P, r))))).toBeGreaterThan(1e-3);
  });

  it('tilted TI and general triclinic media conserve energy', () => {
    const tti = { C: rotateStiffness(shale.C, 40, 25), rho: 2.4 };
    const tri = { C: rotateStiffness(vtiFromThomsen(4, 2.2, 0.15, -0.05, 0.1, 2.6), 63, 140), rho: 2.6 };
    for (const [a, b] of [[tti, sand], [sand, tti], [tti, tri]] as const)
      for (const mode of [0, 1, 2] as const)
        for (let inc = 0; inc < 80; inc += 6)
          for (const azimuth of [0, 90, 200]) {
            const sol = solve(a, b, { mode, inclination: inc, azimuth });
            const evanescent = [...sol.reflected, ...sol.transmitted].filter((w) => !w.propagating).length;
            if (evanescent < 2) expect(sol.energyBalance).toBeCloseTo(1, 6);
            expect(sol.residual).toBeLessThan(1e-9);
          }
  });

  it('rotation is exact: VTI tilted 90 degrees puts C33 on C11', () => {
    const r = rotateStiffness(shale.C, 90, 0);
    expect(r[0][0]).toBeCloseTo(shale.C[2][2], 10);
    expect(r[2][2]).toBeCloseTo(shale.C[0][0], 10);
    const back = rotateStiffness(rotateStiffness(shale.C, 35, 0), -35, 0);
    back.flat().forEach((x, i) => expect(x).toBeCloseTo(shale.C.flat()[i], 10));
  });
});

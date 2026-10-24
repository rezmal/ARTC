import { describe, expect, it } from 'vitest';
import { solve } from './artc';
import { formFromMedium, fromModelFile, parseLayer, parseNumber, toModelFile } from './model';
import { PRESETS } from './presets';

describe('input handling', () => {
  it('parses plain numbers only (no code evaluation like str2num)', () => {
    expect(parseNumber(' 4.41 ')).toBe(4.41);
    expect(parseNumber('-1e-3')).toBe(-0.001);
    expect(parseNumber('2*3')).toBeNaN();
    expect(parseNumber('exit')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });

  it('flags non-positive-definite stiffness', () => {
    const f = formFromMedium('x', PRESETS[0].top.medium);
    f.cells[0][1] = f.cells[1][0] = '9';
    const p = parseLayer(f);
    expect(p.medium).toBeNull();
    expect(p.issues[0].message).toMatch(/positive definite/);
  });

  it('round-trips a model file', () => {
    const p = PRESETS[2];
    const top = formFromMedium(p.top.name, p.top.medium);
    const bot = formFromMedium(p.bottom.name, p.bottom.medium);
    const file = toModelFile(top, bot, { mode: 1, inclination: 20, azimuth: 45 })!;
    const back = fromModelFile(JSON.parse(JSON.stringify(file)));
    expect(back.incidence).toEqual({ mode: 1, inclination: 20, azimuth: 45 });
    expect(parseLayer(back.top).medium!.C[0][0]).toBeCloseTo(p.top.medium.C[0][0], 4); // 7 significant digits
    expect(() => fromModelFile({ hello: 1 })).toThrow();
  });
});

describe('presets', () => {
  for (const p of PRESETS)
    it(`${p.label} is valid and conserves energy`, () => {
      expect(parseLayer(formFromMedium('a', p.top.medium)).medium).not.toBeNull();
      expect(parseLayer(formFromMedium('b', p.bottom.medium)).medium).not.toBeNull();
      for (const mode of [0, 1, 2] as const)
        for (const inclination of [0, 10, 25, 40])
          for (const azimuth of [0, 45, 90]) {
            const s = solve(p.top.medium, p.bottom.medium, { mode, inclination, azimuth });
            const evanescent = [...s.reflected, ...s.transmitted].filter((w) => !w.propagating).length;
            if (evanescent < 2) expect(s.energyBalance).toBeCloseTo(1, 6);
          }
    });
});

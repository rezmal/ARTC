/// <reference lib="webworker" />
import { Mode, solve } from './lib/artc';
import { Medium } from './lib/elastic';
import { Quantity, waveValue } from './lib/quantities';

export interface MapJob {
  id: number;
  top: Medium;
  bottom: Medium;
  mode: Mode;
  inclinations: number[];
  azimuths: number[];
  quantities: Quantity[];
}

/**
 * values[q][w][a * nInc + i] for quantity q, wave w (0-2 reflected, 3-5 transmitted),
 * azimuth a and inclination i; NaN where undefined.
 */
export interface MapResult {
  id: number;
  values: Float64Array[][];
  energyBalance: Float64Array;
  failures: number;
}

export type WorkerMessage = { type: 'progress'; id: number; done: number; total: number } | ({ type: 'done' } & MapResult);

self.onmessage = (ev: MessageEvent<MapJob>) => {
  const { id, top, bottom, mode, inclinations, azimuths, quantities } = ev.data;
  const nInc = inclinations.length;
  const total = nInc * azimuths.length;
  const values = quantities.map(() => Array.from({ length: 6 }, () => new Float64Array(total).fill(NaN)));
  const energyBalance = new Float64Array(total).fill(NaN);
  let failures = 0;
  azimuths.forEach((azimuth, a) => {
    inclinations.forEach((inclination, i) => {
      const idx = a * nInc + i;
      try {
        const s = solve(top, bottom, { mode, inclination, azimuth });
        const waves = [...s.reflected, ...s.transmitted];
        quantities.forEach((q, qi) =>
          waves.forEach((w, wi) => {
            const v = waveValue(w, q);
            values[qi][wi][idx] = v === null ? NaN : v;
          }),
        );
        energyBalance[idx] = s.energyBalance;
      } catch {
        failures++;
      }
    });
    (self as unknown as Worker).postMessage({ type: 'progress', id, done: (a + 1) * nInc, total } satisfies WorkerMessage);
  });
  (self as unknown as Worker).postMessage({ type: 'done', id, values, energyBalance, failures } satisfies WorkerMessage);
};

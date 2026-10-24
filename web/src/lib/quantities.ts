import { Mode, Solution, Wave } from './artc';

export type Quantity = 'magnitude' | 'real' | 'phase' | 'energy' | 'angle' | 'velocity';

export const QUANTITIES: { id: Quantity; label: string; unit: string; signed: boolean }[] = [
  { id: 'magnitude', label: 'Amplitude |A|', unit: '', signed: false },
  { id: 'real', label: 'Real part Re(A)', unit: '', signed: true },
  { id: 'phase', label: 'Phase', unit: '°', signed: true },
  { id: 'energy', label: 'Energy fraction', unit: '', signed: false },
  { id: 'angle', label: 'Angle from vertical', unit: '°', signed: false },
  { id: 'velocity', label: 'Phase velocity', unit: 'km/s', signed: false },
];

export const quantityInfo = (q: Quantity) => QUANTITIES.find((x) => x.id === q)!;

export function waveValue(w: Wave, q: Quantity): number | null {
  switch (q) {
    case 'magnitude':
      return w.magnitude;
    case 'real':
      return w.coefficient.re;
    case 'phase':
      // The phase of a vanishing coefficient is meaningless.
      return w.magnitude < 1e-9 ? null : w.phase;
    case 'energy':
      return w.energy;
    case 'angle':
      return w.angle;
    case 'velocity':
      return w.velocity;
  }
}

export type WaveRef = { side: 'reflected' | 'transmitted'; mode: Mode };

export const pickWave = (s: Solution, r: WaveRef): Wave => s[r.side][r.mode];

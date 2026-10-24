import { MODE_NAMES, Solution, Wave } from '../lib/artc';
import { Complex } from '../lib/complex';

const f = (x: number | null, d = 4) => (x === null || !Number.isFinite(x) ? '—' : x.toFixed(d));
const fc = (z: Complex, d = 4) => {
  if (Math.abs(z.im) < 5 * 10 ** -(d + 1)) return f(z.re, d);
  return `${f(z.re, d)} ${z.im < 0 ? '−' : '+'} ${Math.abs(z.im).toFixed(d)}i`;
};
const fvec = (v: Complex[]) => `(${v.map((z) => fc(z, 3)).join(', ')})`;

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

function WaveRow({ w }: { w: Wave }) {
  return (
    <tr>
      <td>
        <span className="swatch" style={{ background: SERIES[w.mode] }} aria-hidden />
        {MODE_NAMES[w.mode]}
        {!w.propagating && <span className="muted small"> (evanescent)</span>}
      </td>
      <td>{f(w.velocity, 4)}</td>
      <td>{f(w.angle, 2)}</td>
      <td>{fc(w.slowness[2], 5)}</td>
      <td>{fc(w.coefficient, 5)}</td>
      <td>{f(w.magnitude, 5)}</td>
      <td>{w.magnitude < 1e-9 ? '—' : f(w.phase, 2)}</td>
      <td>{f(w.energy, 5)}</td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{fvec(w.polarization)}</td>
    </tr>
  );
}

export function ResultsTable({ sol }: { sol: Solution }) {
  const I = sol.incident;
  const balanced = Math.abs(sol.energyBalance - 1) < 1e-6;
  const reflectedE = sol.reflected.reduce((s, w) => s + w.energy, 0);
  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Incident {MODE_NAMES[I.mode]} velocity</div>
          <div className="value">{f(I.velocity, 4)} km/s</div>
        </div>
        <div className="stat">
          <div className="label">Horizontal slowness (s₁, s₂)</div>
          <div className="value">
            {f(I.slowness[0].re, 4)}, {f(I.slowness[1].re, 4)} s/km
          </div>
        </div>
        <div className="stat">
          <div className="label">Energy reflected / transmitted</div>
          <div className="value">
            {f(reflectedE, 3)} / {f(sol.energyBalance - reflectedE, 3)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Energy balance</div>
          <div className={`value ${balanced ? 'ok' : ''}`}>
            {f(sol.energyBalance, 6)} {balanced ? '✓' : ''}
          </div>
        </div>
      </div>
      {sol.warnings.map((w) => (
        <div className="notice warning" key={w}>
          {w}
        </div>
      ))}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Wave</th>
              <th>Velocity (km/s)</th>
              <th>Angle (°)</th>
              <th>s₃ (s/km)</th>
              <th>Coefficient A</th>
              <th>|A|</th>
              <th>Phase (°)</th>
              <th>Energy</th>
              <th>Polarization</th>
            </tr>
          </thead>
          <tbody>
            <tr className="group">
              <td colSpan={9}>Incident (upper medium, downgoing)</td>
            </tr>
            <WaveRow w={I} />
            <tr className="group">
              <td colSpan={9}>Reflected (upper medium, upgoing)</td>
            </tr>
            {sol.reflected.map((w) => (
              <WaveRow key={`r${w.mode}`} w={w} />
            ))}
            <tr className="group">
              <td colSpan={9}>Transmitted (lower medium, downgoing)</td>
            </tr>
            {sol.transmitted.map((w) => (
              <WaveRow key={`t${w.mode}`} w={w} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        A is the displacement-amplitude ratio to the incident wave; energy is the share of the incident
        vertical energy flux. qS1 is the faster quasi-shear wave; when both shear waves have the same
        speed (isotropic media), qS1 is SV and qS2 is SH. Polarization signs: qP along propagation,
        SH along (−sin φ, cos φ, 0), SV along SH × propagation direction.
      </p>
    </>
  );
}

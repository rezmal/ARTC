import { useState } from 'react';
import {
  describeSymmetry,
  isotropicFromVelocities,
  rotateStiffness,
  vtiFromThomsen,
} from '../lib/elastic';
import { formFromMedium, LayerForm, parseLayer, parseNumber } from '../lib/model';

interface Props {
  title: string;
  form: LayerForm;
  onChange: (f: LayerForm) => void;
}

type BuilderKind = 'iso' | 'vti' | 'rotate';

export function LayerEditor({ title, form, onChange }: Props) {
  const parsed = parseLayer(form);
  const [builder, setBuilder] = useState<BuilderKind>('iso');
  const [iso, setIso] = useState({ vp: '3', vs: '1.6', rho: form.rho });
  const [vti, setVti] = useState({ vp0: '3', vs0: '1.5', eps: '0.2', delta: '0.1', gamma: '0.1', rho: form.rho });
  const [rot, setRot] = useState({ tilt: '30', azimuth: '0' });
  const [builderError, setBuilderError] = useState<string | null>(null);

  const setCell = (i: number, j: number, v: string) => {
    const cells = form.cells.map((r) => [...r]);
    cells[i][j] = v;
    cells[j][i] = v;
    onChange({ ...form, cells });
  };

  const nums = (o: Record<string, string>) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = parseNumber(v);
      if (!Number.isFinite(out[k])) throw new Error(`"${v}" is not a number.`);
    }
    return out;
  };

  const applyBuilder = () => {
    try {
      setBuilderError(null);
      if (builder === 'iso') {
        const { vp, vs, rho } = nums(iso);
        if (!(vp > 0 && vs >= 0 && rho > 0)) throw new Error('Vp and density must be positive.');
        if (vs > vp / Math.SQRT2) throw new Error('Vs must not exceed Vp / sqrt(2) (negative Lamé lambda).');
        onChange(formFromMedium(form.name, { C: isotropicFromVelocities(vp, vs, rho), rho }));
      } else if (builder === 'vti') {
        const { vp0, vs0, eps, delta, gamma, rho } = nums(vti);
        if (!(vp0 > vs0 && vs0 > 0 && rho > 0)) throw new Error('Need Vp0 > Vs0 > 0 and density > 0.');
        onChange(formFromMedium(form.name, { C: vtiFromThomsen(vp0, vs0, eps, delta, gamma, rho), rho }));
      } else {
        if (!parsed.medium) throw new Error('Fix the stiffness matrix before rotating it.');
        const { tilt, azimuth } = nums(rot);
        onChange(
          formFromMedium(form.name, {
            C: rotateStiffness(parsed.medium.C, tilt, azimuth),
            rho: parsed.medium.rho,
          }),
        );
      }
    } catch (e) {
      setBuilderError((e as Error).message);
    }
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    title?: string,
  ) => (
    <label className="field" title={title}>
      {label}
      <input type="text" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <section className="card" aria-label={title}>
      <h2>
        <span className="muted small" style={{ fontWeight: 500 }}>
          {title}
        </span>
        <span className="muted small" style={{ fontWeight: 400 }}>
          {parsed.medium ? describeSymmetry(parsed.medium.C) : ''}
        </span>
      </h2>
      <input
        className="name"
        type="text"
        aria-label={`${title} name`}
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />

      <h3>Stiffness C<sub>ij</sub> (GPa)</h3>
      <div className="cij-grid" role="group" aria-label={`${title} stiffness matrix`}>
        <span />
        {[1, 2, 3, 4, 5, 6].map((j) => (
          <span className="hdr" key={j}>
            {j}
          </span>
        ))}
        {form.cells.map((row, i) => (
          <Row key={i} i={i} row={row} bad={parsed.badCells} onCell={setCell} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label className="field" style={{ width: 120 }}>
          Density ρ (g/cm³)
          <input
            type="text"
            inputMode="decimal"
            className={parsed.badCells.has('rho') ? 'bad' : ''}
            value={form.rho}
            onChange={(e) => onChange({ ...form, rho: e.target.value })}
          />
        </label>
        <span className="muted small" style={{ paddingBottom: 6 }}>
          Lower triangle mirrors the upper one.
        </span>
      </div>
      {parsed.issues.map((iss) => (
        <div key={iss.message} className={`notice ${iss.level}`} role="alert">
          {iss.message}
        </div>
      ))}

      <details className="builder">
        <summary>Fill from parameters…</summary>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="segmented" role="group" aria-label="Builder type">
            {(
              [
                ['iso', 'Isotropic'],
                ['vti', 'VTI (Thomsen)'],
                ['rotate', 'Rotate current'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} aria-pressed={builder === k} onClick={() => setBuilder(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="builder-grid">
          {builder === 'iso' && (
            <>
              {field('Vp (km/s)', iso.vp, (v) => setIso({ ...iso, vp: v }))}
              {field('Vs (km/s)', iso.vs, (v) => setIso({ ...iso, vs: v }))}
              {field('ρ (g/cm³)', iso.rho, (v) => setIso({ ...iso, rho: v }))}
            </>
          )}
          {builder === 'vti' && (
            <>
              {field('Vp0 (km/s)', vti.vp0, (v) => setVti({ ...vti, vp0: v }), 'Vertical P velocity')}
              {field('Vs0 (km/s)', vti.vs0, (v) => setVti({ ...vti, vs0: v }), 'Vertical S velocity')}
              {field('ε', vti.eps, (v) => setVti({ ...vti, eps: v }))}
              {field('δ', vti.delta, (v) => setVti({ ...vti, delta: v }))}
              {field('γ', vti.gamma, (v) => setVti({ ...vti, gamma: v }))}
              {field('ρ (g/cm³)', vti.rho, (v) => setVti({ ...vti, rho: v }))}
            </>
          )}
          {builder === 'rotate' && (
            <>
              {field('Tilt (°)', rot.tilt, (v) => setRot({ ...rot, tilt: v }), 'Tilt the x3 axis towards x1')}
              {field('Azimuth (°)', rot.azimuth, (v) => setRot({ ...rot, azimuth: v }), 'Then rotate about vertical x3')}
            </>
          )}
        </div>
        <div className="row">
          <button className="primary" onClick={applyBuilder}>
            {builder === 'rotate' ? 'Rotate matrix' : 'Replace matrix'}
          </button>
          {builder === 'rotate' && (
            <span className="muted small">Tilt about x2, then rotate about x3.</span>
          )}
        </div>
        {builderError && <div className="notice error">{builderError}</div>}
      </details>
    </section>
  );
}

function Row({
  i,
  row,
  bad,
  onCell,
}: {
  i: number;
  row: string[];
  bad: Set<string>;
  onCell: (i: number, j: number, v: string) => void;
}) {
  return (
    <>
      <span className="hdr">{i + 1}</span>
      {row.map((v, j) =>
        j < i ? (
          <input key={j} type="text" readOnly tabIndex={-1} value={v} aria-label={`C${i + 1}${j + 1} (mirrored)`} />
        ) : (
          <input
            key={j}
            type="text"
            inputMode="decimal"
            value={v}
            className={bad.has(`${i},${j}`) ? 'bad' : ''}
            aria-label={`C${i + 1}${j + 1}`}
            onChange={(e) => onCell(i, j, e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        ),
      )}
    </>
  );
}

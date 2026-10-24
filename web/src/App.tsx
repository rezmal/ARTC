import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { LayerEditor } from './components/LayerEditor';
import { LineChart } from './components/LineChart';
import { PolarMap } from './components/PolarMap';
import { ResultsTable } from './components/ResultsTable';
import { Mode, MODE_NAMES, Solution, solve } from './lib/artc';
import { Medium } from './lib/elastic';
import { formFromMedium, fromModelFile, LayerForm, parseLayer, parseNumber, toModelFile } from './lib/model';
import { PRESETS } from './lib/presets';
import { Quantity, QUANTITIES, quantityInfo, waveValue } from './lib/quantities';
import SweepWorker from './sweep.worker?worker&inline';
import type { MapResult, WorkerMessage } from './sweep.worker';

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const MODE_HELP = [
  'quasi-P',
  'fast quasi-shear (SV when shear speeds coincide)',
  'slow quasi-shear (SH when shear speeds coincide)',
];

type Tab = 'single' | 'sweep' | 'map';
type Theme = 'auto' | 'light' | 'dark';

const fmtFor = (q: Quantity) => (v: number) =>
  q === 'phase' || q === 'angle' ? v.toFixed(1) : q === 'velocity' ? v.toFixed(3) : v.toFixed(4);

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const range = (lo: number, hi: number, step: number) => {
  const out: number[] = [];
  for (let k = 0; lo + k * step <= hi + 1e-9; k++) out.push(Number((lo + k * step).toFixed(6)));
  return out;
};

export default function App() {
  const initial = PRESETS[1];
  const [top, setTop] = useState<LayerForm>(formFromMedium(initial.top.name, initial.top.medium));
  const [bottom, setBottom] = useState<LayerForm>(formFromMedium(initial.bottom.name, initial.bottom.medium));
  const [mode, setMode] = useState<Mode>(0);
  const [incText, setIncText] = useState('30');
  const [aziText, setAziText] = useState('0');
  const [tab, setTab] = useState<Tab>('single');
  const [theme, setTheme] = useState<Theme>('auto');
  const [presetId, setPresetId] = useState(initial.id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const topParsed = useMemo(() => parseLayer(top), [top]);
  const botParsed = useMemo(() => parseLayer(bottom), [bottom]);
  const inc = parseNumber(incText);
  const azi = parseNumber(aziText);
  const incOk = Number.isFinite(inc) && inc >= 0 && inc < 90;
  const aziOk = Number.isFinite(azi);
  const ready = !!topParsed.medium && !!botParsed.medium && incOk && aziOk;

  const single = useMemo<{ sol?: Solution; error?: string }>(() => {
    if (!ready) return {};
    try {
      return { sol: solve(topParsed.medium!, botParsed.medium!, { mode, inclination: inc, azimuth: azi }) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [ready, topParsed, botParsed, mode, inc, azi]);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setTop(formFromMedium(p.top.name, p.top.medium));
    setBottom(formFromMedium(p.bottom.name, p.bottom.medium));
  };

  const saveModel = () => {
    const m = toModelFile(top, bottom, { mode, inclination: incOk ? inc : 0, azimuth: aziOk ? azi : 0 });
    if (m) download('artc-model.json', JSON.stringify(m, null, 2), 'application/json');
  };

  const loadModel = async (file: File) => {
    try {
      const m = fromModelFile(JSON.parse(await file.text()));
      setTop(m.top);
      setBottom(m.bottom);
      setMode(m.incidence.mode);
      setIncText(String(m.incidence.inclination));
      setAziText(String(m.incidence.azimuth));
      setPresetId('');
      setLoadError(null);
    } catch (e) {
      setLoadError(`Could not load model: ${(e as Error).message}`);
    }
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>ARTc — Anisotropic Reflectivity &amp; Transmissivity Calculator</h1>
          <p>Plane-wave reflection and transmission coefficients at a welded interface between two anisotropic half-spaces.</p>
        </div>
        <div className="toolbar">
          <label className="field">
            Example model
            <select value={presetId} onChange={(e) => applyPreset(e.target.value)}>
              {presetId === '' && <option value="">Custom</option>}
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id} title={p.description}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setTop({ ...bottom });
              setBottom({ ...top });
            }}
            title="Swap upper and lower media"
          >
            ⇅ Swap media
          </button>
          <button onClick={saveModel} disabled={!topParsed.medium || !botParsed.medium}>
            Save model
          </button>
          <button onClick={() => fileRef.current?.click()}>Load model</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadModel(f);
              e.target.value = '';
            }}
          />
          <label className="field">
            Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </header>
      {loadError && <div className="notice error">{loadError}</div>}

      <div className="layout">
        <div>
          <section className="card" aria-label="Incident wave">
            <h2>Incident wave</h2>
            <div className="row">
              <div className="segmented" role="group" aria-label="Incident wave type">
                {MODE_NAMES.map((n, k) => (
                  <button key={n} aria-pressed={mode === k} onClick={() => setMode(k as Mode)} title={MODE_HELP[k]}>
                    {n}
                  </button>
                ))}
              </div>
              <label className="field" style={{ width: 110 }}>
                Inclination (°)
                <input
                  type="text"
                  inputMode="decimal"
                  className={incOk ? '' : 'bad'}
                  value={incText}
                  onChange={(e) => setIncText(e.target.value)}
                />
              </label>
              <label className="field" style={{ width: 110 }}>
                Azimuth (°)
                <input
                  type="text"
                  inputMode="decimal"
                  className={aziOk ? '' : 'bad'}
                  value={aziText}
                  onChange={(e) => setAziText(e.target.value)}
                />
              </label>
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {MODE_NAMES[mode]}: {MODE_HELP[mode]}. Inclination is measured from the vertical (0 ≤ θ &lt; 90);
              azimuth from x₁ towards x₂. x₃ points up; the incident wave travels down through the upper medium.
            </p>
            {!incOk && <div className="notice error">Inclination must be a number from 0 up to (not including) 90.</div>}
          </section>
          <LayerEditor title="Upper medium (incidence side)" form={top} onChange={(f) => { setTop(f); setPresetId(''); }} />
          <LayerEditor title="Lower medium" form={bottom} onChange={(f) => { setBottom(f); setPresetId(''); }} />
        </div>

        <div>
          <section className="card">
            <div className="tabs" role="tablist">
              {(
                [
                  ['single', 'Single angle'],
                  ['sweep', 'Angle sweep'],
                  ['map', 'Azimuth–inclination map'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            {!ready && (
              <div className="notice error">Fix the highlighted inputs to see results.</div>
            )}
            {ready && tab === 'single' && (
              <>
                {single.error && <div className="notice error">{single.error}</div>}
                {single.sol && <ResultsTable sol={single.sol} />}
              </>
            )}
            {ready && tab === 'sweep' && (
              <SweepPanel top={topParsed.medium!} bottom={botParsed.medium!} mode={mode} azimuth={azi} marker={inc} />
            )}
            {ready && tab === 'map' && <MapPanel top={topParsed.medium!} bottom={botParsed.medium!} mode={mode} />}
          </section>
          <footer>
            Malehmir, R., Schmitt, D.R., 2016. ARTc: Anisotropic reflectivity and transmissivity calculator.
            Computers &amp; Geosciences 93, 114–126.{' '}
            <a href="https://doi.org/10.1016/j.cageo.2016.05.008" target="_blank" rel="noreferrer">
              doi:10.1016/j.cageo.2016.05.008
            </a>
            . Units: GPa, g/cm³, km/s, s/km. Everything runs locally in your browser.
          </footer>
        </div>
      </div>
    </div>
  );
}

function QuantitySelect({ value, onChange, exclude = [] }: { value: Quantity; onChange: (q: Quantity) => void; exclude?: Quantity[] }) {
  return (
    <label className="field">
      Quantity
      <select value={value} onChange={(e) => onChange(e.target.value as Quantity)}>
        {QUANTITIES.filter((q) => !exclude.includes(q.id)).map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
            {q.unit ? ` (${q.unit})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function SweepPanel({ top, bottom, mode, azimuth, marker }: { top: Medium; bottom: Medium; mode: Mode; azimuth: number; marker: number }) {
  const [q, setQ] = useState<Quantity>('magnitude');
  const [incMax, setIncMax] = useState(89);
  const [step, setStep] = useState(0.5);
  const inputs = useDeferredValue({ top, bottom, mode, azimuth, incMax, step });

  const data = useMemo(() => {
    const x = range(0, inputs.incMax, inputs.step);
    const sols = x.map((inclination) => {
      try {
        return solve(inputs.top, inputs.bottom, { mode: inputs.mode, inclination, azimuth: inputs.azimuth });
      } catch {
        return null;
      }
    });
    return { x, sols };
  }, [inputs]);

  const series = (side: 'reflected' | 'transmitted') =>
    [0, 1, 2].map((k) => ({
      name: MODE_NAMES[k],
      color: SERIES[k],
      values: data.sols.map((s) => (s ? waveValue(s[side][k], q) : null)),
    }));

  const info = quantityInfo(q);
  const yLabel = `${info.label}${info.unit ? ` (${info.unit})` : ''}`;

  const exportCsv = () => {
    const cols = ['magnitude', 'real', 'phase', 'energy', 'angle', 'velocity'] as Quantity[];
    const head = ['inclination_deg'];
    for (const side of ['R', 'T'])
      for (const m of MODE_NAMES) for (const c of cols) head.push(`${side}_${m}_${c}`);
    head.push('energy_balance');
    const rows = data.x.map((xi, i) => {
      const s = data.sols[i];
      if (!s) return [xi, ...new Array(head.length - 1).fill('')].join(',');
      const vals: (number | string)[] = [xi];
      for (const side of ['reflected', 'transmitted'] as const)
        for (const w of s[side]) for (const c of cols) vals.push(waveValue(w, c) ?? '');
      vals.push(s.energyBalance);
      return vals.join(',');
    });
    download(`artc-sweep-${MODE_NAMES[mode]}-azi${azimuth}.csv`, [head.join(','), ...rows].join('\n'), 'text/csv');
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <QuantitySelect value={q} onChange={setQ} />
        <label className="field" style={{ width: 120 }}>
          Max inclination (°)
          <select value={incMax} onChange={(e) => setIncMax(Number(e.target.value))}>
            {[45, 60, 80, 89].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ width: 100 }}>
          Step (°)
          <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
            {[0.1, 0.25, 0.5, 1, 2].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button onClick={exportCsv}>Download CSV</button>
      </div>
      <p className="muted small" style={{ marginTop: -4 }}>
        Incident {MODE_NAMES[mode]} at azimuth {azimuth}°. The dashed line marks the inclination chosen on the left.
      </p>
      <div className="chart-pair">
        <LineChart title="Reflected waves" x={data.x} xLabel="Incidence angle (°)" yLabel={yLabel} series={series('reflected')} marker={marker} format={fmtFor(q)} />
        <LineChart title="Transmitted waves" x={data.x} xLabel="Incidence angle (°)" yLabel={yLabel} series={series('transmitted')} marker={marker} format={fmtFor(q)} />
      </div>
    </>
  );
}

function MapPanel({ top, bottom, mode }: { top: Medium; bottom: Medium; mode: Mode }) {
  const [q, setQ] = useState<Quantity>('magnitude');
  const [incMax, setIncMax] = useState(80);
  const [incStep, setIncStep] = useState(2);
  const [aziStep, setAziStep] = useState(5);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(MapResult & { incs: number[]; azis: number[]; quantities: Quantity[] }) | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(0);

  const incs = useMemo(() => range(0, incMax, incStep), [incMax, incStep]);
  const azis = useMemo(() => range(0, 360 - aziStep, aziStep), [aziStep]);

  useEffect(() => {
    const id = ++jobRef.current;
    const quantities = QUANTITIES.map((x) => x.id);
    const timer = setTimeout(() => {
      workerRef.current?.terminate();
      const w = new SweepWorker();
      workerRef.current = w;
      setProgress(0);
      w.onmessage = (ev: MessageEvent<WorkerMessage>) => {
        const m = ev.data;
        if (m.id !== jobRef.current) return;
        if (m.type === 'progress') setProgress(m.done / m.total);
        else {
          setResult({ ...m, incs, azis, quantities });
          setProgress(null);
          w.terminate();
        }
      };
      w.postMessage({ id, top, bottom, mode, inclinations: incs, azimuths: azis, quantities });
    }, 250);
    return () => clearTimeout(timer);
  }, [top, bottom, mode, incs, azis]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const info = quantityInfo(q);
  const qi = result ? result.quantities.indexOf(q) : -1;

  const exportCsv = () => {
    if (!result) return;
    const head = ['inclination_deg', 'azimuth_deg'];
    for (const side of ['R', 'T']) for (const m of MODE_NAMES) head.push(`${side}_${m}_${q}`);
    const rows: string[] = [];
    result.azis.forEach((a, ai) =>
      result.incs.forEach((i, ii) => {
        const idx = ai * result.incs.length + ii;
        const vals = result.values[qi].map((arr) => (Number.isFinite(arr[idx]) ? arr[idx] : ''));
        rows.push([i, a, ...vals].join(','));
      }),
    );
    download(`artc-map-${MODE_NAMES[mode]}-${q}.csv`, [head.join(','), ...rows].join('\n'), 'text/csv');
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <QuantitySelect value={q} onChange={setQ} />
        <label className="field" style={{ width: 120 }}>
          Max inclination (°)
          <select value={incMax} onChange={(e) => setIncMax(Number(e.target.value))}>
            {[30, 45, 60, 80, 89].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ width: 110 }}>
          Inclination step
          <select value={incStep} onChange={(e) => setIncStep(Number(e.target.value))}>
            {[0.5, 1, 2, 5].map((v) => (
              <option key={v} value={v}>
                {v}°
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ width: 110 }}>
          Azimuth step
          <select value={aziStep} onChange={(e) => setAziStep(Number(e.target.value))}>
            {[2, 5, 10, 15].map((v) => (
              <option key={v} value={v}>
                {v}°
              </option>
            ))}
          </select>
        </label>
        <button onClick={exportCsv} disabled={!result}>
          Download CSV
        </button>
      </div>
      <div className="progress" aria-hidden={progress === null}>
        <div style={{ width: `${(progress ?? (result ? 1 : 0)) * 100}%`, opacity: progress === null ? 0 : 1 }} />
      </div>
      {result && result.failures > 0 && (
        <div className="notice warning">{result.failures} grid points could not be solved and are left blank.</div>
      )}
      {result && qi >= 0 && (
        <div className="chart-pair" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {(['reflected', 'transmitted'] as const).flatMap((side, si) =>
            [0, 1, 2].map((k) => (
              <PolarMap
                key={`${side}${k}`}
                title={`${side === 'reflected' ? 'Reflected' : 'Transmitted'} ${MODE_NAMES[k]} — ${info.label}`}
                inclinations={result.incs}
                azimuths={result.azis}
                values={result.values[qi][si * 3 + k]}
                signed={info.signed}
                unit={info.unit}
                format={fmtFor(q)}
              />
            )),
          )}
        </div>
      )}
      <p className="muted small">
        Radius is inclination (centre = vertical incidence, edge = {incMax}°); angle is azimuth from x₁
        towards x₂. Hatched cells have no value (an evanescent wave, or the phase of a zero coefficient).
        Incident {MODE_NAMES[mode]}; {incs.length} × {azis.length} = {incs.length * azis.length} solutions, computed in a background thread.
        Each map has its own colour scale.
      </p>
    </>
  );
}

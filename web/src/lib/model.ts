import { checkMedium, Medium, MediumIssue, Stiffness, symmetrize, zeros6 } from './elastic';
import { Mode } from './artc';

/** Editable text state for one half-space (only the upper triangle is edited). */
export interface LayerForm {
  name: string;
  cells: string[][];
  rho: string;
}

export interface ModelFile {
  format: 'artc-model';
  version: 1;
  top: { name: string; C: Stiffness; rho: number };
  bottom: { name: string; C: Stiffness; rho: number };
  incidence: { mode: Mode; inclination: number; azimuth: number };
}

const fmt = (x: number) => (Math.abs(x) < 1e-12 ? '0' : String(Number(x.toPrecision(7))));

export function formFromMedium(name: string, m: Medium): LayerForm {
  return {
    name,
    cells: m.C.map((row) => row.map(fmt)),
    rho: fmt(m.rho),
  };
}

/** Strict number parsing (the MATLAB GUI used str2num, which evaluates arbitrary code). */
export function parseNumber(s: string): number {
  const t = s.trim();
  if (t === '') return NaN;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export interface ParsedLayer {
  medium: Medium | null;
  issues: MediumIssue[];
  badCells: Set<string>;
}

export function parseLayer(f: LayerForm): ParsedLayer {
  const C = zeros6();
  const badCells = new Set<string>();
  for (let i = 0; i < 6; i++)
    for (let j = i; j < 6; j++) {
      const v = parseNumber(f.cells[i][j]);
      if (!Number.isFinite(v)) badCells.add(`${i},${j}`);
      C[i][j] = v;
    }
  const rho = parseNumber(f.rho);
  if (!Number.isFinite(rho)) badCells.add('rho');
  if (badCells.size)
    return {
      medium: null,
      issues: [{ level: 'error', message: 'Some entries are not valid numbers.' }],
      badCells,
    };
  const medium = { C: symmetrize(C), rho };
  const issues = checkMedium(medium);
  return { medium: issues.some((i) => i.level === 'error') ? null : medium, issues, badCells };
}

export function toModelFile(
  top: LayerForm,
  bottom: LayerForm,
  incidence: ModelFile['incidence'],
): ModelFile | null {
  const a = parseLayer(top).medium;
  const b = parseLayer(bottom).medium;
  if (!a || !b) return null;
  return {
    format: 'artc-model',
    version: 1,
    top: { name: top.name, C: a.C, rho: a.rho },
    bottom: { name: bottom.name, C: b.C, rho: b.rho },
    incidence,
  };
}

export function fromModelFile(json: unknown): {
  top: LayerForm;
  bottom: LayerForm;
  incidence: ModelFile['incidence'];
} {
  const m = json as ModelFile;
  const ok = (x: { C: unknown; rho: unknown } | undefined) =>
    !!x && Array.isArray(x.C) && x.C.length === 6 && x.C.every((r) => Array.isArray(r) && r.length === 6) &&
    typeof x.rho === 'number';
  if (!m || m.format !== 'artc-model' || !ok(m.top) || !ok(m.bottom))
    throw new Error('Not an ARTc model file.');
  const inc = m.incidence ?? { mode: 0, inclination: 30, azimuth: 0 };
  return {
    top: formFromMedium(m.top.name || 'Upper medium', { C: symmetrize(m.top.C), rho: m.top.rho }),
    bottom: formFromMedium(m.bottom.name || 'Lower medium', { C: symmetrize(m.bottom.C), rho: m.bottom.rho }),
    incidence: {
      mode: ([0, 1, 2].includes(inc.mode) ? inc.mode : 0) as Mode,
      inclination: Number(inc.inclination) || 0,
      azimuth: Number(inc.azimuth) || 0,
    },
  };
}

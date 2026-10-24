import { useEffect, useRef, useState } from 'react';

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

interface Props {
  title: string;
  x: number[];
  xLabel: string;
  yLabel: string;
  series: Series[];
  /** Vertical marker (e.g. the currently selected inclination). */
  marker?: number;
  format?: (v: number) => string;
}

const HEIGHT = 260;
const M = { top: 10, right: 14, bottom: 34, left: 48 };

function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi === lo) {
    hi = lo + 1;
    lo = lo - 1;
  }
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}

export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function LineChart({ title, x, xLabel, yLabel, series, marker, format = (v) => v.toFixed(3) }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  let lo = Math.min(0, ...all);
  let hi = Math.max(...all, 0);
  if (!all.length) {
    lo = 0;
    hi = 1;
  }
  const pad = (hi - lo) * 0.05 || 0.5;
  const yTicks = niceTicks(lo, hi + pad);
  const yLo = Math.min(lo, yTicks[0] ?? lo);
  const yHi = Math.max(hi, yTicks[yTicks.length - 1] ?? hi);
  const xLo = x[0];
  const xHi = x[x.length - 1];
  const W = width;
  const iw = W - M.left - M.right;
  const ih = HEIGHT - M.top - M.bottom;
  const sx = (v: number) => M.left + ((v - xLo) / (xHi - xLo || 1)) * iw;
  const sy = (v: number) => M.top + ih - ((v - yLo) / (yHi - yLo || 1)) * ih;

  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${sx(x[i]).toFixed(1)},${sy(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * iw;
    const xv = xLo + (px / iw) * (xHi - xLo);
    let best = 0;
    x.forEach((xi, i) => {
      if (Math.abs(xi - xv) < Math.abs(x[best] - xv)) best = i;
    });
    setHover(best);
  };

  const xTicks = niceTicks(xLo, xHi, Math.max(3, Math.floor(iw / 70)));
  const tipLeft = hover !== null ? sx(x[hover]) : 0;

  return (
    <figure className="chart" style={{ margin: 0 }} ref={wrapRef}>
      <figcaption className="chart-title">{title}</figcaption>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <span className="swatch" style={{ background: s.color }} aria-hidden />
            {s.name}
          </span>
        ))}
      </div>
      <svg width={W} height={HEIGHT} viewBox={`0 0 ${W} ${HEIGHT}`} role="img" aria-label={`${title}: ${yLabel} against ${xLabel}`}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.left - 6} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
              {String(Number(t.toPrecision(6)))}
            </text>
          </g>
        ))}
        {yLo < 0 && yHi > 0 && (
          <line x1={M.left} x2={W - M.right} y1={sy(0)} y2={sy(0)} stroke="var(--axis)" strokeWidth={1} />
        )}
        <line x1={M.left} x2={W - M.right} y1={M.top + ih} y2={M.top + ih} stroke="var(--axis)" />
        {xTicks.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={M.top + ih + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {t}
          </text>
        ))}
        <text x={M.left + iw / 2} y={HEIGHT - 4} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
          {xLabel}
        </text>
        <text
          transform={`translate(12 ${M.top + ih / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={11}
          fill="var(--ink-2)"
        >
          {yLabel}
        </text>
        {marker !== undefined && marker >= xLo && marker <= xHi && (
          <line x1={sx(marker)} x2={sx(marker)} y1={M.top} y2={M.top + ih} stroke="var(--muted)" strokeDasharray="3 3" />
        )}
        {series.map((s) => (
          <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {hover !== null && (
          <g>
            <line x1={sx(x[hover])} x2={sx(x[hover])} y1={M.top} y2={M.top + ih} stroke="var(--ink-2)" strokeWidth={1} />
            {series.map((s) => {
              const v = s.values[hover];
              return v === null || !Number.isFinite(v) ? null : (
                <circle key={s.name} cx={sx(x[hover])} cy={sy(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              );
            })}
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{
            top: 40,
            left: tipLeft > W / 2 ? undefined : tipLeft + 12,
            right: tipLeft > W / 2 ? W - tipLeft + 12 : undefined,
          }}
        >
          <div className="t-head">
            {xLabel}: {x[hover]}
          </div>
          {series.map((s) => {
            const v = s.values[hover];
            return (
              <div key={s.name}>
                <span className="swatch" style={{ background: s.color }} aria-hidden />
                {s.name}: <b>{v === null || !Number.isFinite(v) ? '—' : format(v)}</b>
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}

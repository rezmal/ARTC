import { useEffect, useRef, useState } from 'react';
import { useWidth } from './LineChart';

interface Props {
  title: string;
  inclinations: number[];
  azimuths: number[];
  /** values[a * nInc + i]; NaN where undefined. */
  values: Float64Array;
  signed: boolean;
  unit: string;
  format: (v: number) => string;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

// Sequential blue ramp (steps 100..700) and a blue-grey-red diverging ramp.
const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'].map(hex);
const DIV_LIGHT = ['#184f95', '#3987e5', '#9ec5f4', '#f0efec', '#f2a9a0', '#e34948', '#a12a2a'].map(hex);
const DIV_DARK = ['#6da7ec', '#3987e5', '#1c5cab', '#383835', '#a63a37', '#e34948', '#f2a9a0'].map(hex);

function ramp(stops: RGB[], t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((k) => stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f) as RGB;
}

function isDarkSurface(el: Element): boolean {
  const c = getComputedStyle(el).getPropertyValue('--surface').trim();
  if (!c.startsWith('#') || c.length < 7) return false;
  const [r, g, b] = hex(c);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

export function PolarMap({ title, inclinations, azimuths, values, signed, unit, format }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; inc: number; azi: number; v: number } | null>(null);
  const [dark, setDark] = useState(false);

  const size = Math.min(width, 520);
  const pad = 26;
  const R = size / 2 - pad;
  const nInc = inclinations.length;
  const incMax = inclinations[nInc - 1];
  const finite = Array.from(values).filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  // A wave that is never generated (e.g. SH from P in isotropic media) has values at
  // round-off level; give it a unit scale so it renders as uniform zero, not as noise.
  const ZERO_LEVEL = 1e-8;
  const allZero = finite.length > 0 && finite.every((v) => Math.abs(v) < ZERO_LEVEL);
  if (signed) {
    const m = Math.max(Math.abs(lo), Math.abs(hi));
    lo = m < ZERO_LEVEL ? -1 : -m;
    hi = -lo;
  } else {
    lo = Math.min(0, lo);
    if (hi - lo < ZERO_LEVEL) hi = lo + 1;
  }

  const stops = signed ? (dark ? DIV_DARK : DIV_LIGHT) : dark ? [...SEQ].reverse() : SEQ;

  /** Grid cell nearest to a canvas point, or null outside the disc. */
  const cellAt = (px: number, py: number) => {
    const dx = px - size / 2;
    const dy = size / 2 - py;
    const r = Math.hypot(dx, dy) / R;
    if (r > 1.0001) return null;
    const inc = r * incMax;
    let azi = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (azi < 0) azi += 360;
    // Both grids are uniform, so the nearest cell is a rounding away.
    const dInc = nInc > 1 ? (incMax - inclinations[0]) / (nInc - 1) : 1;
    const i = Math.min(nInc - 1, Math.max(0, Math.round((inc - inclinations[0]) / dInc)));
    const nAz = azimuths.length;
    const dAz = 360 / nAz;
    const a = ((Math.round((azi - azimuths[0]) / dAz) % nAz) + nAz) % nAz;
    return { i, a, v: values[a * nInc + i] };
  };

  useEffect(() => {
    if (wrapRef.current) setDark(isDarkSurface(wrapRef.current));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => wrapRef.current && setDark(isDarkSurface(wrapRef.current));
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [wrapRef]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(cv.width, cv.height);
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++) {
        const c = cellAt(x / dpr, y / dpr);
        if (!c) continue;
        const o = (y * cv.width + x) * 4;
        if (!Number.isFinite(c.v)) {
          const stripe = ((x + y) >> 3) % 2 === 0;
          img.data.set(dark ? (stripe ? [44, 44, 42, 255] : [35, 35, 33, 255]) : stripe ? [225, 224, 217, 255] : [242, 241, 237, 255], o);
          continue;
        }
        const [r, g, b] = ramp(stops, (c.v - lo) / (hi - lo));
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    ctx.scale(dpr, dpr);
    const cs = getComputedStyle(cv);
    const grid = cs.getPropertyValue('--axis').trim() || '#c3c2b7';
    const ink = cs.getPropertyValue('--ink-2').trim() || '#52514e';
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = ink;
    ctx.font = '11px system-ui, sans-serif';
    const ringStep = incMax > 45 ? 20 : 10;
    for (let inc = ringStep; inc <= incMax + 1e-9; inc += ringStep) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (inc / incMax) * R, 0, 2 * Math.PI);
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const lt = (67.5 * Math.PI) / 180;
      ctx.fillText(`${inc}°`, size / 2 + (inc / incMax) * R * Math.cos(lt) + 2, size / 2 - (inc / incMax) * R * Math.sin(lt) - 2);
    }
    for (let az = 0; az < 360; az += 45) {
      const t = (az * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2);
      ctx.lineTo(size / 2 + R * Math.cos(t), size / 2 - R * Math.sin(t));
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const lx = size / 2 + (R + 13) * Math.cos(t);
      const ly = size / 2 - (R + 13) * Math.sin(t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(az === 0 ? 'x₁' : az === 90 ? 'x₂' : `${az}°`, lx, ly);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    const bar = barRef.current;
    if (bar) {
      bar.width = 256;
      bar.height = 1;
      const bctx = bar.getContext('2d')!;
      const bimg = bctx.createImageData(256, 1);
      for (let x = 0; x < 256; x++) {
        const [r, g, b] = ramp(stops, x / 255);
        bimg.data.set([r, g, b, 255], x * 4);
      }
      bctx.putImageData(bimg, 0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, size, dark, signed, lo, hi]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const c = cellAt(px, py);
    if (!c) return setHover(null);
    const top = e.currentTarget.offsetTop;
    setHover({ x: px, y: py + top, inc: inclinations[c.i], azi: azimuths[c.a], v: c.v });
  };

  return (
    <figure className="chart" style={{ margin: 0 }} ref={wrapRef}>
      <figcaption className="chart-title">{title}</figcaption>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${title}: polar map, radius is inclination, angle is azimuth`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      />
      {allZero ? (
        <div className="colorbar muted">Zero everywhere: this wave is not generated.</div>
      ) : (
        <div className="colorbar" style={{ maxWidth: size }}>
          <span>{format(lo)}</span>
          <canvas ref={barRef} aria-hidden />
          <span>
            {format(hi)} {unit}
          </span>
        </div>
      )}
      {hover && (
        <div
          className="tooltip"
          style={{
            left: hover.x > size / 2 ? undefined : hover.x + 14,
            right: hover.x > size / 2 ? width - hover.x + 14 : undefined,
            top: hover.y + 10,
          }}
        >
          <div className="t-head">
            inc {hover.inc}°, azi {hover.azi}°
          </div>
          <b>{Number.isFinite(hover.v) ? `${format(hover.v)} ${unit}` : 'no value'}</b>
        </div>
      )}
    </figure>
  );
}

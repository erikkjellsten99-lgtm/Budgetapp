import { useMemo, useState } from 'react';
import { today } from './db';
import { formatKr, formatPct } from './money';
import { axisLabel, niceStep, shortDate, signedKr } from './chartUtil';
import HoldingView, { HoldingForm } from './HoldingView';
import {
  allocation,
  totals,
  valueOverTime,
  type HoldingSummary,
  type SeriesPoint,
} from '../supabase/functions/inbox/portfolio.ts';
import type { Holding, PricePoint, Trade } from './types';

interface InvestmentsProps {
  holdings: Holding[];
  trades: Trade[];
  prices: Record<string, PricePoint[]>;
  rows: HoldingSummary[];
  /** Falskt tills första läsningen är klar, så att tomvyn inte blinkar förbi. */
  loaded: boolean;
  /** Vald vy: null är översikten, "new" nytt innehav, annars id för ett innehav. Ägs av App som visar tillbakalänken. */
  selected: string | 'new' | null;
  onSelect: (selected: string | 'new' | null) => void;
}

/** Investeringar: nyckeltal, värde över tid, fördelning och innehav. Räknar inte själv, allt kommer från portfolio.ts. */
export default function Investments({ holdings, trades, prices, rows, loaded, selected, onSelect }: InvestmentsProps) {
  const [by, setBy] = useState<'holding' | 'type'>('holding');
  const sum = useMemo(() => totals(rows), [rows]);
  const slices = useMemo(() => allocation(rows, by), [rows, by]);
  const series = useMemo(() => valueOverTime(holdings, trades, prices, today()), [holdings, trades, prices]);
  const sorted = useMemo(() => [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)), [rows]);

  const anyStale = rows.some((r) => r.quote.stale);
  const priceNote = anyStale ? 'Gamla kurser' : sum.latestDate ? `Kurser från ${shortDate(sum.latestDate)}` : null;

  if (!loaded) return null;

  if (selected === 'new') {
    return <HoldingForm onDone={() => onSelect(null)} />;
  }
  const open = selected === null ? undefined : rows.find((r) => r.holding.id === selected);
  if (open) {
    return <HoldingView row={open} trades={trades} prices={prices} onBack={() => onSelect(null)} />;
  }

  if (rows.length === 0) {
    return (
      <>
        <h2>Investeringar</h2>
        <p className="hint">Lägg in dina aktier och fonder så följer appen värdet åt dig.</p>
        <button className="add" onClick={() => onSelect('new')}>
          + Nytt innehav
        </button>
      </>
    );
  }

  return (
    <>
      <h2>Investeringar</h2>
      <section className="group-block" aria-label="Nyckeltal">
        <div className="group">
          <p className="group-row">
            <span className="row-name">Investerat</span>
            <span className="row-value">{formatKr(sum.invested)}</span>
          </p>
          <p className="group-row">
            <span className="row-main">
              <span className="row-name">Värde idag</span>
              {sum.missing > 0 && sum.value !== null && (
                <span className="row-sub">Värde saknas för {sum.missing} innehav</span>
              )}
            </span>
            <span className="row-value">{sum.value === null ? 'Värde saknas' : formatKr(sum.value)}</span>
          </p>
          <p className="group-row">
            <span className="row-main">
              <span className="row-name">Utveckling</span>
              {sum.changePct !== null && (
                <span className="row-sub">
                  {formatPct(sum.changePct)}
                  {sum.missing > 0 && ', räknat på innehav med kurs'}
                </span>
              )}
            </span>
            <span className={sum.change !== null && sum.change < 0 ? 'row-value negative' : 'row-value'}>
              {sum.change === null ? 'Värde saknas' : signedKr(sum.change)}
            </span>
          </p>
          {sum.realized !== 0 && (
            <p className="group-row">
              <span className="row-name">Realiserat</span>
              <span className={sum.realized < 0 ? 'row-value negative' : 'row-value'}>{formatKr(sum.realized)}</span>
            </p>
          )}
        </div>
        {priceNote && <p className="hint investments-note">{priceNote}</p>}
      </section>

      <Chart series={series} />

      <section className="card investments-allocation" aria-labelledby="investments-alloc">
        <div className="investments-alloc-head">
          <h3 id="investments-alloc">Fördelning</h3>
          <div className="segmented-row" role="group" aria-label="Fördela">
            <button
              type="button"
              className={by === 'holding' ? 'seg active' : 'seg'}
              aria-pressed={by === 'holding'}
              onClick={() => setBy('holding')}
            >
              Per innehav
            </button>
            <button
              type="button"
              className={by === 'type' ? 'seg active' : 'seg'}
              aria-pressed={by === 'type'}
              onClick={() => setBy('type')}
            >
              Per typ
            </button>
          </div>
        </div>
        {slices.length === 0 ? (
          <p className="hint">Värde saknas, så det går inte att fördela än.</p>
        ) : (
          <ul className="investments-bars">
            {slices.map((s) => (
              <li key={s.key}>
                <span className="bar-label">{s.label}</span>
                <span className="bar-track" aria-hidden="true">
                  <span style={{ width: `${s.share * 100}%` }} />
                </span>
                <span className="bar-share">{share(s.share)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="group-block" aria-label="Innehav">
        <div className="group">
          {sorted.map((r) => {
            const notes = [
              r.changePct !== null ? formatPct(r.changePct) : null,
              r.quote.source === 'manual' ? 'egen kurs' : null,
              r.value === null ? 'värde saknas' : null,
            ].filter(Boolean);
            return (
              <button type="button" key={r.holding.id} className="group-row" onClick={() => onSelect(r.holding.id)}>
                <span className="row-main">
                  <span className="row-name">{r.holding.name}</span>
                  {notes.length > 0 && (
                    <span className={r.change !== null && r.change < 0 ? 'row-sub negative' : 'row-sub'}>
                      {notes.join(', ')}
                    </span>
                  )}
                </span>
                <span className="row-value">
                  {r.value === null ? '–' : formatKr(r.value)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <button className="add" onClick={() => onSelect('new')}>
        + Nytt innehav
      </button>
    </>
  );
}

/** Andel som heltal, t.ex. "75 %". */
function share(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

/** Värde och investerat belopp vid månadsskiften. Värdelinjen har ett glapp där något innehav saknar kurs. */
function Chart({ series }: { series: SeriesPoint[] }) {
  if (series.length < 2) return null;
  if (series.filter((p) => p.value !== null).length < 2) {
    return <p className="hint">Grafen visas när det finns kurser för fler dagar.</p>;
  }

  const W = 340;
  const H = 190;
  const pad = { l: 46, r: 14, t: 14, b: 26 };
  const top = Math.max(...series.map((p) => Math.max(p.invested ?? 0, p.value ?? 0)), 100);
  const step = niceStep(top);
  const max = Math.ceil(top / step) * step;
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const point = (i: number, v: number) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`;

  // Sammanhängande stycken med värde. Ett stycke på en enda punkt blir en prick.
  const runsOf = (get: (p: SeriesPoint) => number | null) => {
    const runs: { i: number; v: number }[][] = [];
    series.forEach((p, i) => {
      const v = get(p);
      if (v === null) {
        runs.push([]);
      } else {
        if (runs.length === 0) runs.push([]);
        runs[runs.length - 1].push({ i, v });
      }
    });
    return runs.filter((r) => r.length > 0);
  };
  const valueRuns = runsOf((p) => p.value);
  const investedRuns = runsOf((p) => p.invested);

  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const last = series[series.length - 1];
  const first = series[0];

  return (
    <figure className="card forecast-chart investments-chart">
      <figcaption className="chart-legend">
        <span className="key save">Värde</span>
        <span className="key loan">Investerat</span>
      </figcaption>
      <div className="chart-box">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Värde ${last.value === null ? 'saknas' : formatKr(last.value)}, investerat ${last.invested === null ? 'saknas' : formatKr(last.invested)} den ${shortDate(last.date)}.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis' : 'grid'} />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="lbl">
                {axisLabel(v)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 8} className="lbl">
            {shortDate(first.date)}
          </text>
          <text x={W - pad.r} y={H - 8} textAnchor="end" className="lbl">
            {shortDate(last.date)}
          </text>
          {investedRuns.map((run) =>
            run.length === 1 ? (
              <circle key={run[0].i} cx={x(run[0].i)} cy={y(run[0].v)} r={2.5} className="loan-dot" />
            ) : (
              <polyline key={run[0].i} points={run.map((p) => point(p.i, p.v)).join(' ')} className="loan-line" />
            ),
          )}
          {valueRuns.map((run) =>
            run.length === 1 ? (
              <circle key={run[0].i} cx={x(run[0].i)} cy={y(run[0].v)} r={2.5} className="save-dot" />
            ) : (
              <polyline key={run[0].i} points={run.map((p) => point(p.i, p.v)).join(' ')} className="save-line" />
            ),
          )}
        </svg>
      </div>
    </figure>
  );
}

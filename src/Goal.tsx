import { useEffect, useState } from 'react';
import { getGoals, saveGoal } from './db';
import { formatKr, parseKr, toInputKr } from './money';
import type { Asset, SavingsGoal } from './types';

/** Längsta prognosen som räknas fram, i månader (40 år). */
const MAX_MONTHS = 480;

interface Projection {
  /** Saldo med avkastning, ett värde per månad från idag (index 0). */
  withReturn: number[];
  /** Saldo om pengarna bara låg still, ett värde per månad. */
  depositsOnly: number[];
  /** Månaden då målet nås, eller null om det inte nås inom 40 år. */
  reachedAt: number | null;
}

/**
 * Ränta på ränta: varje månad växer saldot med månadens avkastning och månadssparandet läggs till.
 * Kurvan räknas tills målet är nått (avrundat uppåt till helt år) och minst 10 år framåt, så att ränta-på-ränta-effekten syns.
 */
function project(start: number, goal: SavingsGoal): Projection {
  const monthlyRate = Math.pow(1 + goal.annualReturn / 100, 1 / 12) - 1;
  const withReturn = [start];
  const depositsOnly = [start];
  let reachedAt: number | null = start >= goal.target ? 0 : null;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    withReturn.push(withReturn[month - 1] * (1 + monthlyRate) + goal.monthlyDeposit);
    depositsOnly.push(start + goal.monthlyDeposit * month);
    if (reachedAt === null && withReturn[month] >= goal.target) reachedAt = month;
    const shown = reachedAt === null ? MAX_MONTHS : Math.max(120, Math.ceil((reachedAt + 1) / 12) * 12);
    if (month >= shown) break;
  }
  return { withReturn, depositsOnly, reachedAt };
}

/** Datum om ett antal månader, t.ex. "mars 2031". */
function monthLabel(monthsFromNow: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + monthsFromNow);
  return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
}

/** T.ex. "4 år och 3 månader". */
function durationLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} år`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'månad' : 'månader'}`);
  return parts.join(' och ') || 'nu';
}

/** Kort belopp till axeln, t.ex. "150 tkr". */
function shortKr(amount: number): string {
  return amount >= 1000 ? `${Math.round(amount / 1000)} tkr` : `${Math.round(amount)} kr`;
}

/** Ett jämnt steg för y-axeln, så att det blir 3–5 linjer. */
function niceStep(max: number): number {
  for (const step of [10000, 25000, 50000, 100000, 250000, 500000, 1000000]) {
    if (max / step <= 5) return step;
  }
  return 2500000;
}

interface GoalProps {
  assets: Asset[];
}

/** Sparmålet med en prognos över när målet nås. */
export default function Goal({ assets }: GoalProps) {
  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    getGoals().then((goals) => setGoal(goals[0] ?? null));
  }, []);

  if (!goal) return null;

  async function update(change: Partial<SavingsGoal>) {
    const updated = { ...goal!, ...change };
    setGoal(updated);
    await saveGoal(updated);
  }

  const counted = assets.filter((asset) => goal.assetIds.includes(asset.id));
  const current = counted.reduce((sum, asset) => sum + asset.amount, 0);
  const progress = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
  const projection = project(current, goal);

  return (
    <>
      <h2>Sparmål</h2>
      <section className="card goal">
        <h3>
          {goal.name} <span>{formatKr(goal.target)}</span>
        </h3>
        <div className="goal-body">
          <p className="goal-progress">
            <strong>{formatKr(current)}</strong> av {formatKr(goal.target)} · {Math.round(progress * 100)} %
          </p>
          <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="goal-result">
            {projection.reachedAt === 0
              ? 'Målet är nått!'
              : projection.reachedAt === null
                ? 'Med de här siffrorna nås målet inte inom 40 år. Öka månadssparandet.'
                : `Målet nås i ${monthLabel(projection.reachedAt)}, om ${durationLabel(projection.reachedAt)}.`}
          </p>
          <GoalChart projection={projection} target={goal.target} />
          <div className="goal-inputs">
            <NumberField
              label="Per månad (kr)"
              value={goal.monthlyDeposit}
              onSave={(monthlyDeposit) => update({ monthlyDeposit })}
            />
            <NumberField
              label="Avkastning/år (%)"
              value={goal.annualReturn}
              max={30}
              onSave={(annualReturn) => update({ annualReturn })}
            />
            <NumberField label="Mål (kr)" value={goal.target} onSave={(target) => update({ target })} />
          </div>
          <details className="goal-accounts">
            <summary>Konton som räknas mot målet ({counted.length})</summary>
            {assets
              .filter((asset) => !asset.spending)
              .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
              .map((asset) => (
                <label key={asset.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={goal.assetIds.includes(asset.id)}
                    onChange={(event) =>
                      update({
                        assetIds: event.target.checked
                          ? [...goal.assetIds, asset.id]
                          : goal.assetIds.filter((id) => id !== asset.id),
                      })
                    }
                  />
                  {asset.name} · {formatKr(asset.amount)}
                </label>
              ))}
          </details>
          <p className="note">
            Prognosen är en uppskattning. Avkastningen varierar från år till år, och kurvan visar ett jämnt snitt.
          </p>
        </div>
      </section>
    </>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  max?: number;
  onSave: (value: number) => void;
}

/** Ett sifferfält som sparas när du lämnar fältet. */
function NumberField({ label, value, max, onSave }: NumberFieldProps) {
  const [text, setText] = useState(toInputKr(value));
  const parsed = parseKr(text);
  const valid = Number.isFinite(parsed) && parsed >= 0 && (max === undefined || parsed <= max);

  useEffect(() => setText(toInputKr(value)), [value]);

  return (
    <label>
      {label}
      <input
        value={text}
        inputMode="decimal"
        placeholder="0"
        aria-invalid={!valid}
        onChange={(event) => {
          setText(event.target.value);
          const next = parseKr(event.target.value);
          if (Number.isFinite(next) && next >= 0 && (max === undefined || next <= max)) onSave(next);
        }}
        onBlur={() => !valid && setText(toInputKr(value))}
      />
    </label>
  );
}

// Diagrammet ritas som SVG utan bibliotek. Måtten är i viewBox-enheter och skalas till bredden.
const W = 340;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 48 };

function GoalChart({ projection, target }: { projection: Projection; target: number }) {
  const { withReturn, depositsOnly, reachedAt } = projection;
  const months = withReturn.length - 1;
  const [hover, setHover] = useState<number | null>(null);

  const maxValue = Math.max(target * 1.1, withReturn[months]);
  const step = niceStep(maxValue);
  const yMax = Math.ceil(maxValue / step) * step;
  const x = (month: number) => PAD.left + (month / months) * (W - PAD.left - PAD.right);
  const y = (amount: number) => H - PAD.bottom - (amount / yMax) * (H - PAD.top - PAD.bottom);
  const path = (values: number[]) =>
    values.map((value, month) => `${month === 0 ? 'M' : 'L'}${x(month).toFixed(1)},${y(value).toFixed(1)}`).join('');

  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const years = months / 12;
  const yearStep = years <= 6 ? 1 : years <= 15 ? 2 : 5;
  const xTicks = Array.from({ length: Math.floor(years / yearStep) + 1 }, (_, i) => i * yearStep * 12);

  // Visar värdet för månaden du pekar på, annars månaden då målet nås (eller slutet).
  const shown = hover ?? reachedAt ?? months;

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * W;
    const month = Math.round(((svgX - PAD.left) / (W - PAD.left - PAD.right)) * months);
    setHover(Math.max(0, Math.min(months, month)));
  }

  return (
    <figure className="goal-chart">
      <figcaption className="goal-readout">
        <span>{shown === 0 ? 'Idag' : monthLabel(shown)}</span>
        <strong>{formatKr(Math.round(withReturn[shown]))}</strong>
        <span className="muted">varav insatt {formatKr(Math.round(depositsOnly[shown]))}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Prognos för sparandet de kommande ${Math.round(years)} åren`}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis" x={PAD.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {shortKr(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((month) => (
          <text key={month} className="axis" x={x(month)} y={H - 6} textAnchor={month === months ? 'end' : 'middle'}>
            {month === 0 ? 'Idag' : `${month / 12} år`}
          </text>
        ))}
        <line className="target" x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} />
        <text className="target-label" x={PAD.left + 4} y={y(target) - 5}>
          Mål {shortKr(target)}
        </text>
        <path className="line-deposits" d={path(depositsOnly)} />
        <path className="line-return" d={path(withReturn)} />
        {reachedAt !== null && reachedAt > 0 && (
          <circle className="reached" cx={x(reachedAt)} cy={y(withReturn[reachedAt])} r={5} />
        )}
        {hover !== null && (
          <>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
            <circle className="hover-dot" cx={x(hover)} cy={y(withReturn[hover])} r={4.5} />
          </>
        )}
      </svg>
      <div className="legend">
        <span>
          <i className="swatch-return" /> Med avkastning
        </span>
        <span>
          <i className="swatch-deposits" /> Bara insättningar
        </span>
      </div>
    </figure>
  );
}

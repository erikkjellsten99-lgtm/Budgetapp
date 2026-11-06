import { useEffect, useState } from 'react';
import { getGoals, onDataChange, saveGoal } from './db';
import { countsForGoal, goalStatus, planGoal, planWhen, type GoalPlan } from './goalPlan';
import { formatKr } from './money';
import { useAmountInput } from './useAmountInput';
import { useGoalData } from './useGoalPlan';
import type { Asset, SavingsGoal } from './types';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Kort belopp till axeln, t.ex. "150 tkr". */
function shortKr(amount: number): string {
  return amount >= 1000 ? `${Math.round(amount / 1000).toLocaleString('sv-SE')} tkr` : `${Math.round(amount)} kr`;
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
  /** Får målet när det har lästs in och varje gång det ändras. */
  onChange?: (goal: SavingsGoal) => void;
}

/** Summan av kontona som räknas mot målet. */
export function goalCurrent(goal: SavingsGoal, assets: Asset[]): number {
  return assets.filter((asset) => goal.assetIds.includes(asset.id)).reduce((sum, asset) => sum + asset.amount, 0);
}

/** Sparmålet med en prognos över när målet nås. */
export default function Goal({ assets, onChange }: GoalProps) {
  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    const load = () => getGoals().then((goals) => setGoal(goals[0] ?? null));
    load();
    return onDataChange((kind) => kind === 'remote' && load());
  }, []);

  useEffect(() => {
    if (goal) onChange?.(goal);
  }, [goal]);

  const data = useGoalData(goal);

  if (!goal) return null;

  async function update(change: Partial<SavingsGoal>) {
    const updated = { ...goal!, ...change };
    setGoal(updated);
    await saveGoal(updated);
  }

  const counted = assets.filter((asset) => goal.assetIds.includes(asset.id));
  const current = counted.reduce((sum, asset) => sum + asset.amount, 0);
  const progress = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
  const projection = data ? planGoal(current, goal.target, goal.annualReturn, data.rows) : null;
  const categories = [...(data?.savingsCategories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const chosen = categories.filter((category) => countsForGoal(goal, category));
  const next = data?.rows[0];

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
          {projection ? (
            <>
              <p className="goal-result">{goalStatus(projection)}</p>
              <GoalChart projection={projection} target={goal.target} />
            </>
          ) : (
            <p className="goal-result muted">Räknar …</p>
          )}
          {next && (
            <dl className="goal-monthly">
              <div>
                <dt>Till målet nästa månad</dt>
                <dd>{formatKr(Math.round(next.toGoal))}</dd>
              </div>
              <div className="sub">
                <dt>{chosen.length ? chosen.map((category) => category.name).join(', ') : 'Inga sparkategorier valda'}</dt>
                <dd>{formatKr(next.categories)}</dd>
              </div>
              <div className="sub">
                <dt>Det som blir över</dt>
                <dd>{formatKr(Math.round(next.left))}</dd>
              </div>
            </dl>
          )}
          <p className="hint small">
            Varje månad går de valda sparkategorierna i budgeten och det som blir över till målet. Går det som blir
            över till billånet (Prognos → Extra på lånet) räknas det först när lånet är betalt.
          </p>
          <div className="goal-inputs">
            <NumberField
              label="Avkastning/år (%)"
              value={goal.annualReturn}
              max={30}
              onSave={(annualReturn) => update({ annualReturn })}
            />
            <NumberField label="Mål (kr)" value={goal.target} onSave={(target) => update({ target })} />
          </div>
          <details className="goal-accounts">
            <summary>Budgetkategorier som går till målet ({chosen.length})</summary>
            {categories.length === 0 && <p className="hint small">Det finns inga sparkategorier i budgeten.</p>}
            {categories.map((category) => (
              <label key={category.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={countsForGoal(goal, category)}
                  onChange={(event) => {
                    const ids = chosen.map((c) => c.id);
                    update({
                      categoryIds: event.target.checked ? [...ids, category.id] : ids.filter((id) => id !== category.id),
                    });
                  }}
                />
                {category.name} · {formatKr(category.monthlyBudget)}/mån
              </label>
            ))}
          </details>
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

/** Ett sifferfält som sparas när du lämnar fältet. Tomt eller ogiltigt ger tillbaka det gamla värdet. */
function NumberField({ label, value, max, onSave }: NumberFieldProps) {
  const field = useAmountInput(value, onSave, max);
  return (
    <label>
      {label}
      <input {...field.props} placeholder="0" aria-invalid={field.invalid} />
    </label>
  );
}

// Diagrammet ritas som SVG utan bibliotek. Måtten är i viewBox-enheter och skalas till bredden.
const W = 340;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 58 };

function GoalChart({ projection, target }: { projection: GoalPlan; target: number }) {
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
        <span>{capitalize(planWhen(projection, shown))}</span>
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

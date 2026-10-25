import { useEffect, useState } from 'react';
import {
  currentMonth,
  getAssets,
  getBudget,
  getGoals,
  getIncome,
  getIncomeRecords,
  getLoans,
  monthName,
  onDataChange,
  saveIncome,
  saveLoan,
  shiftMonth,
} from './db';
import { CSN_PLAN, forecast, type Forecast as ForecastResult, type Loan, type MonthInput } from './forecast';
import { formatKr, parseKr, toInputKr } from './money';
import type { MonthlyIncome } from './types';

const HORIZONS = [
  { months: 12, label: '1 år' },
  { months: 24, label: '2 år' },
  { months: 60, label: '5 år' },
];

interface Data {
  inputs: MonthInput[];
  incomes: MonthlyIncome[];
  /** Månader som har egen inkomst ifylld (inte ärvd). */
  ownIncome: Set<string>;
  startSavings: number;
  goalTarget: number;
  loan: Loan | null;
}

const SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "2027-04" som "apr 2027". */
const shortMonth = (month: string) => `${SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const kr = (amount: number) => formatKr(Math.round(amount));

async function loadData(first: string, count: number): Promise<Data> {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(first, i));
  const [records, assets, goals, loans] = await Promise.all([getIncomeRecords(), getAssets(), getGoals(), getLoans()]);
  const inputs: MonthInput[] = [];
  const incomes: MonthlyIncome[] = [];
  for (const month of months) {
    const [{ categories }, income] = await Promise.all([getBudget(month), getIncome(month)]);
    const sum = (type: string) =>
      categories.filter((c) => (type === 'savings' ? c.type === 'savings' : c.type !== 'savings')).reduce((s, c) => s + c.monthlyBudget, 0);
    incomes.push(income);
    inputs.push({ month, income: income.csn + income.other, costs: sum('costs'), plannedSavings: sum('savings') });
  }
  const goal = goals[0];
  return {
    inputs,
    incomes,
    ownIncome: new Set(records.map((r) => r.month)),
    startSavings: assets.filter((a) => !a.spending).reduce((s, a) => s + a.amount, 0),
    goalTarget: goal?.target ?? 0,
    loan: loans[0] ?? null,
  };
}

/** Prognos: månad för månad framåt, med billån och sparande. Siffrorna kommer från budgeten. */
export default function Forecast() {
  const first = shiftMonth(currentMonth(), 1);
  const [horizon, setHorizon] = useState(24);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => loadData(first, horizon).then((d) => alive && setData(d));
    load();
    const stop = onDataChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [first, horizon]);

  if (!data) return null;
  const result = forecast(data.inputs, data.startSavings, data.loan, data.goalTarget);
  const last = result.months.at(-1);
  const csnMissing = CSN_PLAN.some((p) => p.month >= first && !data.ownIncome.has(p.month));

  return (
    <section className="forecast" aria-labelledby="forecast-title">
      <div className="view-intro">
        <p className="eyebrow">FRÅN {monthName(first).toUpperCase()}</p>
        <h2 id="forecast-title">Prognos</h2>
      </div>
      <p className="forecast-lead">
        Räknat på budgeten för varje månad och {kr(data.startSavings)} på sparkontona idag. Utan avkastning.
      </p>

      <div className="forecast-facts">
        {data.loan && (
          <div className="card fact">
            <span>{data.loan.name} betalt</span>
            <strong>{result.loanPaidIn ? monthName(result.loanPaidIn) : 'Inte inom perioden'}</strong>
          </div>
        )}
        <div className="card fact">
          <span>Sparat {last ? monthName(last.month) : ''}</span>
          <strong>{last ? kr(last.savings) : '–'}</strong>
        </div>
        {data.goalTarget > 0 && (
          <div className="card fact">
            <span>{kr(data.goalTarget)} sparat totalt</span>
            <strong>{result.goalReachedIn ? monthName(result.goalReachedIn) : 'Inte inom perioden'}</strong>
          </div>
        )}
      </div>

      {result.lowest.savings < data.startSavings && (
        <p className="forecast-note">
          Lägst blir sparandet {kr(result.lowest.savings)} i {monthName(result.lowest.month)}.
        </p>
      )}

      <div className="segmented-row" role="radiogroup" aria-label="Hur långt fram">
        {HORIZONS.map((h) => (
          <button
            key={h.months}
            type="button"
            role="radio"
            aria-checked={horizon === h.months}
            className={horizon === h.months ? 'seg active' : 'seg'}
            onClick={() => setHorizon(h.months)}
          >
            {h.label}
          </button>
        ))}
      </div>

      <Chart result={result} goal={data.goalTarget} />

      {data.loan && <LoanCard loan={data.loan} />}

      {csnMissing && <CsnPlan first={first} />}

      <section className="card forecast-table">
        <h3>Månad för månad</h3>
        <p className="hint">Tryck på en månad för att se detaljer eller ändra inkomsten.</p>
        <div className="table-head" aria-hidden="true">
          <span>Månad</span>
          <span>Över</span>
          {data.loan && <span>Lån kvar</span>}
          <span>Sparat</span>
        </div>
        <ul>
          {result.months.map((m, i) => (
            <li key={m.month}>
              <button
                type="button"
                className={open === m.month ? 'row month-row open' : 'row month-row'}
                aria-expanded={open === m.month}
                onClick={() => setOpen(open === m.month ? null : m.month)}
              >
                <span className="m">{shortMonth(m.month)}</span>
                <span className={m.left < 0 ? 'negative' : undefined}>{kr(m.left)}</span>
                {data.loan && <span>{m.loanLeft > 0 ? kr(m.loanLeft) : 'Betalt'}</span>}
                <span>{kr(m.savings)}</span>
              </button>
              {open === m.month && (
                <MonthDetails
                  month={m}
                  income={data.incomes[i]}
                  own={data.ownIncome.has(m.month)}
                  hasLoan={!!data.loan}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function MonthDetails({
  month,
  income,
  own,
  hasLoan,
}: {
  month: ForecastResult['months'][number];
  income: MonthlyIncome;
  own: boolean;
  hasLoan: boolean;
}) {
  const [csn, setCsn] = useState(toInputKr(income.csn));
  const [other, setOther] = useState(toInputKr(income.other));
  const [saved, setSaved] = useState(false);
  const csnAmount = parseKr(csn);
  const otherAmount = parseKr(other);
  const valid = [csnAmount, otherAmount].every((n) => Number.isFinite(n) && n >= 0);

  return (
    <div className="month-details">
      <dl>
        <div>
          <dt>Inkomster</dt>
          <dd>{kr(month.income)}</dd>
        </div>
        <div>
          <dt>Kostnader</dt>
          <dd>− {kr(month.costs)}</dd>
        </div>
        {month.plannedSavings > 0 && (
          <div>
            <dt>Planerat sparande</dt>
            <dd>{kr(month.plannedSavings)}</dd>
          </div>
        )}
        {month.freed > 0 && (
          <div>
            <dt>Frigjort när lånet är betalt</dt>
            <dd>+ {kr(month.freed)}</dd>
          </div>
        )}
        {hasLoan && month.extraToLoan > 0 && (
          <div>
            <dt>Extra på lånet</dt>
            <dd>{kr(month.extraToLoan)}</dd>
          </div>
        )}
        {hasLoan && month.interest > 0 && (
          <div>
            <dt>Varav ränta (ingår i kostnaden)</dt>
            <dd>{kr(month.interest)}</dd>
          </div>
        )}
      </dl>
      <form
        className="category-form compact"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          await saveIncome({ month: month.month, csn: csnAmount, other: otherAmount });
          setSaved(true);
        }}
      >
        <p className="hint">
          Inkomst {monthName(month.month)}
          {own ? '' : ' (samma som månaden innan än så länge)'}. Ändrar du här gäller det bara {monthName(month.month)}.
        </p>
        <div className="two">
          <label>
            CSN (kr)
            <input
              value={csn}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => {
                setCsn(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label>
            RZ Zampart (kr)
            <input
              value={other}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => {
                setOther(e.target.value);
                setSaved(false);
              }}
            />
          </label>
        </div>
        {!valid && <p className="error">Skriv belopp, till exempel 18404.</p>}
        <div className="actions">
          <button type="submit" className="primary" disabled={!valid}>
            Spara inkomsten
          </button>
          {saved && (
            <span className="saved" role="status">
              Sparad
            </span>
          )}
        </div>
        <p className="hint small">Kostnaderna ändrar du under Budget med månadsväljaren.</p>
      </form>
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    balance: toInputKr(loan.balance),
    rate: String(loan.annualRate).replace('.', ','),
    payment: toInputKr(loan.monthlyPayment),
    amortization: toInputKr(loan.amortization),
  });
  const values = {
    balance: parseKr(form.balance),
    rate: parseKr(form.rate),
    payment: parseKr(form.payment),
    amortization: parseKr(form.amortization),
  };
  const valid = Object.values(values).every((n) => Number.isFinite(n) && n >= 0) && values.rate < 50;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await saveLoan({
      ...loan,
      balance: values.balance,
      annualRate: values.rate,
      monthlyPayment: values.payment,
      amortization: values.amortization,
      startMonth: shiftMonth(currentMonth(), 1),
    });
    setEditing(false);
  }

  const field = (key: keyof typeof form, label: string) => (
    <label>
      {label}
      <input
        value={form[key]}
        inputMode="decimal"
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <section className="card loan-card">
      <h3>
        {loan.name} <span>{kr(loan.balance)} kvar</span>
      </h3>
      {editing ? (
        <form className="category-form" onSubmit={save}>
          <div className="two">
            {field('balance', 'Kvar att betala (kr)')}
            {field('rate', 'Ränta per år (%)')}
            {field('payment', 'Kostar per månad (kr)')}
            {field('amortization', 'Varav amortering (kr)')}
          </div>
          <p className="hint small">Kvar att betala gäller från {monthName(shiftMonth(currentMonth(), 1))}.</p>
          {!valid && <p className="error">Skriv belopp, till exempel 100000 eller 10,5.</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={!valid}>
              Spara
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Avbryt
            </button>
          </div>
        </form>
      ) : (
        <div className="loan-body">
          <p>
            {kr(loan.monthlyPayment)} i månaden, varav {kr(loan.amortization)} amortering. Ränta {String(loan.annualRate).replace('.', ',')} %.
          </p>
          <label className="switch">
            <input
              type="checkbox"
              checked={loan.payExtra}
              onChange={(e) => saveLoan({ ...loan, payExtra: e.target.checked })}
            />
            <span>
              <b>Lägg det som blir över på lånet</b>
              Tills det är betalt, sedan går allt till sparande.
            </span>
          </label>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Ändra lånet
          </button>
        </div>
      )}
    </section>
  );
}

/** Lägger in CSN-utbetalningarna från csn.se på rätt månader, med ett tryck. */
function CsnPlan({ first }: { first: string }) {
  const [busy, setBusy] = useState(false);
  async function apply() {
    setBusy(true);
    for (const p of CSN_PLAN) {
      if (p.month < first) continue;
      const income = await getIncome(p.month);
      await saveIncome({ month: p.month, csn: p.csn, other: income.other }, true);
    }
    setBusy(false);
  }
  return (
    <section className="card csn-plan">
      <h3>CSN framåt</h3>
      <div className="category-form">
        <p className="hint">
          Lägg in utbetalningarna från csn.se: 18 280 kr i december, 13 653 kr i januari (kommer 11/1), 18 404 kr
          februari–maj, 9 202 kr i juni och inget CSN från juli. RZ Zampart ändras inte.
        </p>
        <button type="button" className="primary" disabled={busy} onClick={apply}>
          Lägg in CSN-planen
        </button>
      </div>
    </section>
  );
}

/** Sparandet och lånet över tid. */
function Chart({ result, goal }: { result: ForecastResult; goal: number }) {
  const months = result.months;
  if (months.length < 2) return null;
  const W = 340;
  const H = 170;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const values = months.flatMap((m) => [m.savings, m.loanLeft]);
  const max = Math.max(...values, goal > 0 && goal < Math.max(...values) * 1.6 ? goal : 0, 1);
  const min = Math.min(0, ...values);
  const x = (i: number) => pad.l + (i / (months.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = (get: (m: (typeof months)[number]) => number) =>
    months.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(m)).toFixed(1)}`).join('');
  const hasLoan = months.some((m) => m.loanLeft > 0);
  const lastI = months.length - 1;
  const yearTicks = months.map((m, i) => ({ m, i })).filter(({ m }) => m.month.endsWith('-01'));

  return (
    <figure className="card forecast-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sparande och lån över tid">
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="axis" />
        {goal > 0 && goal <= max && (
          <>
            <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} className="goal-line" />
            <text x={W - pad.r} y={y(goal) - 4} textAnchor="end" className="lbl">
              Mål {kr(goal)}
            </text>
          </>
        )}
        {yearTicks.map(({ m, i }) => (
          <text key={m.month} x={x(i)} y={H - 6} textAnchor="middle" className="lbl">
            {m.month.slice(0, 4)}
          </text>
        ))}
        {hasLoan && <path d={path((m) => m.loanLeft)} className="loan-line" />}
        <path d={path((m) => m.savings)} className="save-line" />
        <circle cx={x(lastI)} cy={y(months[lastI].savings)} r="3.5" className="save-dot" />
      </svg>
      <figcaption>
        <span className="key save">Sparat</span>
        {hasLoan && <span className="key loan">Kvar på lånet</span>}
      </figcaption>
    </figure>
  );
}

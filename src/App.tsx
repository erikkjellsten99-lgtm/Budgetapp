import { useEffect, useState } from 'react';
import Assets from './Assets';
import Categories, { sumBudgets } from './Categories';
import { currentMonth, getCategories, getIncome } from './db';
import Debts from './Debts';
import Goal, { goalCurrent, goalStatus, project } from './Goal';
import Income from './Income';
import { formatKr } from './money';
import type { Asset, Category, MonthlyIncome, SavingsGoal } from './types';

type View = 'overview' | 'goal' | 'budget' | 'assets' | 'debts';

/** Flikarna i menyn. Kort namn används i mobilens bottenmeny. */
const VIEWS: { id: View; label: string; short: string; icon: string }[] = [
  // Ikonerna är enkla linjer i ett 24×24-rutnät (SVG-sökvägar), ritade för appen.
  { id: 'overview', label: 'Översikt', short: 'Översikt', icon: 'M4 11l8-7 8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5' },
  { id: 'goal', label: 'Sparmål', short: 'Sparmål', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01' },
  { id: 'budget', label: 'Inkomst & kategorier', short: 'Budget', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'assets', label: 'Tillgångar', short: 'Konton', icon: 'M3 7.5h18v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5zM3 7.5l2-3.5h14l2 3.5M16 14h2' },
  { id: 'debts', label: 'Skulder', short: 'Skulder', icon: 'M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h4' },
];

/** Senast öppnade flik, så att appen öppnas där du var. */
function savedView(): View {
  try {
    const saved = localStorage.getItem('view');
    if (VIEWS.some((item) => item.id === saved)) return saved as View;
  } catch {
    // Lagring kan vara avstängd, då börjar appen på översikten.
  }
  return 'overview';
}

export default function App() {
  const [view, setView] = useState<View>(savedView);
  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  function showView(next: View) {
    setView(next);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem('view', next);
    } catch {
      // Inget att göra, fliken sparas bara inte.
    }
  }

  const [categories, setCategories] = useState<Category[]>([]);
  const [debtTotal, setDebtTotal] = useState(0);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [income, setIncome] = useState<MonthlyIncome>({ month: currentMonth(), csn: 0, other: 0 });

  async function reload() {
    setCategories(await getCategories());
    setIncome(await getIncome(currentMonth()));
  }

  useEffect(() => {
    reload();
  }, []);

  const totalIncome = income.csn + income.other;
  const costs = sumBudgets(categories.filter((category) => category.type !== 'savings'));
  const plannedSavings = sumBudgets(categories.filter((category) => category.type === 'savings'));
  const leftForSavings = totalIncome - costs - debtTotal - plannedSavings;
  // Nettovärdet är det som finns på sparkontona. Pengar att använda (hushållskontot) räknas inte,
  // och skulderna betalas med månadens inkomst, så de är redan avdragna i översikten.
  const sumAmounts = (list: Asset[]) => list.reduce((sum, asset) => sum + asset.amount, 0);
  const netWorth = sumAmounts(assets.filter((asset) => !asset.spending));
  const spendingTotal = sumAmounts(assets.filter((asset) => asset.spending));

  const goalNow = goal ? goalCurrent(goal, assets) : 0;
  const goalPercent = goal && goal.target > 0 ? Math.min(100, Math.round((goalNow / goal.target) * 100)) : 0;
  const month = new Date().toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Budget</h1>
        <nav className="app-nav" aria-label="Huvudmeny">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === view ? 'nav-item active' : 'nav-item'}
              aria-current={item.id === view ? 'page' : undefined}
              onClick={() => showView(item.id)}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              <span className="nav-label">{item.label}</span>
              <span className="nav-short-label">{item.short}</span>
            </button>
          ))}
        </nav>
      </header>
      <main>
        {/* Alla vyer ligger kvar i bakgrunden, så att summorna (t.ex. skulder) alltid är uppdaterade. */}
        <div hidden={view !== 'overview'}>
          <div className="view-intro">
            <p className="eyebrow">{month.toUpperCase()}</p>
            <h2>Översikt</h2>
          </div>
          <section className={leftForSavings < 0 ? 'card balance-hero negative' : 'card balance-hero'}>
            <p className="hero-label">Kvar att sätta in på sparande</p>
            <strong className="hero-amount">{formatKr(leftForSavings)}</strong>
            <p className="hero-period">Efter kostnader, skulder och planerat sparande i {month}</p>
          </section>
          <div className="overview-grid">
            <section className="card summary overview-breakdown">
              <h3>Månadens budget</h3>
              <p>
                <span>Inkomster</span>
                <span>{formatKr(totalIncome)}</span>
              </p>
              <p>
                <span>Kostnader</span>
                <span>− {formatKr(costs)}</span>
              </p>
              <p>
                <span>Skulder</span>
                <span>− {formatKr(debtTotal)}</span>
              </p>
              <p>
                <span>Planerat sparande</span>
                <span>− {formatKr(plannedSavings)}</span>
              </p>
            </section>
            <section className="card summary net-worth-card">
              <h3>Nettovärde (sparkonton)</h3>
              <strong className={netWorth < 0 ? 'net-worth negative' : 'net-worth'}>{formatKr(netWorth)}</strong>
              {spendingTotal > 0 && (
                <p className="net-worth-detail">
                  <span>Pengar att använda (räknas inte)</span>
                  <span>{formatKr(spendingTotal)}</span>
                </p>
              )}
              <p className="note">Skulderna betalas med månadens inkomst och är redan avdragna i budgeten.</p>
            </section>
          </div>
          {goal && (
            <button type="button" className="card goal-summary" onClick={() => showView('goal')}>
              <span className="goal-summary-head">
                <span>{goal.name}</span>
                <span aria-hidden="true">›</span>
              </span>
              <span className="goal-summary-amount">
                <strong>{formatKr(goalNow)}</strong> av {formatKr(goal.target)} · {goalPercent} %
              </span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${goalPercent}%` }} />
              </span>
              <span className="goal-summary-status">{goalStatus(project(goalNow, goal).reachedAt)}</span>
            </button>
          )}
        </div>
        <div hidden={view !== 'goal'}>
          <Goal assets={assets} onChange={setGoal} />
        </div>
        <div hidden={view !== 'budget'}>
          <Income income={income} onChanged={reload} />
          <Categories categories={categories} onChanged={reload} />
        </div>
        <div hidden={view !== 'assets'}>
          <Assets onChange={setAssets} />
        </div>
        <div hidden={view !== 'debts'}>
          <Debts onTotalChange={setDebtTotal} />
        </div>
      </main>
    </div>
  );
}

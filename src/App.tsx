import { useEffect, useState } from 'react';
import Assets from './Assets';
import Categories, { sumBudgets } from './Categories';
import Account from './Account';
import {
  budgetMonth,
  currentMonth,
  getBudget,
  getIncome,
  getWishes,
  monthName,
  onDataChange,
  setBudgetMonth,
  shiftMonth,
} from './db';
import Wishlist, { sumCheckedWishes } from './Wishlist';
import { getSyncState, onSyncState, type SyncState } from './sync';
import Goal, { goalCurrent, goalStatus, project } from './Goal';
import Income from './Income';
import { formatKr } from './money';
import type { Asset, Category, MonthlyIncome, SavingsGoal, Wish } from './types';

type View = 'overview' | 'goal' | 'budget' | 'wishlist' | 'assets' | 'account';

/** Flikarna i menyn. Kort namn används i mobilens bottenmeny. */
const VIEWS: { id: View; label: string; short: string; icon: string }[] = [
  // Ikonerna är enkla linjer i ett 24×24-rutnät (SVG-sökvägar), ritade för appen.
  { id: 'overview', label: 'Översikt', short: 'Översikt', icon: 'M4 11l8-7 8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5' },
  { id: 'budget', label: 'Inkomster & utgifter', short: 'Budget', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'goal', label: 'Sparmål', short: 'Sparmål', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01' },
  { id: 'wishlist', label: 'Önskelista', short: 'Önskelista', icon: 'M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z' },
  { id: 'assets', label: 'Tillgångar', short: 'Konton', icon: 'M3 7.5h18v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5zM3 7.5l2-3.5h14l2 3.5M16 14h2' },
];

/** Senast öppnade flik, så att appen öppnas där du var. */
function savedView(): View {
  try {
    const saved = localStorage.getItem('view');
    if (saved === 'account' || VIEWS.some((item) => item.id === saved)) return saved as View;
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
  // Månaden budgeten är sparad på (se getBudget). Visar om vald månad har en egen budget.
  const [budgetFrom, setBudgetFrom] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [income, setIncome] = useState<MonthlyIncome>({ month: budgetMonth(), csn: 0, other: 0 });
  const [selectedMonth, setSelectedMonth] = useState(budgetMonth);
  const [wishes, setWishes] = useState<Wish[]>([]);

  async function reload() {
    const budget = await getBudget(budgetMonth());
    setCategories(budget.categories);
    setBudgetFrom(budget.from);
    setWishes(await getWishes());
    setIncome(await getIncome(budgetMonth()));
  }

  /** Bläddrar budgeten en månad bakåt eller framåt, eller tillbaka till innevarande (steps = 0). */
  function changeMonth(steps: number) {
    const next = steps === 0 ? currentMonth() : shiftMonth(budgetMonth(), steps);
    setBudgetMonth(next);
    setSelectedMonth(next);
    reload();
  }

  useEffect(() => {
    reload();
    return onDataChange((kind) => kind === 'remote' && reload());
  }, []);

  const [sync, setSync] = useState<SyncState>(getSyncState);
  useEffect(() => onSyncState(setSync), []);

  const totalIncome = income.csn + income.other;
  // Det som är ikryssat på önskelistan denna månad räknas in i rörliga utgifter.
  const wishTotal = sumCheckedWishes(wishes);
  const costs = sumBudgets(categories.filter((category) => category.type !== 'savings')) + wishTotal;
  const plannedSavings = sumBudgets(categories.filter((category) => category.type === 'savings'));
  const leftForSavings = totalIncome - costs - plannedSavings;
  // Nettovärdet är det som finns på sparkontona. Pengar att använda (hushållskontot) räknas inte.
  const sumAmounts = (list: Asset[]) => list.reduce((sum, asset) => sum + asset.amount, 0);
  const netWorth = sumAmounts(assets.filter((asset) => !asset.spending));
  const spendingTotal = sumAmounts(assets.filter((asset) => asset.spending));

  const goalNow = goal ? goalCurrent(goal, assets) : 0;
  const goalPercent = goal && goal.target > 0 ? Math.min(100, Math.round((goalNow / goal.target) * 100)) : 0;
  const month = monthName(selectedMonth);

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
        <button
          type="button"
          className={view === 'account' ? 'account-button active' : 'account-button'}
          onClick={() => showView('account')}
          aria-label={`Konto och synk: ${sync.status}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
          <span className={`sync-dot ${sync.status}`} aria-hidden="true" />
        </button>
      </header>
      <main>
        {/* Alla vyer ligger kvar i bakgrunden, så att summorna (t.ex. tillgångar) alltid är uppdaterade. */}
        <div hidden={view !== 'overview'}>
          <div className="view-intro">
            <MonthPicker month={selectedMonth} onChange={changeMonth} />
            <h2>Översikt</h2>
          </div>
          <section className={leftForSavings < 0 ? 'card balance-hero negative' : 'card balance-hero'}>
            <p className="hero-label">Kvar att sätta in på sparande</p>
            <strong className="hero-amount">{formatKr(leftForSavings)}</strong>
            <p className="hero-period">Efter utgifter och planerat sparande i {month}</p>
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
          <div className="view-intro">
            <MonthPicker month={selectedMonth} onChange={changeMonth} />
            <h2>Inkomster & utgifter</h2>
          </div>
          <BudgetSource month={selectedMonth} from={budgetFrom} />
          <Income income={income} onChanged={reload} />
          <Categories
            key={selectedMonth}
            categories={categories}
            onChanged={reload}
            income={totalIncome}
            wishTotal={wishTotal}
            onOpenWishlist={() => showView('wishlist')}
          />
        </div>
        <div hidden={view !== 'wishlist'}>
          <Wishlist wishes={wishes} onChanged={reload} />
        </div>
        <div hidden={view !== 'assets'}>
          <Assets onChange={setAssets} />
        </div>
        <div hidden={view !== 'account'}>
          <Account sync={sync} />
        </div>
      </main>
    </div>
  );
}

/** Bläddra mellan månader: ‹ DECEMBER 2026 ›. steps = 0 går tillbaka till innevarande månad. */
function MonthPicker({ month, onChange }: { month: string; onChange: (steps: number) => void }) {
  return (
    <div className="month-picker" role="group" aria-label="Budgetmånad">
      <button type="button" className="month-step" onClick={() => onChange(-1)} aria-label="Föregående månad">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 6l-6 6 6 6" />
        </svg>
      </button>
      <p className="eyebrow month-name" aria-live="polite">
        {monthName(month).toUpperCase()}
      </p>
      <button type="button" className="month-step" onClick={() => onChange(1)} aria-label="Nästa månad">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.5 6l6 6-6 6" />
        </svg>
      </button>
      {month !== currentMonth() && (
        <button type="button" className="month-today" onClick={() => onChange(0)}>
          Denna månad
        </button>
      )}
    </div>
  );
}

/** Visar om månaden har en egen budget eller utgår från en tidigare månad. */
function BudgetSource({ month, from }: { month: string; from: string | null }) {
  const name = monthName(month);
  const own = from === month;
  return (
    <p className={own ? 'budget-source own' : 'budget-source'}>
      <strong>{own ? `Egen budget för ${name}` : from ? `Samma som ${monthName(from)}` : 'Samma som tidigare månader'}</strong>
      <span>
        {own
          ? 'Tidigare månader påverkas inte av ändringar här. Senare månader utan egna ändringar följer med.'
          : `Ändrar du något får ${name} en egen budget, och ${from ? monthName(from) : 'tidigare månader'} påverkas inte.`}
      </span>
    </p>
  );
}

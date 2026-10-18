import { useEffect, useState } from 'react';
import Assets from './Assets';
import Categories, { sumBudgets } from './Categories';
import { currentMonth, getCategories, getIncome } from './db';
import Debts from './Debts';
import Goal from './Goal';
import Income from './Income';
import { formatKr } from './money';
import type { Asset, Category, MonthlyIncome } from './types';

type View = 'overview' | 'goal' | 'budget' | 'assets' | 'debts';

/** Flikarna i menyn. Kort namn används i mobilens bottenmeny. */
const VIEWS: { id: View; label: string; short: string }[] = [
  { id: 'overview', label: 'Översikt', short: 'Översikt' },
  { id: 'goal', label: 'Sparmål', short: 'Sparmål' },
  { id: 'budget', label: 'Inkomst & kategorier', short: 'Budget' },
  { id: 'assets', label: 'Tillgångar', short: 'Konton' },
  { id: 'debts', label: 'Skulder', short: 'Skulder' },
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
              <p className="eyebrow">NETTOVÄRDE (SPARKONTON)</p>
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
          {VIEWS.filter((item) => item.id !== 'overview').map((item) => (
            <button key={item.id} type="button" className="overview-link" onClick={() => showView(item.id)}>
              {item.label}
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <div hidden={view !== 'goal'}>
          <Goal assets={assets} />
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

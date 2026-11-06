import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Assets from './Assets';
import Categories, { sumBudgets } from './Categories';
import Account from './Account';
import ThemePicker from './ThemePicker';
import UndoToast from './UndoToast';
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
import Goal, { goalCurrent } from './Goal';
import { goalStatus, planGoal } from './goalPlan';
import { useGoalData } from './useGoalPlan';
import { useLoanSplit } from './useLoanSplit';
import Forecast from './Forecast';
import Income from './Income';
// Vanor (med galaxen) och Nyheter laddas först när fliken öppnas, så att appen startar snabbare.
const Vanor = lazy(() => import('./vanor/Vanor'));
import Today from './Today';
import JarvisView from './Jarvis';
const Nyheter = lazy(() => import('./Nyheter'));
import { formatKr } from './money';
import type { Asset, Category, MonthlyIncome, SavingsGoal, Wish } from './types';

type View = 'idag' | 'jarvis' | 'nyheter' | 'overview' | 'vanor' | 'goal' | 'budget' | 'wishlist' | 'assets' | 'account';
type Section = 'idag' | 'jarvis' | 'ekonomi' | 'vanor' | 'nyheter';
type EconomyView = 'overview' | 'budget' | 'goal' | 'assets' | 'wishlist';

/**
 * Huvudflikarna. Ekonomi är en flik med egna underflikar, så att fler huvudflikar
 * får plats i menyn. Ikonerna är enkla linjer i ett 24×24-rutnät.
 */
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'idag', label: 'Idag', icon: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'jarvis', label: 'Jarvis', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5' },
  { id: 'ekonomi', label: 'Ekonomi', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'vanor', label: 'Vanor', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.2l2.7 2.6L16.2 9.4' },
  { id: 'nyheter', label: 'Nyheter', icon: 'M5 4h11v15a1 1 0 0 0 2 0V8h2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM8 8h5M8 12h5M8 16h3' },
];

/** Underflikarna i Ekonomi. */
const ECONOMY: { id: EconomyView; label: string }[] = [
  { id: 'overview', label: 'Översikt' },
  { id: 'budget', label: 'Budget' },
  { id: 'goal', label: 'Prognos' },
  { id: 'assets', label: 'Konton' },
  { id: 'wishlist', label: 'Önskelista' },
];

const isEconomy = (view: View): view is EconomyView => ECONOMY.some((item) => item.id === view);
const sectionOf = (view: View): Section | null => (view === 'idag' || view === 'jarvis' || view === 'vanor' || view === 'nyheter' ? view : isEconomy(view) ? 'ekonomi' : null);

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Lagring kan vara avstängd, då kommer appen bara inte ihåg fliken.
  }
}

/** Senast öppnade flik, så att appen öppnas där du var. Första gången: Idag. */
function savedView(): View {
  const saved = readStorage('view');
  if (saved === 'traning') return 'vanor'; // Träning fanns en tid som egen flik.
  if (saved === 'account' || saved === 'idag' || saved === 'jarvis' || saved === 'vanor' || saved === 'nyheter' || (saved && isEconomy(saved as View))) return saved as View;
  return 'idag';
}

/** Senaste underfliken i Ekonomi, så att Ekonomi öppnas där du var. */
function savedEconomy(): EconomyView {
  const saved = readStorage('ekonomi-flik') as View | null;
  return saved && isEconomy(saved) ? saved : 'overview';
}

export default function App() {
  const [view, setView] = useState<View>(savedView);
  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  const [economyView, setEconomyView] = useState<EconomyView>(savedEconomy);
  const section = sectionOf(view);
  // Flikar som öppnats en gång stannar kvar i bakgrunden, så att de är redo nästa gång.
  const [visited, setVisited] = useState<Set<View>>(() => new Set([savedView()]));
  useEffect(() => {
    setVisited((prev) => (prev.has(view) ? prev : new Set(prev).add(view)));
  }, [view]);

  function showView(next: View) {
    setView(next);
    window.scrollTo(0, 0);
    writeStorage('view', next);
    if (isEconomy(next)) {
      setEconomyView(next);
      writeStorage('ekonomi-flik', next);
    }
  }

  // Håll vald underflik synlig när raden inte får plats på smal skärm.
  const subNav = useRef<HTMLElement>(null);
  useEffect(() => {
    subNav.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [view, section]);

  function showSection(next: Section) {
    showView(next === 'ekonomi' ? economyView : next);
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
  const goalData = useGoalData(goal);
  const goalPlan = goal && goalData ? planGoal(goalNow, goal.target, goal.annualReturn, goalData.rows) : null;
  const goalPercent = goal && goal.target > 0 ? Math.min(100, Math.round((goalNow / goal.target) * 100)) : 0;
  const month = monthName(selectedMonth);
  // Går det som blir över extra till billånet (Prognos → Extra på lånet) visas hur det delas.
  // Samma uträkning som Prognos, och bara när det finns något över att dela.
  const split = useLoanSplit(selectedMonth);
  const toLoan = split && leftForSavings > 0 ? Math.min(split.extra, leftForSavings) : 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Groundwork</h1>
        <nav className="app-nav" aria-label="Huvudmeny">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === section ? 'nav-item active' : 'nav-item'}
              aria-current={item.id === section ? 'page' : undefined}
              title={item.label}
              onClick={() => showSection(item.id)}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              <span className="nav-short-label">{item.label}</span>
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
        {section === 'ekonomi' && (
          <nav className="sub-nav" aria-label="Ekonomi" ref={subNav}>
            {ECONOMY.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === view ? 'sub-nav-item active' : 'sub-nav-item'}
                aria-current={item.id === view ? 'page' : undefined}
                onClick={() => showView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
        {/* Alla vyer ligger kvar i bakgrunden, så att summorna (t.ex. tillgångar) alltid är uppdaterade. */}
        <div hidden={view !== 'idag'}>
          <Today active={view === 'idag'} onOpen={showView} />
        </div>
        <div hidden={view !== 'overview'}>
          <div className="view-intro">
            <MonthPicker month={selectedMonth} onChange={changeMonth} />
            <h2>Översikt</h2>
          </div>
          <section className={leftForSavings < 0 ? 'card balance-hero negative' : 'card balance-hero'}>
            <p className="hero-label">{toLoan > 0 ? 'Blir över' : 'Kvar att sätta in på sparande'}</p>
            <strong className="hero-amount">{formatKr(leftForSavings)}</strong>
            {toLoan > 0 && split && (
              <dl className="hero-split">
                <div>
                  <dt>Extra på lånet ({split.loanName})</dt>
                  <dd>{formatKr(Math.round(toLoan))}</dd>
                </div>
                <div>
                  <dt>Till sparande</dt>
                  {/* Så att de två raderna alltid blir summan ovanför, även efter avrundning. */}
                  <dd>{formatKr(Math.round(leftForSavings) - Math.round(toLoan))}</dd>
                </div>
              </dl>
            )}
            <p className="hero-period">
              Efter utgifter och planerat sparande i {month}
              {toLoan > 0 && ', enligt Prognos → Extra på lånet'}
            </p>
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
              {goalPlan && <span className="goal-summary-status">{goalStatus(goalPlan)}</span>}
            </button>
          )}
        </div>
        <div hidden={view !== 'jarvis'}>
          <JarvisView active={view === 'jarvis'} />
        </div>
        <div hidden={view !== 'nyheter'}>
          {visited.has('nyheter') && (
            <Suspense fallback={<ViewLoading />}>
              <Nyheter active={view === 'nyheter'} />
            </Suspense>
          )}
        </div>
        <div hidden={view !== 'vanor'}>
          <div className="vanor-column">
            {visited.has('vanor') && (
              <Suspense fallback={<ViewLoading />}>
                <Vanor />
              </Suspense>
            )}
          </div>
        </div>
        <div hidden={view !== 'goal'}>
          <Forecast />
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
          <div className="card">
            <ThemePicker />
          </div>
        </div>
      </main>
      <UndoToast />
    </div>
  );
}

/** Visas de första tiondelarna medan en flik laddas. */
function ViewLoading() {
  return (
    <div className="view-loading" aria-busy="true" aria-label="Laddar">
      <div className="card today-skeleton" />
      <div className="card today-skeleton" />
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
      <strong>{own ? `Budget för ${name}` : from ? `Samma som ${monthName(from)} än så länge` : 'Samma som tidigare månader än så länge'}</strong>
      <span>
        {own
          ? `Ändringar här gäller bara ${name}. Andra månader påverkas inte.`
          : `Utgår från ${from ? monthName(from) : 'tidigare månader'}. Ändrar du något gäller det bara ${name}.`}
      </span>
    </p>
  );
}

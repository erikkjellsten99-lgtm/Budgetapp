import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Assets from './Assets';
import Investments from './Investments';
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
// Jarvis bor i specialrummet och laddas först när rummet öppnas (med rummets typsnitt).
const JarvisView = lazy(lazyWithReload(() => import('./Jarvis'), 'jarvis', JarvisUnavailable));
import JarvisOrb from './JarvisOrb';
import { lazyWithReload } from './lazyWithReload';
import Room from './Room';
import { ECONOMY_TABS, isEconomy, restoreView, SECTIONS, sectionOf, tabOf, type EconomyView, type Section, type View } from './nav';
const Nyheter = lazy(() => import('./Nyheter'));
import { formatKr, formatPct } from './money';
import { usePortfolio } from './usePortfolio';
import { missingValues, totals, withHoldingValues } from '../supabase/functions/inbox/portfolio.ts';
import type { Asset, Category, MonthlyIncome, SavingsGoal, Wish } from './types';

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
const savedView = (): View => restoreView(readStorage('view'));

/** Senaste underfliken i Ekonomi, så att Ekonomi öppnas där du var. */
function savedEconomy(): EconomyView {
  const saved = readStorage('ekonomi-flik');
  return saved && isEconomy(saved) ? saved : 'overview';
}

export default function App() {
  const [view, setView] = useState<View>(savedView);
  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  const [economyView, setEconomyView] = useState<EconomyView>(savedEconomy);
  // Specialrummet med Jarvis. Orben öppnar, Tillbaka och Escape stänger, fokus går tillbaka till orben.
  const [roomOpen, setRoomOpen] = useState(false);
  const orb = useRef<HTMLButtonElement>(null);
  const openRoom = useCallback(() => setRoomOpen(true), []);
  const closeRoom = useCallback(() => {
    setRoomOpen(false);
    requestAnimationFrame(() => orb.current?.focus());
  }, []);
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

  function showSection(next: Section) {
    showView(next === 'ekonomi' ? economyView : next);
  }

  const [categories, setCategories] = useState<Category[]>([]);
  // Månaden budgeten är sparad på (se getBudget). Visar om vald månad har en egen budget.
  const [budgetFrom, setBudgetFrom] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const portfolio = usePortfolio();
  // Konton som räknas från innehaven får värdet härifrån. Övriga är exakt som de sparats.
  const portfolioTotals = useMemo(() => totals(portfolio.rows), [portfolio.rows]);
  const valuedAssets = useMemo(() => withHoldingValues(assets, portfolio.rows), [assets, portfolio.rows]);
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
  const netWorth = sumAmounts(valuedAssets.filter((asset) => !asset.spending));
  const spendingTotal = sumAmounts(valuedAssets.filter((asset) => asset.spending));

  // Innehav utan kurs räknas som 0 i kontots värde, så det ska synas.
  const missingTotal = assets
    .filter((asset) => asset.fromHoldings && !asset.spending)
    .reduce((sum, asset) => sum + missingValues(asset, portfolio.rows), 0);

  const goalNow = goal ? goalCurrent(goal, valuedAssets) : 0;
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
        <JarvisOrb ref={orb} onOpen={openRoom} />
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
          <nav className="segmented-row economy-tabs" aria-label="Ekonomi">
            {ECONOMY_TABS.map((item) => {
              const active = isEconomy(view) && tabOf(view) === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={active ? 'seg active' : 'seg'}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => showView(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
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
          <section className="hero" aria-label="Kvar efter utgifter och sparande">
            <p className="hero-label">{toLoan > 0 ? 'Blir över' : 'Kvar att sätta in på sparande'}</p>
            <strong className={leftForSavings < 0 ? 'hero-amount negative' : 'hero-amount positive'}>{formatKr(leftForSavings)}</strong>
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
            <p className="hero-text">
              Efter utgifter och planerat sparande i {month}
              {toLoan > 0 && ', enligt Prognos → Extra på lånet'}
            </p>
          </section>

          <section className="group-block" aria-labelledby="overview-budget">
            <h3 className="group-title" id="overview-budget">
              Månadens budget
            </h3>
            <div className="group">
              <p className="group-row">
                <span className="row-name">Inkomster</span>
                <span className="row-value">{formatKr(totalIncome)}</span>
              </p>
              <p className="group-row">
                <span className="row-name">Kostnader</span>
                <span className="row-value">− {formatKr(costs)}</span>
              </p>
              <p className="group-row">
                <span className="row-name">Planerat sparande</span>
                <span className="row-value">− {formatKr(plannedSavings)}</span>
              </p>
            </div>
          </section>

          <section className="group-block" aria-labelledby="overview-networth">
            <h3 className="group-title" id="overview-networth">
              Nettovärde
            </h3>
            <div className="group">
              <button type="button" className="group-row" onClick={() => showView('assets')}>
                <span className="row-main">
                  <span className="row-name">Konton</span>
                  <span className="row-sub">
                    {missingTotal > 0
                      ? `Det som finns på sparkontona, värde saknas för ${missingTotal} innehav`
                      : 'Det som finns på sparkontona'}
                  </span>
                </span>
                <span className={netWorth < 0 ? 'row-value negative' : 'row-value'}>{formatKr(netWorth)}</span>
              </button>
              {!portfolio.loaded ? null : portfolio.holdings.length === 0 ? (
                <button type="button" className="group-row" onClick={() => showView('investments')}>
                  <span className="row-name">Lägg in investeringar</span>
                </button>
              ) : (
                <button type="button" className="group-row" onClick={() => showView('investments')}>
                  <span className="row-main">
                    <span className="row-name">Investeringar</span>
                    <span className="row-sub">
                      {portfolioTotals.value === null
                        ? 'Värde saknas'
                        : portfolioTotals.changePct !== null &&
                          `Utveckling ${formatPct(portfolioTotals.changePct)}${
                            portfolioTotals.missing > 0 ? `, värde saknas för ${portfolioTotals.missing} innehav` : ''
                          }`}
                    </span>
                  </span>
                  {portfolioTotals.value !== null && <span className="row-value">{formatKr(portfolioTotals.value)}</span>}
                </button>
              )}
              {spendingTotal > 0 && (
                <p className="group-row">
                  <span className="row-main">
                    <span className="row-name">Pengar att använda</span>
                    <span className="row-sub">Räknas inte i nettovärdet</span>
                  </span>
                  <span className="row-value">{formatKr(spendingTotal)}</span>
                </p>
              )}
            </div>
          </section>

          <section className="group-block" aria-label="Sparmål och önskelista">
            <div className="group">
              {goal && (
                <button type="button" className="group-row" onClick={() => showView('goal')}>
                  <span className="row-main">
                    <span className="row-name">{goal.name}</span>
                    <span className="row-sub">
                      {formatKr(goalNow)} av {formatKr(goal.target)}
                    </span>
                    <span className="bar" aria-hidden="true">
                      <span style={{ width: `${goalPercent}%` }} />
                    </span>
                    {goalPlan && <span className="row-sub">{goalStatus(goalPlan)}</span>}
                  </span>
                  <span className="row-value">{goalPercent} %</span>
                </button>
              )}
              <button type="button" className="group-row" onClick={() => showView('wishlist')}>
                <span className="row-main">
                  <span className="row-name">Önskelista</span>
                  <span className="row-sub">Det som är ikryssat räknas in i rörliga utgifter</span>
                </span>
                <span className="row-value">{formatKr(wishTotal)}</span>
              </button>
            </div>
          </section>
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
          <Goal assets={valuedAssets} onChange={setGoal} />
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
          <BackToOverview onClick={() => showView('overview')} />
          <Wishlist wishes={wishes} onChanged={reload} />
        </div>
        <div hidden={view !== 'assets'}>
          <BackToOverview onClick={() => showView('overview')} />
          <Assets onChange={setAssets} rows={portfolio.rows} />
        </div>
        <div hidden={view !== 'investments'}>
          <BackToOverview onClick={() => showView('overview')} />
          <Investments
            holdings={portfolio.holdings}
            trades={portfolio.trades}
            prices={portfolio.prices}
            rows={portfolio.rows}
            onOpenHolding={() => {}}
            onAdd={() => {}}
          />
        </div>
        <div hidden={view !== 'account'}>
          <Account sync={sync} />
          <div className="card">
            <ThemePicker />
          </div>
        </div>
      </main>
      <Room open={roomOpen} onClose={closeRoom}>
        <Suspense fallback={null}>
          <JarvisView active={roomOpen} />
        </Suspense>
      </Room>
      <UndoToast />
    </div>
  );
}

/** Visas i rummet när Jarvis-filen inte gick att hämta (ny version publicerad, eller ingen uppkoppling). */
function JarvisUnavailable() {
  return (
    <p className="room-unavailable" role="alert">
      {navigator.onLine
        ? 'Jarvis kunde inte laddas. Stäng appen helt och öppna den igen.'
        : 'Jarvis behöver internet första gången den öppnas.'}
    </p>
  );
}

/** Textknapp överst i Konton och Önskelista, som öppnas från Översikt. */
function BackToOverview({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="back-link" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Översikt
    </button>
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
        {monthName(month).replace(/^./, (c) => c.toUpperCase())}
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

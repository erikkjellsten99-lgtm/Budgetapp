import { useEffect, useState } from 'react';
import Assets from './Assets';
import Categories, { sumBudgets } from './Categories';
import { currentMonth, getCategories, getIncome } from './db';
import Debts from './Debts';
import Goal from './Goal';
import Income from './Income';
import { formatKr } from './money';
import type { Asset, Category, MonthlyIncome } from './types';

export default function App() {
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

  return (
    <>
      <header>
        <h1>Budget</h1>
      </header>
      <main>
        <section className="card summary">
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
          <p className={leftForSavings < 0 ? 'left negative' : 'left'}>
            <span>Kvar att sätta in på sparande</span>
            <strong>{formatKr(leftForSavings)}</strong>
          </p>
        </section>
        <section className="card summary">
          <p className={netWorth < 0 ? 'left negative' : 'left'}>
            <span>Nettovärde (sparkonton)</span>
            <strong>{formatKr(netWorth)}</strong>
          </p>
          {spendingTotal > 0 && (
            <p>
              <span>Pengar att använda (räknas inte)</span>
              <span>{formatKr(spendingTotal)}</span>
            </p>
          )}
          <p className="note">Skulderna betalas med månadens inkomst och är redan avdragna ovan.</p>
        </section>
        <Goal assets={assets} />
        <Income income={income} onChanged={reload} />
        <Categories categories={categories} onChanged={reload} />
        <Assets onChange={setAssets} />
        <Debts onTotalChange={setDebtTotal} />
      </main>
    </>
  );
}

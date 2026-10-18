import { useEffect, useState } from 'react';
import Assets from './Assets';
import Categories, { sumBudgets } from './Categories';
import { currentMonth, getCategories, getIncome } from './db';
import Debts from './Debts';
import Income from './Income';
import { formatKr } from './money';
import type { Category, MonthlyIncome } from './types';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [debtTotal, setDebtTotal] = useState(0);
  const [assetTotal, setAssetTotal] = useState(0);
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
  // Det som hamnar på sparande när månaden är slut: planerat sparande plus det som blir över.
  const savedThisMonth = plannedSavings + leftForSavings;
  const netWorth = assetTotal + savedThisMonth;

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
          <p>
            <span>Tillgångar idag</span>
            <span>{formatKr(assetTotal)}</span>
          </p>
          <p>
            <span>Sparande denna månad</span>
            <span>
              {savedThisMonth < 0 ? '−' : '+'} {formatKr(Math.abs(savedThisMonth))}
            </span>
          </p>
          <p className={netWorth < 0 ? 'left negative' : 'left'}>
            <span>Nettovärde efter månaden</span>
            <strong>{formatKr(netWorth)}</strong>
          </p>
          <p className="note">Skulderna betalas med månadens inkomst och är redan avdragna ovan.</p>
        </section>
        <Income income={income} onChanged={reload} />
        <Categories categories={categories} onChanged={reload} />
        <Assets onTotalChange={setAssetTotal} />
        <Debts onTotalChange={setDebtTotal} />
      </main>
    </>
  );
}

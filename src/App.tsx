import { useEffect, useState } from 'react';
import Categories, { sumBudgets } from './Categories';
import { currentMonth, getCategories, getIncome } from './db';
import Debts from './Debts';
import Income from './Income';
import { formatKr } from './money';
import type { Category, MonthlyIncome } from './types';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [debtTotal, setDebtTotal] = useState(0);
  const [income, setIncome] = useState<MonthlyIncome>({ month: currentMonth(), csn: 0, other: 0 });

  async function reload() {
    setCategories(await getCategories());
    setIncome(await getIncome(currentMonth()));
  }

  useEffect(() => {
    reload();
  }, []);

  const totalIncome = income.csn + income.other;
  const budgeted = sumBudgets(categories);
  const left = totalIncome - budgeted;

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
            <span>Budgeterat</span>
            <span>− {formatKr(budgeted)}</span>
          </p>
          <p className="left">
            <span>Kvar</span>
            <strong>{formatKr(left)}</strong>
          </p>
          <p>
            <span>Skulder</span>
            <span>− {formatKr(debtTotal)}</span>
          </p>
          <p className="left">
            <span>Kvar om skulderna betalas</span>
            <strong>{formatKr(left - debtTotal)}</strong>
          </p>
        </section>
        <Income income={income} onChanged={reload} />
        <Categories categories={categories} onChanged={reload} />
        <Debts onTotalChange={setDebtTotal} />
      </main>
    </>
  );
}

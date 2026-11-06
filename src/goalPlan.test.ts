import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getBudget, getIncome, getMonthPlans, saveCategory, saveIncome, type MonthPlan } from './db';
import { forecast, type Loan } from './forecast';
import { countsForGoal, goalRows, goalStatus, planGoal, planWhen } from './goalPlan';
import type { Category } from './types';

const categories: Category[] = [
  { id: 'hem', name: 'Hem & hushåll', type: 'fixed', monthlyBudget: 8000 },
  { id: 'billan', name: 'Billån', type: 'fixed', monthlyBudget: 1586 },
  { id: 'gemensamt', name: 'Gemensamt sparande', type: 'savings', monthlyBudget: 2000 },
  { id: 'separat', name: 'Separat sparande', type: 'savings', monthlyBudget: 10000 },
];

function plans(count: number, csn = 18156, other = 29852): MonthPlan[] {
  const months = ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11'];
  return Array.from({ length: count }, (_, i) => ({
    month: months[i] ?? `2028-${String((i % 12) + 1).padStart(2, '0')}`,
    categories,
    income: { month: months[i], csn, other },
  }));
}

const loan: Loan = {
  id: 'billan',
  name: 'Billån',
  balance: 95927,
  annualRate: 8.45,
  monthlyPayment: 1586,
  amortization: 0,
  fees: 143,
  categoryName: 'Billån',
  startMonth: '2026-12',
  payExtra: true,
};

describe('countsForGoal', () => {
  it('utan val: sparkategorier med "gemensam" i namnet', () => {
    expect(categories.filter((c) => countsForGoal({}, c)).map((c) => c.id)).toEqual(['gemensamt']);
  });
  it('med val: bara de valda, och bara sparande', () => {
    expect(categories.filter((c) => countsForGoal({ categoryIds: ['separat', 'hem'] }, c)).map((c) => c.id)).toEqual(['separat']);
    expect(categories.filter((c) => countsForGoal({ categoryIds: [] }, c))).toEqual([]);
  });
});

describe('goalRows', () => {
  it('utan lån: Gemensamt sparande plus det som blir över, med exakt samma "över" som Prognos', () => {
    const p = plans(3);
    const rows = goalRows(p, null, {});
    const prognos = forecast(
      p.map((m) => ({ month: m.month, income: 48008, costs: 9586, plannedSavings: 12000 })),
      0,
      null,
    );
    // 48 008 − 9 586 − 12 000 = 26 422 över varje månad.
    expect(rows.map((r) => r.left)).toEqual(prognos.months.map((m) => m.left));
    expect(rows[0]).toEqual({ month: '2026-12', categories: 2000, left: 26422, toGoal: 28422 });
  });

  it('med Allt över på billånet: det som blir över räknas först när lånet är betalt', () => {
    const rows = goalRows(plans(8), loan, {});
    const prognos = forecast(
      plans(8).map((m) => ({ month: m.month, income: 48008, costs: 9586, plannedSavings: 12000 })),
      0,
      loan,
    );
    rows.forEach((row, i) => {
      expect(row.left).toBe(prognos.months[i].left - prognos.months[i].extraToLoan);
      expect(row.toGoal).toBe(2000 + row.left);
    });
    // Första månaden går allt som blir över till lånet.
    expect(rows[0].left).toBe(0);
    // När lånet är betalt kommer det som blir över (och lånets frigjorda kostnad) till målet.
    expect(rows.at(-1)!.left).toBe(26422 + 1586);
  });
});

describe('planGoal', () => {
  const rows = (amounts: number[]) => amounts.map((toGoal, i) => ({ month: `2027-0${i + 1}`, categories: toGoal, left: 0, toGoal }));

  it('utan avkastning: start plus insättningarna', () => {
    const plan = planGoal(1000, 0, 0, rows([500, 500, 500]));
    expect(plan.withReturn).toEqual([1000, 1500, 2000, 2500]);
    expect(plan.depositsOnly).toEqual(plan.withReturn);
  });

  it('avkastning varje månad på det som redan låg sparat, inte på negativt saldo', () => {
    const rate = Math.pow(1.07, 1 / 12) - 1;
    const plan = planGoal(100000, 0, 7, rows([1000]));
    expect(plan.withReturn[1]).toBeCloseTo(100000 + 100000 * rate + 1000, 8);
    expect(planGoal(-500, 0, 7, rows([1000])).withReturn[1]).toBe(500);
  });

  it('målet nås, och texten säger när pengarna finns på kontot', () => {
    const plan = planGoal(0, 1500, 0, rows([500, 500, 500, 500]));
    expect(plan.reachedAt).toBe(3);
    expect(planWhen(plan, 3)).toBe('slutet av februari 2027');
    expect(goalStatus(plan)).toBe('Målet nås i slutet av februari 2027, om 2 månader.');
    expect(goalStatus(planGoal(2000, 1500, 0, rows([1])))).toBe('Målet är nått!');
    expect(goalStatus(planGoal(0, 1500, 0, rows([0, 0])))).toBe('Med budgeten som den är nås målet inte inom 40 år.');
    expect(goalStatus(planGoal(0, 500, 0, rows([500])))).toBe('Målet nås i slutet av den här månaden.');
  });
});

describe('getMonthPlans', () => {
  it('ger samma budget och inkomst som getBudget och getIncome, månad för månad', async () => {
    await saveCategory('2041-03', { id: 'gym', name: 'Gym', type: 'fixed', monthlyBudget: 400 });
    await saveCategory('2041-07', { id: 'gym', name: 'Gym', type: 'fixed', monthlyBudget: 450.5 });
    await saveIncome({ month: '2041-05', csn: 13653, other: 31970 });
    const list = await getMonthPlans('2041-01', 12);
    for (const plan of list) {
      expect(plan.categories).toEqual((await getBudget(plan.month)).categories);
      expect(plan.income).toEqual(await getIncome(plan.month));
    }
  });
});

// Sammanfattningen (servern) ska ge exakt samma siffror som appen visar, på samma data.
// Startvärdena i en tom testdatabas används, plus en önskan och ett sparkonto.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { currentMonth, getAssets, getBudget, getGoals, getIncome, getLoans, getMonthPlans, getWishes, saveAsset, saveWish, shiftMonth } from './db';
import { sumBudgets } from './Categories';
import { goalCurrent, goalStatus, MAX_MONTHS, planGoal } from './goalPlan';
import { loadGoalData } from './useGoalPlan';
import { loadLoanSplit } from './useLoanSplit';
import { formatKr } from './money';
import { prioritizeToday } from '../supabase/functions/inbox/priority';
import { summaryLines } from '../supabase/functions/inbox/summary';

describe('sammanfattningen ger samma siffror som appen', () => {
  it('Översikt, sparmål, billån och önskelista', async () => {
    const month = currentMonth();
    const [{ id: assetId }] = (await getAssets()).filter((a) => a.name.includes('gemensam'));
    const asset = (await getAssets()).find((a) => a.id === assetId)!;
    await saveAsset({ ...asset, amount: 12345.5 });
    await saveWish({ id: 'cykel', list: 'erik', name: 'Cykel', amount: 2499, paidMonth: month });
    await saveWish({ id: 'lurar', list: 'cassandra', name: 'Hörlurar', amount: 1200 });

    const [budget, income, assets, goals, loans, wishes] = await Promise.all([
      getBudget(month), getIncome(month), getAssets(), getGoals(), getLoans(), getWishes(),
    ]);
    const today = `${month}-15`;
    const lines = summaryLines({
      today,
      plans: await getMonthPlans(month, MAX_MONTHS + 1),
      assets,
      holdings: [],
      trades: [],
      prices: {},
      goal: goals[0],
      loan: loans[0],
      wishes,
      priority: prioritizeToday([], {}, new Set(), [], today),
      tasks: [],
      health: [],
    });
    const text = lines.join('\n');

    // Översikt (App.tsx): inkomster − kostnader (med önskningar köpta i månaden) − planerat sparande
    const categories = budget.categories;
    const totalIncome = income.csn + income.other;
    const costs = sumBudgets(categories.filter((c) => c.type !== 'savings')) + 2499;
    const planned = sumBudgets(categories.filter((c) => c.type === 'savings'));
    expect(text).toContain(`efter utgifter och planerat sparande: ${formatKr(totalIncome - costs - planned)}`);
    expect(text).toContain(`Inkomster i `);
    expect(text).toContain(`: ${formatKr(totalIncome)}`);
    expect(text).toContain(`Kostnader i `);
    expect(text).toContain(`: ${formatKr(costs)}`);
    expect(text).toContain(`Nettovärde (sparkonton): ${formatKr(assets.filter((a) => !a.spending).reduce((s, a) => s + a.amount, 0))}`);

    // Sparmål (Sparmål-kortet och Översikt)
    const goal = goals[0];
    const now = goalCurrent(goal, assets);
    const plan = planGoal(now, goal.target, goal.annualReturn, (await loadGoalData(goal)).rows);
    expect(text).toContain(`${goal.name}: ${formatKr(now)} av ${formatKr(goal.target)}`);
    expect(text).toContain(goalStatus(plan));

    // Billån: extra på lånet nästa månad, som Prognos och Översikt (useLoanSplit)
    const split = await loadLoanSplit(shiftMonth(month, 1));
    const loanLine = lines.find((l) => l.startsWith(`${loans[0].name}:`))!;
    expect(loanLine).toContain(`${formatKr(Math.round(loans[0].balance))} kvar`);
    expect(loanLine).toContain(`Nästa betalning: ${formatKr(loans[0].monthlyPayment)}`);
    if (split) expect(loanLine).toContain(`extra på lånet ${formatKr(Math.round(split.extra))}`);

    // Önskelista: totalt och kvar att köpa
    expect(text).toContain(`Önskelista: ${formatKr(3699)} totalt, kvar att köpa ${formatKr(1200)}`);
  });

  it('dagen och hälsan', () => {
    const today = '2026-11-06';
    const habits = [
      { id: 's', name: 'I säng före 23', goal: 7, order: 0, created: '2026-10-01', after: [], archived: false },
      { id: 'g', name: 'Gym', goal: 3, order: 1, created: '2026-10-01', after: [], archived: false },
    ];
    const tasks = [{ id: 't', title: 'Ringa tandläkaren', date: today, time: '14:00', created: 1 }];
    const lines = summaryLines({
      today,
      plans: [{ month: '2026-11', categories: [], income: { month: '2026-11', csn: 0, other: 0 } }],
      assets: [],
      holdings: [],
      trades: [],
      prices: {},
      goal: null,
      loan: null,
      wishes: [],
      priority: prioritizeToday(habits, { [today]: ['g'] }, new Set(), tasks, today),
      tasks,
      health: [{ date: '2026-11-05', updated: 1, values: { sleepH: 7.2, steps: 8432, restingHr: 54 } }],
    });
    expect(lines).toContain('Att göra idag: Ringa tandläkaren 14:00');
    expect(lines).toContain('Måste göras idag: I säng före 23');
    expect(lines).toContain('Börja med: Ringa tandläkaren');
    expect(lines).toContain('Klart idag: 1 av 3');
    expect(lines).toContain('Hälsa igår: Sömn 7 h 12 min, Steg 8 432 steg, Vilopuls 54 slag/min');
  });
});

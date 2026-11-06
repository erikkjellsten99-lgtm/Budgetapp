// Fråga Jarvis i appen ska ge exakt samma belopp som Översikt, på appens egen data.
// Startvärdena i en tom testdatabas används, plus en köpt önskan och ett sparkonto.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { currentMonth, getAssets, getBudget, getIncome, getLoans, saveAsset, saveWish } from './db';
import { sumBudgets } from './Categories';
import { formatKr } from './money';
import { ask, loadFacts } from './jarvis';

describe('Fråga Jarvis i appen', () => {
  it('blir över, inkomster, kostnader och billån som i Översikt', async () => {
    const month = currentMonth();
    const asset = (await getAssets()).find((a) => !a.spending)!;
    await saveAsset({ ...asset, amount: 23456 });
    await saveWish({ id: 'cykel', list: 'erik', name: 'Cykel', amount: 2499, paidMonth: month });

    const [budget, income, loans] = await Promise.all([getBudget(month), getIncome(month), getLoans()]);
    const totalIncome = income.csn + income.other;
    const costs = sumBudgets(budget.categories.filter((c) => c.type !== 'savings')) + 2499;
    const planned = sumBudgets(budget.categories.filter((c) => c.type === 'savings'));

    expect(await ask('Vad blir över den här månaden?')).toContain(`blir det ${formatKr(totalIncome - costs - planned)} över`);
    expect(await ask('Hur mycket är inkomsterna?')).toContain(formatKr(totalIncome));
    expect(await ask('Vad kostar allt?')).toContain(formatKr(costs));
    if (loans[0]?.balance > 0) expect(await ask('Hur mycket är kvar på billånet?')).toContain(`${formatKr(Math.round(loans[0].balance))} kvar`);
  });

  it('läser bara: inget ändras av en fråga', async () => {
    const before = JSON.stringify(await loadFacts());
    await ask('Vad blir över?');
    await ask('Hur sov jag i natt?');
    expect(JSON.stringify(await loadFacts())).toBe(before);
  });

  it('tom fråga ger exempel', async () => {
    expect(await ask('')).toMatch(/^Fråga till exempel/);
  });
});

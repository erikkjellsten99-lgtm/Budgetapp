import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { currentMonth, getLoans, getMonthPlans, saveLoan, shiftMonth } from './db';
import { forecast } from './forecast';
import { monthInput } from './goalPlan';
import { loadLoanSplit } from './useLoanSplit';

describe('loadLoanSplit', () => {
  it('innevarande och tidigare månader: ingen uppdelning (som Prognos, månaden är redan betald)', async () => {
    expect(await loadLoanSplit(currentMonth())).toBeNull();
    expect(await loadLoanSplit(shiftMonth(currentMonth(), -3))).toBeNull();
  });

  it('kommande månader: exakt samma extra på lånet som Prognos', async () => {
    const first = shiftMonth(currentMonth(), 1);
    const [saved] = await getLoans();
    // Ett lån som säkert inte är betalt inom testets månader, oavsett vilket datum testet körs.
    const loan = { ...saved, balance: 500000, startMonth: first, payExtra: true, extraAmount: undefined };
    await saveLoan(loan);
    const plans = await getMonthPlans(first, 8);
    const prognos = forecast(plans.map(monthInput), 0, loan).months;
    for (const [i, row] of prognos.entries()) {
      const split = await loadLoanSplit(row.month);
      expect(split?.extra ?? 0).toBe(row.extraToLoan);
      if (i === 0) expect(split?.extra).toBeGreaterThan(0);
    }
    await saveLoan(saved);
  });

  it('utan Extra på lånet: ingen uppdelning', async () => {
    const [loan] = await getLoans();
    await saveLoan({ ...loan, payExtra: false });
    expect(await loadLoanSplit(shiftMonth(currentMonth(), 1))).toBeNull();
    await saveLoan(loan);
  });
});

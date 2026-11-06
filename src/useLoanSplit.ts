import { useEffect, useState } from 'react';
import { currentMonth, getLoans, getMonthPlans, onDataChange, shiftMonth } from './db';
import { forecast } from './forecast';
import { monthInput } from './goalPlan';

/** Hur mycket som går extra till lånet en budgetmånad, enligt Prognos. */
export interface LoanSplit {
  loanName: string;
  /** Extra på lånet den månaden, i kronor. */
  extra: number;
}

/**
 * Det som går extra till lånet en månad, med exakt samma uträkning som fliken Prognos.
 * Prognos börjar med nästa månad: innevarande månad är redan betald och det som blev över
 * finns i sparandet. För innevarande och tidigare månader blir det därför null.
 */
export async function loadLoanSplit(month: string): Promise<LoanSplit | null> {
  const first = shiftMonth(currentMonth(), 1);
  if (month < first) return null;
  const [year, number] = month.split('-').map(Number);
  const [firstYear, firstNumber] = first.split('-').map(Number);
  const count = (year - firstYear) * 12 + (number - firstNumber) + 1;
  const [plans, loans] = await Promise.all([getMonthPlans(first, count), getLoans()]);
  const loan = loans[0];
  if (!loan || !loan.payExtra) return null;
  const row = forecast(plans.map(monthInput), 0, loan).months.at(-1);
  return row && row.extraToLoan > 0 ? { loanName: loan.name, extra: row.extraToLoan } : null;
}

/** Samma som loadLoanSplit, och räknas om när datan ändras. */
export function useLoanSplit(month: string): LoanSplit | null {
  const [split, setSplit] = useState<LoanSplit | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => loadLoanSplit(month).then((next) => alive && setSplit(next));
    load();
    const stop = onDataChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [month]);
  return split;
}

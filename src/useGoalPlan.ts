import { useEffect, useState } from 'react';
import { currentMonth, getLoans, getMonthPlans, onDataChange, shiftMonth } from './db';
import { goalRows, MAX_MONTHS, type GoalRow } from './goalPlan';
import type { Category, SavingsGoal } from './types';

export interface GoalData {
  rows: GoalRow[];
  /** Sparkategorierna i nästa månads budget, att välja bland i Sparmål. */
  savingsCategories: Category[];
}

/** Läser budget, inkomster och lån och räknar vad som går till målet varje månad, 40 år framåt. */
export async function loadGoalData(goal: Pick<SavingsGoal, 'categoryIds'>): Promise<GoalData> {
  // Som i Prognos: första budgetmånaden är nästa månad (pengarna kommer den 23–25:e den här månaden).
  const first = shiftMonth(currentMonth(), 1);
  const [plans, loans] = await Promise.all([getMonthPlans(first, MAX_MONTHS), getLoans()]);
  return {
    rows: goalRows(plans, loans[0] ?? null, goal),
    savingsCategories: plans[0].categories.filter((c) => c.type === 'savings'),
  };
}

/** Samma som loadGoalData, och räknas om när datan ändras (här eller på den andra telefonen). */
export function useGoalData(goal: SavingsGoal | null): GoalData | null {
  const [data, setData] = useState<GoalData | null>(null);
  const key = goal ? JSON.stringify(goal.categoryIds ?? null) : null;

  useEffect(() => {
    if (!goal) return;
    let alive = true;
    const load = () => loadGoalData(goal).then((next) => alive && setData(next));
    load();
    const stop = onDataChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [key]);

  return goal ? data : null;
}

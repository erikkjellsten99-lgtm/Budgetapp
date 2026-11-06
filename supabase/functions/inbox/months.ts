// Månader och budget per månad. Rena funktioner som både appen (db.ts) och servern (sammanfattningen)
// använder, så att en månad utan egen budget eller inkomst utgår från samma tidigare månad på båda ställena.

import type { Category, MonthBudget, MonthlyIncome } from './types.ts';

/** Månaden flyttad ett antal steg, t.ex. shiftMonth("2026-12", 1) = "2027-01". */
export function shiftMonth(month: string, steps: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + steps;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** "2026-10" som "oktober 2026". */
export function monthName(month: string): string {
  return new Date(`${month}-01T12:00`).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
}

/** Budget och inkomst för en månad, som getBudget och getIncome ger dem. */
export interface MonthPlan {
  month: string;
  categories: Category[];
  income: MonthlyIncome;
}

/**
 * Budget och inkomst för många månader i följd ("first" och framåt): en månad utan egen post utgår från
 * närmaste tidigare månad (budget), eller har 0 kr (inkomst utan tidigare månad). Budgetar utan någon
 * tidigare månad använder den gamla kategorilistan. `budgets` och `incomes` sorterade på månad.
 */
export function monthPlans(
  budgets: MonthBudget[],
  incomes: MonthlyIncome[],
  legacy: Category[],
  first: string,
  count: number,
): MonthPlan[] {
  const latest = <T extends { month: string }>(list: T[], month: string) => {
    let found: T | undefined;
    for (const item of list) {
      if (item.month > month) break;
      found = item;
    }
    return found;
  };
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(first, i);
    const income = latest(incomes, month);
    return {
      month,
      categories: latest(budgets, month)?.categories ?? legacy,
      income: { month, csn: income?.csn ?? 0, other: income?.other ?? 0 },
    };
  });
}

// Sparmålet månad för månad, en enda uträkning för Översikt, Prognos, Sparmål och ekonomigalaxen.
//
// Till målet går varje månad:
// - budgetkategorierna (sparande) som är valda för målet, t.ex. Gemensamt sparande, och
// - det som blir över efter utgifter och planerat sparande. När "Allt över" eller ett eget
//   belopp går till billånet räknas bara det som är kvar efter lånet, precis som i Prognos.
// Avkastningen räknas som ränta på ränta varje månad, på det som redan ligger på målets konton.
// Månaderna och "det som blir över" kommer från samma prognos som fliken Prognos (forecast.ts).

import { forecast, type Loan, type MonthInput } from './forecast';
import { monthName, shiftMonth, type MonthPlan } from './db';
import type { Category, SavingsGoal } from './types';

/** Längsta prognosen som räknas fram, i månader (40 år). */
export const MAX_MONTHS = 480;

/** En budgetmånad och vad som går till målet den månaden. */
export interface GoalRow {
  month: string;
  /** Valda sparkategorier i budgeten. */
  categories: number;
  /** Det som blir över, efter det som går extra till lånet. Kan vara negativt. */
  left: number;
  /** Totalt till målet: categories + left. */
  toGoal: number;
}

export interface GoalPlan {
  /** Saldo med avkastning. Index 0 är idag, index i är efter budgetmånad rows[i − 1]. */
  withReturn: number[];
  /** Saldo om pengarna bara låg still. */
  depositsOnly: number[];
  /** Index då målet nås, eller null om det inte nås inom 40 år. */
  reachedAt: number | null;
  /** Budgetmånaderna, samma index som ovan minus ett. */
  rows: GoalRow[];
}

/** Kategorin går till målet: vald i Sparmål, eller (innan något valts) "gemensam" i namnet. */
export function countsForGoal(goal: Pick<SavingsGoal, 'categoryIds'>, category: Category): boolean {
  if (category.type !== 'savings') return false;
  return goal.categoryIds ? goal.categoryIds.includes(category.id) : category.name.toLowerCase().includes('gemensam');
}

/** Budgetens summor för prognosen, räknade som i fliken Prognos (Forecast.tsx). */
function monthInput(plan: MonthPlan): MonthInput {
  const sum = (savings: boolean) =>
    plan.categories.filter((c) => (c.type === 'savings') === savings).reduce((s, c) => s + c.monthlyBudget, 0);
  return { month: plan.month, income: plan.income.csn + plan.income.other, costs: sum(false), plannedSavings: sum(true) };
}

/** Vad som går till målet varje budgetmånad. */
export function goalRows(plans: MonthPlan[], loan: Loan | null, goal: Pick<SavingsGoal, 'categoryIds'>): GoalRow[] {
  const result = forecast(plans.map(monthInput), 0, loan);
  return result.months.map((m, i) => {
    const categories = plans[i].categories.filter((c) => countsForGoal(goal, c)).reduce((s, c) => s + c.monthlyBudget, 0);
    const left = m.left - m.extraToLoan;
    return { month: m.month, categories, left, toGoal: categories + left };
  });
}

/**
 * Saldot mot målet månad för månad. Kurvan räknas tills målet är nått (avrundat uppåt till
 * helt år) och minst 10 år framåt, så att ränta-på-ränta-effekten syns.
 */
export function planGoal(start: number, target: number, annualReturn: number, rows: GoalRow[]): GoalPlan {
  const monthlyRate = annualReturn ? Math.pow(1 + annualReturn / 100, 1 / 12) - 1 : 0;
  const withReturn = [start];
  const depositsOnly = [start];
  let reachedAt: number | null = target > 0 && start >= target ? 0 : null;
  const last = Math.min(rows.length, MAX_MONTHS);

  for (let i = 1; i <= last; i++) {
    const before = withReturn[i - 1];
    // Avkastning på det som redan låg sparat under månaden (inte på ett negativt saldo), som i Prognos.
    withReturn.push(before + (before > 0 ? before * monthlyRate : 0) + rows[i - 1].toGoal);
    depositsOnly.push(depositsOnly[i - 1] + rows[i - 1].toGoal);
    if (reachedAt === null && target > 0 && withReturn[i] >= target) reachedAt = i;
    const shown = reachedAt === null ? last : Math.max(120, Math.ceil((reachedAt + 1) / 12) * 12);
    if (i >= shown) break;
  }
  return { withReturn, depositsOnly, reachedAt, rows: rows.slice(0, withReturn.length - 1) };
}

/** När ett index i planen är: "Idag" eller t.ex. "slutet av mars 2029" (pengarna finns på kontot då). */
export function planWhen(plan: GoalPlan, index: number): string {
  if (index === 0) return 'Idag';
  return `slutet av ${monthName(shiftMonth(plan.rows[index - 1].month, -1))}`;
}

/** T.ex. "4 år och 3 månader". */
export function durationLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} år`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'månad' : 'månader'}`);
  return parts.join(' och ') || 'nu';
}

/** Kort text om när målet nås, t.ex. "Målet nås i slutet av mars 2029, om 2 år och 4 månader." */
export function goalStatus(plan: GoalPlan): string {
  const at = plan.reachedAt;
  if (at === 0) return 'Målet är nått!';
  if (at === null) return 'Med budgeten som den är nås målet inte inom 40 år.';
  // Index 1 är pengarna som sätts in i slutet av den här månaden.
  const monthsAway = at - 1;
  if (monthsAway === 0) return 'Målet nås i slutet av den här månaden.';
  return `Målet nås i ${planWhen(plan, at)}, om ${durationLabel(monthsAway)}.`;
}

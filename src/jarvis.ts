// "Fråga Jarvis" i appen: samma svar som Siri-genvägen (ask.ts), men räknat här i telefonen
// från datan som redan finns i appen (IndexedDB). Ingen server, ingen AI, läser bara.
// Siffrorna kommer från summaryFacts (summary.ts), samma uträkning som sammanfattningen och Översikt.

import { getValuedAssets } from './valuedAssets';
import { getGoals, getLoans, getMonthPlans, getWishes } from './db';
import { MAX_MONTHS } from './goalPlan';
import { loadHabitData, toLog } from './vanor/store';
import { todayKey } from './vanor/dates';
import { prioritizeToday } from '../supabase/functions/inbox/priority';
import { summaryFacts, type SummaryFacts } from '../supabase/functions/inbox/summary';
import { answer, EXAMPLES, type AskOptions } from '../supabase/functions/inbox/ask';

export { EXAMPLES };

/** Siffrorna för idag, räknade från appens egen data. */
export async function loadFacts(now = new Date()): Promise<SummaryFacts> {
  const today = todayKey(now);
  const month = today.slice(0, 7);
  const [plans, assets, goals, loans, wishes, habitData] = await Promise.all([
    getMonthPlans(month, MAX_MONTHS + 1),
    getValuedAssets(),
    getGoals(),
    getLoans(),
    getWishes(),
    loadHabitData(),
  ]);
  const paused = new Set(habitData.pauses.map((p) => p.date));
  return summaryFacts({
    today,
    plans,
    assets,
    goal: goals[0] ?? null,
    loan: loans[0] ?? null,
    wishes,
    priority: prioritizeToday(habitData.habits, toLog(habitData.checks), paused, habitData.tasks, today),
    tasks: habitData.tasks,
    health: habitData.health,
  });
}

/** Svaret på en fråga, med de siffror som ligger i appen just nu. */
export async function ask(question: string, options: AskOptions = {}): Promise<string> {
  return answer(question, await loadFacts(), options);
}

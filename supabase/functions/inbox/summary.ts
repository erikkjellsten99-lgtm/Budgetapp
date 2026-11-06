// Sammanfattningen av Groundwork som text, för Jarvis (Mac) och "Fråga Groundwork" (iPhone och klocka).
// Varje siffra räknas med samma kod som appen visar den med, och skrivs en gång med en tydlig etikett:
// - Översikt: blir över, inkomster, kostnader, planerat sparande, nettovärde (App.tsx)
// - Sparmål: saldo, procent och när målet nås (goalPlan.ts)
// - Billån: kvar och nästa månads betalning med extra på lånet (forecast.ts, som Prognos)
// - Önskelista: summan och kvar att köpa (wishes.ts)
// - Vanor: Att göra, måsten och vad som bör göras först (priority.ts), och hälsa (health.ts)
// Läser bara. Rena funktioner, tester i summary.test.ts.

import { forecast, type Loan } from './forecast.ts'
import { goalCurrent, goalRows, goalStatus, planGoal, monthInput } from './goalPlan.ts'
import { formatKr } from './money.ts'
import { monthName, shiftMonth, type MonthPlan } from './months.ts'
import type { Asset, SavingsGoal, Wish } from './types.ts'
import { sumLeftToBuy, sumPaidIn } from './wishes.ts'
import { firstThing, type Priority } from './priority.ts'
import { daySummary } from './habits.ts'
import { doneToday, type Task } from './tasks.ts'
import { addDays, longDate, type DateKey } from './dates.ts'
import { formatHealth, type HealthDay, type HealthMetric } from './health.ts'
import { list } from './morning.ts'

export interface SummaryInput {
  /** Dagens datum, som "2026-11-06". */
  today: DateKey
  /** Budget och inkomst från innevarande månad och framåt (minst två månader, gärna 40 år för sparmålet). */
  plans: MonthPlan[]
  assets: Asset[]
  goal: SavingsGoal | null
  loan: Loan | null
  wishes: Wish[]
  priority: Priority
  tasks: Task[]
  health: HealthDay[]
}

/** Siffrorna i Översikt för en månad, räknade exakt som App.tsx. */
export function overviewNumbers(plan: MonthPlan, wishes: Wish[], assets: Asset[]) {
  const sum = (savings: boolean) =>
    plan.categories.filter((c) => (c.type === 'savings') === savings).reduce((s, c) => s + c.monthlyBudget, 0)
  const income = plan.income.csn + plan.income.other
  const costs = sum(false) + sumPaidIn(wishes, plan.month)
  const plannedSavings = sum(true)
  const sumAmounts = (items: Asset[]) => items.reduce((s, a) => s + a.amount, 0)
  return {
    income,
    costs,
    plannedSavings,
    left: income - costs - plannedSavings,
    netWorth: sumAmounts(assets.filter((a) => !a.spending)),
    spending: sumAmounts(assets.filter((a) => a.spending)),
  }
}

const HEALTH: [HealthMetric, string][] = [
  ['sleepH', 'Sömn'],
  ['steps', 'Steg'],
  ['restingHr', 'Vilopuls'],
]

/** Hela sammanfattningen som rader, t.ex. "Blir över i november 2026: 16 858 kr". */
export function summaryLines(input: SummaryInput): string[] {
  const { today, plans, assets, goal, loan, wishes, priority: p, tasks, health } = input
  const [now, ...future] = plans
  const lines = [`Idag: ${longDate(today)} ${today.slice(0, 4)}`]

  // Översikt för innevarande månad
  const o = overviewNumbers(now, wishes, assets)
  const month = monthName(now.month)
  lines.push(
    `Blir över i ${month} efter utgifter och planerat sparande: ${formatKr(o.left)}`,
    `Inkomster i ${month}: ${formatKr(o.income)}`,
    `Kostnader i ${month}: ${formatKr(o.costs)}`,
    `Planerat sparande i ${month}: ${formatKr(o.plannedSavings)}`,
    `Nettovärde (sparkonton): ${formatKr(o.netWorth)}`,
  )
  if (o.spending > 0) lines.push(`Pengar att använda (räknas inte i nettovärdet): ${formatKr(o.spending)}`)

  // Sparmålet, med samma uträkning som Översikt och Sparmål
  if (goal) {
    const current = goalCurrent(goal, assets)
    const percent = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0
    const plan = planGoal(current, goal.target, goal.annualReturn, goalRows(future, loan, goal))
    lines.push(`${goal.name}: ${formatKr(current)} av ${formatKr(goal.target)} (${percent} %). ${goalStatus(plan)}`)
  }

  // Billånet: kvar, och nästa månads betalning med extra på lånet enligt Prognos
  if (loan && loan.balance > 0 && future.length) {
    const next = forecast(future.slice(0, 1).map(monthInput), 0, loan).months[0]
    const extra = next ? Math.round(next.extraToLoan) : 0
    const nextMonth = monthName(shiftMonth(now.month, 1))
    lines.push(
      `${loan.name}: ${formatKr(Math.round(loan.balance))} kvar. Nästa betalning: ${formatKr(loan.monthlyPayment)} i ${nextMonth}` +
        (extra > 0 ? `, och extra på lånet ${formatKr(extra)} enligt Prognos.` : '.'),
    )
  }

  // Önskelistan
  const total = wishes.reduce((s, w) => s + w.amount, 0)
  lines.push(`Önskelista: ${formatKr(total)} totalt, kvar att köpa ${formatKr(sumLeftToBuy(wishes))}`)

  // Dagen i Vanor
  lines.push(`Att göra idag: ${p.tasksDue.length ? list(p.tasksDue.map((t) => (t.time ? `${t.title} ${t.time}` : t.title))) : 'inget'}`)
  if (p.pausedToday) lines.push('Vanor: pausad dag, inga måsten')
  else lines.push(`Måste göras idag: ${p.must.length ? list(p.must.map((r) => r.habit.name)) : 'inget'}`)
  const first = firstThing(p.pausedToday ? { ...p, must: [], flexible: [] } : p)
  if (first) lines.push(`Börja med: ${first}`)
  const habits = daySummary(p.rows.map((r) => r.info))
  const done = doneToday(tasks, today).length
  lines.push(`Klart idag: ${habits.done + done} av ${habits.total + p.tasksDue.length + done}`)

  // Hälsa: idag, annars igår (som i Vanor)
  const day = health.find((d) => d.date === today) ?? health.find((d) => d.date === addDays(today, -1))
  if (day) {
    const when = day.date === today ? 'idag' : 'igår'
    const shown = HEALTH.filter(([m]) => day.values[m] !== undefined).map(([m, label]) => `${label} ${formatHealth(m, day.values[m]!)}`)
    if (shown.length) lines.push(`Hälsa ${when}: ${shown.join(', ')}`)
  }
  return lines
}

export const summaryText = (input: SummaryInput) => summaryLines(input).join('\n')

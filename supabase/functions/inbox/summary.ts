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

/** Sammanfattningens siffror och texter, räknade en gång. Används av sammanfattningen och "Fråga Groundwork". */
export interface SummaryFacts {
  today: DateKey
  /** "november 2026" */
  month: string
  left: string
  income: string
  costs: string
  plannedSavings: string
  netWorth: string
  /** Pengar att använda, eller null om 0 kr. */
  spending: string | null
  goal: { name: string; current: string; target: string; percent: number; status: string } | null
  loan: { name: string; left: string; payment: string; nextMonth: string; extra: string | null } | null
  wishes: { total: string; leftToBuy: string }
  /** Att göra idag och försenat, t.ex. "Ringa tandläkaren 14:00". */
  tasks: string[]
  paused: boolean
  must: string[]
  first: string | null
  done: number
  total: number
  /** Hälsa idag, annars igår (som i Vanor). */
  health: { when: 'idag' | 'igår'; values: { metric: HealthMetric; label: string; text: string }[] } | null
}

export function summaryFacts(input: SummaryInput): SummaryFacts {
  const { today, plans, assets, goal, loan, wishes, priority: p, tasks, health } = input
  const [now, ...future] = plans

  // Översikt för innevarande månad
  const o = overviewNumbers(now, wishes, assets)

  // Sparmålet, med samma uträkning som Översikt och Sparmål
  let goalFacts: SummaryFacts['goal'] = null
  if (goal) {
    const current = goalCurrent(goal, assets)
    const percent = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0
    const plan = planGoal(current, goal.target, goal.annualReturn, goalRows(future, loan, goal))
    goalFacts = { name: goal.name, current: formatKr(current), target: formatKr(goal.target), percent, status: goalStatus(plan) }
  }

  // Billånet: kvar, och nästa månads betalning med extra på lånet enligt Prognos
  let loanFacts: SummaryFacts['loan'] = null
  if (loan && loan.balance > 0 && future.length) {
    const next = forecast(future.slice(0, 1).map(monthInput), 0, loan).months[0]
    const extra = next ? Math.round(next.extraToLoan) : 0
    loanFacts = {
      name: loan.name,
      left: formatKr(Math.round(loan.balance)),
      payment: formatKr(loan.monthlyPayment),
      nextMonth: monthName(shiftMonth(now.month, 1)),
      extra: extra > 0 ? formatKr(extra) : null,
    }
  }

  // Dagen i Vanor
  const habits = daySummary(p.rows.map((r) => r.info))
  const doneTasks = doneToday(tasks, today).length

  // Hälsa: idag, annars igår (som i Vanor)
  const day = health.find((d) => d.date === today) ?? health.find((d) => d.date === addDays(today, -1))
  const values = day
    ? HEALTH.filter(([m]) => day.values[m] !== undefined).map(([metric, label]) => ({ metric, label, text: formatHealth(metric, day.values[metric]!) }))
    : []

  return {
    today,
    month: monthName(now.month),
    left: formatKr(o.left),
    income: formatKr(o.income),
    costs: formatKr(o.costs),
    plannedSavings: formatKr(o.plannedSavings),
    netWorth: formatKr(o.netWorth),
    spending: o.spending > 0 ? formatKr(o.spending) : null,
    goal: goalFacts,
    loan: loanFacts,
    wishes: { total: formatKr(wishes.reduce((s, w) => s + w.amount, 0)), leftToBuy: formatKr(sumLeftToBuy(wishes)) },
    tasks: p.tasksDue.map((t) => (t.time ? `${t.title} ${t.time}` : t.title)),
    paused: p.pausedToday,
    must: p.must.map((r) => r.habit.name),
    first: firstThing(p.pausedToday ? { ...p, must: [], flexible: [] } : p),
    done: habits.done + doneTasks,
    total: habits.total + p.tasksDue.length + doneTasks,
    health: day && values.length ? { when: day.date === today ? 'idag' : 'igår', values } : null,
  }
}

/** Hela sammanfattningen som rader, t.ex. "Blir över i november 2026: 16 858 kr". */
export function summaryLines(input: SummaryInput): string[] {
  const f = summaryFacts(input)
  const lines = [
    `Idag: ${longDate(f.today)} ${f.today.slice(0, 4)}`,
    `Blir över i ${f.month} efter utgifter och planerat sparande: ${f.left}`,
    `Inkomster i ${f.month}: ${f.income}`,
    `Kostnader i ${f.month}: ${f.costs}`,
    `Planerat sparande i ${f.month}: ${f.plannedSavings}`,
    `Nettovärde (sparkonton): ${f.netWorth}`,
  ]
  if (f.spending) lines.push(`Pengar att använda (räknas inte i nettovärdet): ${f.spending}`)
  if (f.goal) lines.push(`${f.goal.name}: ${f.goal.current} av ${f.goal.target} (${f.goal.percent} %). ${f.goal.status}`)
  if (f.loan) {
    lines.push(
      `${f.loan.name}: ${f.loan.left} kvar. Nästa betalning: ${f.loan.payment} i ${f.loan.nextMonth}` +
        (f.loan.extra ? `, och extra på lånet ${f.loan.extra} enligt Prognos.` : '.'),
    )
  }
  lines.push(`Önskelista: ${f.wishes.total} totalt, kvar att köpa ${f.wishes.leftToBuy}`)
  lines.push(`Att göra idag: ${f.tasks.length ? list(f.tasks) : 'inget'}`)
  if (f.paused) lines.push('Vanor: pausad dag, inga måsten')
  else lines.push(`Måste göras idag: ${f.must.length ? list(f.must) : 'inget'}`)
  if (f.first) lines.push(`Börja med: ${f.first}`)
  lines.push(`Klart idag: ${f.done} av ${f.total}`)
  if (f.health) lines.push(`Hälsa ${f.health.when}: ${f.health.values.map((v) => `${v.label} ${v.text}`).join(', ')}`)
  return lines
}

export const summaryText = (input: SummaryInput) => summaryLines(input).join('\n')

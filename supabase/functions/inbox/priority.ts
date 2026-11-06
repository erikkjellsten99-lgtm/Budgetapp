// "Prioritera idag": vad som ska göras idag och i vilken ordning. Delas av appen (Vanor) och
// servern (morgonbeskedet), så att båda alltid säger samma sak. Rena funktioner, tester i priority.test.ts.

import { todayInfo, type Habit, type Log, type Paused, type TodayInfo } from './habits.ts'
import { dueTasks, type Task } from './tasks.ts'
import type { DateKey } from './dates.ts'

export interface PriorityRow {
  /** Vanan, med kopplingar till borttagna vanor bortplockade. */
  habit: Habit
  info: TodayInfo
}

export interface Priority {
  /** Alla aktiva vanor i listans ordning. */
  rows: PriorityRow[]
  /** Att göra: idag och försenat, inte gjort (försenat först). Räknas som måsten idag. */
  tasksDue: Task[]
  /** Vanor som måste göras idag för att hinna veckans mål. */
  must: PriorityRow[]
  /** Vanor som ska göras men kan vänta, mest bråttom först. */
  flexible: PriorityRow[]
  pausedToday: boolean
}

/**
 * Samma ordning som under Prioritera idag i Vanor: Att göra först, sedan vanor som måste göras idag,
 * sedan det som kan vänta (mest bråttom först). `habits` i listans ordning.
 */
export function prioritizeToday(habits: Habit[], log: Log, paused: Paused, tasks: Task[], today: DateKey): Priority {
  const active = habits.filter((h) => !h.archived)
  // Kopplingar till borttagna vanor räknas inte (annars skulle t.ex. Stretching aldrig komma upp).
  const names = new Set(active.map((h) => h.id))
  const rows = active.map((h) => {
    const habit = { ...h, after: h.after.filter((id) => names.has(id)) }
    return { habit, info: todayInfo(habit, log, today, paused) }
  })
  const open = rows.filter((r) => r.info.due && !r.info.done)
  return {
    rows,
    tasksDue: dueTasks(tasks, today),
    must: open.filter((r) => r.info.must),
    flexible: open.filter((r) => !r.info.must).sort((a, b) => b.info.urgency - a.info.urgency),
    pausedToday: paused.has(today),
  }
}

/** Det som bör göras först: första Att göra, annars första måstet, annars det mest bråttom som kan vänta. */
export function firstThing(p: Priority): string | null {
  return p.tasksDue[0]?.title ?? p.must[0]?.habit.name ?? p.flexible[0]?.habit.name ?? null
}

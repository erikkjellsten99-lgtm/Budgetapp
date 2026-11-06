// Morgonbeskedet: en kort svensk text som genvägen läser upp kl. 07 och visar som notis på klockan.
// Bygger på samma ordning som Prioritera idag i Vanor (priority.ts). Vädret lägger genvägen själv till.
// Ingen ekonomi. Rena funktioner, tester i morning.test.ts.

import { longDate, type DateKey } from './dates.ts'
import { firstThing, type Priority } from './priority.ts'
import { shortDate, type Task } from './tasks.ts'

/** "A", "A och B", "A, B och C". */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`
}

function taskText(task: Task, today: DateKey): string {
  const at = task.time ? ` klockan ${task.time}` : ''
  const late = task.date < today ? ` (försenad sedan ${shortDate(task.date, today)})` : ''
  return `${task.title}${at}${late}`
}

/** T.ex. "Fredag 6 november. Att göra: Ringa tandläkaren klockan 14:00. Måste göras idag: Gym. Börja med: Ringa tandläkaren." */
export function morningText(p: Priority, today: DateKey): string {
  const parts = [`${longDate(today)}.`]
  if (p.tasksDue.length) parts.push(`Att göra: ${list(p.tasksDue.map((t) => taskText(t, today)))}.`)

  if (p.pausedToday) {
    parts.push('Du har pausat idag, så inga vanor måste göras. Krya på dig.')
  } else if (p.must.length) {
    parts.push(`Måste göras idag: ${list(p.must.map((r) => r.habit.name))}.`)
  }

  const first = firstThing(p.pausedToday ? { ...p, must: [], flexible: [] } : p)
  if (!p.tasksDue.length && !p.must.length && !p.pausedToday) {
    if (p.flexible.length) parts.push(`Inget måste idag. Har du tid, ta ${first} först.`)
    else if (p.rows.length) parts.push('Allt för idag är redan gjort.')
    else parts.push('Inget planerat i Groundwork idag.')
  } else if (first) {
    parts.push(`Börja med: ${first}.`)
  }
  return parts.join(' ')
}

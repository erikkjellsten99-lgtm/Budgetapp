// Att göra: enstaka saker med datum (och valfri tid) som bockas av en gång.
// Visas i Vanor på rätt dag, privata precis som vanorna. Rena funktioner, tester i tasks.test.ts.

import { addDays, weekday, type DateKey } from './dates'

export interface Task {
  id: string
  title: string
  /** Dagen saken ska göras. */
  date: DateKey
  /** Valfri tid, t.ex. "10:00". Ger en påminnelse om notiser är på. */
  time?: string
  /** Dagen den bockades av. Saknas = inte gjord. */
  doneOn?: DateKey
  /** När den skapades (ms), för ordning. */
  created: number
}

export const TITLE_MAX = 80

const byTime = (a: Task, b: Task) =>
  a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.created - b.created

/** Det som ska göras idag eller är försenat och inte gjort, försenat först. */
export function dueTasks(tasks: Task[], today: DateKey): Task[] {
  return tasks.filter((t) => !t.doneOn && t.date <= today).sort(byTime)
}

/** Bockat idag, så att det syns under Klart resten av dagen. */
export function doneToday(tasks: Task[], today: DateKey): Task[] {
  return tasks.filter((t) => t.doneOn === today).sort(byTime)
}

/** Kommande, inte gjort, i datumordning. */
export function upcomingTasks(tasks: Task[], today: DateKey): Task[] {
  return tasks.filter((t) => !t.doneOn && t.date > today).sort(byTime)
}

const DAYS = ['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** "tors 5 nov" (med år om det inte är i år). */
export function shortDate(date: DateKey, today: DateKey): string {
  const [y, m, d] = date.split('-').map(Number)
  const year = date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`
  return `${DAYS[weekday(date)]} ${d} ${MONTHS[m - 1]}${year}`
}

/** "Idag", "I morgon", "Försenad sedan tis 27 okt" eller "fre 30 okt". Med tid om den finns. */
export function whenText(task: Task, today: DateKey): string {
  const day =
    task.date === today
      ? 'Idag'
      : task.date === addDays(today, 1)
        ? 'I morgon'
        : task.date < today
          ? `Försenad sedan ${shortDate(task.date, today)}`
          : shortDate(task.date, today)
  return task.time ? `${day} ${task.time}` : day
}

export const cleanTitle = (title: string) => title.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX)

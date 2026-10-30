// Rymdbasen och satelliterna i galaxen. Rena funktioner, tester i space.test.ts.
// - Rymdbasen: en station vid galaxens kärna som byggs ut med en modul för varje milstolpe. Den kan bara växa.
// - Satelliter: varje avklarad Att göra-sak blir en satellit runt månadens solsystem.

import { addDays, weekStart, type DateKey } from './dates'
import { weekCount, weekGoal, type Habit, type Log, type Paused } from './habits'
import { monthOfWeek } from './progress'
import type { Task } from './tasks'

export type ModuleKind = 'core' | 'panel' | 'panel2' | 'antenna' | 'dock' | 'habitat' | 'greenhouse' | 'telescope' | 'ring' | 'sail' | 'beacon'

export interface Milestone {
  id: ModuleKind
  /** Vad som krävs, t.ex. "100 bockar". */
  title: string
  /** Modulen som byggs, t.ex. "Solpanel". */
  module: string
  /** Dagen milstolpen nåddes, eller null om den inte är nådd än. */
  done: DateKey | null
  /** Hur långt du har kommit mot en milstolpe som inte är nådd (saknas för perfekt vecka). */
  progress?: { now: number; target: number; unit: string }
}

/**
 * Rymdbasens milstolpar i den ordning de kan nås, med datum för de nådda.
 * Räknar alla bockar (även för borttagna vanor – det du har gjort finns kvar).
 */
export function baseMilestones(habits: Habit[], log: Log, paused: Paused, today: DateKey): Milestone[] {
  const days = Object.keys(log)
    .filter((d) => d <= today && log[d].length > 0)
    .sort()
  const first = days[0] ?? null

  // Bockar i tur och ordning: dagen då bock nr N gjordes.
  const countReached = (n: number) => {
    let total = 0
    for (const d of days) {
      total += log[d].length
      if (total >= n) return d
    }
    return null
  }
  const total = days.reduce((n, d) => n + log[d].length, 0)

  // Längsta serien (dagar i rad på en vana, pausdagar bryter inte) och dagen en viss längd nåddes.
  const runReached = (len: number) => {
    let best: DateKey | null = null
    for (const h of habits) {
      let run = 0
      for (let d = h.created; d <= today; d = addDays(d, 1)) {
        if (log[d]?.includes(h.id)) {
          run++
          if (run === len) {
            if (!best || d < best) best = d
            break
          }
        } else if (!paused.has(d)) run = 0
      }
    }
    return best
  }
  const longestRun = () => {
    let longest = 0
    for (const h of habits) {
      let run = 0
      for (let d = h.created; d <= today; d = addDays(d, 1)) {
        if (log[d]?.includes(h.id)) longest = Math.max(longest, ++run)
        else if (!paused.has(d)) run = 0
      }
    }
    return longest
  }

  // Första perfekta veckan: alla vanor med mål klarade, och veckan är slut.
  const perfectWeek = () => {
    if (!first) return null
    for (let monday = weekStart(first); addDays(monday, 6) < today; monday = addDays(monday, 7)) {
      let goal = 0
      let done = 0
      for (const h of habits) {
        const g = weekGoal(h, paused, monday)
        goal += g
        done += Math.min(weekCount(log, h.id, monday), g)
      }
      if (goal > 0 && done >= goal) return addDays(monday, 6)
    }
    return null
  }

  const daysSince = first ? Math.round((Date.parse(today) - Date.parse(first)) / 864e5) : 0
  const after = (n: number) => (first && daysSince >= n ? addDays(first, n) : null)

  const longest = longestRun()
  const list: Milestone[] = [
    { id: 'core', title: 'Första bocken', module: 'Basen grundas', done: first },
    countMilestone('panel', 25, 'Solpanel', countReached(25), total),
    countMilestone('panel2', 100, 'Solpanel nr 2', countReached(100), total),
    { id: 'antenna', title: 'Första perfekta veckan', module: 'Antenn', done: perfectWeek() },
    { id: 'dock', title: '7 dagar i rad på en vana', module: 'Dockningsport', done: runReached(7), progress: { now: longest, target: 7, unit: 'dagar i rad' } },
    countMilestone('habitat', 250, 'Bostadsmodul', countReached(250), total),
    { id: 'greenhouse', title: '30 dagar i rad på en vana', module: 'Växthus', done: runReached(30), progress: { now: longest, target: 30, unit: 'dagar i rad' } },
    { id: 'telescope', title: 'Tre månader med vanor', module: 'Teleskop', done: after(90), progress: { now: daysSince, target: 90, unit: 'dagar' } },
    countMilestone('ring', 500, 'Rotationsring', countReached(500), total),
    countMilestone('sail', 1000, 'Solsegel', countReached(1000), total),
    { id: 'beacon', title: 'Ett år med vanor', module: 'Fyr', done: after(365), progress: { now: daysSince, target: 365, unit: 'dagar' } },
  ]
  return list.map((m) => (m.done ? { ...m, progress: undefined } : m))
}

function countMilestone(id: ModuleKind, n: number, module: string, done: DateKey | null, total: number): Milestone {
  return { id, title: `${n} bockar`, module, done, progress: { now: total, target: n, unit: 'bockar' } }
}

/** Nästa milstolpe att jobba mot: den som är närmast i procent. */
export function nextMilestone(list: Milestone[]): Milestone | null {
  const open = list.filter((m) => !m.done && m.progress)
  if (!open.length) return list.find((m) => !m.done) ?? null
  return open.reduce((a, b) => (b.progress!.now / b.progress!.target > a.progress!.now / a.progress!.target ? b : a))
}

/** Satelliterna i en månads solsystem: Att göra-saker som bockades av den månaden, äldst först. */
export function monthSatellites(tasks: Task[], month: string): Task[] {
  return tasks
    .filter((t) => t.doneOn && monthOfWeek(weekStart(t.doneOn)) === month)
    .sort((a, b) => a.doneOn!.localeCompare(b.doneOn!) || a.created - b.created)
}

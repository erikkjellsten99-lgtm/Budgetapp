// Utveckling i procent: hur stor del av veckomålen som klarats, vecka för vecka och per vana.
// Rena funktioner med tester bredvid (progress.test.ts).

import { addDays, weekStart, type DateKey } from './dates'
import { weekCount, weekGoal, type Habit, type Log, type Paused } from './habits'

export interface WeekScore {
  monday: DateKey
  /** Gjorda dagar, högst målet per vana (extra dagar räknas inte över 100 %). */
  done: number
  /** Summan av veckomålen (sänkta för pausade dagar och dagar innan vanan fanns). */
  goal: number
  /** 0–100, eller null om veckan inte hade något mål. */
  pct: number | null
  /** Veckan pågår fortfarande. */
  current: boolean
}

const pctOf = (done: number, goal: number) => (goal > 0 ? Math.round((done / goal) * 100) : null)

/** En vanas andel av veckomålet en viss vecka. */
function habitWeek(habit: Habit, log: Log, paused: Paused, monday: DateKey) {
  const goal = weekGoal(habit, paused, monday)
  return { done: Math.min(weekCount(log, habit.id, monday), goal), goal }
}

/** Alla vanors procent av veckomålen, vecka för vecka. Äldst först, sist den pågående veckan. */
export function weeklyScores(habits: Habit[], log: Log, paused: Paused, today: DateKey, weeks = 8): WeekScore[] {
  const thisMonday = weekStart(today)
  const out: WeekScore[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -7 * i)
    let done = 0
    let goal = 0
    for (const h of habits) {
      const w = habitWeek(h, log, paused, monday)
      done += w.done
      goal += w.goal
    }
    out.push({ monday, done, goal, pct: pctOf(done, goal), current: i === 0 })
  }
  // Veckor innan första vanan fanns visas inte.
  const first = out.findIndex((w) => w.goal > 0)
  return first === -1 ? out.slice(-1) : out.slice(first)
}

export interface HabitTrend {
  habit: Habit
  /** Procent av målet de senaste hela veckorna (högst 4). */
  pct: number | null
  /** Samma för veckorna innan (lika många), för jämförelse. */
  prevPct: number | null
  /** Antal hela veckor som räknats. */
  weeks: number
}

/**
 * Per vana: andel av veckomålet de senaste hela veckorna (den pågående räknas inte, den är inte slut),
 * jämfört med lika många veckor innan.
 */
export function habitTrends(habits: Habit[], log: Log, paused: Paused, today: DateKey, span = 4): HabitTrend[] {
  const lastMonday = addDays(weekStart(today), -7)
  return habits.map((habit) => {
    const sum = (from: number) => {
      let done = 0
      let goal = 0
      let weeks = 0
      for (let i = from; i < from + span; i++) {
        const w = habitWeek(habit, log, paused, addDays(lastMonday, -7 * i))
        // Veckor där vanan bara fanns (eller gick att göra) en liten del räknas inte – annars kan 1 av 1 bli 100 %.
        if (w.goal === 0 || w.goal < Math.min(7, habit.goal) * 0.6) continue
        done += w.done
        goal += w.goal
        weeks++
      }
      return { pct: pctOf(done, goal), weeks }
    }
    const now = sum(0)
    const before = sum(span)
    return { habit, pct: now.pct, prevPct: before.pct, weeks: now.weeks }
  })
}

/** Skillnad i procentenheter, t.ex. "+12" eller "−5". Null om något saknas. */
export function change(now: number | null, before: number | null): number | null {
  return now === null || before === null ? null : now - before
}

// Månaden (galaxen): månadens veckor är de ISO-veckor vars torsdag ligger i månaden,
// så att varje vecka hör till exakt en månad. Varje vecka blir en planet.

export interface MonthWeek {
  monday: DateKey
  /** Procent av veckomålet (0–100), null om veckan inte hade något mål. */
  pct: number | null
  done: number
  goal: number
  state: 'past' | 'current' | 'future'
}

export interface MonthScore {
  /** "2026-10" */
  month: string
  weeks: MonthWeek[]
  /** Gjort hittills av hela månadens mål, 0–100. Når 100 först när alla veckor är klara. */
  pct: number
  /** Antal bockningar i månadens veckor (blir stjärnor). */
  checks: number
}

const MONTH_NAMES = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** "oktober" (med år om det inte är samma år som today). */
export function monthName(month: string, today?: DateKey): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTH_NAMES[m - 1]
  return today && today.slice(0, 4) !== String(y) ? `${name} ${y}` : name
}

/** Månaden en vecka hör till: torsdagens månad. */
export const monthOfWeek = (monday: DateKey) => addDays(monday, 3).slice(0, 7)

/** Måndagarna i en månads veckor. */
export function monthMondays(month: string): DateKey[] {
  const first = weekStart(`${month}-01`)
  const out: DateKey[] = []
  for (let monday = first; ; monday = addDays(monday, 7)) {
    const m = monthOfWeek(monday)
    if (m > month) break
    if (m === month) out.push(monday)
  }
  return out
}

/** Föregående månad, "2026-10" → "2026-09". */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** Hur långt månadens galax har kommit. Kommande veckor räknas med sitt mål, så 100 % kräver hela månaden. */
export function monthScore(habits: Habit[], log: Log, paused: Paused, today: DateKey, month = monthOfWeek(weekStart(today))): MonthScore {
  const thisMonday = weekStart(today)
  let done = 0
  let goal = 0
  let checks = 0
  const weeks: MonthWeek[] = monthMondays(month).map((monday) => {
    const state = monday < thisMonday ? 'past' : monday === thisMonday ? 'current' : 'future'
    let d = 0
    let g = 0
    for (const h of habits) {
      const w = habitWeek(h, log, state === 'future' ? new Set() : paused, monday)
      g += w.goal
      if (state !== 'future') {
        d += w.done
        checks += weekCount(log, h.id, monday)
      }
    }
    done += d
    goal += g
    return { monday, done: d, goal: g, pct: g > 0 && state !== 'future' ? Math.round((d / g) * 100) : null, state }
  })
  return { month, weeks, pct: goal > 0 ? Math.round((done / goal) * 100) : 0, checks }
}

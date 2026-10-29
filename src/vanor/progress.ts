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

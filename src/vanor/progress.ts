// Utveckling i procent: hur stor del av veckomålen som klarats, vecka för vecka och per vana.
// Rena funktioner med tester bredvid (progress.test.ts).

import { addDays, weekday, weekStart, type DateKey } from './dates'
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

export interface MonthForecast {
  /** Var månaden landar med samma takt som hittills (0–100), eller null om det är för tidigt att säga. */
  projected: number | null
  /** Nästa jämna mål över prognosen, t.ex. 80 eller 90 (högst 100). */
  target: number
  /** Ungefär hur många bockar per vecka som behövs resten av månaden för att nå target. */
  perWeekNeeded: number | null
  /** Bockar per vecka hittills (räknat mot målen, högst målet per vana). */
  perWeekNow: number
}

/**
 * Prognos för månaden: takten hittills (gjort / mål för den tid som gått) antas hålla resten av månaden.
 * Innan en hel veckas data finns är det för tidigt att säga.
 */
export function monthForecast(score: MonthScore, today: DateKey): MonthForecast {
  const currentWeek = score.weeks.find((w) => w.state === 'current')
  const elapsedInCurrent = currentWeek ? (weekday(today) + 1) / 7 : 0
  let done = 0
  let goalSoFar = 0
  let total = 0
  let weeksElapsed = 0
  for (const w of score.weeks) {
    total += w.goal
    if (w.state === 'past') {
      done += w.done
      goalSoFar += w.goal
      if (w.goal > 0) weeksElapsed += 1
    } else if (w.state === 'current') {
      done += w.done
      goalSoFar += w.goal * elapsedInCurrent
      if (w.goal > 0) weeksElapsed += elapsedInCurrent
    }
  }
  const perWeekNow = weeksElapsed > 0 ? done / weeksElapsed : 0
  if (weeksElapsed < 1 || goalSoFar <= 0 || total <= 0) {
    return { projected: null, target: 100, perWeekNeeded: null, perWeekNow: Math.round(perWeekNow) }
  }
  const projected = Math.min(100, Math.round((done / goalSoFar) * 100))
  const target = Math.min(100, Math.floor(projected / 10) * 10 + 10)
  const weeksLeft = score.weeks.filter((w) => w.goal > 0).length - weeksElapsed
  const needed = (target / 100) * total - done
  const perWeekNeeded = weeksLeft > 0.3 && needed > 0 ? Math.ceil(needed / weeksLeft) : null
  return { projected, target, perWeekNeeded, perWeekNow: Math.round(perWeekNow) }
}

export interface GalaxyMonth extends MonthScore {
  /** Den pågående månaden (byggs fortfarande). */
  current: boolean
  /** Bästa veckan i månaden, för detaljerna. */
  bestWeek: MonthWeek | null
}

/** Alla månader sedan första vanan, äldst först. Galaxen börjar aldrig om – varje månad blir ett solsystem. */
export function galaxyMonths(habits: Habit[], log: Log, paused: Paused, today: DateKey): GalaxyMonth[] {
  if (!habits.length) return []
  const current = monthOfWeek(weekStart(today))
  const first = monthOfWeek(weekStart(habits.reduce((min, h) => (h.created < min ? h.created : min), today)))
  const months: string[] = []
  for (let m = current; m >= first && months.length < 600; m = previousMonth(m)) months.unshift(m)
  return months
    .map((month) => {
      const score = monthScore(habits, log, paused, today, month)
      const scored = score.weeks.filter((w) => w.pct !== null)
      const bestWeek = scored.length ? scored.reduce((a, b) => ((b.pct ?? 0) > (a.pct ?? 0) ? b : a)) : null
      return { ...score, current: month === current, bestWeek }
    })
    .filter((m) => m.current || m.weeks.some((w) => w.goal > 0))
}

export interface MonthPlanet {
  id: string
  name: string
  /** Bockar för vanan under månaden. */
  checks: number
  /** Andel av vanans mål under månadens veckor hittills (0–1). Styr planetens storlek. */
  share: number
  /** Veckor där målet klarades, av de veckor som är avgjorda (slut, eller redan klarade). */
  weeksMet: number
  weeksTotal: number
  /** Kometer: varje 7 dagar i rad under månaden. */
  comets: number
}

/** Antal hela 7-dagarsserier (dagar i rad) bland `days`. Pausade dagar bryter inte serien men räknas inte. */
export function sevenDayRuns(log: Log, habitId: string, days: DateKey[], paused: Paused): number {
  let run = 0
  let runs = 0
  for (const day of days) {
    if (log[day]?.includes(habitId)) {
      run++
      if (run === 7) {
        runs++
        run = 0
      }
    } else if (!paused.has(day)) run = 0
  }
  return runs
}

/** Planeterna i en månads solsystem: en per vana som fanns under månaden. */
export function monthPlanets(habits: Habit[], log: Log, paused: Paused, today: DateKey, month: string): MonthPlanet[] {
  const mondays = monthMondays(month).filter((m) => m <= today)
  if (!mondays.length) return []
  const days = mondays.flatMap((m) => Array.from({ length: 7 }, (_, i) => addDays(m, i))).filter((d) => d <= today)
  const last = addDays(mondays[mondays.length - 1], 6)
  return [...habits]
    .sort((a, b) => a.order - b.order)
    .filter((h) => h.created <= (last < today ? last : today))
    .map((h) => {
      const checks = days.filter((d) => d >= h.created && log[d]?.includes(h.id)).length
      const weeks = mondays.filter((m) => addDays(m, 6) >= h.created).length
      let weeksMet = 0
      let weeksTotal = 0
      for (const monday of mondays) {
        const w = habitWeek(h, log, paused, monday)
        if (w.goal === 0) continue
        const met = w.done >= w.goal
        if (met || addDays(monday, 6) < today) {
          weeksTotal++
          if (met) weeksMet++
        }
      }
      return {
        id: h.id,
        name: h.name,
        checks,
        share: Math.min(1, checks / Math.max(1, h.goal * weeks)),
        weeksMet,
        weeksTotal,
        comets: sevenDayRuns(log, h.id, days, paused),
        archived: h.archived,
      }
    })
    .filter((p) => !p.archived || p.checks > 0)
    .map(({ archived: _archived, ...p }) => p)
}

export interface WeekHabit {
  id: string
  name: string
  done: number
  goal: number
}

/** Varje vanas del av en vecka (för att se vilka vanor som klarades och vilka som drog ner). */
export function weekHabits(habits: Habit[], log: Log, paused: Paused, monday: DateKey): WeekHabit[] {
  return [...habits]
    .sort((a, b) => a.order - b.order)
    .map((h) => ({ id: h.id, name: h.name, ...habitWeek(h, log, paused, monday) }))
    .filter((h) => h.goal > 0)
}

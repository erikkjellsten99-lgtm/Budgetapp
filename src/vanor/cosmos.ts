// Logiken bakom galaxen (CosmosView), utan 3D: dagens poäng som en soluppgång över Jorden,
// en stjärna per vana (klass efter hur ofta den blir av) och ett solsystem per område.
// Rena funktioner, tester i cosmos.test.ts.

import { areaOf, AREAS, NO_AREA } from './areas'
import type { DateKey } from './dates'
import { daySummary, dayStreak, todayInfo, weekCount, weekGoal, type Habit, type Log, type Paused } from './habits'
import { habitTrends, monthName, monthOfWeek, monthPlanets } from './progress'
import { weekStart } from './dates'

/* ---------- Dagens poäng: solen över Jorden ---------- */

export interface DayPhase {
  /** "Gryning" */
  name: string
  /** "Horisonten har börjat glöda." */
  text: string
}

export interface DayScore {
  /** 0–100. */
  score: number
  phase: DayPhase
  /** Dagens vanor: bockade av de som räknas idag (som rubriken i Vanor). */
  done: number
  total: number
  /** Första vanan som måste göras idag och inte är bockad. */
  next: Habit | null
  /** True när inget måste göras idag – då visar poängen veckans mål i stället. */
  week: boolean
}

const PHASES: [number, DayPhase][] = [
  [0, { name: 'Natt', text: 'Solen har inte gått upp än.' }],
  [1, { name: 'Gryning', text: 'Horisonten har börjat glöda.' }],
  [25, { name: 'Soluppgång', text: 'Solen är på väg upp.' }],
  [50, { name: 'Förmiddag', text: 'Solen står högt över horisonten.' }],
  [75, { name: 'Dag', text: 'Nästan full sol.' }],
  [100, { name: 'Full sol', text: 'Allt är klart idag.' }],
]

export function dayPhase(score: number): DayPhase {
  let phase = PHASES[0][1]
  for (const [from, p] of PHASES) if (score >= from) phase = p
  return phase
}

/**
 * Dagens poäng: hur stor del av det som räknas idag (måste göras eller redan bockat) som är gjort.
 * Måste inget göras idag och inget är bockat visas veckans mål i stället.
 */
export function dayScore(habits: Habit[], log: Log, paused: Paused, today: DateKey): DayScore {
  const active = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order)
  const infos = active.map((h) => ({ h, info: todayInfo(h, log, today, paused) }))
  const sum = daySummary(infos.map((x) => x.info))
  const next = infos.find((x) => x.info.must && !x.info.done)?.h ?? null
  if (sum.total > 0) {
    const score = Math.round((sum.done / sum.total) * 100)
    return { score, phase: dayPhase(score), done: sum.done, total: sum.total, next, week: false }
  }
  const monday = weekStart(today)
  let goal = 0
  let done = 0
  for (const h of active) {
    const g = weekGoal(h, paused, monday)
    goal += g
    done += Math.min(g, weekCount(log, h.id, monday))
  }
  const score = goal ? Math.round((done / goal) * 100) : 0
  return { score, phase: dayPhase(score), done: sum.done, total: sum.total, next: null, week: true }
}

/* ---------- Stjärnorna: en per vana ---------- */

export type StarKind = 'proto' | 'red' | 'orange' | 'yellow' | 'blue'

export const STAR_KINDS: Record<StarKind, { name: string; many: string; color: string; advice: string }> = {
  proto: {
    name: 'Protostjärna',
    many: 'protostjärnor',
    color: '#ff9a7a',
    advice: 'Stjärnan håller på att födas. Gör vanan oftare så samlas gasen till en riktig stjärna (över 20 %).',
  },
  red: {
    name: 'Röd dvärg',
    many: 'röda dvärgar',
    color: '#ff7a55',
    advice: 'Vanan har kommit igång. Kommer du över 45 % blir den en orange dvärg.',
  },
  orange: {
    name: 'Orange dvärg',
    many: 'orange dvärgar',
    color: '#ffb46a',
    advice: 'Vanan sitter delvis. Lyfter du den över 70 % blir stjärnan het och gul.',
  },
  yellow: {
    name: 'Gul stjärna',
    many: 'gula stjärnor',
    color: '#fff1c4',
    advice: 'Vanan sitter. Över 90 % blir den en blå jätte.',
  },
  blue: {
    name: 'Blå jätte',
    many: 'blå jättar',
    color: '#c4d8ff',
    advice: 'Vanan sitter som berget. Stjärnan brinner som starkast.',
  },
}

/** Stjärnans klass efter hur stor del av målet som blev av (0–100). */
export function starKind(pct: number | null): StarKind {
  const p = pct ?? 0
  return p < 20 ? 'proto' : p < 45 ? 'red' : p < 70 ? 'orange' : p < 90 ? 'yellow' : 'blue'
}

/** "now" = de senaste veckorna, annars en månad som "2026-10". */
export type Period = 'now' | string

export interface HabitStar {
  id: string
  name: string
  area: string
  /** Andel av målet (0–100), eller null om det inte finns något att räkna på än. */
  pct: number | null
  kind: StarKind
  streak: number
  /** Vad procenten gäller, t.ex. "de senaste fyra veckorna" eller "i oktober". */
  span: string
}

/**
 * En stjärna per aktiv vana. Nu: andel av veckomålen de senaste hela veckorna (högst fyra);
 * finns ingen hel vecka än räknas månaden hittills. En månad: andel av målet den månaden.
 */
export function habitStars(habits: Habit[], log: Log, paused: Paused, today: DateKey, period: Period = 'now'): HabitStar[] {
  const active = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order)
  const month = period === 'now' ? monthOfWeek(weekStart(today)) : period
  const planets = new Map(monthPlanets(habits, log, paused, today, month).map((p) => [p.id, p]))
  const trends = period === 'now' ? new Map(habitTrends(active, log, paused, today).map((t) => [t.habit.id, t])) : null
  return active.map((h) => {
    const trend = trends?.get(h.id)
    const planet = planets.get(h.id)
    let pct: number | null
    let span: string
    if (trend && trend.pct !== null) {
      pct = trend.pct
      span = trend.weeks === 1 ? 'förra veckan' : `de senaste ${['', '', 'två', 'tre', 'fyra'][trend.weeks] ?? trend.weeks} veckorna`
    } else {
      pct = planet ? Math.round(planet.share * 100) : null
      span = period === 'now' ? 'hittills den här månaden' : `i ${monthName(month, today)}`
    }
    return { id: h.id, name: h.name, area: areaOf(h), pct, kind: starKind(pct), streak: dayStreak(log, h.id, today, paused), span }
  })
}

/* ---------- Solsystemen: ett per område ---------- */

export interface AreaSystem {
  area: string
  stars: HabitStar[]
  /** Snittet av stjärnornas procent, eller null. */
  pct: number | null
  kind: StarKind
  /** "4 orange dvärgar · 1 protostjärna" */
  summary: string
}

/** Områdena i fast ordning (Övrigt sist), bara de som har vanor. */
export function areaSystems(stars: HabitStar[]): AreaSystem[] {
  const order = [...AREAS, NO_AREA] as string[]
  const areas = [...new Set(stars.map((s) => s.area))].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia < 0 ? order.length - 1 : ia) - (ib < 0 ? order.length - 1 : ib) || a.localeCompare(b, 'sv')
  })
  return areas.map((area) => {
    const list = stars.filter((s) => s.area === area)
    const known = list.filter((s) => s.pct !== null)
    const pct = known.length ? Math.round(known.reduce((n, s) => n + (s.pct ?? 0), 0) / known.length) : null
    return { area, stars: list, pct, kind: starKind(pct), summary: kindSummary(list) }
  })
}

/** "4 orange dvärgar · 1 protostjärna": antal per klass, starkast först. */
export function kindSummary(stars: HabitStar[]): string {
  const order: StarKind[] = ['blue', 'yellow', 'orange', 'red', 'proto']
  return order
    .map((k) => [k, stars.filter((s) => s.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${n === 1 ? STAR_KINDS[k].name.toLowerCase() : STAR_KINDS[k].many}`)
    .join(' · ')
}

import { addDays, weekStart, weekday, type DateKey } from './dates'

export interface Habit {
  id: string
  name: string
  /** Mål i dagar per vecka, 1–7. 7 = varje dag. */
  goal: number
  /** Dagen vanan lades till. */
  created: DateKey
  /** Vanor den här hör ihop med, t.ex. Stretching efter Gym och Löpning. */
  after: string[]
  /** Plats i listan (lägst först). */
  order: number
  archived: boolean
  /** Minsta godkända version, t.ex. "2 min". Räknas som klar en dålig dag. Tom = ingen. */
  minimum?: string
  /** Tid för påminnelse, t.ex. "21:00". Tom = ingen. Skickas av servern (se push.ts). */
  remind?: string
}

/** Loggen: datum → id:n för vanorna som är klara den dagen. */
export type Log = Record<DateKey, string[]>

/** Pausade dagar (sjuk/skadad): bryter inga streaks och sänker veckomålen. */
export type Paused = ReadonlySet<DateKey>

const NO_PAUSE: Paused = new Set()

/** Längsta bakåtblick, så att en loop aldrig kan bli evig (ca 10 år). */
const MAX_STEPS = 3700

export const isDaily = (h: Habit) => h.goal >= 7

export const isDone = (log: Log, habitId: string, date: DateKey) =>
  log[date]?.includes(habitId) ?? false

/** Antal klara dagar i veckan som börjar på måndagen `monday`. */
export function weekCount(log: Log, habitId: string, monday: DateKey): number {
  let n = 0
  for (let i = 0; i < 7; i++) if (isDone(log, habitId, addDays(monday, i))) n++
  return n
}

/** Antal pausade dagar i veckan som börjar på `monday`. */
export function pausedDays(paused: Paused, monday: DateKey): number {
  let n = 0
  for (let i = 0; i < 7; i++) if (paused.has(addDays(monday, i))) n++
  return n
}

/**
 * Veckomålet i proportion till dagarna som gick att använda: pausade dagar och dagar
 * innan vanan fanns räknas bort. Mål 4 med 2 pausade dagar → 4 × 5/7 ≈ 3.
 * 0 betyder att veckan inte räknas alls.
 */
export function weekGoal(habit: Habit, paused: Paused, monday: DateKey): number {
  let active = 0
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i)
    if (day >= habit.created && !paused.has(day)) active++
  }
  return Math.min(habit.goal, Math.round((habit.goal * active) / 7))
}

/**
 * Dagar i rad som vanan är gjord. Är dagens inte bockad än räknas från igår,
 * så att streaken inte ser bruten ut mitt på dagen. Pausade dagar hoppas över.
 */
export function dayStreak(log: Log, habitId: string, today: DateKey, paused: Paused = NO_PAUSE): number {
  let day = isDone(log, habitId, today) ? today : addDays(today, -1)
  let n = 0
  for (let step = 0; step < MAX_STEPS; step++) {
    if (isDone(log, habitId, day)) n++
    else if (!paused.has(day)) break
    day = addDays(day, -1)
  }
  return n
}

/**
 * Veckor i rad med nått veckomål. Pågående vecka räknas bara om målet redan
 * är nått – annars räknas från förra veckan, eftersom veckan inte är slut.
 * Helt pausade veckor hoppas över.
 */
export function weekStreak(log: Log, habit: Habit, today: DateKey, paused: Paused = NO_PAUSE): number {
  let monday = weekStart(today)
  const reached = (m: DateKey) => weekCount(log, habit.id, m) >= Math.max(1, weekGoal(habit, paused, m))
  if (!reached(monday)) monday = addDays(monday, -7)
  let n = 0
  const firstWeek = weekStart(habit.created)
  for (let step = 0; step < MAX_STEPS / 7 && monday >= firstWeek; step++) {
    if (weekGoal(habit, paused, monday) === 0) {
      monday = addDays(monday, -7)
      continue
    }
    if (!reached(monday)) break
    n++
    monday = addDays(monday, -7)
  }
  return n
}

export type PillKind = 'plain' | 'ok' | 'warn' | 'bad' | 'fire'
export interface Pill {
  kind: PillKind
  text: string
}

export interface TodayInfo {
  /** Bockad idag. */
  done: boolean
  /** Ska göras idag (står under "Att göra idag" om den inte är bockad). */
  due: boolean
  /** Klara dagar denna vecka. */
  count: number
  /** Veckomålet efter pausade dagar. */
  goal: number
  pills: Pill[]
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Hur en vana står till idag: om den ska göras, och vilka lappar som visas. */
export function todayInfo(habit: Habit, log: Log, today: DateKey, paused: Paused = NO_PAUSE): TodayInfo {
  const done = isDone(log, habit.id, today)
  const monday = weekStart(today)
  const count = weekCount(log, habit.id, monday)
  const goal = weekGoal(habit, paused, monday)
  const pausedToday = paused.has(today)
  const pills: Pill[] = []
  let due = !pausedToday
  // En "efter"-vana (t.ex. Stretching efter Gym) görs bara de dagar passet är gjort.
  const linked = habit.after.length > 0
  const trained = linked && habit.after.some((id) => isDone(log, id, today))

  if (isDaily(habit)) {
    const days = dayStreak(log, habit.id, today, paused)
    if (days > 0) pills.push({ kind: 'fire', text: `${plural(days, 'dag', 'dagar')} i rad` })
  } else {
    // Dagar kvar i veckan som går att använda, idag inräknat (om idag inte är pausad).
    let daysLeft = 0
    for (let i = weekday(today); i < 7; i++) if (!paused.has(addDays(monday, i))) daysLeft++
    const need = Math.max(0, goal - count)
    if (goal === 0) {
      // Veckan räknas inte (ny vana sent i veckan, eller pausad). Inget krav, men går att bocka.
      if (!done) due = false
      if (habit.created > monday) pills.push({ kind: 'plain', text: 'Ny vana, räknas från nästa vecka' })
    } else if (need === 0 && !done) {
      due = false
      pills.push({ kind: 'ok', text: 'Veckomål klart' })
    } else if (done) {
      if (need === 0) pills.push({ kind: 'plain', text: 'Veckomål klart' })
    } else if (!pausedToday && !linked) {
      const tight = need >= daysLeft
      const over = need > daysLeft
      const left = daysLeft === 1 ? 'veckan slutar idag' : `${daysLeft} dagar kvar av veckan`
      pills.push({ kind: 'plain', text: `${need} kvar, ${left}` })
      // Man kan bara bocka en gång per dag: fler kvar än dagar = målet nås inte.
      if (over) pills.push({ kind: 'bad', text: 'Veckomålet hinns inte' })
      else if (tight) pills.push({ kind: 'warn', text: 'Måste bli idag' })
    }
    const weeks = weekStreak(log, habit, today, paused)
    if (weeks > 1) pills.push({ kind: 'fire', text: `${weeks} veckor i rad` })
  }

  if (linked && !done) {
    due = trained && (isDaily(habit) || count < goal)
    if (due) pills.unshift({ kind: 'warn', text: 'Efter dagens pass' })
  }

  if (pausedToday && !done && !due) pills.unshift({ kind: 'plain', text: 'Pausad idag' })

  return { done, due, count, goal, pills }
}

/** Sammanfattning för rubriken: hur många som ska göras idag och hur många som är klara. */
export function daySummary(infos: TodayInfo[]): { total: number; done: number } {
  const relevant = infos.filter((i) => i.due || i.done)
  return { total: relevant.length, done: relevant.filter((i) => i.done).length }
}

export const NAME_MAX = 40

/** Jämför namn utan hänsyn till stora/små bokstäver och mellanslag (å/ä/ö på svenska). */
export const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('sv') === b.trim().toLocaleLowerCase('sv')

/** Felmeddelande för ett vanenamn, eller null om det är okej. */
export function nameError(name: string, active: Habit[], exceptId?: string): string | null {
  const text = name.trim()
  if (!text) return 'Skriv ett namn.'
  if (text.length > NAME_MAX) return `Högst ${NAME_MAX} tecken.`
  if (active.some((h) => h.id !== exceptId && sameName(h.name, text))) return 'Den vanan finns redan.'
  return null
}

/** Målet som text, t.ex. "Varje dag" eller "4 gånger i veckan". */
export const goalText = (goal: number) =>
  goal >= 7 ? 'Varje dag' : `${goal} ${goal === 1 ? 'gång' : 'gånger'} i veckan`

/**
 * Hur vanan beskrivs i listan, t.ex. "4 gånger i veckan" eller "Efter Gym".
 * `names` slår upp namnet på kopplade vanor.
 */
export function habitPlan(habit: Habit, names: (id: string) => string | undefined): string {
  const after = habit.after.map(names).filter(Boolean) as string[]
  if (!after.length) return goalText(habit.goal)
  return `Efter ${after.join(' eller ')}`
}

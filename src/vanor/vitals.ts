// Hälsodatan i galaxen (CosmosView): vad Hälsogalaxens kärna, sömnnebulosan och stegringen ska visa.
// Ren logik utan 3D, tester i vitals.test.ts. Läser samma hälsodata som kortet Hälsa idag.

import { addDays, type DateKey } from './dates'
import type { Habit } from './habits'
import type { HealthDay, HealthMetric, SleepStage } from '../../supabase/functions/inbox/health'

export interface Vitals {
  /** Dagen siffrorna gäller (idag, annars i går). */
  date: DateKey
  isToday: boolean
  /** Vilopulsen som kärnan slår i, och hur den ligger mot ditt snitt. */
  pulse: { bpm: number; trend: number | null } | null
  /** Nattens sömn: längd, poäng och hur stor del varje fas var (för nebulosans färgband). */
  sleep: {
    hours: number
    score: number | null
    /** Andel av natten per fas, i nattens ordning (för färgbanden). Tom om faserna saknas. */
    bands: { k: SleepStage['k']; share: number }[]
    deepH: number | null
    remH: number | null
  } | null
  /** Dagens steg mot målet (10k steg-vanans gräns, annars 10 000). */
  steps: { value: number; goal: number; part: number; habit: string | null } | null
  /** Träningspass idag: ett meteorspår per pass. */
  workouts: number
  /** Kondition: hur starkt kärnan lyser (0–1) och trenden mot snittet. */
  vo2: { value: number; trend: number | null } | null
  hrv: { value: number; trend: number | null } | null
  /** 0–1: kärnans glöd, av VO₂ max (mest) och HRV-trenden. */
  glow: number
}

/** Ditt snitt de 14 dagarna före, eller null om det finns färre än 3 dagar. */
function trendOf(health: HealthDay[], metric: HealthMetric, date: DateKey, value: number): number | null {
  const from = addDays(date, -14)
  const past = health.filter((d) => d.date < date && d.date >= from && d.values[metric] !== undefined).map((d) => d.values[metric]!)
  if (past.length < 3) return null
  return value - past.reduce((a, b) => a + b, 0) / past.length
}

/** Hur stor del av natten varje fas var, i den ordning faserna kom. Fasbyten i rad slås ihop. */
export function sleepBands(stages: SleepStage[] | undefined): { k: SleepStage['k']; share: number }[] {
  if (!stages?.length) return []
  const total = stages.reduce((a, s) => a + Math.max(0, s.e - s.s), 0)
  if (total <= 0) return []
  const out: { k: SleepStage['k']; share: number }[] = []
  for (const s of stages) {
    const share = Math.max(0, s.e - s.s) / total
    const last = out[out.length - 1]
    if (last && last.k === s.k) last.share += share
    else out.push({ k: s.k, share })
  }
  return out
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Det galaxen visar av hälsodatan. Null när ingenting har kommit de senaste två dagarna, då ser
 * Hälsogalaxen ut som förut. `habits` används för stegmålet (vanan med regel på steg).
 */
export function galaxyVitals(health: HealthDay[], habits: Habit[], today: DateKey): Vitals | null {
  const byDate = new Map(health.map((d) => [d.date, d]))
  const day = byDate.get(today) ?? byDate.get(addDays(today, -1))
  if (!day || !Object.keys(day.values).length) return null
  const v = day.values

  const pulse = v.restingHr !== undefined ? { bpm: v.restingHr, trend: trendOf(health, 'restingHr', day.date, v.restingHr) } : null
  const sleep =
    v.sleepH !== undefined && v.sleepH > 0
      ? {
          hours: v.sleepH,
          score: v.sleepScore ?? null,
          bands: sleepBands(day.stages),
          deepH: v.sleepDeepH ?? null,
          remH: v.sleepRemH ?? null,
        }
      : null
  const stepHabit = habits.find((h) => !h.archived && h.auto?.metric === 'steps')
  const goal = stepHabit?.auto?.min && stepHabit.auto.min > 0 ? stepHabit.auto.min : 10000
  const steps = v.steps !== undefined ? { value: v.steps, goal, part: clamp01(v.steps / goal), habit: stepHabit?.name ?? null } : null
  const vo2 = v.vo2Max !== undefined ? { value: v.vo2Max, trend: trendOf(health, 'vo2Max', day.date, v.vo2Max) } : null
  const hrv = v.hrvMs !== undefined ? { value: v.hrvMs, trend: trendOf(health, 'hrvMs', day.date, v.hrvMs) } : null
  // VO₂ max 30–55 ml/kg/min ger 0–1, och en HRV över ditt snitt lägger till lite
  const fit = vo2 ? clamp01((vo2.value - 30) / 25) : 0.4
  const hrvBoost = hrv?.trend ? Math.max(-0.15, Math.min(0.15, hrv.trend / 40)) : 0
  return {
    date: day.date,
    isToday: day.date === today,
    pulse,
    sleep,
    steps,
    workouts: Math.max(0, Math.round(v.workouts ?? 0)),
    vo2,
    hrv,
    glow: clamp01(fit + hrvBoost),
  }
}

/** Pulsens ljus över ett hjärtslag (0–1): ett tydligt slag och ett svagare efterslag, sedan vila. */
export function heartbeat(t: number, bpm: number): number {
  const period = 60 / Math.max(30, Math.min(120, bpm))
  const p = (((t % period) + period) % period) / period
  const beat = (center: number, width: number) => Math.exp(-(((p - center) / width) ** 2))
  return Math.min(1, beat(0.06, 0.05) + 0.55 * beat(0.24, 0.06))
}

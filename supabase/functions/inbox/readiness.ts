// Dagsform: hur utvilad man är idag, räknat ur hälsodatan från Apple Hälsa (se health.ts).
// Ingen AI och ingen medicinsk bedömning: varje mått jämförs med personens egen normalnivå (medianen av de
// senaste veckorna) och ger plus eller minus. Gränserna är Claudes bedömning, inte kliniska gränsvärden.
// Delad kod: appen visar den i Challenges, och servern kan använda samma uträkning.

import type { HealthDay, HealthMetric } from './health.ts'
import type { DateKey } from './dates.ts'

export type ReadinessLevel = 'go' | 'easy' | 'rest' | 'unknown'

export interface ReadinessSignal {
  metric: HealthMetric
  /** −2 = tydligt sämre än vanligt, −1 = lite sämre, 0 = som vanligt, +1 = bättre. */
  points: number
  /** T.ex. "Vilopuls 58, 6 över ditt vanliga". */
  text: string
}

export interface Readiness {
  level: ReadinessLevel
  score: number
  signals: ReadinessSignal[]
  /** Mått som skulle göra bedömningen säkrare men saknas idag. */
  missing: HealthMetric[]
}

/** Så många tidigare dagar behövs innan ett mått kan jämföras med det vanliga. */
export const MIN_BASELINE_DAYS = 5
/** Så långt bakåt räknas det vanliga. */
export const BASELINE_DAYS = 28

/** Måtten som säger mest om återhämtning. Saknas de, säger appen det. */
export const KEY_METRICS: HealthMetric[] = ['hrvMs', 'restingHr', 'sleepH']

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Det vanliga värdet: medianen av dagarna före idag, eller null om de är för få. */
export function baseline(days: HealthDay[], metric: HealthMetric, today: DateKey): number | null {
  const values = days
    .filter((d) => d.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, BASELINE_DAYS)
    .map((d) => d.values[metric])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return values.length >= MIN_BASELINE_DAYS ? median(values) : null
}

const comma = (n: number, decimals = 0) => n.toFixed(decimals).replace('.', ',')
const hours = (h: number) => {
  const total = Math.round(h * 60)
  return `${Math.floor(total / 60)} h ${total % 60} min`
}

/** Dagens form ur dagens värden och de senaste veckornas. */
export function readiness(days: HealthDay[], today: DateKey): Readiness {
  const now = days.find((d) => d.date === today)?.values ?? {}
  const signals: ReadinessSignal[] = []
  const base = (m: HealthMetric) => baseline(days, m, today)

  // Sömn: bedöms mot ett fast behov, så att en vana av för lite sömn inte räknas som bra.
  if (typeof now.sleepH === 'number') {
    const h = now.sleepH
    const points = h < 6 ? -2 : h < 7 ? -1 : h >= 8 ? 1 : 0
    signals.push({ metric: 'sleepH', points, text: `Sömn ${hours(h)}${points < 0 ? ', under 7 timmar' : ''}` })
  } else if (typeof now.sleepScore === 'number') {
    const s = now.sleepScore
    const points = s < 60 ? -2 : s < 75 ? -1 : s >= 90 ? 1 : 0
    signals.push({ metric: 'sleepScore', points, text: `Sömnpoäng ${comma(s)}` })
  }

  // Pulsvariabilitet: lägre än vanligt tyder på att kroppen inte återhämtat sig.
  const hrv = base('hrvMs')
  if (typeof now.hrvMs === 'number' && hrv) {
    const ratio = now.hrvMs / hrv
    const points = ratio <= 0.8 ? -2 : ratio <= 0.9 ? -1 : ratio >= 1.1 ? 1 : 0
    const diff = Math.round((ratio - 1) * 100)
    signals.push({
      metric: 'hrvMs',
      points,
      text: `Pulsvariabilitet ${comma(now.hrvMs)} ms, ${diff === 0 ? 'som vanligt' : `${Math.abs(diff)} % ${diff < 0 ? 'under' : 'över'} ditt vanliga`}`,
    })
  }

  // Vilopuls: högre än vanligt tyder på trötthet, stress eller begynnande sjukdom.
  const rhr = base('restingHr')
  if (typeof now.restingHr === 'number' && rhr) {
    const diff = Math.round(now.restingHr - rhr)
    const points = diff >= 7 ? -2 : diff >= 4 ? -1 : diff <= -3 ? 1 : 0
    signals.push({
      metric: 'restingHr',
      points,
      text: `Vilopuls ${comma(now.restingHr)}, ${diff === 0 ? 'som vanligt' : `${Math.abs(diff)} ${diff > 0 ? 'över' : 'under'} ditt vanliga`}`,
    })
  }

  // Andning och handledstemperatur under natten: ger bara minus, och bara när de sticker ut.
  const resp = base('respRate')
  if (typeof now.respRate === 'number' && resp && now.respRate - resp >= 1.5) {
    signals.push({ metric: 'respRate', points: -1, text: `Andning ${comma(now.respRate, 1)} per minut, högre än ditt vanliga` })
  }
  const temp = base('wristTemp')
  if (typeof now.wristTemp === 'number' && temp !== null && now.wristTemp - temp >= 0.5) {
    signals.push({ metric: 'wristTemp', points: -2, text: `Handledstemperatur ${comma(now.wristTemp - temp, 1)} °C över ditt vanliga` })
  }

  const missing = KEY_METRICS.filter((m) => !signals.some((s) => s.metric === m) && !(m === 'sleepH' && signals.some((s) => s.metric === 'sleepScore')))
  if (signals.length === 0) return { level: 'unknown', score: 0, signals, missing }
  const score = signals.reduce((sum, s) => sum + s.points, 0)
  const level: ReadinessLevel = score <= -3 ? 'rest' : score <= -1 ? 'easy' : 'go'
  return { level, score, signals, missing }
}

export const READINESS_TITLE: Record<ReadinessLevel, string> = {
  go: 'Kör som vanligt',
  easy: 'Ta det lite lugnare',
  rest: 'Ta det lugnt idag',
  unknown: 'Ingen bedömning än',
}

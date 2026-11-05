import { describe, expect, it } from 'vitest'
import { galaxyVitals, heartbeat, sleepBands } from './vitals'
import type { HealthDay } from '../../supabase/functions/inbox/health'
import type { Habit } from './habits'

const day = (date: string, values: HealthDay['values'], stages?: HealthDay['stages']): HealthDay => ({ date, updated: 0, values, ...(stages ? { stages } : {}) })

describe('hälsodatan i galaxen', () => {
  it('saknas data de senaste två dagarna visas inget', () => {
    expect(galaxyVitals([day('2026-11-01', { steps: 5 })], [], '2026-11-05')).toBeNull()
    expect(galaxyVitals([], [], '2026-11-05')).toBeNull()
  })

  it('tar gårdagen om idag saknas, och stegmålet från vanan', () => {
    const habits = [{ id: 's', name: '10k steg', auto: { metric: 'steps', min: 12000 } }] as unknown as Habit[]
    const v = galaxyVitals([day('2026-11-04', { steps: 6000 })], habits, '2026-11-05')!
    expect(v.isToday).toBe(false)
    expect(v.steps).toEqual({ value: 6000, goal: 12000, part: 0.5, habit: '10k steg' })
    expect(galaxyVitals([day('2026-11-05', { steps: 15000 })], [], '2026-11-05')!.steps!.part).toBe(1)
  })

  it('puls, sömn, kondition och trend mot snittet', () => {
    const health = [
      day('2026-11-01', { restingHr: 54, vo2Max: 37 }),
      day('2026-11-02', { restingHr: 52, vo2Max: 37 }),
      day('2026-11-03', { restingHr: 56, vo2Max: 37 }),
      day('2026-11-05', { restingHr: 50, vo2Max: 42.5, sleepH: 6.9, sleepScore: 95, workouts: 2 }),
    ]
    const v = galaxyVitals(health, [], '2026-11-05')!
    expect(v.pulse).toEqual({ bpm: 50, trend: -4 })
    expect(v.vo2!.trend).toBeCloseTo(5.5)
    expect(v.sleep!.score).toBe(95)
    expect(v.workouts).toBe(2)
    expect(v.glow).toBeCloseTo(0.5)
  })

  it('sömnens färgband: andel per fas, fasbyten i rad slås ihop', () => {
    const h = 3600000
    const bands = sleepBands([
      { k: 'core', s: 0, e: h },
      { k: 'core', s: h, e: 2 * h },
      { k: 'deep', s: 2 * h, e: 3 * h },
      { k: 'rem', s: 3 * h, e: 4 * h },
    ])
    expect(bands.map((b) => b.k)).toEqual(['core', 'deep', 'rem'])
    expect(bands[0].share).toBe(0.5)
    expect(sleepBands(undefined)).toEqual([])
  })

  it('hjärtslaget: starkt slag i början av varje period, vila emellan', () => {
    expect(heartbeat(0.06 * 1.2, 50)).toBeGreaterThan(0.9)
    expect(heartbeat(0.7 * 1.2, 50)).toBeLessThan(0.05)
    // Samma ställe i nästa slag
    expect(heartbeat(1.2 + 0.072, 50)).toBeCloseTo(heartbeat(0.072, 50))
  })
})

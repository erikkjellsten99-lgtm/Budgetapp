import { describe, expect, it } from 'vitest'
import type { HealthDay, HealthMetric } from './health.ts'
import { baseline, readiness } from './readiness.ts'

const TODAY = '2026-11-16'
const day = (date: string, values: Partial<Record<HealthMetric, number>>): HealthDay => ({ date, updated: 1, values })
/** Tio vanliga dagar före idag: pulsvariabilitet 60, vilopuls 52, sömn 7,5 h. */
const usual = Array.from({ length: 10 }, (_, i) => day(`2026-11-${String(6 + i).padStart(2, '0')}`, { hrvMs: 60, restingHr: 52, sleepH: 7.5, respRate: 14, wristTemp: 35 }))
const today = (values: Partial<Record<HealthMetric, number>>) => readiness([...usual, day(TODAY, values)], TODAY)

describe('det vanliga värdet', () => {
  it('är medianen av dagarna före idag, och idag räknas inte in', () => {
    expect(baseline([...usual, day(TODAY, { hrvMs: 10 })], 'hrvMs', TODAY)).toBe(60)
  })

  it('saknas när det finns färre än fem dagar', () => {
    expect(baseline(usual.slice(0, 4), 'hrvMs', TODAY)).toBeNull()
  })
})

describe('dagsformen', () => {
  it('som vanligt ger Kör som vanligt', () => {
    const r = today({ hrvMs: 61, restingHr: 52, sleepH: 7.5 })
    expect(r.level).toBe('go')
    expect(r.score).toBe(0)
    expect(r.missing).toEqual([])
  })

  it('en kort natt räcker för att ta det lite lugnare', () => {
    const r = today({ hrvMs: 60, restingHr: 52, sleepH: 6.5 })
    expect(r.level).toBe('easy')
    expect(r.signals.find((s) => s.metric === 'sleepH')?.text).toBe('Sömn 6 h 30 min, under 7 timmar')
  })

  it('dålig sömn, låg pulsvariabilitet och hög vilopuls ger Ta det lugnt', () => {
    const r = today({ hrvMs: 45, restingHr: 60, sleepH: 5.5 })
    expect(r.level).toBe('rest')
    expect(r.signals.map((s) => s.points)).toEqual([-2, -2, -2])
    expect(r.signals[1].text).toBe('Pulsvariabilitet 45 ms, 25 % under ditt vanliga')
    expect(r.signals[2].text).toBe('Vilopuls 60, 8 över ditt vanliga')
  })

  it('bra värden väger upp en lite kort natt', () => {
    expect(today({ hrvMs: 70, restingHr: 48, sleepH: 6.8 }).level).toBe('go')
  })

  it('förhöjd handledstemperatur och andning drar ner även när resten är bra', () => {
    const r = today({ hrvMs: 60, restingHr: 52, sleepH: 7.5, wristTemp: 35.7, respRate: 16 })
    expect(r.level).toBe('rest')
  })

  it('utan dagens värden finns ingen bedömning, och appen får veta vad som saknas', () => {
    const r = readiness(usual, TODAY)
    expect(r.level).toBe('unknown')
    expect(r.missing).toEqual(['hrvMs', 'restingHr', 'sleepH'])
  })

  it('bara sömn: bedömningen görs, men pulsvariabilitet och vilopuls anges som saknade', () => {
    const r = readiness([day(TODAY, { sleepH: 8.2 })], TODAY)
    expect(r.level).toBe('go')
    expect(r.missing).toEqual(['hrvMs', 'restingHr'])
  })

  it('sömnpoäng används när sömntiden saknas', () => {
    const r = readiness([day(TODAY, { sleepScore: 55 })], TODAY)
    expect(r.level).toBe('easy')
    expect(r.missing).toEqual(['hrvMs', 'restingHr'])
  })
})

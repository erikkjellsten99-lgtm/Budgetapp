import { describe, expect, it } from 'vitest'
import { isoWeek, sundayReport, type ReportCheck } from './report'

const habits = [
  { id: 'gym', name: 'Gym', goal: 4, created: '2026-09-01', order: 1 },
  { id: 'dsl', name: 'Diesel', goal: 7, created: '2026-09-01', order: 0 },
]
const checksFor = (id: string, days: string[]): ReportCheck[] => days.map((date) => ({ date, habitId: id }))
const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from + 'T00:00:00Z') + i * 864e5).toISOString().slice(0, 10))

describe('sundayReport', () => {
  it('skickas bara på söndagar', () => {
    expect(sundayReport(habits, [], new Set(), '2026-10-24')).toBeNull()
  })

  it('veckorapport: procent, vad som drog ner, 7 dagar i rad och jämförelse', () => {
    // Vecka 43 (19–25 okt): Diesel 7/7, Gym 2/4 → 9 av 11 = 82 %. Vecka 42: Diesel 7, Gym 4 → 100 %.
    const checks = [
      ...checksFor('dsl', range('2026-10-12', 14)),
      ...checksFor('gym', ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-20', '2026-10-22']),
    ]
    const r = sundayReport(habits, checks, new Set(), '2026-10-25')!
    expect(r.key).toBe('report-week:2026-10-19')
    expect(r.title).toBe('Vecka 43: 82 % av målen')
    expect(r.body).toBe('Klarade: Diesel. Drog ner: Gym (2 av 4). ☄ 7 dagar i rad: Diesel. −18 mot förra veckan.')
  })

  it('månadens sista söndag blir en månadsrapport', () => {
    // Oktober = v.40–44 (28/9–1/11). Diesel varje dag i oktober, inget gym.
    const checks = checksFor('dsl', range('2026-09-28', 35))
    const r = sundayReport(habits, checks, new Set(), '2026-11-01')!
    expect(r.key).toBe('report-month:2026-10')
    expect(r.title).toBe('Oktober är klar: 64 %') // 35 av 55
    expect(r.body).toContain('☄ 5 kometer.')
    expect(r.body).toContain('Ett nytt solsystem i din galax.')
  })

  it('pausade dagar sänker målet', () => {
    const paused = new Set(range('2026-10-19', 7))
    expect(sundayReport(habits, [], paused, '2026-10-25')).toBeNull()
  })
})

it('ISO-veckonummer', () => {
  expect(isoWeek('2026-10-25')).toBe(43)
  expect(isoWeek('2026-01-01')).toBe(1)
  expect(isoWeek('2027-01-01')).toBe(53)
})

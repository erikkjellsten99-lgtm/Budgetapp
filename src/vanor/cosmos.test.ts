import { describe, expect, it } from 'vitest'
import type { Habit, Log } from './habits'
import { areaSystems, dayPhase, dayScore, habitStars, kindSummary, starKind, type HabitStar } from './cosmos'

const make = (id: string, goal: number, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  goal,
  created: '2026-09-01',
  after: [],
  order: 0,
  archived: false,
  ...extra,
})
const NONE = new Set<string>()
const TODAY = '2026-10-29' // torsdag, vecka 44 (måndag 26/10)
const days = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(from + 'T00:00:00Z') + i * 864e5).toISOString().slice(0, 10))

describe('dagens poäng', () => {
  it('andel av det som räknas idag, och nästa vana att göra', () => {
    const a = make('a', 7, { order: 0 })
    const b = make('b', 7, { order: 1 })
    const s = dayScore([a, b], { [TODAY]: ['a'] }, NONE, TODAY)
    expect(s.score).toBe(50)
    expect(s.phase.name).toBe('Förmiddag')
    expect(s.next?.id).toBe('b')
    expect(s.week).toBe(false)
  })

  it('inget måste idag: veckans mål i stället', () => {
    // Mål 1 gång i veckan, redan gjord i måndags → inget måste idag
    const s = dayScore([make('a', 1)], { '2026-10-26': ['a'] }, NONE, TODAY)
    expect(s.week).toBe(true)
    expect(s.score).toBe(100)
  })

  it('faserna', () => {
    expect(dayPhase(0).name).toBe('Natt')
    expect(dayPhase(13).name).toBe('Gryning')
    expect(dayPhase(99).name).toBe('Dag')
    expect(dayPhase(100).name).toBe('Full sol')
  })
})

describe('stjärnorna', () => {
  it('klass efter procent', () => {
    expect([null, 10, 30, 63, 80, 95].map(starKind)).toEqual(['proto', 'proto', 'red', 'orange', 'yellow', 'blue'])
  })

  it('de senaste hela veckorna, med område och serie', () => {
    // Varje dag 28/9–28/10 (fyra hela veckor 28/9–25/10 + vecka 44 hittills)
    const log: Log = Object.fromEntries(days('2026-09-28', 31).map((d) => [d, ['a']]))
    const [star] = habitStars([make('a', 7, { area: 'Sinne' })], log, NONE, TODAY)
    expect(star.pct).toBe(100)
    expect(star.kind).toBe('blue')
    expect(star.area).toBe('Sinne')
    expect(star.span).toBe('de senaste fyra veckorna')
    expect(star.streak).toBe(31)
  })

  it('en vald månad, och Övrigt utan område', () => {
    const log: Log = Object.fromEntries(days('2026-10-01', 10).map((d) => [d, ['a']]))
    const [star] = habitStars([make('a', 7)], log, NONE, TODAY, '2026-10')
    expect(star.area).toBe('Övrigt')
    expect(star.span).toBe('i oktober')
    expect(star.pct).toBeGreaterThan(0)
  })
})

describe('solsystemen', () => {
  const star = (id: string, area: string, pct: number | null): HabitStar => ({ id, name: id, area, pct, kind: starKind(pct), streak: 0, span: '' })

  it('ett per område i fast ordning, med snitt och sammanfattning', () => {
    const list = areaSystems([star('x', 'Övrigt', 50), star('a', 'Sinne', 60), star('b', 'Träning', 66), star('c', 'Träning', 10)])
    expect(list.map((s) => s.area)).toEqual(['Träning', 'Sinne', 'Övrigt'])
    expect(list[0].pct).toBe(38)
    expect(list[0].summary).toBe('1 orange dvärg · 1 protostjärna')
  })

  it('flertal', () => {
    expect(kindSummary([star('a', 'X', 60), star('b', 'X', 65), star('c', 'X', 5)])).toBe('2 orange dvärgar · 1 protostjärna')
  })
})

import { describe, expect, it } from 'vitest'
import type { Habit, Log } from './habits'
import { change, habitTrends, weekElapsed, weeklyScores } from './progress'

const make = (id: string, goal: number, created = '2026-09-01'): Habit => ({
  id,
  name: id,
  goal,
  created,
  after: [],
  order: 0,
  archived: false,
})

const logOf = (entries: [string, string[]][]): Log => Object.fromEntries(entries)
const NONE = new Set<string>()
const TODAY = '2026-10-29' // torsdag, vecka 44 (måndag 26/10)

describe('weeklyScores', () => {
  it('räknar procent av veckomålen och tar inte med extra dagar över målet', () => {
    const gym = make('gym', 2)
    const med = make('med', 2)
    // Vecka 43 (19–25/10): gym 3 gånger (räknas som 2), med 1 gång → 3 av 4 = 75 %.
    const log = logOf([
      ['2026-10-19', ['gym', 'med']],
      ['2026-10-20', ['gym']],
      ['2026-10-21', ['gym']],
    ])
    const weeks = weeklyScores([gym, med], log, NONE, TODAY, 2)
    expect(weeks.map((w) => [w.monday, w.pct, w.current])).toEqual([
      ['2026-10-19', 75, false],
      ['2026-10-26', 0, true],
    ])
  })

  it('börjar veckan då första vanan fanns', () => {
    const weeks = weeklyScores([make('a', 3, '2026-10-20')], {}, NONE, TODAY, 8)
    expect(weeks[0].monday).toBe('2026-10-19')
    expect(weeks).toHaveLength(2)
  })

  it('en helt pausad vecka har inget mål', () => {
    const daily = make('d', 7)
    const paused = new Set(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
    const weeks = weeklyScores([daily], {}, paused, TODAY, 3)
    expect(weeks.map((w) => w.pct)).toEqual([0, null, 0])
  })
})

describe('habitTrends', () => {
  it('jämför de senaste hela veckorna med veckorna innan', () => {
    const h = make('h', 2)
    // Veckorna 5/10 och 12/10 (innan): 1 av 2 → 50 %. 19/10 (senaste hela): 2 av 2 → 100 %.
    const log = logOf([
      ['2026-10-05', ['h']],
      ['2026-10-12', ['h']],
      ['2026-10-19', ['h']],
      ['2026-10-20', ['h']],
    ])
    const [t] = habitTrends([h], log, NONE, TODAY, 1)
    expect(t.pct).toBe(100)
    expect(t.prevPct).toBe(50)
    expect(change(t.pct, t.prevPct)).toBe(50)
  })

  it('räknar inte den pågående veckan och saknar jämförelse för nya vanor', () => {
    const [t] = habitTrends([make('n', 3, '2026-10-27')], logOf([['2026-10-27', ['n']]]), NONE, TODAY)
    expect(t.pct).toBeNull()
    expect(t.weeks).toBe(0)
  })
})

it('andel av veckan som gått', () => {
  expect(weekElapsed('2026-10-26')).toBeCloseTo(1 / 7)
  expect(weekElapsed('2026-11-01')).toBe(1)
})

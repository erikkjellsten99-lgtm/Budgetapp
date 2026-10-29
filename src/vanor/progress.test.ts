import { describe, expect, it } from 'vitest'
import type { Habit, Log } from './habits'
import { change, galaxyMonths, habitTrends, monthForecast, monthMondays, monthPlanets, monthName, sevenDayRuns, weekHabits, monthOfWeek, monthScore, previousMonth, weeklyScores } from './progress'

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

it('räknar inte en vecka där vanan bara fanns en dag', () => {
  // Skapad söndag 25/10: förra veckan hade bara 1 dag, så den räknas inte som 100 %.
  const [t] = habitTrends([make('d', 7, '2026-10-25')], logOf([['2026-10-25', ['d']]]), NONE, TODAY)
  expect(t.weeks).toBe(0)
  expect(t.pct).toBeNull()
})

describe('månaden (galaxen)', () => {
  it('månadens veckor är de vars torsdag ligger i månaden', () => {
    expect(monthMondays('2026-10')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(monthMondays('2026-11')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])
    expect(monthOfWeek('2026-11-30')).toBe('2026-12')
  })

  it('räknar hela månadens mål, så 100 % kräver alla veckor', () => {
    const h = make('h', 2)
    const log = logOf([
      ['2026-10-26', ['h']],
      ['2026-10-27', ['h']],
    ])
    // 1 dag in i november: bara vecka 1 av 4 har gått, och den är klar.
    const nov = monthScore([h], { ...log, '2026-11-02': ['h'], '2026-11-03': ['h'] }, NONE, '2026-11-04')
    expect(nov.weeks.map((w) => w.state)).toEqual(['current', 'future', 'future', 'future'])
    expect(nov.pct).toBe(25)
    expect(nov.checks).toBe(2)
    expect(nov.weeks[0].pct).toBe(100)
  })

  it('månadens namn och föregående månad', () => {
    expect(monthName('2026-10', '2026-10-29')).toBe('oktober')
    expect(monthName('2025-12', '2026-10-29')).toBe('december 2025')
    expect(previousMonth('2026-01')).toBe('2025-12')
  })
})

describe('månadens prognos', () => {
  const h = make('h', 2)
  // November 2026: veckor 2/11, 9/11, 16/11, 23/11. Mål 2 per vecka = 8 för månaden.
  it('för tidigt första veckan', () => {
    const f = monthForecast(monthScore([h], { '2026-11-02': ['h'] }, NONE, '2026-11-04'), '2026-11-04')
    expect(f.projected).toBeNull()
  })
  it('räknar med takten hittills och vad som behövs för nästa jämna mål', () => {
    // Två hela veckor med 1 av 2 → 50 % takt. Vi är på måndag vecka 3 (1/7 av veckan).
    const log = { '2026-11-02': ['h'], '2026-11-10': ['h'] }
    const f = monthForecast(monthScore([h], log, NONE, '2026-11-16'), '2026-11-16')
    expect(f.projected).toBe(47)
    expect(f.target).toBe(50)
    // 50 % av 8 = 4, gjort 2, kvar ca 1,86 veckor → 2 per vecka.
    expect(f.perWeekNeeded).toBe(2)
    expect(f.perWeekNow).toBe(1)
  })
})

it('galaxen har alla månader sedan första vanan och börjar aldrig om', () => {
  const h = make('h', 2, '2026-08-10')
  const months = galaxyMonths([h], { '2026-09-01': ['h'] }, NONE, '2026-10-29')
  expect(months.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10'])
  expect(months.at(-1)!.current).toBe(true)
  expect(months[1].checks).toBe(1)
})

it('solsystemet har en planet per vana, större ju mer av målet som klarats', () => {
  const gym = { ...make('gym', 2, '2026-09-01'), order: 0 }
  const gammal = { ...make('gammal', 3, '2026-09-01'), order: 1, archived: true }
  const ny = { ...make('ny', 7, '2026-11-01'), order: 2 }
  // Oktober = v.40–44 (28/9–1/11). Idag 29/10 → alla fem veckor räknas, gym-målet 10.
  const log = logOf([['2026-10-05', ['gym']], ['2026-10-06', ['gym']], ['2026-10-20', ['gym']], ['2026-10-29', ['gym']]])
  const planets = monthPlanets([ny, gammal, gym], log, NONE, TODAY, '2026-10')
  expect(planets.map((p) => p.id)).toEqual(['gym']) // arkiverad utan bockar och framtida vana syns inte
  expect(planets[0].checks).toBe(4)
  expect(planets[0].share).toBeCloseTo(0.4)
  // v.40 (2 av 2) och v.44 (pågår men bara 1 av 2) → 1 klarad av 4 avgjorda veckor.
  expect(planets[0].weeksMet).toBe(1)
  expect(planets[0].weeksTotal).toBe(4)
})

it('en komet för varje 7 dagar i rad – en pausdag bryter inte serien', () => {
  const days = Array.from({ length: 16 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
  const log = Object.fromEntries(days.filter((d) => d !== '2026-10-04').map((d) => [d, ['h']]))
  expect(sevenDayRuns(log, 'h', days, NONE)).toBe(1) // 5–16 okt = 12 dagar i rad
  expect(sevenDayRuns(log, 'h', days, new Set(['2026-10-04']))).toBe(2) // pausad 4 okt → 15 dagar
})

it('veckans vanor visar gjort och mål per vana', () => {
  const gym = { ...make('gym', 2), order: 1 }
  const med = { ...make('med', 7), order: 0 }
  const log = logOf([['2026-10-19', ['gym', 'med']], ['2026-10-20', ['gym']], ['2026-10-21', ['gym']]])
  expect(weekHabits([gym, med], log, NONE, '2026-10-19')).toEqual([
    { id: 'med', name: 'med', done: 1, goal: 7 },
    { id: 'gym', name: 'gym', done: 2, goal: 2 },
  ])
})

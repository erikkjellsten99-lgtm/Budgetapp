import { describe, expect, it } from 'vitest'
import { cleanTitle, doneToday, dueTasks, upcomingTasks, whenText, type Task } from './tasks'

const TODAY = '2026-10-29' // torsdag
let n = 0
const task = (date: string, extra: Partial<Task> = {}): Task => ({ id: `t${++n}`, title: `Sak ${n}`, date, created: n, ...extra })

describe('att göra', () => {
  const all = [
    task('2026-10-29', { time: '15:00' }),
    task('2026-10-27'),
    task('2026-10-29', { time: '09:00' }),
    task('2026-10-30'),
    task('2026-10-29', { doneOn: '2026-10-29' }),
    task('2026-10-20', { doneOn: '2026-10-21' }),
    task('2026-11-05'),
  ]

  it('idag och försenat, försenat först och sedan efter tid', () => {
    expect(dueTasks(all, TODAY).map((t) => [t.date, t.time])).toEqual([
      ['2026-10-27', undefined],
      ['2026-10-29', '09:00'],
      ['2026-10-29', '15:00'],
    ])
  })

  it('bockat idag syns, gamla bockade inte', () => {
    expect(doneToday(all, TODAY)).toHaveLength(1)
  })

  it('kommande i datumordning', () => {
    expect(upcomingTasks(all, TODAY).map((t) => t.date)).toEqual(['2026-10-30', '2026-11-05'])
  })

  it('skriver när', () => {
    expect(whenText(task(TODAY, { time: '10:00' }), TODAY)).toBe('Idag 10:00')
    expect(whenText(task('2026-10-30'), TODAY)).toBe('I morgon')
    expect(whenText(task('2026-11-05'), TODAY)).toBe('tors 5 nov')
    expect(whenText(task('2026-10-27'), TODAY)).toBe('Försenad sedan tis 27 okt')
    expect(whenText(task('2027-01-04'), TODAY)).toBe('mån 4 jan 2027')
  })

  it('städar titeln', () => {
    expect(cleanTitle('  Ring   vårdcentralen ')).toBe('Ring vårdcentralen')
  })
})

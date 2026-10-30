import { describe, expect, it } from 'vitest'
import type { Habit, Log } from './habits'
import { baseMilestones, monthSatellites, nextMilestone } from './space'
import type { Task } from './tasks'

const make = (id: string, goal: number, created = '2026-10-01'): Habit => ({ id, name: id, goal, created, after: [], order: 0, archived: false })
const NONE = new Set<string>()
const days = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(from + 'T00:00:00Z') + i * 864e5).toISOString().slice(0, 10))

describe('baseMilestones', () => {
  it('tom bas innan första bocken', () => {
    const list = baseMilestones([make('a', 7)], {}, NONE, '2026-10-29')
    expect(list.every((m) => !m.done)).toBe(true)
    expect(list[0].id).toBe('core')
  })

  it('datum för bockar, serier och perfekt vecka', () => {
    // Varje dag 5–20 okt på en vana med mål 7/vecka → 16 bockar, 16 dagar i rad, v.42 (12–18) perfekt.
    const log: Log = Object.fromEntries(days('2026-10-05', 16).map((d) => [d, ['a']]))
    const list = baseMilestones([make('a', 7, '2026-10-05')], log, NONE, '2026-10-29')
    const by = Object.fromEntries(list.map((m) => [m.id, m]))
    expect(by.core.done).toBe('2026-10-05')
    expect(by.panel.done).toBeNull()
    expect(by.panel.progress).toEqual({ now: 16, target: 25, unit: 'bockar' })
    expect(by.dock.done).toBe('2026-10-11')
    expect(by.antenna.done).toBe('2026-10-11') // v.41 (5–11 okt) är redan hel
    expect(by.greenhouse.progress?.now).toBe(16)
    expect(nextMilestone(list)?.id).toBe('panel') // 16 av 25 är närmast
  })

  it('en pausdag bryter inte serien', () => {
    const log: Log = Object.fromEntries(days('2026-10-01', 8).filter((d) => d !== '2026-10-04').map((d) => [d, ['a']]))
    const by = Object.fromEntries(baseMilestones([make('a', 7)], log, new Set(['2026-10-04']), '2026-10-29').map((m) => [m.id, m]))
    expect(by.dock.done).toBe('2026-10-08')
  })
})

it('satelliter: avklarade saker i månaden, äldst först', () => {
  const t = (id: string, doneOn?: string): Task => ({ id, title: id, date: '2026-10-01', doneOn, created: 0 })
  // 1 nov hör till oktober (v.44, torsdagen 29 okt). 2 nov hör till november.
  const tasks = [t('b', '2026-11-01'), t('a', '2026-10-05'), t('c', '2026-11-02'), t('ej')]
  expect(monthSatellites(tasks, '2026-10').map((x) => x.id)).toEqual(['a', 'b'])
})

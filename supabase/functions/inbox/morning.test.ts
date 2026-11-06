import { describe, expect, it } from 'vitest'
import { todayInfo, type Habit, type Log } from './habits.ts'
import { firstThing, prioritizeToday } from './priority.ts'
import { list, morningText } from './morning.ts'
import type { Task } from './tasks.ts'

// Fredag 6 november 2026. Veckan började måndag 2 november.
const TODAY = '2026-11-06'

const habit = (id: string, name: string, goal: number, order: number, extra: Partial<Habit> = {}): Habit => ({
  id, name, goal, order, created: '2026-10-01', after: [], archived: false, ...extra,
})

const habits: Habit[] = [
  habit('somn', 'I säng före 23', 7, 0),
  habit('gym', 'Gym', 3, 1),
  habit('lopning', 'Löpning', 2, 2),
  habit('stretch', 'Stretching', 2, 3, { after: ['gym'] }),
  habit('gammal', 'Gammal vana', 7, 4, { archived: true }),
]

// Gym gjort måndag, löpning inte alls, sömn varje dag fram till igår.
const log: Log = {
  '2026-11-02': ['gym', 'somn'],
  '2026-11-03': ['somn'],
  '2026-11-04': ['somn'],
  '2026-11-05': ['somn'],
}

const task = (id: string, title: string, date: string, extra: Partial<Task> = {}): Task => ({ id, title, date, created: 1, ...extra })

describe('prioritizeToday', () => {
  it('ger samma ordning som Vanor räknade förut (måsten, sedan mest bråttom)', () => {
    const p = prioritizeToday(habits, log, new Set(), [], TODAY)
    // Samma uträkning som Vanor.tsx hade inline, som facit.
    const active = habits.filter((h) => !h.archived)
    const names = new Set(active.map((h) => h.id))
    const rows = active.map((h) => {
      const hh = { ...h, after: h.after.filter((id) => names.has(id)) }
      return { habit: hh, info: todayInfo(hh, log, TODAY, new Set()) }
    })
    const open = rows.filter((r) => r.info.due && !r.info.done)
    expect(p.must.map((r) => r.habit.id)).toEqual(open.filter((r) => r.info.must).map((r) => r.habit.id))
    expect(p.flexible.map((r) => r.habit.id)).toEqual(
      open.filter((r) => !r.info.must).sort((a, b) => b.info.urgency - a.info.urgency).map((r) => r.habit.id),
    )
    // Löpning: 2 kvar och 3 dagar kvar (fre–sön) går att vänta med; Gym: 2 kvar på 3 dagar likaså. Sömnen är ett måste.
    expect(p.must.map((r) => r.habit.name)).toEqual(['I säng före 23'])
    expect(p.rows.some((r) => r.habit.id === 'gammal')).toBe(false)
  })

  it('Att göra kommer först, försenat före idag', () => {
    const tasks = [task('a', 'Ringa tandläkaren', TODAY, { time: '14:00' }), task('b', 'Betala hyran', '2026-11-04'), task('c', 'Klar sak', TODAY, { doneOn: TODAY })]
    const p = prioritizeToday(habits, log, new Set(), tasks, TODAY)
    expect(p.tasksDue.map((t) => t.title)).toEqual(['Betala hyran', 'Ringa tandläkaren'])
    expect(firstThing(p)).toBe('Betala hyran')
  })
})

describe('morningText', () => {
  it('Att göra, måsten och vad som ska göras först', () => {
    const tasks = [task('a', 'Ringa tandläkaren', TODAY, { time: '14:00' }), task('b', 'Betala hyran', '2026-11-04')]
    expect(morningText(prioritizeToday(habits, log, new Set(), tasks, TODAY), TODAY)).toBe(
      'Fredag 6 november. Att göra: Betala hyran (försenad sedan ons 4 nov) och Ringa tandläkaren klockan 14:00. ' +
        'Måste göras idag: I säng före 23. Börja med: Betala hyran.',
    )
  })

  it('inget måste: föreslår det mest bråttom', () => {
    const done: Log = { ...log, [TODAY]: ['somn'] }
    const text = morningText(prioritizeToday(habits, done, new Set(), [], TODAY), TODAY)
    expect(text).toMatch(/^Fredag 6 november\. Inget måste idag\. Har du tid, ta (Gym|Löpning) först\.$/)
  })

  it('pausad dag', () => {
    const text = morningText(prioritizeToday(habits, log, new Set([TODAY]), [], TODAY), TODAY)
    expect(text).toBe('Fredag 6 november. Du har pausat idag, så inga vanor måste göras. Krya på dig.')
  })

  it('allt gjort, och inga vanor alls', () => {
    const all: Log = { ...log, [TODAY]: ['somn', 'gym', 'lopning', 'stretch'], '2026-11-03': ['somn', 'gym', 'lopning'], '2026-11-04': ['somn', 'gym'] }
    expect(morningText(prioritizeToday(habits, all, new Set(), [], TODAY), TODAY)).toBe('Fredag 6 november. Allt för idag är redan gjort.')
    expect(morningText(prioritizeToday([], {}, new Set(), [], TODAY), TODAY)).toBe('Fredag 6 november. Inget planerat i Groundwork idag.')
  })

  it('å, ä, ö och listor', () => {
    expect(list(['Städa förrådet'])).toBe('Städa förrådet')
    expect(list(['A', 'B', 'C'])).toBe('A, B och C')
  })
})

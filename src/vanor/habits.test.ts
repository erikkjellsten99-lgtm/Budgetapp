import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { daySummary, rampToday, dayStreak, habitPlan, nameError, remindDaysText, remindText, todayInfo, weekCount, weekGoal, weekStreak, type Habit, type Log } from './habits'

const habit = (goal: number): Habit => ({
  id: 'h',
  name: 'Test',
  goal,
  created: '2026-09-01',
  after: [],
  order: 0,
  archived: false,
})

/** Logg där vanan 'h' är bockad de angivna dagarna. */
const logOf = (days: string[]): Log => Object.fromEntries(days.map((d) => [d, ['h']]))

const TODAY = '2026-10-14' // onsdag, vecka 42

describe('weekCount', () => {
  it('räknar bara dagar i den veckan', () => {
    const log = logOf(['2026-10-11', '2026-10-12', '2026-10-14', '2026-10-18', '2026-10-19'])
    expect(weekCount(log, 'h', '2026-10-12')).toBe(3)
  })
})

describe('dayStreak', () => {
  it('räknar dagar i rad till och med idag', () => {
    expect(dayStreak(logOf(['2026-10-12', '2026-10-13', '2026-10-14']), 'h', TODAY)).toBe(3)
  })
  it('bryts inte av att dagens inte är bockad än', () => {
    expect(dayStreak(logOf(['2026-10-12', '2026-10-13']), 'h', TODAY)).toBe(2)
  })
  it('är 0 om igår missades och idag inte är gjord', () => {
    expect(dayStreak(logOf(['2026-10-11', '2026-10-12']), 'h', TODAY)).toBe(0)
  })
  it('börjar om efter en missad dag', () => {
    expect(dayStreak(logOf(['2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14']), 'h', TODAY)).toBe(3)
  })
  it('går över årsskiftet', () => {
    expect(dayStreak(logOf(['2026-12-30', '2026-12-31', '2027-01-01']), 'h', '2027-01-01')).toBe(3)
  })
  it('räknar bara den egna vanan', () => {
    const log: Log = { '2026-10-13': ['annan'], '2026-10-14': ['h', 'annan'] }
    expect(dayStreak(log, 'h', TODAY)).toBe(1)
    expect(dayStreak(log, 'annan', TODAY)).toBe(2)
  })
})

describe('weekStreak', () => {
  // Vecka 40: 28 sep–4 okt, vecka 41: 5–11 okt, vecka 42: 12–18 okt.
  const w40 = ['2026-09-28', '2026-09-30']
  const w41 = ['2026-10-06', '2026-10-11']

  it('räknar hela veckor med nått mål', () => {
    expect(weekStreak(logOf([...w40, ...w41]), habit(2), TODAY)).toBe(2)
  })
  it('pågående vecka räknas när målet redan är nått', () => {
    expect(weekStreak(logOf([...w40, ...w41, '2026-10-12', '2026-10-13']), habit(2), TODAY)).toBe(3)
  })
  it('pågående vecka bryter inte streaken innan den är slut', () => {
    expect(weekStreak(logOf([...w40, ...w41, '2026-10-12']), habit(2), TODAY)).toBe(2)
  })
  it('en vecka under målet bryter streaken', () => {
    expect(weekStreak(logOf([...w40, '2026-10-06']), habit(2), TODAY)).toBe(0)
  })
  it('går över årsskiftet (vecka 52, 53 och 1)', () => {
    const log = logOf(['2026-12-21', '2026-12-28', '2027-01-03', '2027-01-04'])
    expect(weekStreak(log, habit(1), '2027-01-05')).toBe(3)
  })
  it('är 0 utan logg', () => {
    expect(weekStreak({}, habit(3), TODAY)).toBe(0)
  })
})

describe('pausade dagar', () => {
  const paused = (days: string[]) => new Set(days)

  it('bryter inte en daglig streak', () => {
    const log = logOf(['2026-10-10', '2026-10-11', '2026-10-13', '2026-10-14'])
    expect(dayStreak(log, 'h', TODAY)).toBe(2)
    expect(dayStreak(log, 'h', TODAY, paused(['2026-10-12']))).toBe(4)
  })
  it('pausad idag räknas från igår', () => {
    expect(dayStreak(logOf(['2026-10-12', '2026-10-13']), 'h', TODAY, paused([TODAY]))).toBe(2)
  })
  it('sänker veckomålet i proportion', () => {
    // Mål 4, två pausade dagar: 4 × 5/7 ≈ 3.
    expect(weekGoal(habit(4), paused(['2026-10-12', '2026-10-13']), '2026-10-12')).toBe(3)
    expect(weekGoal(habit(4), paused([]), '2026-10-12')).toBe(4)
  })
  it('en helt pausad vecka bryter inte veckostreaken', () => {
    const w39 = ['2026-09-21', '2026-09-22']
    const w41 = ['2026-10-06', '2026-10-11']
    const week40 = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
    expect(weekStreak(logOf([...w39, ...w41]), habit(2), TODAY)).toBe(1)
    expect(weekStreak(logOf([...w39, ...w41]), habit(2), TODAY, paused(week40))).toBe(2)
  })
})

describe('todayInfo', () => {
  // TODAY är onsdag: idag + 4 dagar kvar = 5 dagar kvar i veckan.
  it('veckovana med gott om tid', () => {
    const info = todayInfo(habit(2), {}, TODAY)
    expect(info.due).toBe(true)
    expect(info.must).toBe(false)
    // Onsdag–söndag kvar, 2 gånger: kan vänta till lördag.
    expect(info.pills[0]).toEqual({ kind: 'plain', text: '2 kvar på 5 dagar, kan vänta till lördag' })
  })
  it('kan vänta till i morgon när det bara finns en dag till godo', () => {
    // 4 kvar på 5 dagar: senast i morgon (torsdag).
    expect(todayInfo(habit(4), {}, TODAY).pills[0].text).toBe('4 kvar på 5 dagar, kan vänta till i morgon')
  })
  it('måste idag: dagliga vanor och veckovanor utan marginal', () => {
    expect(todayInfo(habit(7), {}, TODAY).must).toBe(true)
    expect(todayInfo(habit(5), {}, TODAY).must).toBe(true)
    expect(todayInfo(habit(7), logOf([TODAY]), TODAY).must).toBe(false)
  })
  it('varnar "Måste bli idag" när det är på gränsen', () => {
    const info = todayInfo(habit(5), {}, TODAY)
    expect(info.pills.map((p) => p.text)).toContain('Måste bli idag')
  })
  it('säger "Hinns inte i veckan" när det är omöjligt', () => {
    const info = todayInfo(habit(6), {}, TODAY)
    expect(info.pills.map((p) => p.text)).toContain('Veckomålet hinns inte')
  })
  it('veckomål klart flyttar ned vanan', () => {
    const info = todayInfo(habit(2), logOf(['2026-10-12', '2026-10-13']), TODAY)
    expect(info.due).toBe(false)
    expect(info.pills[0]).toEqual({ kind: 'ok', text: 'Veckomål klart' })
  })
  it('en pausad dag ger inga krav', () => {
    expect(todayInfo(habit(5), {}, TODAY, new Set([TODAY])).due).toBe(false)
    expect(todayInfo(habit(7), {}, TODAY, new Set([TODAY])).due).toBe(false)
  })
  it('kommer upp "Efter dagens pass" när en kopplad vana är bockad', () => {
    const stretch: Habit = { ...habit(6), id: 's', after: ['gym'] }
    const log: Log = { [TODAY]: ['gym'] }
    const info = todayInfo(stretch, log, TODAY)
    expect(info.due).toBe(true)
    expect(info.must).toBe(true)
    expect(info.pills[0]).toEqual({ kind: 'warn', text: 'Efter dagens pass' })
  })
  it('rubriken räknar det som måste göras idag, inte det som kan vänta', () => {
    const infos = [
      todayInfo(habit(2), logOf(['2026-10-12', '2026-10-13']), TODAY), // klart för veckan
      todayInfo(habit(7), logOf([TODAY]), TODAY), // bockad idag
      todayInfo({ ...habit(7), id: 'x' }, {}, TODAY), // kvar
      todayInfo({ ...habit(2), id: 'y' }, {}, TODAY), // kan vänta, räknas inte
    ]
    expect(daySummary(infos)).toEqual({ total: 2, done: 1, flexible: 1 })
  })
})

describe('nameError', () => {
  const active = [{ ...habit(4), id: 'g', name: 'Gym' }, { ...habit(7), id: 'k', name: 'Kvällspromenad' }]
  it('kräver ett namn', () => expect(nameError('   ', active)).toBe('Skriv ett namn.'))
  it('stoppar dubbletter oavsett stora bokstäver och å/ä/ö', () => {
    expect(nameError(' gym ', active)).toBe('Den vanan finns redan.')
    expect(nameError('KVÄLLSPROMENAD', active)).toBe('Den vanan finns redan.')
  })
  it('tillåter samma namn på vanan som ändras', () => expect(nameError('Gym', active, 'g')).toBeNull())
  it('har en maxlängd', () => expect(nameError('a'.repeat(41), active)).toBe('Högst 40 tecken.'))
  it('godkänner ett nytt namn', () => expect(nameError('Läsa 20 min', active)).toBeNull())
})

describe('efter-vanor', () => {
  const stretch: Habit = { ...habit(4), id: 's', after: ['gym'] }
  it('behöver inte göras en dag utan pass', () => {
    const info = todayInfo(stretch, {}, TODAY)
    expect(info.due).toBe(false)
    expect(info.pills.map((p) => p.text)).not.toContain('Måste bli idag')
  })
  it('kommer upp när passet är gjort', () => {
    expect(todayInfo(stretch, { [TODAY]: ['gym'] }, TODAY).due).toBe(true)
  })
  it('beskrivs som "Efter Gym"', () => {
    const names = (id: string) => ({ gym: 'Gym', run: 'Löpning' })[id]
    expect(habitPlan(stretch, names)).toBe('Efter Gym')
    expect(habitPlan({ ...stretch, after: ['gym', 'run'] }, names)).toBe('Efter Gym eller Löpning')
    expect(habitPlan(habit(3), names)).toBe('3 gånger i veckan')
    expect(habitPlan(habit(7), names)).toBe('Varje dag')
  })
})

describe('ny vana mitt i veckan', () => {
  it('veckomålet räknas bara på dagarna sedan vanan lades till', () => {
    // Skapad söndag: 1 av 7 dagar → mål 4 blir 1, så det går att klara.
    const sunday = '2026-10-18'
    const h = { ...habit(4), created: sunday }
    expect(weekGoal(h, new Set(), '2026-10-12')).toBe(1)
    const info = todayInfo(h, {}, sunday)
    expect(info.pills.map((p) => p.text)).toEqual(['1 kvar, veckan slutar idag', 'Måste bli idag'])
  })
  it('veckor innan vanan fanns bryter inte streaken', () => {
    const h = { ...habit(1), created: '2026-10-05' }
    expect(weekStreak(logOf(['2026-10-06', '2026-10-13']), h, TODAY)).toBe(2)
  })
})

describe('vecka som inte räknas', () => {
  it('ny vana på söndagen med lågt mål: inget krav, men en förklaring', () => {
    const h = { ...habit(3), created: '2026-10-18' } // 3 × 1/7 ≈ 0
    const info = todayInfo(h, {}, '2026-10-18')
    expect(info.goal).toBe(0)
    expect(info.due).toBe(false)
    expect(info.pills.map((p) => p.text)).toEqual(['Ny vana, räknas från nästa vecka'])
  })
})

describe('påminnelsens dagar', () => {
  it('skriver dagarna kort', () => {
    expect(remindDaysText(undefined)).toBe('varje dag')
    expect(remindDaysText([0, 1, 2, 3, 4, 5, 6])).toBe('varje dag')
    expect(remindDaysText([4, 0, 1, 2, 3])).toBe('vardagar')
    expect(remindDaysText([5, 6])).toBe('helger')
    expect(remindDaysText([0, 2])).toBe('mån, ons')
  })
  it('visar tid och dagar', () => {
    expect(remindText({ ...habit(4), remind: '17:00', remindDays: [0, 1] })).toBe('mån, tis 17:00')
    expect(remindText({ ...habit(4), remind: '17:00' })).toBe('17:00')
    expect(remindText(habit(4))).toBe('')
  })
})

describe('planerade dagar', () => {
  // TODAY är onsdag 14/10.
  const gym = (days: number[]): Habit => ({ ...habit(days.length), id: 'g', days })
  it('en planerad dag är ett måste', () => {
    const info = todayInfo(gym([0, 2]), {}, TODAY)
    expect(info.must).toBe(true)
    expect(info.pills[0].text).toBe('Planerat idag, 2 kvar i veckan')
  })
  it('andra dagar kan vänta och visar nästa planerade', () => {
    const info = todayInfo(gym([3, 5]), {}, TODAY)
    expect(info.must).toBe(false)
    expect(info.due).toBe(true)
    expect(info.pills[0].text).toBe('Nästa planerade: i morgon')
  })
  it('missade pass utan fler planerade dagar', () => {
    expect(todayInfo(gym([0, 1]), {}, TODAY).pills[0].text).toBe('2 kvar, ta igen när det passar')
  })
  it('blir ett måste när det inte går att vänta längre', () => {
    const info = todayInfo(gym([0, 1, 3, 4, 5]), {}, TODAY)
    expect(info.must).toBe(true)
  })
  it('planen och påminnelsen visar dagarna', () => {
    expect(habitPlan(gym([0, 2]), () => undefined)).toBe('mån, ons')
    expect(remindText({ ...gym([0, 2]), remind: '17:00', remindDays: [6] })).toBe('mån, ons 17:00')
  })
})

describe('rampToday', () => {
  const med = (ramp?: Habit['ramp']): Habit => ({ id: 'med', name: 'Meditation', goal: 7, created: '2026-10-25', after: [], order: 0, archived: false, ramp })
  const ramp = { start: '2026-10-30', from: 3, step: 1, max: 30, unit: 'min' }

  it('startar på from och ökar en minut för varje gjord dag före idag', () => {
    const log = { '2026-10-30': ['med'], '2026-10-31': ['med'] }
    expect(rampToday(med(ramp), log, '2026-10-30')).toBe(3)
    expect(rampToday(med(ramp), log, '2026-10-31')).toBe(4)
    expect(rampToday(med(ramp), log, '2026-11-01')).toBe(5)
  })

  it('står still en missad dag och stannar vid taket', () => {
    expect(rampToday(med(ramp), { '2026-10-30': ['med'] }, '2026-11-05')).toBe(4)
    const every = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [addDays('2026-10-30', i), ['med']]))
    expect(rampToday(med(ramp), every, '2026-12-31')).toBe(30)
  })

  it('null för vanor som inte ökar', () => {
    expect(rampToday(med(), {}, '2026-10-30')).toBeNull()
  })
})

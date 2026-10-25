import { describe, expect, it } from 'vitest'
import { addDays, isoWeek, longDate, todayKey, weekday, weekStart } from './dates'

describe('todayKey', () => {
  it('ger kalenderdagen i telefonens tidszon', () => {
    expect(todayKey(new Date(2026, 9, 14, 0, 0))).toBe('2026-10-14')
    expect(todayKey(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14')
    expect(todayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('går över månads- och årsskiften', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('klarar skottdagar', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
  it('påverkas inte av sommartid', () => {
    // Sommartid 2026: börjar 29 mars, slutar 25 oktober.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })
})

describe('veckostart', () => {
  it('veckan börjar på måndag', () => {
    expect(weekday('2026-10-12')).toBe(0) // måndag
    expect(weekday('2026-10-18')).toBe(6) // söndag
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-14')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // söndag är veckans sista dag
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
  })
  it('över månads- och årsskiften', () => {
    expect(weekStart('2026-03-01')).toBe('2026-02-23')
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })
})

describe('ISO-vecka', () => {
  it('vanliga veckor', () => {
    expect(isoWeek('2026-10-12')).toBe(42)
    expect(isoWeek('2026-10-14')).toBe(42)
    expect(isoWeek('2026-10-18')).toBe(42)
    expect(isoWeek('2026-10-19')).toBe(43)
  })
  it('vecka 1 kan börja i december', () => {
    expect(isoWeek('2024-12-30')).toBe(1)
    expect(isoWeek('2025-12-29')).toBe(1)
    expect(isoWeek('2026-01-01')).toBe(1)
  })
  it('början av januari kan höra till förra årets sista vecka', () => {
    expect(isoWeek('2026-12-31')).toBe(53)
    expect(isoWeek('2027-01-03')).toBe(53)
    expect(isoWeek('2027-01-04')).toBe(1)
    expect(isoWeek('2021-01-03')).toBe(53)
    expect(isoWeek('2023-01-01')).toBe(52)
  })
})

describe('longDate', () => {
  it('skriver datumet på svenska', () => {
    expect(longDate('2026-10-14')).toBe('Onsdag 14 oktober')
    expect(longDate('2027-01-03')).toBe('Söndag 3 januari')
  })
})

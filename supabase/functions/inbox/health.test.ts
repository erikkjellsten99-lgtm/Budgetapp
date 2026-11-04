import { describe, expect, it } from 'vitest'
import { formatGoal, formatHealth, formatProgress, guessRule, isHealthBody, metRules, parseHealthBody, parseHealthValue } from './health'

describe('hälsodata från genvägen', () => {
  it('läser siffror med svenska tusental och decimaler', () => {
    expect(parseHealthValue('8 432 steg', 'steps')).toBe(8432)
    expect(parseHealthValue('8 432', 'steps')).toBe(8432)
    expect(parseHealthValue(8432, 'steps')).toBe(8432)
    expect(parseHealthValue('5,2 km', 'distanceKm')).toBe(5.2)
    expect(parseHealthValue('78.4 kg', 'weightKg')).toBe(78.4)
  })

  it('lägger ihop flera mätningar, men tar senaste för vikt och puls', () => {
    expect(parseHealthValue('1200 steg\n800 steg\n432 steg', 'steps')).toBe(2432)
    expect(parseHealthValue(['20 min', '14 min'], 'exerciseMin')).toBe(34)
    expect(parseHealthValue('78,4 kg\n79,0 kg', 'weightKg')).toBe(78.4)
    expect(parseHealthValue('52 slag/min\n60 slag/min', 'restingHr')).toBe(52)
  })

  it('byter enheter', () => {
    expect(parseHealthValue('5200 m', 'distanceKm')).toBe(5.2)
    expect(parseHealthValue('1500 ml', 'waterL')).toBe(1.5)
    expect(parseHealthValue('4184 kJ', 'activeKcal')).toBe(1000)
    expect(parseHealthValue('170 lb', 'weightKg')).toBeCloseTo(77.1, 1)
  })

  it('tolkar tider för sömn, träning och mindfulness', () => {
    expect(parseHealthValue('7 h 30 min', 'sleepH')).toBe(7.5)
    expect(parseHealthValue('7 tim 12 min', 'sleepH')).toBe(7.2)
    expect(parseHealthValue('7:30', 'sleepH')).toBe(7.5)
    expect(parseHealthValue('450 min', 'sleepH')).toBe(7.5)
    expect(parseHealthValue('7,5', 'sleepH')).toBe(7.5)
    expect(parseHealthValue('34', 'exerciseMin')).toBe(34)
    expect(parseHealthValue('600 s', 'mindfulMin')).toBe(10)
    // Genvägars Tidslängd skickar sekunder utan enhet
    expect(parseHealthValue('180', 'mindfulMin')).toBe(3)
    expect(parseHealthValue(180, 'mindfulMin')).toBe(3)
    expect(parseHealthValue('3:00', 'mindfulMin')).toBe(3)
    expect(parseHealthValue('0:05:30', 'mindfulMin')).toBe(5.5)
    expect(parseHealthValue('7:30', 'sleepH')).toBe(7.5)
    expect(parseHealthValue('180\n420', 'mindfulMin')).toBe(10)
    expect(parseHealthValue('12 min', 'mindfulMin')).toBe(12)
    expect(parseHealthValue('27000', 'sleepH')).toBe(7.5)
  })

  it('hoppar över tomt och skräp', () => {
    expect(parseHealthValue('', 'steps')).toBeNull()
    expect(parseHealthValue('inga data', 'steps')).toBeNull()
    expect(parseHealthValue(null, 'steps')).toBeNull()
    expect(parseHealthValue(-5, 'steps')).toBeNull()
    expect(parseHealthBody({ steg: '9 001', somn: '', okänt: 5 })).toEqual({ steps: 9001 })
    expect(isHealthBody({ sak: 'x' })).toBe(false)
    expect(isHealthBody({ steg: '1' })).toBe(true)
  })

  it('bockar vanor vars regel är uppfylld', () => {
    const habits = [
      { id: 'steg', auto: { metric: 'steps' as const, min: 10000 } },
      { id: 'med', auto: { metric: 'mindfulMin' as const, min: 10 } },
      { id: 'gym' },
      { id: 'gammal', archived: true, auto: { metric: 'steps' as const, min: 1 } },
      { id: 'ny', created: '2026-11-10', auto: { metric: 'steps' as const, min: 1 } },
    ]
    expect(metRules(habits, { steps: 10432, mindfulMin: 8 }, '2026-11-04')).toEqual([{ id: 'steg', min: false }])
    expect(metRules(habits, { steps: 9999, mindfulMin: 10 }, '2026-11-04')).toEqual([{ id: 'med', min: false }])
  })

  it('gränsen kan följa vanans ökning, och minimiversionen ger en minimibock', () => {
    const med = [{ id: 'med', minimum: '2 min', ramp: { start: '2026-11-01', from: 3, step: 1, max: 20 }, auto: { metric: 'mindfulMin' as const, min: 2, follow: true } }]
    // 4 gjorda dagar före idag → 7 min idag
    expect(metRules(med, { mindfulMin: 7 }, '2026-11-06', () => 4)).toEqual([{ id: 'med', min: false }])
    expect(metRules(med, { mindfulMin: 5 }, '2026-11-06', () => 4)).toEqual([{ id: 'med', min: true }])
    expect(metRules(med, { mindfulMin: 1 }, '2026-11-06', () => 4)).toEqual([])
    // Taket
    expect(metRules(med, { mindfulMin: 20 }, '2026-11-06', () => 50)).toEqual([{ id: 'med', min: false }])
  })

  it('visar svenska tal och föreslår regler', () => {
    expect(formatHealth('steps', 8432)).toBe('8 432 steg')
    expect(formatHealth('sleepH', 7.2)).toBe('7 h 12 min')
    expect(formatHealth('distanceKm', 5.25)).toBe('5,3 km')
    expect(formatProgress('steps', 8432, 10000)).toBe('8\u00a0432 av 10\u00a0000\u00a0steg')
    expect(formatProgress('sleepH', 6.5, 7)).toBe('6 h 30 min av 7 h')
    expect(formatGoal('steps', 10000)).toBe('10\u00a0000\u00a0steg')
    expect(formatGoal('mindfulMin', 10)).toBe('10\u00a0min mindfulness')
    expect(guessRule('10k steg')).toEqual({ metric: 'steps', min: 10000 })
    expect(guessRule('8 000 steg')).toEqual({ metric: 'steps', min: 8000 })
    expect(guessRule('Meditation')).toEqual({ metric: 'mindfulMin', min: 10 })
    expect(guessRule('Läsa')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { areaOf, cleanArea, guessArea, NO_AREA } from './areas'

describe('områden', () => {
  it('förslag utifrån namnet', () => {
    expect(guessArea('Gym')).toBe('Träning')
    expect(guessArea('Meditation')).toBe('Sinne')
    expect(guessArea('Stretching')).toBe('Träning')
    expect(guessArea('Bygga på mina projekt')).toBe('Projekt')
    expect(guessArea('Läsa 10 sidor')).toBe('Sinne')
    expect(guessArea('Ringa mormor')).toBeNull()
  })

  it('städar och känner igen namnen oavsett skiftläge', () => {
    expect(cleanArea('  träning ')).toBe('Träning')
    expect(cleanArea('')).toBeUndefined()
    expect(cleanArea(null)).toBeUndefined()
    expect(cleanArea('Familj')).toBe('Familj')
    expect(areaOf({})).toBe(NO_AREA)
    expect(areaOf({ area: 'Sömn' })).toBe('Sömn')
  })
})

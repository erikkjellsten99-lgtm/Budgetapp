import { describe, expect, it } from 'vitest'
import { confirmText, parseSpoken } from './spoken'

// 2026-11-03 är en tisdag
const today = '2026-11-03'

describe('sagt till Siri', () => {
  it('imorgon och klockan', () => {
    expect(parseSpoken('Ringa mamma imorgon klockan 18', today)).toEqual({ title: 'Ringa mamma', date: '2026-11-04', time: '18:00' })
    expect(parseSpoken('ringa mamma i morgon kl. 18.30', today)).toEqual({ title: 'Ringa mamma', date: '2026-11-04', time: '18:30' })
  })

  it('veckodagar går till nästa sådan dag', () => {
    expect(parseSpoken('Handla på fredag', today)).toEqual({ title: 'Handla', date: '2026-11-06' })
    expect(parseSpoken('Tvätta tisdag', today)).toEqual({ title: 'Tvätta', date: '2026-11-10' })
    expect(parseSpoken('Möte med Åsa på måndag kl 9', today)).toEqual({ title: 'Möte med Åsa', date: '2026-11-09', time: '09:00' })
  })

  it('datum med månad, passerat datum blir nästa år', () => {
    expect(parseSpoken('Betala hyran den 25 november', today)).toEqual({ title: 'Betala hyran', date: '2026-11-25' })
    expect(parseSpoken('Tandläkare 4 mars 10:15', today)).toEqual({ title: 'Tandläkare', date: '2027-03-04', time: '10:15' })
    expect(parseSpoken('Födelsedag 1/12', today)).toEqual({ title: 'Födelsedag', date: '2026-12-01' })
  })

  it('utan dag blir det idag, och små ord i början tas bort', () => {
    expect(parseSpoken('påminn mig att köpa mjölk', today)).toEqual({ title: 'Köpa mjölk', date: today })
    expect(parseSpoken('Gå ut med Diesel ikväll klockan 21', today)).toEqual({ title: 'Gå ut med Diesel', date: today, time: '21:00' })
  })

  it('tomt eller bara en tid ger inget', () => {
    expect(parseSpoken('   ', today)).toBeNull()
    expect(parseSpoken('imorgon kl 8', today)).toBeNull()
  })

  it('bekräftelse att läsa upp', () => {
    expect(confirmText({ title: 'Ringa mamma', date: '2026-11-04', time: '18:00' }, today, true)).toBe('Klart: Ringa mamma, i morgon kl. 18:00.')
    expect(confirmText({ title: 'Handla', date: '2026-11-06' }, today, true)).toBe('Klart: Handla, fre 2026-11-06.')
    expect(confirmText({ title: 'Handla', date: today }, today, false)).toBe('Handla finns redan i Groundwork.')
  })
})

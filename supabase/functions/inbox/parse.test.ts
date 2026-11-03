import { describe, expect, it } from 'vitest'
import { itemId, parseLines, parseWhen, stockholmToday, TITLE_MAX } from './parse'

const today = '2026-11-03'

describe('påminnelser från iPhone', () => {
  it('läser titel, datum och tid', () => {
    expect(parseLines('Ring tandläkaren | 2026-11-04T10:30:00+01:00', today)).toEqual([
      { title: 'Ring tandläkaren', date: '2026-11-04', time: '10:30' },
    ])
  })

  it('utan datum blir det idag, 00:00 räknas som ingen tid', () => {
    expect(parseLines('Köpa mjölk |\nTvätta | 2026-11-05T00:00:00+01:00\nHandla', today)).toEqual([
      { title: 'Köpa mjölk', date: today },
      { title: 'Tvätta', date: '2026-11-05' },
      { title: 'Handla', date: today },
    ])
  })

  it('tål å/ä/ö, streck i titeln, tomma rader och dubbletter', () => {
    const text = '\n  Möte | Åsa  | 2026-11-06\n\nmöte | åsa | 2026-11-06\n   \n'
    expect(parseLines(text, today)).toEqual([{ title: 'Möte | Åsa', date: '2026-11-06' }])
  })

  it('kortar för långa titlar och ignorerar trasiga datum', () => {
    const [item] = parseLines(`${'a'.repeat(200)} | 2026-13-40`, today)
    expect(item.title.length).toBe(TITLE_MAX)
    expect(item.date).toBe(today)
  })

  it('förstår telefonens svenska och engelska datumformat', () => {
    expect(parseWhen('4 nov. 2026 10:00', today)).toEqual({ date: '2026-11-04', time: '10:00' })
    expect(parseWhen('4 november 2026 kl. 09.30', today)).toEqual({ date: '2026-11-04', time: '09:30' })
    expect(parseWhen('1 maj 2027', today)).toEqual({ date: '2027-05-01' })
    expect(parseWhen('Nov 4, 2026 at 10:00', today)).toEqual(null)
    expect(parseWhen('4 Dec 2026 at 18:15', today)).toEqual({ date: '2026-12-04', time: '18:15' })
    expect(parseWhen('I morgon 08:00', today)).toEqual({ date: '2026-11-04', time: '08:00' })
    expect(parseWhen('idag', today)).toEqual({ date: today })
    expect(parseWhen('31 feb. 2026', today)).toEqual(null)
    expect(parseLines('Gym | 5 nov. 2026 07:15', today)).toEqual([{ title: 'Gym', date: '2026-11-05', time: '07:15' }])
  })

  it('samma påminnelse får samma id', async () => {
    const a = await itemId({ title: 'Gym', date: today })
    expect(a).toBe(await itemId({ title: 'gym', date: today }))
    expect(a).not.toBe(await itemId({ title: 'Gym', date: '2026-11-04' }))
    expect(a).toMatch(/^rem-[0-9a-f]{20}$/)
  })

  it('dagens datum i Sverige', () => {
    expect(stockholmToday(new Date('2026-11-03T23:30:00Z'))).toBe('2026-11-04')
  })
})

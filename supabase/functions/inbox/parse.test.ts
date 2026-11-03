import { describe, expect, it } from 'vitest'
import { itemId, parseLines, stockholmToday, TITLE_MAX } from './parse'

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

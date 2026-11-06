import { describe, expect, it } from 'vitest'
import { FEEDS, isWar, judgeTone, loadNews, parseRss, PER_TOPIC } from './news.ts'

const rss = (items: string) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>SVT</title>${items}</channel></rss>`
const item = (title: string, opts: { link?: string; date?: string; desc?: string } = {}) =>
  `<item><title><![CDATA[${title}]]></title><link>${opts.link ?? `https://www.svt.se/nyheter/${encodeURIComponent(title)}`}</link>` +
  `<pubDate>${opts.date ?? 'Fri, 06 Nov 2026 10:00:00 +0100'}</pubDate><description>${opts.desc ?? ''}</description></item>`

describe('parseRss', () => {
  it('läser titel, länk, datum och beskrivning, med CDATA, entiteter och HTML', () => {
    const [e] = parseRss(rss(item('Räntan sänks – "äntligen"', { desc: '&lt;p&gt;Riksbanken &amp;amp; banker: lägre &lt;b&gt;räntor&lt;/b&gt;.&lt;/p&gt;' })))
    expect(e.title).toBe('Räntan sänks – "äntligen"')
    expect(e.link).toMatch(/^https:\/\/www\.svt\.se\//)
    expect(e.summary).toBe('Riksbanken & banker: lägre räntor .')
    expect(new Date(e.published).toISOString()).toBe('2026-11-06T09:00:00.000Z')
  })

  it('hoppar över artiklar utan titel eller med osäker länk', () => {
    const xml = rss(item('') + item('Bra', { link: 'javascript:alert(1)' }) + item('Bra', { link: 'http://x.se' }) + item('Ok'))
    expect(parseRss(xml).map((e) => e.title)).toEqual(['Ok'])
  })

  it('tomt eller trasigt flöde ger inga artiklar', () => {
    expect(parseRss('')).toEqual([])
    expect(parseRss('<html>Inte RSS</html>')).toEqual([])
  })
})

describe('judgeTone', () => {
  it('positiva nyheter', () => {
    expect(judgeTone('Sverige vann mot Danmark – klara för VM').tone).toBe('positiv')
    expect(judgeTone('Riksbanken sänker räntan').tone).toBe('positiv')
    expect(judgeTone('Arbetslösheten minskar för tredje månaden').tone).toBe('positiv')
    expect(judgeTone('Vapenvila överens om i natt').tone).toBe('positiv')
  })

  it('negativa nyheter', () => {
    expect(judgeTone('Flera döda i ny attack mot Kiev').tone).toBe('negativ')
    expect(judgeTone('Börsen rasar efter beskedet').tone).toBe('negativ')
    expect(judgeTone('Arbetslösheten ökar i hela landet').tone).toBe('negativ')
    expect(judgeTone('Företaget varslar 300 anställda').tone).toBe('negativ')
    expect(judgeTone('Malmö FF förlorade hemma').tone).toBe('negativ')
  })

  it('samma ord åt olika håll: frasen avgör', () => {
    expect(judgeTone('Börsen stiger').tone).toBe('positiv')
    expect(judgeTone('Priserna stiger').tone).toBe('negativ')
  })

  it('neutral när inget talar för någotdera, och visar orden som avgjorde', () => {
    expect(judgeTone('Regeringen presenterar budgeten i dag')).toEqual({ tone: 'neutral', because: [] })
    expect(judgeTone('Flera döda i ny attack').because).toEqual(expect.arrayContaining(['döda', 'attack']))
  })

  it('ord inuti andra ord räknas inte (å, ä, ö)', () => {
    expect(judgeTone('Hotellet öppnar igen').because).not.toContain('hot')
    expect(judgeTone('Krigsmuseet').tone).toBe('neutral')
  })
})

describe('isWar', () => {
  it('känner igen krig, också med å/ä/ö', () => {
    expect(isWar('Drönarattacker mot Odessa')).toBe(true)
    expect(isWar('Ryssland anfaller')).toBe(true)
    expect(isWar('Val i Frankrike')).toBe(false)
    expect(isWar('Ukrainas president')).toBe(true)
  })
})

describe('loadNews', () => {
  it('fyra ämnen, krig filtreras från utrikes, nyast först, och trasigt flöde blir saknat', async () => {
    const feeds: Record<string, string> = {
      [FEEDS[0].url]: rss(item('Börsen stiger', { date: 'Fri, 06 Nov 2026 08:00:00 +0100' })),
      [FEEDS[1].url]: rss(item('Ny attack i Ukraina') + item('Val i Frankrike')),
      [FEEDS[2].url]: rss(Array.from({ length: 20 }, (_, i) => item(`Match ${i}`, { date: `Fri, 06 Nov 2026 ${String(i).padStart(2, '0')}:00:00 +0100` })).join('')),
    }
    const result = await loadNews(async (url) => {
      if (!feeds[url]) throw new Error('404')
      return feeds[url]
    }, 123)
    expect(result.updated).toBe(123)
    expect(result.missing).toEqual(['sverige'])
    expect(result.items.filter((i) => i.topic === 'krig').map((i) => i.title)).toEqual(['Ny attack i Ukraina'])
    expect(result.items.filter((i) => i.topic === 'fotboll')).toHaveLength(PER_TOPIC)
    expect(result.items[0].title).toBe('Match 19')
    const dates = result.items.map((i) => i.published)
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
    expect(new Set(result.items.map((i) => i.id)).size).toBe(result.items.length)
  })
})

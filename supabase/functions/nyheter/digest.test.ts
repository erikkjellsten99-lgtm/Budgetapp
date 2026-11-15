import { describe, expect, it } from 'vitest'
import { checkStories, collectSources, leaningOf, SAVE_TOOL, STORIES_MAX } from './digest.ts'
import { costUsd, MAX_ATTEMPTS, readySections, weekDone, weekId, type SectionResult, type Week } from './shared.ts'

const URLS = {
  svt: 'https://www.svt.se/nyheter/inrikes/en-nyhet',
  ab: 'https://www.aftonbladet.se/nyheter/a/abc/en-nyhet',
  svd: 'https://www.svd.se/a/xyz/en-nyhet',
  blogg: 'https://exempel.se/blogg/en-nyhet',
}
const found = collectSources([{ type: 'web_search_tool_result', content: Object.values(URLS).map((url) => ({ type: 'web_search_result', url })) }])

const story = (over: Record<string, unknown> = {}) => ({
  title: 'Rubrik',
  summary: 'Det här har hänt.',
  positive: true,
  sources: [{ title: 'SVT Nyheter', url: URLS.svt }],
  angles: [],
  blindspot: null,
  ...over,
})
const check = (stories: unknown[]) => checkStories({ stories }, 'sverige', found)

describe('veckans id', () => {
  it('ISO-vecka, måndag till söndag', () => {
    expect(weekId(Date.parse('2026-11-16T03:00:00Z'))).toBe('2026-W47')
    expect(weekId(Date.parse('2026-11-15T23:00:00Z'))).toBe('2026-W46')
    expect(weekId(Date.parse('2027-01-01T12:00:00Z'))).toBe('2026-W53')
    expect(weekId(Date.parse('2024-12-30T12:00:00Z'))).toBe('2025-W01')
  })
})

describe('kontrollen av nyheterna', () => {
  it('behåller en nyhet med källa ur sökresultaten', () => {
    const { stories, dropped } = check([story()])
    expect(dropped).toBe(0)
    expect(stories[0]).toMatchObject({ title: 'Rubrik', positive: true, sources: [{ title: 'SVT Nyheter', url: URLS.svt }] })
    expect(stories[0].id).toMatch(/^sverige-/)
  })

  it('kastar en nyhet vars källa sökningen aldrig hittade', () => {
    const { stories, dropped } = check([story({ sources: [{ title: 'Påhittad', url: 'https://www.svt.se/nyheter/finns-inte' }] })])
    expect(stories).toEqual([])
    expect(dropped).toBe(1)
  })

  it('kastar nyheter utan rubrik eller text, och dubbletter', () => {
    expect(check([story({ title: ' ' }), story({ summary: '' }), story(), story()]).stories).toHaveLength(1)
  })

  it('en vinkel utan bekräftad artikel kastas, resten behålls', () => {
    const { stories } = check([
      story({
        angles: [
          { side: 'vanster', outlet: 'Aftonbladet', text: 'Betonar kostnaden för hushållen.', url: URLS.ab },
          { side: 'hoger', outlet: 'Okänd', text: 'Påhittad vinkel.', url: 'https://www.svd.se/a/finns-inte' },
        ],
      }),
    ])
    expect(stories[0].angles).toEqual([{ side: 'vanster', outlet: 'Aftonbladet', text: 'Betonar kostnaden för hushållen.', url: URLS.ab }])
  })

  it('den fasta lutningen går före modellens, och varje sida får högst en vinkel', () => {
    const { stories } = check([
      story({
        angles: [
          { side: 'vanster', outlet: 'SvD', text: 'Betonar skattetrycket.', url: URLS.svd },
          { side: 'hoger', outlet: 'Aftonbladet', text: 'Betonar välfärden.', url: URLS.ab },
          { side: 'hoger', outlet: 'En blogg', text: 'Tredje rösten.', url: URLS.blogg },
        ],
      }),
    ])
    expect(stories[0].angles.map((a) => [a.side, a.outlet])).toEqual([
      ['vanster', 'Aftonbladet'],
      ['hoger', 'SvD'],
    ])
  })

  it('okända medier får sidan modellen anger', () => {
    expect(leaningOf(URLS.blogg)).toBeNull()
    expect(leaningOf('https://nyheter.svt.se/x')).toBe('mitten')
    const { stories } = check([story({ angles: [{ side: 'hoger', outlet: '', text: 'En röst.', url: URLS.blogg }] })])
    expect(stories[0].angles[0]).toMatchObject({ side: 'hoger', outlet: 'exempel.se' })
  })

  it('en blind fläck godtas bara när vinklarna stämmer med den', () => {
    const left = { side: 'vanster', outlet: 'Aftonbladet', text: 'Bevakar.', url: URLS.ab }
    const right = { side: 'hoger', outlet: 'SvD', text: 'Bevakar.', url: URLS.svd }
    expect(check([story({ angles: [left], blindspot: 'hoger' })]).stories[0].blindspot).toBe('hoger')
    expect(check([story({ angles: [left, right], blindspot: 'hoger' })]).stories[0].blindspot).toBeNull()
    expect(check([story({ angles: [], blindspot: 'hoger' })]).stories[0].blindspot).toBeNull()
    expect(check([story({ angles: [right], blindspot: 'vanster' })]).stories[0].blindspot).toBe('vanster')
  })

  it('vinklarnas artiklar räknas som källor när inga andra håller', () => {
    const { stories } = check([story({ sources: [], angles: [{ side: 'vanster', outlet: 'Aftonbladet', text: 'Bevakar.', url: URLS.ab }] })])
    expect(stories[0].sources).toEqual([{ title: 'Aftonbladet', url: URLS.ab }])
  })

  it('minst hälften positiva: de sista av de andra kastas', () => {
    const many = [false, false, true, false, true].map((positive, i) => story({ title: `Nyhet ${i}`, positive }))
    const { stories, dropped } = check(many)
    expect(stories.map((s) => s.title)).toEqual(['Nyhet 0', 'Nyhet 1', 'Nyhet 2', 'Nyhet 4'])
    expect(stories.filter((s) => s.positive).length * 2).toBeGreaterThanOrEqual(stories.length)
    expect(dropped).toBe(1)
  })

  it('utan positiva nyheter visas bara en', () => {
    expect(check([story({ title: 'A', positive: false }), story({ title: 'B', positive: false })]).stories).toHaveLength(1)
  })

  it('aldrig fler än taket, och positiva går före', () => {
    const many = [false, false, false, true, true, true, true].map((positive, i) => story({ title: `Nyhet ${i}`, positive }))
    const { stories } = check(many)
    expect(stories).toHaveLength(STORIES_MAX)
    expect(stories.filter((s) => s.positive)).toHaveLength(4)
  })

  it('tål skräp', () => {
    expect(checkStories(null, 'ai', found).stories).toEqual([])
    expect(checkStories({ stories: [null, 3, 'x'] }, 'ai', found).stories).toEqual([])
  })

  it('verktygets schema är strikt', () => {
    expect(SAVE_TOOL.strict).toBe(true)
    expect(SAVE_TOOL.input_schema.additionalProperties).toBe(false)
  })
})

describe('veckan', () => {
  const section = (over: Partial<SectionResult>): SectionResult => ({ status: 'klar', attempts: 1, stories: [], dropped: 0, model: 'claude-fable-5-2', usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 }, costUsd: 0, ...over })
  const all = (r: SectionResult): Week => ({ week: '2026-W47', created: 0, updated: 0, sections: { varlden: r, sverige: r, karlstad: r, ai: r, anthropic: r, openai: r } })

  it('klar när inget finns kvar att vänta på eller försöka', () => {
    expect(weekDone(all(section({})))).toBe(true)
    expect(weekDone(all(section({ status: 'vantar' })))).toBe(false)
    expect(weekDone(all(section({ status: 'fel', attempts: 1 })))).toBe(false)
    expect(weekDone(all(section({ status: 'fel', attempts: MAX_ATTEMPTS })))).toBe(true)
    expect(weekDone({ week: '2026-W47', created: 0, updated: 0, sections: {} })).toBe(false)
  })

  it('bara klara sektioner med nyheter visas', () => {
    expect(readySections(all(section({})))).toEqual([])
    expect(readySections(null)).toEqual([])
  })

  it('kostnaden: halva tokenpriset via batch, sökningar fullt pris', () => {
    expect(costUsd('claude-fable-5-2', { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0, searches: 10 })).toBe(6.1)
    expect(costUsd('claude-opus-5-5', { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0, searches: 0 })).toBe(3)
  })
})

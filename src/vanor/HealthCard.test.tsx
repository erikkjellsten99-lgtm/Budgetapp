import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HealthCard from './HealthCard'

const render = (values: Record<string, number>) =>
  renderToStaticMarkup(
    <HealthCard health={[{ date: '2026-11-07', updated: 0, values }]} habits={[]} today="2026-11-07" goalOf={() => 0} />,
  )

describe('HealthCard', () => {
  it('visar sömnpoängen och en förklaring när bara poängen har kommit', () => {
    const html = render({ sleepScore: 100 })
    expect(html).toContain('Hälsa idag')
    expect(html).toContain('100')
    expect(html).toContain('Sömnen har inte kommit från Hälsa än')
  })

  it('visas inte när det bara finns sömnmått som inte kan visas ensamma', () => {
    expect(render({ sleepWakes: 2 })).toBe('')
  })

  it('visar sömnen som vanligt när den finns', () => {
    const html = render({ sleepH: 7.5, sleepScore: 90 })
    expect(html).toContain('sleep-big')
    expect(html).not.toContain('sleep-pending')
  })
})

import { describe, expect, it } from 'vitest'
import { fetchStart, isRealDay, normalizeCurrency, parseChart, parseSearch, rowsToUpsert, toSek } from './prices.ts'
import sek from './fixtures/chart-inve-b.json'
import usd from './fixtures/chart-aapl.json'
import usdSek from './fixtures/chart-usdsek.json'
import search from './fixtures/search.json'

describe('parseChart', () => {
  it('läser valuta och punkter, och hoppar över kurser som saknas (null)', () => {
    const chart = parseChart(sek)
    expect(chart?.currency).toBe('SEK')
    // Fixturen har fem dagar men en null-kurs den 4 november.
    expect(chart?.points.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'])
    expect(chart?.points[0].close).toBe(281.4)
  })

  it('ger fem punkter när ingen kurs saknas', () => {
    expect(parseChart(usd)?.points).toHaveLength(5)
  })

  it('ger null för svar utan data', () => {
    expect(parseChart({})).toBeNull()
    expect(parseChart(null)).toBeNull()
    expect(parseChart({ chart: { result: null, error: { code: 'Not Found' } } })).toBeNull()
  })

  it('ger datum i Europe/Stockholm, inte UTC', () => {
    // 22:30 UTC den 5 november är 23:30 i Stockholm (vintertid): fortfarande den 5:e. 23:30 UTC är 00:30 den 6:e.
    const make = (t: number) => ({
      chart: { result: [{ meta: { currency: 'SEK' }, timestamp: [t], indicators: { quote: [{ close: [1] }] } }] },
    })
    expect(parseChart(make(Date.UTC(2026, 10, 5, 22, 30) / 1000))?.points[0].date).toBe('2026-11-05')
    expect(parseChart(make(Date.UTC(2026, 10, 5, 23, 30) / 1000))?.points[0].date).toBe('2026-11-06')
  })
})

describe('toSek', () => {
  it('räknar om med valutakursen samma dag och utelämnar dagar utan valutakurs', () => {
    const points = parseChart(usd)!.points
    const fx = parseChart(usdSek)!.points.filter((p) => p.date !== '2026-11-04')
    const out = toSek(points, fx, 'USD')
    expect(out).toHaveLength(4)
    expect(out.map((p) => p.date)).not.toContain('2026-11-04')
    expect(out[0]).toEqual({ date: '2026-11-02', close: 270.1 * 9.41 })
  })

  it('lämnar kronor oförändrade', () => {
    const points = parseChart(sek)!.points
    expect(toSek(points, null, 'SEK')).toEqual(points)
  })

  it('ger inget om valutakurs saknas helt för annan valuta', () => {
    expect(toSek(parseChart(usd)!.points, null, 'USD')).toEqual([])
  })

  it('delar kurser i pence med 100 före omräkningen', () => {
    const points = [{ date: '2026-11-02', close: 1250 }]
    const fx = [{ date: '2026-11-02', close: 13.5 }]
    expect(toSek(points, fx, 'GBP', 100)).toEqual([{ date: '2026-11-02', close: 12.5 * 13.5 }])
  })
})

describe('normalizeCurrency', () => {
  it('gör om valutor i minsta enhet till huvudvalutan och delar med 100', () => {
    expect(normalizeCurrency('GBp')).toEqual({ currency: 'GBP', divisor: 100 })
    expect(normalizeCurrency('GBX')).toEqual({ currency: 'GBP', divisor: 100 })
    expect(normalizeCurrency('ZAc')).toEqual({ currency: 'ZAR', divisor: 100 })
    expect(normalizeCurrency('ILA')).toEqual({ currency: 'ILS', divisor: 100 })
  })

  it('lämnar vanliga valutor som de är', () => {
    expect(normalizeCurrency('SEK')).toEqual({ currency: 'SEK', divisor: 1 })
    expect(normalizeCurrency('USD')).toEqual({ currency: 'USD', divisor: 1 })
    expect(normalizeCurrency('GBP')).toEqual({ currency: 'GBP', divisor: 1 })
  })

  it('avvisar okända former', () => {
    for (const c of ['usd', 'US', 'USDT', '', 'Sek', 'GBp ']) expect(normalizeCurrency(c)).toBeNull()
  })
})

describe('parseSearch', () => {
  it('mappar typerna och hoppar över index', () => {
    expect(parseSearch(search)).toEqual([
      { ticker: 'INVE-B.ST', name: 'Investor AB (publ)', type: 'stock' },
      { ticker: '0P0000XYZ.ST', name: 'Fond Global', type: 'fund' },
      { ticker: 'XACT-OMXS30.ST', name: 'XACT OMXS30', type: 'etf' },
    ])
  })

  it('ger tom lista för oväntat svar', () => {
    expect(parseSearch({})).toEqual([])
    expect(parseSearch(null)).toEqual([])
  })
})

describe('rowsToUpsert', () => {
  it('ger unika (ticker, date) även när samma punkt finns två gånger, sista vinner', () => {
    const rows = rowsToUpsert('AAPL', [
      { date: '2026-11-02', close: 1 },
      { date: '2026-11-03', close: 2 },
      { date: '2026-11-02', close: 3 },
    ])
    expect(rows).toEqual([
      { ticker: 'AAPL', date: '2026-11-02', close_sek: 3 },
      { ticker: 'AAPL', date: '2026-11-03', close_sek: 2 },
    ])
  })
})

describe('tomma intervall och ogiltiga kurser', () => {
  it('giltig meta utan tidsstämplar ger inga punkter, inte null', () => {
    const empty = { chart: { result: [{ meta: { currency: 'USD', symbol: 'AAPL' }, indicators: { quote: [{}] } }], error: null } }
    expect(parseChart(empty)).toEqual({ currency: 'USD', points: [] })
  })

  it('hoppar över kurser som är 0 eller negativa', () => {
    const bad = {
      chart: { result: [{ meta: { currency: 'SEK' }, timestamp: [1793606400, 1793692800, 1793779200], indicators: { quote: [{ close: [0, -3, 5] }] } }] },
    }
    expect(parseChart(bad)?.points).toEqual([{ date: '2026-11-04', close: 5 }])
  })
})

describe('fetchStart', () => {
  it('hämtar om den senast sparade dagen när from redan är sparad', () => {
    expect(fetchStart('2026-01-01', '2026-11-06', '2026-01-01')).toBe('2026-11-06')
    expect(fetchStart('2025-06-01', '2026-11-06', '2026-01-01')).toBe('2026-11-06')
  })

  it('hämtar från from när inget är sparat', () => {
    expect(fetchStart(null, null, '2026-01-01')).toBe('2026-01-01')
  })

  it('hämtar från from när en bakåtdaterad affär ligger före första sparade dagen', () => {
    expect(fetchStart('2026-03-01', '2026-11-06', '2026-01-01')).toBe('2026-01-01')
  })
})

describe('isRealDay', () => {
  it('godtar riktiga datum och avvisar omöjliga', () => {
    expect(isRealDay('2026-11-06')).toBe(true)
    expect(isRealDay('2028-02-29')).toBe(true)
    expect(isRealDay('2026-13-45')).toBe(false)
    expect(isRealDay('2026-02-30')).toBe(false)
    expect(isRealDay('2026-1-6')).toBe(false)
    expect(isRealDay(20261106)).toBe(false)
  })
})

// Kurser från Yahoo Finance (öppet, ingen nyckel): dagens stängningskurs per innehav, omräknad till kronor.
// Ren kod utan npm-importer, så att Vitest kan köra den. Själva sparandet i tabellen prices görs i index.ts.

import type { HoldingType, PricePoint } from './types.ts'

export interface ChartData {
  currency: string
  /** Datum i Europe/Stockholm, kursen i bolagets egen valuta. */
  points: { date: string; close: number }[]
}

export interface SearchHit {
  ticker: string
  name: string
  type: HoldingType
}

// sv-SE ger ÅÅÅÅ-MM-DD.
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' })

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Yahoos chart-svar (v8) till valuta och punkter. Dagar utan kurs (null, 0 eller negativ) hoppas över. */
export function parseChart(json: unknown): ChartData | null {
  if (!isRecord(json) || !isRecord(json.chart) || !Array.isArray(json.chart.result)) return null
  const result = json.chart.result[0]
  if (!isRecord(result) || !isRecord(result.meta) || typeof result.meta.currency !== 'string') return null
  const stamps = result.timestamp
  const indicators = result.indicators
  const quote = isRecord(indicators) && Array.isArray(indicators.quote) ? indicators.quote[0] : null
  const closes = isRecord(quote) ? quote.close : null
  // Giltig meta utan tidsstämplar eller kurser: inga handelsdagar i intervallet (helg, helgdag, redan uppdaterad).
  if (!Array.isArray(stamps) || !Array.isArray(closes)) return { currency: result.meta.currency, points: [] }
  const points: ChartData['points'] = []
  stamps.forEach((t, i) => {
    const close = closes[i]
    if (typeof t !== 'number' || typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return
    points.push({ date: dayFormat.format(new Date(t * 1000)), close })
  })
  return { currency: result.meta.currency, points }
}

/** Kurserna i kronor. Andra valutor räknas om med valutakursen samma dag; en dag utan valutakurs utelämnas. */
export function toSek(points: ChartData['points'], fx: ChartData['points'] | null, currency: string): PricePoint[] {
  if (currency === 'SEK') return points
  if (!fx) return []
  const rate = new Map(fx.map((p) => [p.date, p.close]))
  const out: PricePoint[] = []
  for (const p of points) {
    const r = rate.get(p.date)
    if (r !== undefined) out.push({ date: p.date, close: p.close * r })
  }
  return out
}

const TYPES: Record<string, HoldingType> = { EQUITY: 'stock', MUTUALFUND: 'fund', ETF: 'etf' }

/** Yahoos söksvar (v1) till innehav. Index och annat som inte är aktie, fond eller ETF hoppas över. */
export function parseSearch(json: unknown): SearchHit[] {
  if (!isRecord(json) || !Array.isArray(json.quotes)) return []
  const hits: SearchHit[] = []
  for (const q of json.quotes) {
    if (!isRecord(q) || typeof q.symbol !== 'string' || typeof q.quoteType !== 'string') continue
    const type = TYPES[q.quoteType]
    if (!type) continue
    const name = [q.longname, q.shortname].find((n): n is string => typeof n === 'string' && n !== '') ?? q.symbol
    hits.push({ ticker: q.symbol, name, type })
  }
  return hits
}

/** Rader för tabellen prices, en per dag. Kommer samma dag flera gånger vinner den sista. */
export function rowsToUpsert(ticker: string, points: PricePoint[]): { ticker: string; date: string; close_sek: number }[] {
  const byDate = new Map<string, number>()
  for (const p of points) byDate.set(p.date, p.close)
  return [...byDate].map(([date, close_sek]) => ({ ticker, date, close_sek }))
}

/** Första dagen att hämta. Den senast sparade dagen hämtas om, för den kan ha sparats mitt under handelsdagen. */
export function fetchStart(lastStored: string | null, from: string): string {
  return lastStored ?? from
}

/** Ett riktigt datum på formen ÅÅÅÅ-MM-DD (alltså inte 2026-13-45). */
export function isRealDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const d = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day
}

const HEADERS = { 'user-agent': 'Groundwork/1.0 (kurser)' }

/** Dagskurser från och med `from` (ÅÅÅÅ-MM-DD) till idag, eller null om Yahoo inte svarar med data. */
export async function fetchChart(ticker: string, from: string): Promise<ChartData | null> {
  const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000)
  const period2 = Math.floor(Date.now() / 1000) + 86400
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  return parseChart(await res.json())
}

/** Sök aktier, fonder och ETF:er på namn eller symbol. */
export async function search(query: string): Promise<SearchHit[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${res.status}`)
  return parseSearch(await res.json())
}

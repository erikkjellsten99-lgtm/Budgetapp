import { getMeta, setMeta } from './db'
import { supabase } from './sync'
import type { Holding, HoldingType, PricePoint, Trade } from './types'
import { INBOX_URL } from './vanor/InboxSettings'

// Kurser i appen: läser tabellen public.prices och ber funktionen "inbox" hämta nya kurser (högst en gång per dygn).

const PAGE = 1000
const MAX_TICKERS = 50

/** Kurser per ticker i datumordning. Supabase ger högst 1000 rader per fråga, så vi hämtar sida för sida. */
export async function loadPrices(tickers: string[]): Promise<Record<string, PricePoint[]>> {
  const out: Record<string, PricePoint[]> = {}
  if (tickers.length === 0) return out
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('prices')
      .select('ticker,date,close_sek')
      .in('ticker', tickers)
      .order('date')
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as { ticker: string; date: string; close_sek: number | string }[]
    for (const r of rows) (out[r.ticker] ??= []).push({ date: r.date, close: Number(r.close_sek) })
    if (rows.length < PAGE) break
  }
  return out
}

function dayOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Hämtar nya kurser för innehav med ticker och affärer. Returnerar false (utan att kasta) om det inte gick. */
export async function refreshPrices(holdings: Holding[], trades: Trade[], now: Date = new Date()): Promise<boolean> {
  try {
    const day = dayOf(now)
    if ((await getMeta<string>('pricesRefreshedOn')) === day) return true

    // från = datumet för första affären, tidigast bland innehav med samma ticker
    const first = new Map<string, string>()
    for (const h of holdings) {
      if (!h.ticker) continue
      for (const t of trades) {
        if (t.holdingId !== h.id) continue
        const prev = first.get(h.ticker)
        if (!prev || t.date < prev) first.set(h.ticker, t.date)
      }
    }
    const tickers = [...first].slice(0, MAX_TICKERS).map(([ticker, from]) => ({ ticker, from }))
    if (tickers.length === 0) return false

    const { data } = await supabase.auth.getSession()
    if (!data.session) return false
    const res = await fetch(`${INBOX_URL}?action=kurser`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers }),
    })
    if (!res.ok) return false
    await setMeta('pricesRefreshedOn', day)
    return true
  } catch {
    return false
  }
}

/** Sök bolag, fond eller ETF på namn eller ticker. */
export async function searchTicker(q: string): Promise<{ ticker: string; name: string; type: HoldingType }[]> {
  const query = q.trim()
  if (!query) return []
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return []
    const res = await fetch(`${INBOX_URL}?action=kurssok&q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { results?: { ticker: string; name: string; type: HoldingType }[] }
    return body.results ?? []
  } catch {
    return []
  }
}

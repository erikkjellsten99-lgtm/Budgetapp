import { getMeta, setMeta } from './db';
import { supabase } from './sync';
import type { Holding, HoldingType, PricePoint, Trade } from './types';
import { INBOX_URL } from './vanor/InboxSettings';

// Kurser i appen: läser tabellen public.prices och ber funktionen "inbox" hämta nya kurser (högst en gång per dygn).

const PAGE = 1000;
const MAX_TICKERS = 50;

/** Senast lästa kurser, sparade lokalt i meta så att värdena syns utan nät eller inloggning. */
const CACHE_KEY = 'pricesCache';

/** De sparade kurserna för `tickers`, eller {} om inga finns. */
async function cachedPrices(tickers: string[]): Promise<Record<string, PricePoint[]>> {
  const out: Record<string, PricePoint[]> = {};
  try {
    const cache = (await getMeta<Record<string, PricePoint[]>>(CACHE_KEY)) ?? {};
    for (const t of tickers) if (cache[t]) out[t] = cache[t];
  } catch {
    // Ingen lokal kopia att läsa.
  }
  return out;
}

/**
 * Kurser per ticker i datumordning. Supabase ger högst 1000 rader per fråga, så vi hämtar sida för sida.
 * Lyckad läsning sparas lokalt; utloggad eller fel ger de senast sparade kurserna i stället.
 */
export async function loadPrices(tickers: string[]): Promise<Record<string, PricePoint[]>> {
  if (tickers.length === 0) return {};
  let out: Record<string, PricePoint[]>;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return await cachedPrices(tickers);
    out = await readPrices(tickers);
  } catch {
    return await cachedPrices(tickers);
  }
  try {
    // Bara de begärda tickers byts ut; en ticker utan rader tas bort ur kopian
    const cache = { ...((await getMeta<Record<string, PricePoint[]>>(CACHE_KEY)) ?? {}) };
    for (const t of tickers) {
      if (out[t]) cache[t] = out[t];
      else delete cache[t];
    }
    await setMeta(CACHE_KEY, cache);
  } catch {
    // Kopian kunde inte sparas; kurserna gäller ändå.
  }
  return out;
}

async function readPrices(tickers: string[]): Promise<Record<string, PricePoint[]>> {
  const out: Record<string, PricePoint[]> = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('prices')
      .select('ticker,date,close_sek')
      .in('ticker', tickers)
      .order('date')
      .order('ticker')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { ticker: string; date: string; close_sek: number | string }[];
    for (const r of rows) (out[r.ticker] ??= []).push({ date: r.date, close: Number(r.close_sek) });
    if (rows.length < PAGE) break;
  }
  return out;
}

function dayOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Hämtar nya kurser för innehav med ticker och affärer. True betyder att det kan finnas nya kurser att läsa.
 * False (utan att kasta) om det inte gick, eller om samma lista redan hämtats i dag.
 */
export async function refreshPrices(holdings: Holding[], trades: Trade[], now: Date = new Date()): Promise<boolean> {
  try {
    const day = dayOf(now);

    // från = datumet för första affären, tidigast bland innehav med samma ticker
    const first = new Map<string, string>();
    for (const h of holdings) {
      if (!h.ticker) continue;
      for (const t of trades) {
        if (t.holdingId !== h.id) continue;
        const prev = first.get(h.ticker);
        if (!prev || t.date < prev) first.set(h.ticker, t.date);
      }
    }
    const tickers = [...first]
      .map(([ticker, from]) => ({ ticker, from }))
      .sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0))
      .slice(0, MAX_TICKERS);
    if (tickers.length === 0) return false;

    // Hoppa över bara om samma lista redan hämtats i dag; nytt innehav eller tidigare affär ger nytt anrop
    const signature = JSON.stringify(tickers);
    if (
      (await getMeta<string>('pricesRefreshedOn')) === day &&
      (await getMeta<string>('pricesRefreshedFor')) === signature
    ) {
      return false;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    const res = await fetch(`${INBOX_URL}?action=kurser`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers }),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { updated?: Record<string, number>; failed?: string[] } | null;
    const failed = Array.isArray(body?.failed) ? body.failed : [];
    if (failed.length > 0) {
      // Någon symbol misslyckades: dagen sparas inte, så att det görs ett nytt försök vid nästa ändring
      return Object.values(body?.updated ?? {}).some((n) => n > 0);
    }
    await setMeta('pricesRefreshedOn', day);
    await setMeta('pricesRefreshedFor', signature);
    return true;
  } catch {
    return false;
  }
}

/** Sök bolag, fond eller ETF på namn eller ticker. [] är en riktig tom träfflista, null att sökningen inte gick (utloggad, inget nät, serverfel). */
export async function searchTicker(q: string): Promise<{ ticker: string; name: string; type: HoldingType }[] | null> {
  const query = q.trim();
  if (!query) return [];
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const res = await fetch(`${INBOX_URL}?action=kurssok&q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: { ticker: string; name: string; type: HoldingType }[] };
    return body.results ?? [];
  } catch {
    return null;
  }
}

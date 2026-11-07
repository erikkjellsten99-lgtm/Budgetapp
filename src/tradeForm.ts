import { validateTrades } from '../supabase/functions/inbox/portfolio.ts';
import { today } from './db';
import type { Trade } from './types';

/** Tolkar ett antal, t.ex. "12,3456" eller "1 000". Komma eller punkt som decimaltecken, ingen avrundning. Tomt eller ogiltigt blir NaN. */
export function parseQuantity(text: string): number {
  const clean = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (clean === '') return NaN;
  return Number(clean);
}

/** Sant för ett riktigt datum skrivet som "2026-10-18". */
function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/**
 * Felmeddelande för en affär som sparas, annars null. Kontrollerar fälten och sedan att inga
 * försäljningar överstiger innehavet, med utkastet i stället för affären med samma id.
 */
export function tradeError(trades: Trade[], draft: Trade): string | null {
  if (!isRealDate(draft.date)) return 'Välj ett datum.';
  if (draft.date > today()) return 'Datumet har inte varit än.';
  if (!(draft.quantity > 0)) return 'Skriv ett antal större än 0.';
  if (!(draft.price > 0)) return 'Skriv en kurs större än 0.';
  if (!(draft.fee >= 0)) return 'Courtage kan inte vara negativt.';
  const others = trades.filter((t) => t.id !== draft.id);
  const problem = validateTrades([...others, draft]);
  // Datumet visas på svenska i formuläret, t.ex. "7 nov. 2026"
  return problem?.replace(/\d{4}-\d{2}-\d{2}/, (d) => longDate(d)) ?? null;
}

export type PriceRange = '1m' | '1y' | 'all';

/** Första dagen i kursgrafen: 1 mån är 31 dagar bakåt, 1 år 365 dagar, "Sedan köp" första affärens datum. */
export function rangeStart(range: PriceRange, today: string, firstTradeDate: string | null): string {
  if (range === 'all') return firstTradeDate ?? today;
  const days = range === '1m' ? 31 : 365;
  return new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/** "2026-11-07" som "7 nov. 2026". */
export function longDate(date: string): string {
  return new Date(`${date}T12:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

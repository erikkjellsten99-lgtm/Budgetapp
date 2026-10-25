// Flytt från den gamla vanetrackern (egen app på en annan adress). Den gamla appen visar
// en kod som kopieras och klistras in här. Koden är bara data, inget skickas någonstans.

import type { DateKey } from './dates';
import type { Habit } from './habits';
import type { Pause } from './store';

export interface Transfer {
  habits: Habit[];
  checks: { date: DateKey; habitId: string; min?: boolean }[];
  pauses: Pause[];
}

const PREFIX = 'VANOR1:';
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Läser en flyttkod. Kastar ett fel med en förklaring om koden inte går att läsa. */
export function parseTransfer(code: string): Transfer {
  const text = code.trim().replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) throw new Error('Det här ser inte ut som en flyttkod. Den börjar med VANOR1:');
  let raw: unknown;
  try {
    const bytes = Uint8Array.from(atob(text.slice(PREFIX.length)), (c) => c.charCodeAt(0));
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Koden är ofullständig. Kopiera den igen i den gamla appen och klistra in hela.');
  }
  const r = raw as Partial<Transfer>;
  if (!Array.isArray(r.habits) || !Array.isArray(r.checks)) throw new Error('Koden saknar vanor. Kopiera den igen.');
  const habits = r.habits
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
    .map((h, i) => ({
      id: h.id,
      name: h.name.trim().slice(0, 40),
      goal: Math.min(7, Math.max(1, Math.round(Number(h.goal)) || 1)),
      created: isDate(h.created) ? h.created : '2026-01-01',
      after: Array.isArray(h.after) ? h.after.filter((a) => typeof a === 'string') : [],
      order: Number.isFinite(h.order) ? h.order : i,
      archived: !!h.archived,
      ...(typeof h.minimum === 'string' && h.minimum.trim() ? { minimum: h.minimum.trim().slice(0, 40) } : {}),
    }));
  const checks = r.checks
    .filter((c) => c && isDate(c.date) && typeof c.habitId === 'string')
    .map((c) => (c.min ? { date: c.date, habitId: c.habitId, min: true } : { date: c.date, habitId: c.habitId }));
  const pauses = (Array.isArray(r.pauses) ? r.pauses : []).filter((p) => p && isDate(p.date)).map((p) => ({ date: p.date }));
  return { habits, checks, pauses };
}

/** Gör en flyttkod (används i testerna och i den gamla appen). */
export function makeTransfer(data: Transfer): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin);
}

// Veckonyheter i appen: hämtas från edge-funktionen nyheter (GET, ingen nyckel), som en gång i veckan låter Claude
// skriva en sammanställning i sex sektioner (supabase/functions/nyheter). Senaste svaret sparas på telefonen, så
// att nyheterna syns även utan uppkoppling.

import { INBOX_URL } from './vanor/InboxSettings';
import { SIDES, weekNumber, type Side, type Story, type Week } from '../supabase/functions/nyheter/shared';

export type { Angle, SectionId, Side, Story, Week } from '../supabase/functions/nyheter/shared';
export { readySections, SECTIONS, SIDES, weekCost } from '../supabase/functions/nyheter/shared';

export const NEWS_URL = INBOX_URL.replace(/inbox$/, 'nyheter');

const KEY = 'veckonyheter-cache';

interface Cached {
  /** När svaret hämtades (ms). */
  fetched: number
  week: Week | null
}

export function cachedNews(): Cached | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cached | null;
    return saved && typeof saved.fetched === 'number' && (saved.week === null || typeof saved.week?.sections === 'object') ? saved : null;
  } catch {
    return null;
  }
}

/** Senaste veckan, eller null om ingen sammanställning finns än. */
export async function fetchNews(now = Date.now()): Promise<Cached> {
  const res = await fetch(NEWS_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`${res.status}`);
  const body = (await res.json()) as { week?: Week | null };
  if (body.week !== null && typeof body.week?.sections !== 'object') throw new Error('Fel svar');
  const result: Cached = { fetched: now, week: body.week ?? null };
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
    // De gamla SVT-nyheterna används inte längre.
    localStorage.removeItem('nyheter-cache');
  } catch {
    // Utan lagring syns nyheterna bara tills appen stängs.
  }
  return result;
}

/** "Vecka 47, skriven 2026-11-16" */
export const weekLine = (week: Week) => `Vecka ${weekNumber(week.week)}, skriven ${new Date(week.created).toLocaleDateString('sv-SE')}`;

/** "5 nyheter, 3 positiva" */
export function countLine(stories: Story[]): string {
  const positive = stories.filter((s) => s.positive).length;
  return `${stories.length} ${stories.length === 1 ? 'nyhet' : 'nyheter'}, ${positive} ${positive === 1 ? 'positiv' : 'positiva'}`;
}

/** "Blind fläck: högermedier har inte bevakat nyheten." */
export const blindspotLine = (side: Side) => `Blind fläck: ${SIDES.find((s) => s.id === side)?.plural ?? side} har inte bevakat nyheten.`;

/** "3,42" */
export const usd = (amount: number) => amount.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

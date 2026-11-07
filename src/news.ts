// Nyheter i appen: hämtas från inbox-funktionen (?action=nyheter), som läser SVT:s öppna RSS-flöden
// och bedömer tonen (supabase/functions/inbox/news.ts). Senaste svaret sparas på telefonen, så att
// nyheterna syns även utan uppkoppling.

import { INBOX_URL } from './vanor/InboxSettings';
import { TOPICS, type NewsItem, type NewsResult } from '../supabase/functions/inbox/news';

export type { NewsItem, NewsResult, NewsTopic, Tone } from '../supabase/functions/inbox/news';
export { TOPICS } from '../supabase/functions/inbox/news';

const KEY = 'nyheter-cache';

export function cachedNews(): NewsResult | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as NewsResult | null;
    return saved && Array.isArray(saved.items) ? saved : null;
  } catch {
    return null;
  }
}

export async function fetchNews(): Promise<NewsResult> {
  const res = await fetch(`${INBOX_URL}?action=nyheter`, { method: 'GET' });
  if (!res.ok) throw new Error(`${res.status}`);
  const result = (await res.json()) as NewsResult;
  if (!Array.isArray(result.items)) throw new Error('Fel svar');
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    // Utan lagring syns nyheterna bara tills appen stängs.
  }
  return result;
}

/** "nyss", "för 25 min sedan", "för 3 tim sedan", annars "6 nov". */
export function ago(time: number, now = Date.now()): string {
  if (!time) return '';
  const minutes = Math.round((now - time) / 60000);
  if (minutes < 2) return 'nyss';
  if (minutes < 60) return `för ${minutes} min sedan`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `för ${hours} tim sedan`;
  return new Date(time).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Metaraden under en nyhet: "SVT Sport, för 16 min sedan", med ämnet först när alla ämnen visas. */
export function newsMeta(
  item: Pick<NewsItem, 'source' | 'published' | 'topic'>,
  { now = Date.now(), withTopic = false }: { now?: number; withTopic?: boolean } = {},
): string {
  const topic = withTopic ? TOPICS.find((t) => t.id === item.topic)?.label : undefined;
  return [topic, item.source, ago(item.published, now)].filter(Boolean).join(', ');
}

/** "14:05" */
export const clock = (time: number) => new Date(time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

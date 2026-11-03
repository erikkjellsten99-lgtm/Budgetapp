// Tolkar det iPhone-genvägen skickar: en rad per påminnelse, "Titel | förfallodatum".
// Datumet kommer som ISO 8601 från Genvägar (t.ex. 2026-11-04T10:00:00+01:00 eller 2026-11-04),
// och kan saknas. Utan datum hamnar saken på dagens datum. 00:00 räknas som "ingen tid"
// (heldagspåminnelser). Rena funktioner, tester i parse.test.ts.

export const TITLE_MAX = 80
export const MAX_ITEMS = 200

export interface InboxItem {
  title: string
  date: string
  time?: string
}

const DATE = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/

/** Gör om texten från genvägen till saker att göra. Tomma rader och dubbletter hoppas över. */
export function parseLines(text: string, today: string): InboxItem[] {
  const out: InboxItem[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const bar = line.lastIndexOf('|')
    const titlePart = bar >= 0 ? line.slice(0, bar) : line
    const datePart = bar >= 0 ? line.slice(bar + 1) : ''
    const title = titlePart.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX).trim()
    if (!title) continue
    const m = DATE.exec(datePart)
    const valid = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[3]) >= 1 && Number(m[3]) <= 31
    const date = valid ? `${m[1]}-${m[2]}-${m[3]}` : today
    const time = valid && m[4] && !(m[4] === '00' && m[5] === '00') && Number(m[4]) < 24 && Number(m[5]) < 60 ? `${m[4]}:${m[5]}` : undefined
    const key = `${title.toLowerCase()}|${date}|${time ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(time ? { title, date, time } : { title, date })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

/** Dagens datum i Sverige som ÅÅÅÅ-MM-DD. */
export function stockholmToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * Samma påminnelse ger alltid samma id, så att genvägen kan köras många gånger utan dubbletter.
 * En sak som redan finns (även bockad eller borttagen i appen) skrivs aldrig över.
 */
export async function itemId(item: InboxItem): Promise<string> {
  const bytes = new TextEncoder().encode(`${item.title.toLowerCase()}|${item.date}|${item.time ?? ''}`)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return 'rem-' + Array.from(hash.slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('')
}

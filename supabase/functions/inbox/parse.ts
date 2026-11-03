// Tolkar det iPhone-genvägen skickar: en rad per påminnelse, "Titel | förfallodatum".
// Datumet kan komma som ISO 8601 (2026-11-04T10:00:00+01:00), som telefonens vanliga format
// ("4 nov. 2026 10:00", "4 november 2026 kl. 10:00", engelska månader går också), som "idag"/"i morgon",
// eller saknas. Utan datum hamnar saken på dagens datum. 00:00 räknas som "ingen tid"
// (heldagspåminnelser). Rena funktioner, tester i parse.test.ts.

export const TITLE_MAX = 80
export const MAX_ITEMS = 200

export interface InboxItem {
  title: string
  date: string
  time?: string
}

const ISO = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/
const WORDS = /(\d{1,2})\s+([a-zåäö]+)\.?\s+(\d{4})/i
const TIME = /(?:^|[^\d])(\d{1,2})[:.](\d{2})(?!\d)/
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12,
}
const RELATIVE: [RegExp, number][] = [
  [/\bi\s?förrgår\b/i, -2],
  [/\bi\s?går\b|\byesterday\b/i, -1],
  [/\bi\s?dag\b|\btoday\b/i, 0],
  [/\bi\s?övermorgon\b/i, 2],
  [/\bi\s?morgon\b|\btomorrow\b/i, 1],
]

const pad = (n: number) => String(n).padStart(2, '0')

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

function validDay(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

function cleanTime(h: number, min: number): string | undefined {
  if (h > 23 || min > 59 || (h === 0 && min === 0)) return undefined
  return `${pad(h)}:${pad(min)}`
}

/** Läser datum och tid ur datumdelen av en rad. Utan giltigt datum: ingen träff. */
export function parseWhen(text: string, today: string): { date: string; time?: string } | null {
  const iso = ISO.exec(text)
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    if (!validDay(y, m, d)) return null
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`
    const time = iso[4] ? cleanTime(Number(iso[4]), Number(iso[5])) : undefined
    return time ? { date, time } : { date }
  }
  let date: string | null = null
  let rest = text
  const words = WORDS.exec(text)
  if (words) {
    const month = MONTHS[words[2].toLowerCase().slice(0, 3)]
    const [y, d] = [Number(words[3]), Number(words[1])]
    if (month && validDay(y, month, d)) {
      date = `${y}-${pad(month)}-${pad(d)}`
      rest = text.replace(words[0], ' ')
    }
  }
  if (!date) {
    for (const [re, days] of RELATIVE) {
      if (re.test(text)) {
        date = addDays(today, days)
        rest = text.replace(re, ' ')
        break
      }
    }
  }
  if (!date) return null
  const t = TIME.exec(rest)
  const time = t ? cleanTime(Number(t[1]), Number(t[2])) : undefined
  return time ? { date, time } : { date }
}

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
    const when = parseWhen(datePart, today)
    const date = when?.date ?? today
    const time = when?.time
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

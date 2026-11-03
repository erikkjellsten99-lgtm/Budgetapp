// Tolkar en sak som du säger till Siri, t.ex. "Ringa mamma imorgon klockan 18" eller
// "Handla på fredag kl. 17.30". Dag och tid plockas ut ur meningen och resten blir titeln.
// Utan dag hamnar saken på idag. Rena funktioner, tester i spoken.test.ts.

import { TITLE_MAX, type InboxItem } from './parse.ts'

const pad = (n: number) => String(n).padStart(2, '0')

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** 0 = måndag … 6 = söndag. */
function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12,
}
const WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

// Ordgränser som fungerar med å/ä/ö (JavaScripts \b gör inte det).
const B = '(?<![\\p{L}\\d])'
const E = '(?![\\p{L}\\d])'
const re = (src: string) => new RegExp(`${B}${src}${E}`, 'iu')

const RELATIVE: [RegExp, number][] = [
  [re('i\\s?övermorgon'), 2],
  [re('i\\s?morgon(?:\\s?(?:bitti|kväll|eftermiddag))?'), 1],
  [re('i\\s?(?:dag|kväll|eftermiddag|natt)'), 0],
]
const WEEKDAY = re(`(?:(?:på|nästa|den här)\\s+)?(${WEEKDAYS.join('|')})(?:en)?`)
const DAY_MONTH = re('(?:den\\s+)?(\\d{1,2})(?::e|:a)?\\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[\\p{L}]*\\.?(?:\\s+(\\d{4}))?')
const DAY_SLASH = re('(?:den\\s+)?(\\d{1,2})/(\\d{1,2})')
const TIME_WORD = re('(?:vid\\s+)?(?:kl\\.?|klockan)\\s*(\\d{1,2})(?:[:.](\\d{2}))?')
const TIME_BARE = re('(\\d{1,2})[:.](\\d{2})')

function validDay(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** "Ringa mamma imorgon klockan 18" → titel "Ringa mamma", imorgon, 18:00. */
export function parseSpoken(input: string, today: string): InboxItem | null {
  let text = ` ${input.replace(/\s+/g, ' ').trim()} `
  let date: string | null = null
  let time: string | undefined

  const take = (m: RegExpExecArray) => {
    text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
  }

  // Tid först, så att "18.30" inte tas för ett datum
  const tw = TIME_WORD.exec(text) ?? TIME_BARE.exec(text)
  if (tw) {
    const h = Number(tw[1])
    const min = Number(tw[2] ?? '0')
    if (h < 24 && min < 60) {
      time = `${pad(h)}:${pad(min)}`
      take(tw)
    }
  }

  for (const [pattern, days] of RELATIVE) {
    const m = pattern.exec(text)
    if (m) {
      date = addDays(today, days)
      take(m)
      break
    }
  }

  if (!date) {
    const m = WEEKDAY.exec(text)
    if (m) {
      const target = WEEKDAYS.indexOf(m[1].toLowerCase())
      let diff = (target - weekdayIndex(today) + 7) % 7
      if (diff === 0 || /nästa/i.test(m[0])) diff = diff === 0 ? 7 : diff
      date = addDays(today, diff)
      take(m)
    }
  }

  if (!date) {
    const m = DAY_MONTH.exec(text) ?? DAY_SLASH.exec(text)
    if (m) {
      const day = Number(m[1])
      const month = MONTHS[m[2].toLowerCase().slice(0, 3)] ?? Number(m[2])
      let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4))
      if (validDay(year, month, day)) {
        let candidate = `${year}-${pad(month)}-${pad(day)}`
        // Utan år och redan passerat: nästa år
        if (!m[3] && candidate < today) {
          year += 1
          candidate = `${year}-${pad(month)}-${pad(day)}`
        }
        if (validDay(year, month, day)) {
          date = candidate
          take(m)
        }
      }
    }
  }

  const title = text
    .replace(/\s+/g, ' ')
    .replace(/\s+(?:på|den|vid|om|till)\s*$/iu, '')
    .replace(/^\s*(?:att|jag ska|påminn mig att|påminn mig om att)\s+/iu, '')
    .replace(/[\s,.!?–-]+$/u, '')
    .trim()
    .slice(0, TITLE_MAX)
    .trim()
  if (!title) return null
  const pretty = title.charAt(0).toLocaleUpperCase('sv-SE') + title.slice(1)
  return time ? { title: pretty, date: date ?? today, time } : { title: pretty, date: date ?? today }
}

const DAY_NAMES = ['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön']

/** Kort svar som Siri kan läsa upp, t.ex. "Klart: Ringa mamma, i morgon kl. 18:00." */
export function confirmText(item: InboxItem, today: string, added: boolean): string {
  const when =
    item.date === today
      ? 'idag'
      : item.date === addDays(today, 1)
        ? 'i morgon'
        : `${DAY_NAMES[weekdayIndex(item.date)]} ${item.date}`
  const at = item.time ? ` kl. ${item.time}` : ''
  return added ? `Klart: ${item.title}, ${when}${at}.` : `${item.title} finns redan i Groundwork.`
}

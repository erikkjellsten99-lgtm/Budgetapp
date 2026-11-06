// Datumlogik. Ett datum är text 'ÅÅÅÅ-MM-DD' (en kalenderdag i telefonens tidszon).
// Själva räkningen görs i UTC, så sommartid kan aldrig flytta en dag.
// Veckor börjar på måndag och numreras enligt ISO 8601.

export type DateKey = string

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

function toUTC(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(d: Date): DateKey {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Dagens datum i telefonens tidszon. */
export function todayKey(now = new Date()): DateKey {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUTC(new Date(toUTC(key).getTime() + days * DAY_MS))
}

/** Veckodag: 0 = måndag … 6 = söndag. */
export function weekday(key: DateKey): number {
  return (toUTC(key).getUTCDay() + 6) % 7
}

/** Måndagen i samma vecka. */
export function weekStart(key: DateKey): DateKey {
  return addDays(key, -weekday(key))
}

/** ISO-veckonummer (1–53). En vecka hör till det år där dess torsdag ligger. */
export function isoWeek(key: DateKey): number {
  const thursday = toUTC(addDays(key, 3 - weekday(key)))
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1
}

const WEEKDAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
const MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

/** T.ex. "Onsdag 14 oktober". */
export function longDate(key: DateKey): string {
  const d = toUTC(key)
  return `${WEEKDAYS[weekday(key)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

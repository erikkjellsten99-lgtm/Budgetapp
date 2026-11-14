// Kunskap: det som appen och servern delar om korten, inställningarna och kostnaden. Ren logik, inget nätverk.
// Appen importerar härifrån (src/kunskap/), så att båda räknar ord, id:n och kostnad på samma sätt.

export type CardType = 'citat' | 'insikt' | 'protokoll'

export const MAX_WORDS = 80

/** Ett kort i flödet. Genererade kort har också `created` och `batch`. */
export interface KunskapCard {
  id: string
  person: string
  topic: string
  type: CardType
  /** Citatet på originalspråket, eller insikten. Kan vara tom för protokoll. */
  text: string
  /** Citat på annat språk än svenska: svensk översättning. */
  sv?: string
  /** Protokoll: stegen i ordning. */
  steps?: string[]
  /** Insikt: hur väl belagd den är (bara exempelkorten ur Lär). */
  label?: string
  /** Varningsrad för sådant som kan vara riskabelt (andning, kyla). */
  warning?: string
  source: { title: string; url: string }
  /** Genererade kort: när kortet skapades (ms) och i vilken batch. */
  created?: number
  batch?: string
  /** Citat: ordagrant återfunnet i källsidans text av servern. */
  verified?: boolean
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** Orden som räknas mot gränsen: texten och stegen (inte översättningen, som är samma sak en gång till). */
export const cardWords = (card: Pick<KunskapCard, 'text' | 'steps'>) => wordCount([card.text, ...(card.steps ?? [])].join(' '))

/** Kort och stabilt id av en text. */
export function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ')

/** Jämför namn utan hänsyn till stora bokstäver och accenter: "Susanna Soberg" är samma som "Susanna Søberg". */
export const personKey = (name: string) =>
  tidy(name)
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Inställningar

export type Frequency = 'av' | 'dag' | 'vecka'

/** Sparas som en post (id "settings") i kunskap_settings. Utan post genereras ingenting. */
export interface KunskapSettings {
  id: 'settings'
  frequency: Frequency
  count: number
}

export const COUNT_DEFAULT = 5
export const COUNT_MAX = 10
export const DEFAULT_SETTINGS: KunskapSettings = { id: 'settings', frequency: 'av', count: COUNT_DEFAULT }

export function cleanSettings(raw: unknown): KunskapSettings {
  const r = (raw ?? {}) as Record<string, unknown>
  const frequency: Frequency = r.frequency === 'dag' || r.frequency === 'vecka' ? r.frequency : 'av'
  const n = typeof r.count === 'number' && Number.isFinite(r.count) ? Math.round(r.count) : COUNT_DEFAULT
  return { id: 'settings', frequency, count: Math.min(COUNT_MAX, Math.max(1, n)) }
}

// Batchar och kostnad

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  searches: number
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 }

/** En körning av genereringen. Sparas i kunskap_batches så att kostnaden syns i appen. */
export interface Batch {
  id: string
  created: number
  status: 'pagar' | 'klar' | 'fel'
  trigger: 'schema' | 'manuell'
  requested: number
  /** Kort som sparades. */
  cards: number
  /** Citat som hittades ordagrant i källan, och citat som gjordes om till insikter för att de inte gick att bekräfta. */
  quotesVerified: number
  quotesRewritten: number
  /** Kort som kastades (ingen känd källa, för långa, okänd person, dubbletter). */
  dropped: number
  model: string
  usage: Usage
  costUsd: number
  error?: string
}

/**
 * Listpriser i USD (2026-11): Claude Sonnet 5.5 per miljon token, och webbsökning per 1 000 sökningar.
 * Ändras priserna ska de ändras här, annars visar appen fel kostnad.
 */
export const PRICE = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5, searchPer1000: 10 }

export function costUsd(u: Usage): number {
  const tokens = (u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite) / 1_000_000
  return Math.round((tokens + (u.searches * PRICE.searchPer1000) / 1000) * 10_000) / 10_000
}

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  searches: a.searches + b.searches,
})

const HOUR = 3_600_000

/** Ska schemat köra en batch nu? Dagligen: senaste schemalagda är äldre än 20 timmar. Veckovis: äldre än 6 dygn och 20 timmar. */
export function isDue(settings: KunskapSettings, batches: Pick<Batch, 'created' | 'trigger'>[], now: number): boolean {
  if (settings.frequency === 'av') return false
  const last = Math.max(0, ...batches.filter((b) => b.trigger === 'schema').map((b) => b.created))
  return now - last > (settings.frequency === 'dag' ? 20 : 6 * 24 + 20) * HOUR
}

/** Högst så här många batchar per dygn och person, schemalagda och manuella tillsammans. Skyddar mot dyra misstag. */
export const MAX_BATCHES_PER_DAY = 3

export const batchesLastDay = (batches: Pick<Batch, 'created'>[], now: number) => batches.filter((b) => now - b.created < 24 * HOUR).length

/** En batch som stått som pågående längre än så här har avbrutits (funktionen hann inte klart). */
export const STALE_MS = 10 * 60_000

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
  /** Upptäckt: en person du inte följer eller ett nytt ämne nära det du gillar. */
  discovery?: boolean
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

/** Tecken från kodpunkter. Mönster med osynliga tecken byggs så, så att källfilen bara innehåller synliga tecken. */
export const ch = (...codes: number[]) => String.fromCharCode(...codes)
/** Kombinerande accenter, U+0300 till U+036F. */
const ACCENTS = new RegExp(`[${ch(0x300)}-${ch(0x36f)}]`, 'g')

/** Jämför namn utan hänsyn till stora bokstäver och accenter: "Susanna Soberg" är samma som "Susanna Søberg". */
export const personKey = (name: string) =>
  tidy(name)
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(ACCENTS, '')

// Presentation av en egen person

/** Högst så här många ord i en presentation, och så här många källor. */
export const PROFILE_WORDS = 120
export const PROFILE_SOURCES = 4

/**
 * En kort presentation av en person du lagt till själv, skriven av Claude med webbsökning. Sparas på personens
 * post i kunskap_people. Den är inte granskad, och har därför inga påståenden om belägg.
 */
export interface PersonProfile {
  /** Ett till tre korta stycken på svenska. */
  text: string[]
  /** Sidor ur webbsökningen som texten bygger på. Minst en. */
  sources: { title: string; url: string }[]
  created: number
  model: string
}

// Upptäck: personer som Claude hittat åt en sökning på en genre

export const FOUND_ABOUT_MAX = 110
/** Högst så här många personer per sökning, och så här många sparade totalt. */
export const FOUND_PER_SEARCH = 6
export const FOUND_KEPT = 40
export const GENRE_MAX = 60

/** En person som Claude hittat med webbsökning. Inte granskad: en rad om vem det är, och sidan den kom från. */
export interface FoundPerson {
  name: string
  about: string
  topics: string[]
  /** Genren som användaren sökte på. */
  genre: string
  source: { title: string; url: string }
  created: number
}

/** De sparade träffarna (posten "found" i kunskap_settings), städade. Trasiga rader tas bort. */
export function cleanFound(raw: unknown): FoundPerson[] {
  const list = (raw as { people?: unknown } | null)?.people
  const out: FoundPerson[] = []
  const seen = new Set<string>()
  for (const item of Array.isArray(list) ? list : []) {
    const r = (item ?? {}) as Record<string, unknown>
    const source = (r.source ?? {}) as Record<string, unknown>
    const text = (value: unknown, max: number) => (typeof value === 'string' ? tidy(value).slice(0, max).trim() : '')
    const person: FoundPerson = {
      name: text(r.name, 60),
      about: text(r.about, FOUND_ABOUT_MAX),
      topics: (Array.isArray(r.topics) ? r.topics : []).map((t) => text(t, 30)).filter(Boolean).slice(0, 3),
      genre: text(r.genre, GENRE_MAX),
      source: { title: text(source.title, 160), url: text(source.url, 600) },
      created: typeof r.created === 'number' && Number.isFinite(r.created) ? r.created : 0,
    }
    const key = personKey(person.name)
    if (!person.name || !person.about || !/^https:\/\//.test(person.source.url) || seen.has(key)) continue
    seen.add(key)
    out.push(person)
    if (out.length === FOUND_KEPT) break
  }
  return out
}

/** Nya träffar först, utan dubbletter av samma person, högst FOUND_KEPT. */
export function mergeFound(old: FoundPerson[], fresh: FoundPerson[]): FoundPerson[] {
  return cleanFound({ people: [...fresh, ...old] })
}

// Inställningar

export type Frequency = 'av' | 'dag' | 'vecka'

/** Sparas som en post (id "settings") i kunskap_settings. Utan post genereras ingenting. */
export interface KunskapSettings {
  id: 'settings'
  frequency: Frequency
  count: number
  /** Appen ber om en ny omgång kort när man bläddrat förbi de nya. Av tills man slår på det. Läses bara av appen. */
  auto: boolean
}

export const COUNT_DEFAULT = 5
export const COUNT_MAX = 10
export const DEFAULT_SETTINGS: KunskapSettings = { id: 'settings', frequency: 'av', count: COUNT_DEFAULT, auto: false }

export function cleanSettings(raw: unknown): KunskapSettings {
  const r = (raw ?? {}) as Record<string, unknown>
  const frequency: Frequency = r.frequency === 'dag' || r.frequency === 'vecka' ? r.frequency : 'av'
  const n = typeof r.count === 'number' && Number.isFinite(r.count) ? Math.round(r.count) : COUNT_DEFAULT
  return { id: 'settings', frequency, count: Math.min(COUNT_MAX, Math.max(1, n)), auto: r.auto === true }
}

// Smak: viktning av personer, ämnen och korttyper utifrån gilla/ogilla, och det användaren själv ställt in

export type PrefKind = 'person' | 'topic' | 'type'
export type ManualLevel = 'mer' | 'mindre'

/** Sparas som en post (id "prefs") i kunskap_settings: det användaren själv ändrat i "Vad Claude tror du gillar". */
export interface KunskapPrefs {
  id: 'prefs'
  manual: Record<string, { kind: PrefKind; label: string; level: ManualLevel }>
}

export const NO_PREFS: KunskapPrefs = { id: 'prefs', manual: {} }
export const PREF_LABEL_MAX = 60
const MANUAL_MAX = 80

/** Nyckeln för en person, ett ämne eller en korttyp. Personer jämförs utan accenter, ämnen utan stora bokstäver. */
export const prefKey = (kind: PrefKind, label: string) => `${kind}:${kind === 'person' ? personKey(label) : tidy(label).toLowerCase()}`

export function cleanPrefs(raw: unknown): KunskapPrefs {
  const manual: KunskapPrefs['manual'] = {}
  const given = ((raw ?? {}) as { manual?: unknown }).manual
  for (const value of Object.values(given && typeof given === 'object' ? (given as Record<string, unknown>) : {}).slice(0, MANUAL_MAX)) {
    const v = (value ?? {}) as Record<string, unknown>
    const kind = v.kind === 'person' || v.kind === 'topic' || v.kind === 'type' ? v.kind : null
    const label = typeof v.label === 'string' ? tidy(v.label).slice(0, PREF_LABEL_MAX).trim() : ''
    if (kind && label && (v.level === 'mer' || v.level === 'mindre')) manual[prefKey(kind, label)] = { kind, label, level: v.level }
  }
  return { id: 'prefs', manual }
}

export interface VoteRow {
  value: 1 | -1
  person: string
  topic: string
  type: CardType
}

export interface Weight {
  key: string
  kind: PrefKind
  label: string
  likes: number
  dislikes: number
  /** Det användaren själv valt, om något. Går före rösterna. */
  manual?: ManualLevel
  /** -1 till 1. Från rösterna: (gilla − ogilla) / (gilla + ogilla + 2), så att en enda röst inte väger för tungt. */
  weight: number
}

/** Över den här gränsen räknas något som gillat (eller under minus gränsen som ogillat). En enda gilla räcker. */
export const LEAN = 0.2
export const leaning = (w: Pick<Weight, 'weight'>): 'mer' | 'mindre' | 'neutral' => (w.weight >= LEAN ? 'mer' : w.weight <= -LEAN ? 'mindre' : 'neutral')

/**
 * Viktningen per person, ämne och korttyp. `known` är sådant som ska finnas med även utan röster
 * (dem du följer och deras ämnen, de tre korttyperna). Sorterad med det mest gillade först inom varje slag.
 */
export function weights(votes: VoteRow[], prefs: KunskapPrefs, known: { kind: PrefKind; label: string }[] = []): Weight[] {
  const all = new Map<string, Weight>()
  const entry = (kind: PrefKind, label: string) => {
    const clean = tidy(String(label ?? '')).slice(0, PREF_LABEL_MAX).trim()
    if (!clean) return null
    const key = prefKey(kind, clean)
    if (!all.has(key)) all.set(key, { key, kind, label: clean, likes: 0, dislikes: 0, weight: 0 })
    return all.get(key)!
  }
  for (const k of known) entry(k.kind, k.label)
  for (const v of votes) {
    if (v.value !== 1 && v.value !== -1) continue
    for (const e of [entry('person', v.person), entry('topic', v.topic), entry('type', v.type)]) {
      if (e) v.value === 1 ? e.likes++ : e.dislikes++
    }
  }
  for (const m of Object.values(prefs.manual)) {
    const e = entry(m.kind, m.label)
    if (e) e.manual = m.level
  }
  const order: PrefKind[] = ['person', 'topic', 'type']
  return [...all.values()]
    .map((w) => ({ ...w, weight: w.manual === 'mer' ? 1 : w.manual === 'mindre' ? -1 : Math.round(((w.likes - w.dislikes) / (w.likes + w.dislikes + 2)) * 100) / 100 }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.weight - a.weight || a.label.localeCompare(b.label, 'sv'))
}

/** Andelen kort per batch som ska vara upptäckt, och hur många det blir: 5 kort ger 1, 10 kort ger 2, 1 eller 2 kort ger 0. */
export const DISCOVERY_SHARE = 0.2
export const discoveryCount = (count: number) => Math.round(count * DISCOVERY_SHARE)

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
  /** `profil`: något annat än kort gjordes: en presentation av en person, eller en sökning i Upptäck (`search`). */
  trigger: 'schema' | 'manuell' | 'profil'
  /** `profil`: vem presentationen gäller, eller genren som söktes. */
  person?: string
  /** En sökning efter personer i Upptäck. Räknas för sig, inte mot presentationerna. */
  search?: boolean
  requested: number
  /** Kort som sparades. */
  cards: number
  /** Citat som hittades ordagrant i källan, och citat som gjordes om till insikter för att de inte gick att bekräfta. */
  quotesVerified: number
  quotesRewritten: number
  /** Kort som kastades (ingen känd källa, för långa, okänd person, dubbletter). */
  dropped: number
  /** Hur många av korten som är upptäckt. Saknas på batchar från före 2026-11-15. */
  discovery?: number
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

export const batchesLastDay = (batches: Pick<Batch, 'created' | 'trigger'>[], now: number) =>
  batches.filter((b) => b.trigger !== 'profil' && now - b.created < 24 * HOUR).length

/** Högst så här många presentationer per dygn och person som frågar. Räknas för sig, inte mot batcharna. */
export const MAX_PROFILES_PER_DAY = 20

export const profilesLastDay = (batches: Pick<Batch, 'created' | 'trigger' | 'search'>[], now: number) =>
  batches.filter((b) => b.trigger === 'profil' && !b.search && now - b.created < 24 * HOUR).length

/** Högst så här många sökningar i Upptäck per dygn och person som frågar. */
export const MAX_SEARCHES_PER_DAY = 5

export const searchesLastDay = (batches: Pick<Batch, 'created' | 'search'>[], now: number) =>
  batches.filter((b) => b.search && now - b.created < 24 * HOUR).length

/** En batch som stått som pågående längre än så här har avbrutits (funktionen hann inte klart). */
export const STALE_MS = 10 * 60_000

// Nyheter: rubriker från öppna RSS-flöden (SVT), i fyra ämnen, med en enkel bedömning av tonen.
// Tonen bedöms med svenska ordlistor, utan AI (0 kr): positiv, negativ, eller neutral när inga ord
// talar för någotdera. Det är en grov bedömning och kan ha fel. Rena funktioner, tester i news.test.ts.

export type NewsTopic = 'ekonomi' | 'krig' | 'fotboll' | 'sverige'
export type Tone = 'positiv' | 'negativ' | 'neutral'

export interface NewsItem {
  id: string
  topic: NewsTopic
  title: string
  link: string
  summary: string
  /** ms sedan 1970, eller 0 om flödet saknar datum. */
  published: number
  source: string
  tone: Tone
  /** Orden som gav tonen, t.ex. ["seger"] eller ["attack", "döda"]. */
  because: string[]
}

export interface Feed {
  topic: NewsTopic
  source: string
  url: string
  /** Bara artiklar som handlar om ämnet (för krig, som hämtas från utrikesflödet). */
  filter?: (text: string) => boolean
}

export const TOPICS: { id: NewsTopic; label: string }[] = [
  { id: 'ekonomi', label: 'Ekonomi' },
  { id: 'krig', label: 'Krig' },
  { id: 'fotboll', label: 'Fotboll' },
  { id: 'sverige', label: 'Sverige' },
]

// Ordbörjan som gör att en utrikesnyhet räknas till Krig.
const WAR_STEMS = [
  'krig', 'ukrain', 'ryssland', 'ryska', 'ryske', 'putin', 'gaza', 'israel', 'hamas', 'hizbollah', 'iran', 'missil',
  'drönar', 'robotattack', 'robotanfall', 'invasion', 'fronten', 'frontlinjen', 'soldat', 'militär', 'armé', 'nato',
  'vapenvila', 'flyganfall', 'bomb', 'ockup', 'sudan', 'jemen', 'syrien', 'beskjut', 'offensiv',
]
const WAR_RE = new RegExp(`(?<![\\p{L}\\d])(?:${WAR_STEMS.join('|')})`, 'iu')
export const isWar = (text: string) => WAR_RE.test(text)

/** Flödena. Fungerar inte ett flöde hoppas det över, och ämnet syns som saknat i appen. */
export const FEEDS: Feed[] = [
  { topic: 'ekonomi', source: 'SVT', url: 'https://www.svt.se/nyheter/ekonomi/rss.xml' },
  { topic: 'krig', source: 'SVT', url: 'https://www.svt.se/nyheter/utrikes/rss.xml', filter: isWar },
  { topic: 'fotboll', source: 'SVT Sport', url: 'https://www.svt.se/sport/fotboll/rss.xml' },
  { topic: 'sverige', source: 'SVT', url: 'https://www.svt.se/nyheter/inrikes/rss.xml' },
]

/** Högst så här många per ämne, nyast först. */
export const PER_TOPIC = 15

// ---------- RSS ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (all, name) => ENTITIES[name.toLowerCase()] ?? all)
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1] : ''
}

export interface RssEntry {
  title: string
  link: string
  summary: string
  published: number
}

/** Artiklarna i ett RSS-flöde. Tål CDATA, HTML i beskrivningen och saknade fält. */
export function parseRss(xml: string): RssEntry[] {
  const out: RssEntry[] = []
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const item = m[0]
    const title = stripTags(decode(tag(item, 'title')))
    const link = decode(tag(item, 'link')).trim() || decode(tag(item, 'guid')).trim()
    if (!title || !/^https:\/\//.test(link)) continue
    // Avkoda två gånger: beskrivningen är ofta HTML som i sin tur är kodad.
    const summary = stripTags(decode(stripTags(decode(tag(item, 'description'))))).slice(0, 280)
    const date = Date.parse(decode(tag(item, 'pubDate')).trim())
    out.push({ title, link, summary, published: Number.isFinite(date) ? date : 0 })
  }
  return out
}

// ---------- Tonen ----------

// Fraser först: de väger tyngre och avgör ord som annars kan gå åt båda hållen ("stiger", "ökar").
const POSITIVE_PHRASES = [
  /sänk\w* räntan/, /räntan sänks/, /räntesänkning\w*/, /inflationen (?:sjunker|faller|minskar|bromsar)/,
  /arbetslösheten (?:sjunker|minskar|faller)/, /börsen (?:stiger|lyfter|rusar)/, /priserna (?:sjunker|faller)/,
  /nya jobb/, /fler jobb/, /sänkt skatt/, /skattesänkning\w*/, /lägre priser/, /billigare/,
]
const NEGATIVE_PHRASES = [
  /höj\w* räntan/, /räntan höjs/, /räntehöjning\w*/, /inflationen (?:stiger|ökar)/,
  /arbetslösheten (?:stiger|ökar)/, /börsen (?:faller|rasar|backar|sjunker)/, /priserna (?:stiger|ökar)/,
  /dyrare/, /högre priser/,
]

const POSITIVE_WORDS = [
  'seger', 'segern', 'segrar', 'segrade', 'vinner', 'vann', 'vinst', 'vinsten', 'guld', 'mästare', 'mästerskapet',
  'avancerar', 'klara för', 'fred', 'fredsavtal', 'vapenvila', 'vapenvilan', 'eldupphör', 'överens', 'avtal',
  'räddad', 'räddade', 'räddas', 'befriad', 'befriade', 'frigiven', 'frigivna', 'släpps fri', 'lyckas', 'lyckades',
  'hyllas', 'hyllade', 'firar', 'genombrott', 'framgång', 'framgångar', 'rekordvinst', 'återhämtning', 'tillväxt',
  'ökad tillväxt', 'investering', 'satsning', 'satsar', 'förbättras', 'förbättring', 'stärks', 'återvänder hem',
  'öppnar', 'invigs', 'prisas', 'belönas',
]
const NEGATIVE_WORDS = [
  'krig', 'kriget', 'död', 'döda', 'dödad', 'dödade', 'dödas', 'dödsfall', 'dör', 'dog', 'omkom', 'omkommit',
  'attack', 'attacken', 'anfall', 'anfallet', 'angrepp', 'bomb', 'bomber', 'bombning', 'explosion', 'sprängning',
  'skott', 'skjuten', 'skjutning', 'skottlossning', 'mord', 'mördad', 'dråp', 'våld', 'misshandel', 'knivhuggen',
  'kris', 'krisen', 'rasar', 'ras', 'kollaps', 'förlust', 'förluster', 'förlorar', 'förlorade', 'torsk', 'varsel',
  'varslar', 'uppsägning', 'uppsägningar', 'konkurs', 'nedläggning', 'läggs ner', 'stänger', 'recession', 'lågkonjunktur',
  'underskott', 'nedskärning', 'nedskärningar', 'olycka', 'olyckan', 'krasch', 'brand', 'branden', 'larm', 'varning',
  'varnar', 'hot', 'hotar', 'hotet', 'skadad', 'skadade', 'skadades', 'gripen', 'gripna', 'häktad', 'åtal', 'åtalas',
  'döms', 'dömd', 'fängelse', 'skandal', 'strejk', 'kaos', 'katastrof', 'offer', 'saknad', 'saknas', 'svält', 'torka',
  'översvämning', 'storm', 'pandemi', 'smitta', 'missil', 'missiler', 'drönare', 'drönarattack', 'robotattack',
  'invasion', 'ockupation', 'terror', 'terrorattentat', 'flyganfall', 'beskjutning', 'sanktioner', 'skuld', 'fusk',
  'bedrägeri', 'utvisas', 'avgår', 'sparkas', 'sparkad', 'petas', 'skadeskjuten', 'utslagen', 'åker ut', 'degraderas',
]

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const asWord = (word: string) => new RegExp(`(?<![\\p{L}\\d])${escape(word)}(?![\\p{L}\\d])`, 'u')
const POS = POSITIVE_WORDS.map((w) => [w, asWord(w)] as const)
const NEG = NEGATIVE_WORDS.map((w) => [w, asWord(w)] as const)

/** Tonen i en rubrik och ingress. Rubriken väger dubbelt, fraser väger tre. */
export function judgeTone(title: string, summary = ''): { tone: Tone; because: string[] } {
  let score = 0
  const because: string[] = []
  const parts: [string, number][] = [
    [title.toLocaleLowerCase('sv-SE'), 2],
    [summary.toLocaleLowerCase('sv-SE'), 1],
  ]
  for (const [text, weight] of parts) {
    if (!text) continue
    for (const re of POSITIVE_PHRASES) {
      const m = text.match(re)
      if (m) { score += 3 * weight; because.push(m[0]) }
    }
    for (const re of NEGATIVE_PHRASES) {
      const m = text.match(re)
      if (m) { score -= 3 * weight; because.push(m[0]) }
    }
    for (const [word, re] of POS) if (re.test(text)) { score += weight; because.push(word) }
    for (const [word, re] of NEG) if (re.test(text)) { score -= weight; because.push(word) }
  }
  const unique = [...new Set(because)].slice(0, 4)
  return { tone: score > 0 ? 'positiv' : score < 0 ? 'negativ' : 'neutral', because: score === 0 ? [] : unique }
}

// ---------- Ihop ----------

function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** Artiklarna från ett flöde som nyheter, filtrerade, bedömda och nyast först. */
export function toNews(feed: Feed, entries: RssEntry[]): NewsItem[] {
  return entries
    .filter((e) => !feed.filter || feed.filter(`${e.title} ${e.summary}`))
    .sort((a, b) => b.published - a.published)
    .slice(0, PER_TOPIC)
    .map((e) => ({
      id: `${feed.topic}-${hash(e.link)}`,
      topic: feed.topic,
      title: e.title,
      link: e.link,
      summary: e.summary,
      published: e.published,
      source: feed.source,
      ...judgeTone(e.title, e.summary),
    }))
}

export interface NewsResult {
  /** När nyheterna hämtades (ms). */
  updated: number
  items: NewsItem[]
  /** Ämnen där flödet inte gick att hämta. */
  missing: NewsTopic[]
}

/** Hämtar alla flöden. fetchText byts ut i testerna. */
export async function loadNews(fetchText: (url: string) => Promise<string>, now = Date.now()): Promise<NewsResult> {
  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        return { feed, items: toNews(feed, parseRss(await fetchText(feed.url))) }
      } catch {
        return { feed, items: null }
      }
    }),
  )
  return {
    updated: now,
    items: results.flatMap((r) => r.items ?? []).sort((a, b) => b.published - a.published),
    missing: results.filter((r) => !r.items).map((r) => r.feed.topic),
  }
}

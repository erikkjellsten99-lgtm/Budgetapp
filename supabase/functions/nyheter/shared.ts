// Veckonyheter: det som appen och edge-funktionen nyheter delar. Sektionerna, typerna, veckans id och kostnaden.
// Ren logik utan nätverk. Appen importerar den här filen direkt, så den får inte dra in något från servern.

export type SectionId = 'varlden' | 'sverige' | 'karlstad' | 'ai' | 'anthropic' | 'openai'
export type Side = 'vanster' | 'mitten' | 'hoger'

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'varlden', label: 'Världen' },
  { id: 'sverige', label: 'Sverige' },
  { id: 'karlstad', label: 'Karlstad' },
  { id: 'ai', label: 'AI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
]

export const SIDES: { id: Side; label: string; plural: string }[] = [
  { id: 'vanster', label: 'Vänster', plural: 'vänstermedier' },
  { id: 'mitten', label: 'Mitten', plural: 'mittenmedier' },
  { id: 'hoger', label: 'Höger', plural: 'högermedier' },
]

/** Hur en sida vinklar nyheten, med artikeln det bygger på. */
export interface Angle {
  side: Side
  /** Tidningen eller kanalen, till exempel "Aftonbladet". */
  outlet: string
  text: string
  url: string
}

export interface Source {
  title: string
  url: string
}

export interface Story {
  id: string
  title: string
  summary: string
  positive: boolean
  sources: Source[]
  /** Högst en vinkel per sida. Tom när ingen politisk vinkel hittades. */
  angles: Angle[]
  /** Sidan som inte bevakar nyheten fast den andra gör det. */
  blindspot: 'vanster' | 'hoger' | null
}

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  searches: number
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 }

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  searches: a.searches + b.searches,
})

/** klar: nyheterna finns. vantar: frågan ligger hos Claude. fel: försöket misslyckades. */
export type SectionStatus = 'klar' | 'vantar' | 'fel'

export interface SectionResult {
  status: SectionStatus
  /** Antal försök (högst MAX_ATTEMPTS). */
  attempts: number
  stories: Story[]
  /** Nyheter som kastades: utan bekräftad källa, dubbletter, eller för att minst hälften ska vara positiva. */
  dropped: number
  model: string
  usage: Usage
  costUsd: number
  error?: string
}

export interface Week {
  /** "2026-W47" */
  week: string
  created: number
  updated: number
  sections: Partial<Record<SectionId, SectionResult>>
}

/** Första försöket. Eriks val 2026-11-15. */
export const MODEL = 'claude-fable-5-2'
/** Andra försöket, om det första misslyckas eller avböjs. */
export const RETRY_MODEL = 'claude-opus-5-5'
export const MAX_ATTEMPTS = 2

/**
 * USD per miljon token och per 1000 sökningar. Frågorna går via batch-API:t, som kostar hälften för token
 * (BATCH_DISCOUNT). Ändras här om Anthropic ändrar priserna.
 */
export const PRICE: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-fable-5-2': { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 10 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
}
export const SEARCH_PER_1000 = 10
export const BATCH_DISCOUNT = 0.5

export function costUsd(model: string, u: Usage): number {
  const p = PRICE[model] ?? PRICE[MODEL]
  const tokens = ((u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000) * BATCH_DISCOUNT
  return Math.round((tokens + (u.searches * SEARCH_PER_1000) / 1000) * 10_000) / 10_000
}

/** Veckans id enligt ISO 8601 (veckan börjar på måndag, vecka 1 innehåller årets första torsdag): "2026-W47". */
export function weekId(time: number): string {
  const d = new Date(time)
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // Torsdagen i samma vecka avgör året.
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7))
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** "2026-W47" → 47 */
export const weekNumber = (week: string) => Number(week.split('-W')[1]) || 0

/** Sektionerna som är klara, i fast ordning. */
export const readySections = (week: Week | null) => SECTIONS.filter((s) => week?.sections[s.id]?.status === 'klar' && week.sections[s.id]!.stories.length > 0)

/** Veckans kostnad i USD, alla försök. */
export const weekCost = (week: Week) => Math.round(Object.values(week.sections).reduce((sum, s) => sum + (s?.costUsd ?? 0), 0) * 100) / 100

/** Är veckan färdig, det vill säga finns inget mer att vänta på eller försöka? */
export const weekDone = (week: Week) =>
  SECTIONS.every((s) => {
    const r = week.sections[s.id]
    return r && (r.status === 'klar' || (r.status === 'fel' && r.attempts >= MAX_ATTEMPTS))
  })

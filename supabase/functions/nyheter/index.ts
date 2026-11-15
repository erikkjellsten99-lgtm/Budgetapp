// Veckonyheter: en sammanställning per vecka i sex sektioner (världen, Sverige, Karlstad, AI, Anthropic, OpenAI),
// skriven av Claude med webbsökning. Minst hälften positiva nyheter, vinklar från vänster, mitten och höger, och
// blinda fläckar. Kontrollerna står i digest.ts.
//
// GET (ingen nyckel): { week } med senaste veckan som har något klart, eller null. Nyheterna är inte personliga.
// POST med rubriken "x-cron-secret" (schemat, måndagar): för veckans arbete ett steg framåt.
//   Frågorna går via Anthropics batch-API: halva priset, och ingen tidsgräns som en edge-funktion annars har.
//   Första anropet skickar en fråga per sektion. Senare anrop hämtar svaren, kontrollerar dem och sparar.
//   Ett misslyckat försök görs om en gång med RETRY_MODEL. Svar: { week, sections: { id: status } }.
//
// Skydd mot kostnad: bara schemat kan starta något, högst MAX_ATTEMPTS försök per sektion och vecka, tak på
// antal sökningar, och kostnaden sparas per sektion.
//
// Tabell: news_weeks (migrationen nyheter). verify_jwt ska vara AV. Hemlighet: ANTHROPIC_API_KEY (samma som
// Jarvis). Schemats hemlighet är samma som för kunskap-generera (kunskap_cron_secret).
// Importerar filer från ../kunskap-generera, så de måste följa med vid utläggning.
// Läggs bara ut efter att Erik skrivit "Lägg ut".

import type Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { admin, anthropic, CORS, errorText, fail, json, usageOf } from '../kunskap-generera/server.ts'
import { checkStories, collectSources, MAX_SEARCHES, SAVE_TOOL, systemPrompt, userPrompt } from './digest.ts'
import {
  addUsage,
  costUsd,
  MAX_ATTEMPTS,
  MODEL,
  NO_USAGE,
  readySections,
  RETRY_MODEL,
  SECTIONS,
  weekDone,
  weekId,
  type SectionId,
  type SectionResult,
  type Week,
} from './shared.ts'

/** Högst så här många gånger fortsätts ett pausat svar (pause_turn). */
const MAX_CONTINUATIONS = 2
/** Ett svar som inte kommit på så här länge räknas som misslyckat. */
const GIVE_UP = 20 * 3_600_000

/** Det som bara servern behöver, per sektion: frågan som ligger ute och svarsblocken från pausade svar. */
interface Work {
  batchId?: string
  sent?: number
  /** Svarsblock från pausade svar, som skickas tillbaka oförändrade. */
  content?: unknown[]
  turns?: number
  /** Ska skickas igen som fortsättning. */
  resume?: boolean
}
type WorkMap = Partial<Record<SectionId, Work>>

const sectionIds = SECTIONS.map((s) => s.id)

function request(section: SectionId, model: string, prior: unknown[] | undefined, today: string) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt(section, today) }]
  // Pausat svar: skicka tillbaka det oförändrat, så fortsätter servern där den var.
  if (prior?.length) messages.push({ role: 'assistant', content: prior as Anthropic.ContentBlockParam[] })
  return {
    custom_id: section,
    params: {
      model,
      max_tokens: 20000,
      output_config: { effort: 'medium' },
      system: systemPrompt(),
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: MAX_SEARCHES,
          user_location: { type: 'approximate', city: 'Karlstad', country: 'SE', timezone: 'Europe/Stockholm' },
        },
        SAVE_TOOL,
      ] as unknown as Anthropic.ToolUnion[],
      messages,
    },
  }
}

const failed = (r: SectionResult, error: string) => Object.assign(r, { status: 'fel' as const, error })

/** Ett svar från batchen: räknar kostnaden och gör sektionen klar, pausad eller misslyckad. */
function take(week: Week, work: WorkMap, section: SectionId, result: Anthropic.Messages.MessageBatchIndividualResponse['result']) {
  const r = week.sections[section]
  const w = work[section]
  if (!r || !w || r.status !== 'vantar') return
  delete w.batchId
  if (result.type !== 'succeeded') return void failed(r, result.type === 'errored' ? 'Fel från Claude.' : 'Frågan hann inte besvaras.')

  const message = result.message
  const usage = usageOf(message.usage)
  r.usage = addUsage(r.usage, usage)
  r.costUsd = Math.round((r.costUsd + costUsd(r.model, usage)) * 10_000) / 10_000
  const blocks = [...(w.content ?? []), ...message.content]

  const saved = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === SAVE_TOOL.name)
  if (saved) {
    const checked = checkStories(saved.input, section, collectSources(blocks))
    if (checked.stories.length === 0) return void failed(r, 'Ingen nyhet hade en källa som gick att bekräfta.')
    Object.assign(r, { status: 'klar', stories: checked.stories, dropped: checked.dropped })
    delete r.error
    work[section] = {}
    return
  }
  if (message.stop_reason === 'pause_turn' && (w.turns ?? 0) < MAX_CONTINUATIONS) {
    Object.assign(w, { content: blocks, turns: (w.turns ?? 0) + 1, resume: true })
    return
  }
  failed(r, message.stop_reason === 'refusal' ? 'Claude avböjde uppdraget.' : 'Claude lämnade inget svar.')
}

/** Ett steg framåt i veckans arbete: hämta svar som kommit, skicka det som ska skickas. */
async function step(now: number) {
  const id = weekId(now)
  const { data: row, error } = await admin.from('news_weeks').select('data, work').eq('week', id).maybeSingle()
  if (error) throw error
  const week: Week = (row?.data as Week | undefined) ?? { week: id, created: now, updated: now, sections: {} }
  const work: WorkMap = (row?.work as WorkMap | undefined) ?? {}
  const brief = () => ({ week: id, sections: Object.fromEntries(sectionIds.map((s) => [s, week.sections[s]?.status ?? 'ny'])) })
  if (row && weekDone(week)) return brief()

  // 1. Svar som kommit.
  const waiting = sectionIds.filter((s) => week.sections[s]?.status === 'vantar' && work[s]?.batchId)
  for (const batchId of new Set(waiting.map((s) => work[s]!.batchId!))) {
    const mine = waiting.filter((s) => work[s]!.batchId === batchId)
    const batch = await anthropic.messages.batches.retrieve(batchId)
    if (batch.processing_status !== 'ended') {
      for (const s of mine) {
        if (now - (work[s]!.sent ?? now) > GIVE_UP) {
          failed(week.sections[s]!, 'Det tog för lång tid.')
          work[s] = {}
        }
      }
      continue
    }
    for await (const result of await anthropic.messages.batches.results(batchId)) {
      if (mine.includes(result.custom_id as SectionId)) take(week, work, result.custom_id as SectionId, result.result)
    }
    // Saknas ett svar i batchen räknas försöket som misslyckat.
    for (const s of mine) if (work[s]?.batchId === batchId) { failed(week.sections[s]!, 'Svaret saknades.'); work[s] = {} }
  }

  // 2. Nya försök och fortsättningar.
  const today = new Date(now).toISOString().slice(0, 10)
  const requests = []
  for (const s of sectionIds) {
    const r = week.sections[s]
    if (r?.status === 'vantar' && work[s]?.resume) {
      requests.push(request(s, r.model, work[s]!.content, today))
    } else if (!r || (r.status === 'fel' && r.attempts < MAX_ATTEMPTS)) {
      const attempts = (r?.attempts ?? 0) + 1
      const model = attempts === 1 ? MODEL : RETRY_MODEL
      week.sections[s] = { status: 'vantar', attempts, stories: [], dropped: 0, model, usage: r?.usage ?? NO_USAGE, costUsd: r?.costUsd ?? 0 }
      work[s] = {}
      requests.push(request(s, model, undefined, today))
    }
  }
  if (requests.length) {
    try {
      const batch = await anthropic.messages.batches.create({ requests } as unknown as Anthropic.Messages.BatchCreateParams)
      for (const q of requests) Object.assign(work[q.custom_id]!, { batchId: batch.id, sent: now, resume: false })
    } catch (e) {
      console.error('nyheter: batchen gick inte att skicka', errorText(e))
      for (const q of requests) { failed(week.sections[q.custom_id]!, errorText(e)); work[q.custom_id] = {} }
    }
  }

  week.updated = now
  const { error: saveError } = await admin.from('news_weeks').upsert({ week: id, data: week, work, updated_at: new Date(now).toISOString() })
  if (saveError) throw saveError
  console.log('nyheter:', JSON.stringify({ ...brief(), skickade: requests.length, usd: Object.values(week.sections).reduce((sum, s) => sum + (s?.costUsd ?? 0), 0) }))
  return brief()
}

/** Senaste veckan som har något att visa. */
async function latest(): Promise<Week | null> {
  const { data, error } = await admin.from('news_weeks').select('data').order('week', { ascending: false }).limit(3)
  if (error) throw error
  return (data ?? []).map((r) => r.data as Week).find((w) => readySections(w).length > 0) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } })
  try {
    if (req.method === 'GET') return json({ week: await latest() })
    if (req.method !== 'POST') return fail(405, 'metod', 'Anropa med GET eller POST.')

    // Bara schemat får starta något. Hemligheten ligger i Vault och är samma som för kunskap-generera.
    const given = req.headers.get('x-cron-secret')
    const { data: secret, error } = given ? await admin.rpc('kunskap_cron_secret') : { data: null, error: null }
    if (!given || error || typeof secret !== 'string' || !secret || given !== secret) return fail(401, 'hemlighet', 'Fel hemlighet.')
    return json(await step(Date.now()))
  } catch (error) {
    console.error('nyheter: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Något gick fel. Försök igen.')
  }
})

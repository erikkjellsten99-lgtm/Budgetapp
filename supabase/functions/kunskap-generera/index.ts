// Kunskap, generering: gör nya kort åt dem som slagit på det i appen (Kunskap → Inställningar). Frågar Claude
// (Anthropic API) med webbsökning, kontrollerar det som kommer tillbaka (generate.ts) och sparar korten och
// kostnaden i personal_records, så att de synkas till appen som allt annat i Kunskap.
//
// Två sätt att anropa (POST):
// - Schemat (pg_cron, en gång per dygn): rubriken "x-cron-secret" med hemligheten ur Vault (kunskap_cron_secret). Kör alla
//   som har Varje dag eller Varje vecka och står på tur (isDue).
// - Appen ("Generera nu"): "Authorization: Bearer <JWT>". Kör en batch åt den inloggade.
// Svar: { batches: [{ id, status, cards, costUsd }] }. Fel: { error, message }.
//
// Skydd mot kostnad: utan sparad inställning genereras ingenting, högst MAX_BATCHES_PER_DAY batchar per person
// och dygn, högst COUNT_MAX kort per batch och ett tak på antal webbsökningar. Varje batch loggas med token,
// sökningar och kostnad i USD (kunskap_batches), även när den misslyckas.
//
// verify_jwt ska vara AV (schemat har ingen JWT; funktionen kontrollerar själv). Hemlighet: ANTHROPIC_API_KEY
// (samma som Jarvis). Schemats hemlighet skapas av migrationen och läses med kunskap_cron_secret(). Läggs bara ut efter att Erik skrivit "Lägg ut".

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { checkCards, collectSources, htmlToText, MODEL, SAVE_TOOL, systemPrompt, userPrompt, type Person } from './generate.ts'
import {
  addUsage,
  batchesLastDay,
  cleanPrefs,
  cleanSettings,
  costUsd,
  discoveryCount,
  isDue,
  MAX_BATCHES_PER_DAY,
  NO_USAGE,
  type Batch,
  type KunskapCard,
  type Usage,
  type VoteRow,
  type Weight,
  weights,
} from './shared.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const fail = (status: number, error: string, message: string) => json({ error, message }, status)

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

// Ett försök, och en tidsgräns under funktionens egen (150 s).
const anthropic = new Anthropic({ maxRetries: 0, timeout: 125_000 })

/** Högst så här många gånger fortsätts ett pausat svar (pause_turn). */
const MAX_CONTINUATIONS = 3

const STORES = ['kunskap_people', 'kunskap_settings', 'kunskap_votes', 'kunskap_cards', 'kunskap_batches']

interface Row {
  user_id: string
  store: string
  id: string
  data: unknown
}

async function loadRows(userId?: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    let query = admin.from('personal_records').select('user_id, store, id, data').in('store', STORES).eq('deleted', false).order('user_id').order('store').order('id').range(from, from + 999)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw error
    out.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) return out
  }
}

async function save(userId: string, store: string, records: { id: string }[]) {
  if (!records.length) return
  const now = Date.now()
  const { error } = await admin
    .from('personal_records')
    .upsert(records.map((data) => ({ user_id: userId, store, id: data.id, data, deleted: false, client_ts: now })), { onConflict: 'user_id,store,id' })
  if (error) throw error
}

const usageOf = (u: Anthropic.Usage): Usage => ({
  input: u.input_tokens ?? 0,
  output: u.output_tokens ?? 0,
  cacheRead: u.cache_read_input_tokens ?? 0,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
  searches: u.server_tool_use?.web_search_requests ?? 0,
})

/** Källsidans text, för att bekräfta citat. Null om sidan inte går att läsa (då görs citatet om till en insikt). */
async function pageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; kunskapskort/1.0)', Accept: 'text/html,text/plain' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok || !/text\/|xml|json/.test(res.headers.get('content-type') ?? '')) return null
    return htmlToText((await res.text()).slice(0, 3_000_000))
  } catch {
    return null
  }
}

/** Frågar Claude med webbsökning tills korten lämnas med spara_kort. Ger verktygets indata, alla svarsblock och förbrukningen. */
async function ask(people: Person[], count: number, discovery: number, taste: Weight[], existing: KunskapCard[], usage: { total: Usage }) {
  const first: Anthropic.MessageParam = { role: 'user', content: userPrompt(people, count, discovery, taste, existing, new Date().toISOString().slice(0, 10)) }
  const messages: Anthropic.MessageParam[] = [first]
  const blocks: unknown[] = []
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system: systemPrompt(),
      tools: [
        // Taket håller nere kostnaden: sökningar kostar per styck, och varje resultat blir token att läsa.
        { type: 'web_search_20260209', name: 'web_search', max_uses: Math.min(12, count + 3) },
        SAVE_TOOL,
      ] as unknown as Anthropic.ToolUnion[],
      messages,
    })
    usage.total = addUsage(usage.total, usageOf(response.usage))
    blocks.push(...response.content)
    if (response.stop_reason === 'refusal') throw new Error('Claude avböjde uppdraget.')
    const saved = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === SAVE_TOOL.name)
    if (saved) return { input: saved.input, blocks }
    if (response.stop_reason !== 'pause_turn') break
    // Sökningen pausade: skicka tillbaka svaret oförändrat, så fortsätter servern där den var.
    messages.push({ role: 'assistant', content: response.content })
  }
  throw new Error('Claude lämnade inga kort.')
}

/** En batch åt en person. Loggas alltid, även när den misslyckas. */
async function runBatch(userId: string, rows: Row[], trigger: Batch['trigger']): Promise<Batch> {
  const of = <T>(store: string) => rows.filter((r) => r.store === store && r.data).map((r) => r.data as T)
  // Inställningen och smaken ligger i samma store, med olika id.
  const record = (id: string) => rows.find((r) => r.store === 'kunskap_settings' && r.id === id)?.data
  const settings = cleanSettings(record('settings'))
  const people = of<Person>('kunskap_people').map((p) => ({ name: String(p.name ?? ''), topics: Array.isArray(p.topics) ? p.topics.map(String) : [] })).filter((p) => p.name)
  const existing = of<KunskapCard>('kunskap_cards').sort((a, b) => (b.created ?? 0) - (a.created ?? 0))

  // Smaken: rösterna viktade per person, ämne och korttyp, plus det användaren själv ställt in.
  const taste = weights(of<VoteRow>('kunskap_votes'), cleanPrefs(record('prefs')), people.flatMap((p) => [{ kind: 'person' as const, label: p.name }, ...p.topics.map((t) => ({ kind: 'topic' as const, label: t }))]))
  const discovery = discoveryCount(settings.count)

  const now = Date.now()
  const batch: Batch = {
    id: `b-${now.toString(36)}`,
    created: now,
    status: 'pagar',
    trigger,
    requested: settings.count,
    cards: 0,
    quotesVerified: 0,
    quotesRewritten: 0,
    dropped: 0,
    model: MODEL,
    usage: NO_USAGE,
    costUsd: 0,
  }
  // Sparas först, så att batchen räknas mot dygnets gräns även om funktionen avbryts.
  await save(userId, 'kunskap_batches', [batch])

  const usage = { total: NO_USAGE }
  try {
    const { input, blocks } = await ask(people, settings.count, discovery, taste, existing, usage)
    const checked = await checkCards(input, people, collectSources(blocks), new Set(existing.map((c) => c.id)), settings.count, pageText, now, batch.id, discovery)
    await save(userId, 'kunskap_cards', checked.cards)
    Object.assign(batch, { status: 'klar', cards: checked.cards.length, quotesVerified: checked.quotesVerified, quotesRewritten: checked.quotesRewritten, dropped: checked.dropped, discovery: checked.discovery })
  } catch (error) {
    batch.status = 'fel'
    batch.error =
      error instanceof Anthropic.AuthenticationError
        ? 'API-nyckeln godtas inte.'
        : error instanceof Anthropic.RateLimitError
          ? 'Claude hade för mycket att göra.'
          : error instanceof Anthropic.APIConnectionError
            ? 'Det tog för lång tid.'
            : error instanceof Anthropic.APIError
              ? `Fel från Claude (${error.status}).`
              : error instanceof Error
                ? error.message.slice(0, 200)
                : 'Okänt fel.'
    console.error('kunskap-generera: batchen misslyckades', batch.id, batch.error)
  }
  batch.usage = usage.total
  batch.costUsd = costUsd(usage.total)
  await save(userId, 'kunskap_batches', [batch])
  console.log('kunskap-generera: batch', JSON.stringify({ id: batch.id, status: batch.status, cards: batch.cards, usage: batch.usage, costUsd: batch.costUsd }))
  return batch
}

const brief = (b: Batch) => ({ id: b.id, status: b.status, cards: b.cards, costUsd: b.costUsd, error: b.error })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'metod', 'Anropa med POST.')

  try {
    // Schemat: alla som står på tur.
    const given = req.headers.get('x-cron-secret')
    if (given) {
      // Hemligheten ligger bara i databasen (Vault). Schemat läser den där, och funktionen frågar efter den här.
      const { data: secret, error } = await admin.rpc('kunskap_cron_secret')
      if (error || typeof secret !== 'string' || !secret || given !== secret) return fail(401, 'hemlighet', 'Fel hemlighet.')
      const rows = await loadRows()
      const now = Date.now()
      const due = [...new Set(rows.map((r) => r.user_id))].filter((userId) => {
        const mine = rows.filter((r) => r.user_id === userId)
        const batches = mine.filter((r) => r.store === 'kunskap_batches').map((r) => r.data as Batch)
        const settings = cleanSettings(mine.find((r) => r.store === 'kunskap_settings' && r.id === 'settings')?.data)
        return mine.some((r) => r.store === 'kunskap_people') && isDue(settings, batches, now) && batchesLastDay(batches, now) < MAX_BATCHES_PER_DAY
      })
      const done = await Promise.all(due.map((userId) => runBatch(userId, rows.filter((r) => r.user_id === userId), 'schema')))
      return json({ batches: done.map(brief) })
    }

    // Appen: en batch åt den inloggade.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: null }
    if (!auth?.user) return fail(401, 'utloggad', 'Logga in i Groundwork för att generera kort.')
    const rows = await loadRows(auth.user.id)
    if (!rows.some((r) => r.store === 'kunskap_people')) return fail(400, 'personer', 'Följ minst en person först. Vänta några sekunder om du just lade till någon.')
    const batches = rows.filter((r) => r.store === 'kunskap_batches').map((r) => r.data as Batch)
    if (batchesLastDay(batches, Date.now()) >= MAX_BATCHES_PER_DAY) {
      return fail(429, 'grans', `Högst ${MAX_BATCHES_PER_DAY} batchar per dygn. Försök igen i morgon.`)
    }
    const batch = await runBatch(auth.user.id, rows, 'manuell')
    return batch.status === 'klar' ? json({ batches: [brief(batch)] }) : fail(502, 'fel', batch.error ?? 'Genereringen misslyckades.')
  } catch (error) {
    console.error('kunskap-generera: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Något gick fel. Försök igen.')
  }
})

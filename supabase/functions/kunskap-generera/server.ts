// Kunskap: det som edge-funktionerna kunskap-generera och kunskap-presentation delar: svar, klienter mot Supabase
// och Claude, läsning och skrivning i personal_records, och frågan till Claude med webbsökning.
// Service role används, så varje anropare måste själv ha kontrollerat vem som frågar.

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { htmlToText, MODEL } from './generate.ts'
import { addUsage, type Usage } from './shared.ts'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
export const fail = (status: number, error: string, message: string) => json({ error, message }, status)

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

// Ett försök, och en tidsgräns under funktionens egen (150 s).
export const anthropic = new Anthropic({ maxRetries: 0, timeout: 125_000 })

/** Högst så här många gånger fortsätts ett pausat svar (pause_turn). */
export const MAX_CONTINUATIONS = 3

export const STORES = ['kunskap_people', 'kunskap_settings', 'kunskap_votes', 'kunskap_cards', 'kunskap_batches']

export interface Row {
  user_id: string
  store: string
  id: string
  data: unknown
}

export async function loadRows(userId?: string): Promise<Row[]> {
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

export async function save(userId: string, store: string, records: { id: string }[]) {
  if (!records.length) return
  const now = Date.now()
  const { error } = await admin
    .from('personal_records')
    .upsert(records.map((data) => ({ user_id: userId, store, id: data.id, data, deleted: false, client_ts: now })), { onConflict: 'user_id,store,id' })
  if (error) throw error
}

export const usageOf = (u: Anthropic.Usage): Usage => ({
  input: u.input_tokens ?? 0,
  output: u.output_tokens ?? 0,
  cacheRead: u.cache_read_input_tokens ?? 0,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
  searches: u.server_tool_use?.web_search_requests ?? 0,
})

/** Källsidans text, för att bekräfta citat. Null om sidan inte går att läsa (då görs citatet om till en insikt). */
export async function pageText(url: string): Promise<string | null> {
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

/**
 * Frågar Claude med webbsökning tills svaret lämnas med verktyget `tool`. Ger verktygets indata, alla svarsblock
 * (där sökresultaten finns) och lägger förbrukningen till `usage`.
 */
export async function ask(system: string, prompt: string, tool: { name: string }, maxSearches: number, usage: { total: Usage }) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  const blocks: unknown[] = []
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system,
      tools: [
        // Taket håller nere kostnaden: sökningar kostar per styck, och varje resultat blir token att läsa.
        { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches },
        tool,
      ] as unknown as Anthropic.ToolUnion[],
      messages,
    })
    usage.total = addUsage(usage.total, usageOf(response.usage))
    blocks.push(...response.content)
    if (response.stop_reason === 'refusal') throw new Error('Claude avböjde uppdraget.')
    const saved = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === tool.name)
    if (saved) return { input: saved.input, blocks }
    if (response.stop_reason !== 'pause_turn') break
    // Sökningen pausade: skicka tillbaka svaret oförändrat, så fortsätter servern där den var.
    messages.push({ role: 'assistant', content: response.content })
  }
  throw new Error('Claude lämnade inget svar.')
}

export const errorText = (error: unknown) =>
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

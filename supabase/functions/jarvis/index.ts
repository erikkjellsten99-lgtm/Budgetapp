// Jarvis: svarar på frågor om hushållets ekonomi med Claude (Anthropic API). Läser bara.
//
// POST { question: "Vad blir över i december?" }  med appens inloggning ("Authorization: Bearer <JWT>").
// Svar: { answer: "…", used: 7, limit: 50 }. Fel: { error: "kod", message: "text på svenska" }.
//
// - Modellen får inte hela ekonomin i prompten. Den får två verktyg (tools.ts) och hämtar det frågan gäller.
// - All läsning sker med användarens egen JWT, så radsäkerheten (RLS) gäller. Ingen service role-nyckel används.
// - Högst 50 frågor per användare och dag. Räknas i tabellen jarvis_usage av jarvis_count_call().
// - ANTHROPIC_API_KEY ligger som hemlighet i Supabase och lämnar aldrig servern.
// - Svaren läses upp i appen: systemprompten (tools.ts) ber om korta svar i talspråk.
//
// Utläggning: funktionen importerar filer från ../inbox, så de måste följa med (Supabase CLI gör det själv).
// verify_jwt ska vara på (standard). Läggs bara ut efter att Erik skrivit "Lägg ut".

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4'
import { stockholmToday } from '../inbox/parse.ts'
import type { Holding, PricePoint } from '../inbox/types.ts'
import { DAILY_LIMIT, MAX_QUESTION, MODEL, runTool, systemPrompt, toEconomy, TOOLS, type Economy } from './tools.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const fail = (status: number, error: string, message: string) => json({ error, message }, status)

/** Högst så här många vändor med verktyg per fråga. */
const MAX_TURNS = 6

// Nyckeln läses från miljön (ANTHROPIC_API_KEY). Ett försök om, och en tidsgräns som passar ett röstsvar.
const anthropic = new Anthropic({ maxRetries: 1, timeout: 40_000 })

/** Alla rader i en fråga, 1000 åt gången. */
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

/** Hushållets ekonomi, läst med användarens klient. Null om användaren inte är med i något hushåll. */
async function loadEconomy(db: SupabaseClient, userId: string): Promise<Economy | null> {
  const { data: member, error } = await db.from('household_members').select('household_id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!member) return null
  const rows = await allRows<{ store: string; data: unknown }>((from, to) =>
    db.from('records').select('store, data').eq('household_id', member.household_id).eq('deleted', false).order('store').order('id').range(from, to),
  )
  const tickers = [
    ...new Set(rows.filter((r) => r.store === 'holdings').flatMap((r) => ((r.data as Holding | null)?.ticker ? [(r.data as Holding).ticker!] : []))),
  ]
  const prices: Record<string, PricePoint[]> = {}
  if (tickers.length) {
    try {
      const priceRows = await allRows<{ ticker: string; date: string; close_sek: number | string }>((from, to) =>
        db.from('prices').select('ticker,date,close_sek').in('ticker', tickers).order('date').order('ticker').range(from, to),
      )
      for (const r of priceRows) (prices[r.ticker] ??= []).push({ date: r.date, close: Number(r.close_sek) })
    } catch {
      // Utan kurser räknas innehaven utan värde. Resten av ekonomin går att svara om ändå.
    }
  }
  return toEconomy(rows, prices, stockholmToday())
}

/** Frågar Claude och kör verktygen tills det finns ett svar i text. */
async function answer(question: string, economy: Economy): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }]
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // Röstsvar ska komma fort: låg ansträngning räcker för att slå upp och återge siffror.
      output_config: { effort: 'low' },
      system: systemPrompt(economy.today),
      tools: TOOLS as unknown as Anthropic.Tool[],
      messages,
    })

    if (response.stop_reason === 'refusal') return 'Det kan jag inte svara på. Fråga mig om budgeten, kontona, sparmålet eller lånet.'

    if (response.stop_reason === 'tool_use') {
      // Hela svaret skickas tillbaka oförändrat (även modellens tankeblock), sedan alla verktygssvar i ett meddelande.
      messages.push({ role: 'assistant', content: response.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const result = runTool(block.name, block.input, economy)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: result.content, is_error: result.isError })
      }
      messages.push({ role: 'user', content: results })
      continue
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) return text
    break
  }
  return 'Jag fick inte fram något svar. Försök ställa frågan på ett annat sätt.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'metod', 'Skicka frågan med POST.')

  // Vem frågar? Klienten nedan använder användarens egen JWT för allt den läser.
  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'utloggad', 'Logga in i Groundwork för att fråga Jarvis.')
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await db.auth.getUser(token)
  if (!auth?.user) return fail(401, 'utloggad', 'Logga in i Groundwork för att fråga Jarvis.')

  let body: { question?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'fraga', 'Skicka frågan som JSON: { "question": "…" }.')
  }
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION) : ''
  if (!question) return fail(400, 'fraga', 'Frågan är tom.')

  try {
    const economy = await loadEconomy(db, auth.user.id)
    if (!economy) return fail(404, 'hushall', 'Du är inte med i något hushåll i Groundwork än.')

    // Räkna frågan först, så att gränsen gäller även om svaret sedan misslyckas.
    const { data: counted, error: countError } = await db.rpc('jarvis_count_call')
    if (countError) throw countError
    const count = (Array.isArray(counted) ? counted[0] : counted) as { allowed: boolean; used: number } | null
    if (!count) throw new Error('jarvis_count_call gav inget svar')
    if (!count.allowed) {
      return json({ error: 'grans', message: `Du har ställt ${DAILY_LIMIT} frågor i dag, och det är gränsen. I morgon går det igen.`, used: count.used, limit: DAILY_LIMIT }, 429)
    }

    return json({ answer: await answer(question, economy), used: count.used, limit: DAILY_LIMIT })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('jarvis: API-nyckeln godtas inte', error.status)
      return fail(500, 'nyckel', 'Jarvis är inte rätt inställd på servern.')
    }
    if (error instanceof Anthropic.RateLimitError) return fail(503, 'upptagen', 'Jarvis har mycket att göra just nu. Försök igen om en stund.')
    if (error instanceof Anthropic.APIConnectionError) return fail(504, 'tid', 'Det tog för lång tid att få svar. Försök igen.')
    if (error instanceof Anthropic.APIError) {
      console.error('jarvis: fel från Claude', error.status, error.message)
      return fail(502, 'claude', 'Det gick inte att få ett svar just nu. Försök igen.')
    }
    console.error('jarvis: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Något gick fel när Jarvis läste Groundwork. Försök igen.')
  }
})

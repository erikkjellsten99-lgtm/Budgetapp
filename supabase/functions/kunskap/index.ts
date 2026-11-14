// Kunskap, Gå djupare: en chatt med Claude (Anthropic API) om ett kort ur flödet. Läser och skriver ingen data.
//
// POST { card: { person, topic, type, text, label?, source: { title, url } }, question: "…",
//        history?: [{ question, answer }] }  med appens inloggning ("Authorization: Bearer <JWT>").
// Svar: { answer: "…", used: 7, limit: 50 }. Fel: { error: "kod", message: "text på svenska" }.
//
// - Bara inloggade. Frågorna räknas av samma räknare som Jarvis (jarvis_count_call, tabellen jarvis_usage):
//   högst 50 frågor per person och dag, Jarvis och Kunskap tillsammans.
// - Inga verktyg och ingen åtkomst till ekonomin eller vanorna: modellen får bara kortet och samtalet.
// - ANTHROPIC_API_KEY ligger som hemlighet i Supabase och lämnar aldrig servern.
//
// verify_jwt ska vara på (standard). Läggs bara ut efter att Erik skrivit "Lägg ut".

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { DAILY_LIMIT, MAX_QUESTION, MODEL, systemPrompt, toCard, toMessages } from './prompt.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const fail = (status: number, error: string, message: string) => json({ error, message }, status)

const anthropic = new Anthropic({ maxRetries: 1, timeout: 40_000 })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'metod', 'Skicka frågan med POST.')

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'utloggad', 'Logga in i Groundwork för att gå djupare.')
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await db.auth.getUser(token)
  if (!auth?.user) return fail(401, 'utloggad', 'Logga in i Groundwork för att gå djupare.')

  let body: { card?: unknown; question?: unknown; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'fraga', 'Skicka frågan som JSON.')
  }
  const card = toCard(body?.card)
  if (!card) return fail(400, 'kort', 'Kortet saknas eller är ofullständigt.')
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION) : ''
  if (!question) return fail(400, 'fraga', 'Frågan är tom.')

  try {
    // Räkna frågan först, så att gränsen gäller även om svaret sedan misslyckas.
    const { data: counted, error: countError } = await db.rpc('jarvis_count_call')
    if (countError) throw countError
    const count = (Array.isArray(counted) ? counted[0] : counted) as { allowed: boolean; used: number } | null
    if (!count) throw new Error('jarvis_count_call gav inget svar')
    if (!count.allowed) {
      return json({ error: 'grans', message: `Du har ställt ${DAILY_LIMIT} frågor i dag, och det är gränsen. I morgon går det igen.`, used: count.used, limit: DAILY_LIMIT }, 429)
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: systemPrompt(card),
      messages: toMessages(body.history, question),
    })
    if (response.stop_reason === 'refusal') return json({ answer: 'Det kan jag inte svara på. Fråga gärna något annat om kortet.', used: count.used, limit: DAILY_LIMIT })
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return json({ answer: text || 'Jag fick inte fram något svar. Försök ställa frågan på ett annat sätt.', used: count.used, limit: DAILY_LIMIT })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('kunskap: API-nyckeln godtas inte', error.status)
      return fail(500, 'nyckel', 'Chatten är inte rätt inställd på servern.')
    }
    if (error instanceof Anthropic.RateLimitError) return fail(503, 'upptagen', 'Det är mycket att göra just nu. Försök igen om en stund.')
    if (error instanceof Anthropic.APIConnectionError) return fail(504, 'tid', 'Det tog för lång tid att få svar. Försök igen.')
    if (error instanceof Anthropic.APIError) {
      console.error('kunskap: fel från Claude', error.status, error.message)
      return fail(502, 'claude', 'Det gick inte att få ett svar just nu. Försök igen.')
    }
    console.error('kunskap: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Något gick fel. Försök igen.')
  }
})

// Jarvis röst: gör om en text till tal med ElevenLabs och skickar tillbaka ljudet (mp3).
//
// POST { text: "Det blir ungefär sextontusen kronor över." }  med appens inloggning ("Authorization: Bearer <JWT>").
// Svar: ljudet som application/octet-stream (mp3). Fel: { error: "kod", message: "text på svenska" }.
//
// - Bara inloggade användare. Högst 150 uppläsningar per person och dag (jarvis_usage.spoken, jarvis_count_speech()).
// - ELEVENLABS_API_KEY ligger som hemlighet i Supabase och lämnar aldrig servern.
// - Valfria hemligheter: ELEVENLABS_VOICE_ID (rösten) och ELEVENLABS_MODEL (modellen).
// - Läser ingenting ur ekonomin och skriver bara räknaren. Appen faller tillbaka på telefonens röst vid fel.
//
// verify_jwt ska vara på (standard). Läggs bara ut efter att Erik skrivit "Lägg ut".

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { SPEECH_LIMIT, speakable } from './text.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const fail = (status: number, error: string, message: string) =>
  new Response(JSON.stringify({ error, message }), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })

/** Rösten om ingen är vald: exemplet i ElevenLabs dokumentation. Byt med hemligheten ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb'
/** Flerspråkig modell med svenska. Byt med hemligheten ELEVENLABS_MODEL, t.ex. eleven_flash_v2_5 (snabbare). */
const DEFAULT_MODEL = 'eleven_multilingual_v2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'metod', 'Skicka texten med POST.')

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'utloggad', 'Logga in i Groundwork för att höra Jarvis röst.')
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await db.auth.getUser(token)
  if (!auth?.user) return fail(401, 'utloggad', 'Logga in i Groundwork för att höra Jarvis röst.')

  let body: { text?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'text', 'Skicka texten som JSON: { "text": "…" }.')
  }
  const text = typeof body?.text === 'string' ? speakable(body.text) : ''
  if (!text) return fail(400, 'text', 'Texten är tom.')

  const key = Deno.env.get('ELEVENLABS_API_KEY')
  if (!key) {
    console.error('jarvis-rost: ELEVENLABS_API_KEY saknas')
    return fail(503, 'nyckel', 'Jarvis röst är inte inställd på servern.')
  }

  try {
    const { data: counted, error: countError } = await db.rpc('jarvis_count_speech')
    if (countError) throw countError
    const count = (Array.isArray(counted) ? counted[0] : counted) as { allowed: boolean; used: number } | null
    if (!count) throw new Error('jarvis_count_speech gav inget svar')
    if (!count.allowed) return fail(429, 'grans', `Jarvis har läst upp ${SPEECH_LIMIT} gånger i dag, och det är gränsen.`)

    const voice = Deno.env.get('ELEVENLABS_VOICE_ID') || DEFAULT_VOICE
    const model = Deno.env.get('ELEVENLABS_MODEL') || DEFAULT_MODEL
    const speech = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      // language_code stöds inte av eleven_multilingual_v2, som hör språket själv.
      body: JSON.stringify({ text, model_id: model, ...(model === 'eleven_multilingual_v2' ? {} : { language_code: 'sv' }) }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!speech.ok || !speech.body) {
      console.error('jarvis-rost: fel från ElevenLabs', speech.status, (await speech.text().catch(() => '')).slice(0, 300))
      if (speech.status === 401) return fail(503, 'nyckel', 'Jarvis röst är inte rätt inställd på servern.')
      return fail(502, 'rost', 'Det gick inte att få fram rösten just nu.')
    }
    // octet-stream så att appens Supabase-klient lämnar ljudet som en Blob och inte försöker läsa det som text.
    return new Response(speech.body, { headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('jarvis-rost: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Det gick inte att få fram rösten just nu.')
  }
})

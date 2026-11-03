// Inkorg för Vanor: tar emot påminnelser från iPhone-genvägen och lägger in dem under Att göra.
//
// - POST ?action=token  (inloggad i appen): skapar en personlig nyckel för genvägen. En ny nyckel
//   ersätter den gamla. Bara en hash av nyckeln sparas (tabellen inbox_tokens).
// - POST  (från genvägen, "Authorization: Bearer <nyckel>"): JSON { rader: "Titel | datum\n..." }.
//   Varje rad blir en sak att göra. Samma påminnelse läggs bara in en gång (se parse.ts).
// - POST  (från Siri-genvägen "Ny uppgift"): JSON { sak: "Ringa mamma imorgon klockan 18" }.
//   Dag och tid plockas ut ur meningen (spoken.ts). Svaret är en kort text som Siri läser upp.
//
// Funktionen kontrollerar själv vem som anropar (verify_jwt är av).

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { itemId, parseLines, stockholmToday, type InboxItem } from './parse.ts'
import { confirmText, parseSpoken } from './spoken.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const say = (text: string, status = 200) =>
  new Response(text, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sha256(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
}

function bearer(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
}

async function createToken(req: Request) {
  const { data, error } = await admin.auth.getUser(bearer(req))
  if (error || !data.user) return json({ error: 'login' }, 401)
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const token = 'gw_' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const { error: saveError } = await admin
    .from('inbox_tokens')
    .upsert({ user_id: data.user.id, token_hash: await sha256(token), created_at: new Date().toISOString() })
  if (saveError) return json({ error: 'failed' }, 500)
  return json({ token })
}

async function receive(req: Request) {
  const token = bearer(req)
  if (!token.startsWith('gw_')) return json({ error: 'Fel nyckel. Skapa en ny i Groundwork → Vanor → Mina vanor.' }, 401)
  const { data: owner } = await admin.from('inbox_tokens').select('user_id').eq('token_hash', await sha256(token)).maybeSingle()
  if (!owner) return json({ error: 'Nyckeln gäller inte längre. Skapa en ny i Groundwork → Vanor → Mina vanor.' }, 401)

  const type = req.headers.get('content-type') ?? ''
  const body = type.includes('json') ? await req.json().catch(() => ({})) : { rader: await req.text() }
  const today = stockholmToday()

  // Från Siri: en enda sak med dag och tid i meningen
  if (typeof body?.sak === 'string') {
    const item = parseSpoken(body.sak.slice(0, 500), today)
    if (!item) return say('Jag hörde ingen uppgift. Försök igen.', 400)
    // Det du säger till Siri läggs alltid in, även om samma sak tagits bort tidigare (eget id varje gång)
    const added = await save(owner.user_id, [item], `-${Date.now().toString(36)}`)
    if (added < 0) return say('Det gick inte att spara. Försök igen.', 500)
    return say(confirmText(item, today, true))
  }

  const value = body?.rader ?? body?.text ?? ''
  const text = Array.isArray(value) ? value.join('\n') : String(value)
  if (text.length > 100_000) return json({ error: 'För mycket text på en gång.' }, 413)

  const items = parseLines(text, today)
  if (!items.length) return json({ added: 0, message: 'Inga nya påminnelser.' })
  const added = await save(owner.user_id, items)
  if (added < 0) return json({ error: 'Kunde inte spara. Försök igen.' }, 500)
  return json({ added, message: added ? `${added} ny${added === 1 ? '' : 'a'} i Groundwork.` : 'Inga nya påminnelser.' })
}

/** Lägger in saker under Att göra. Finns de redan rörs de inte. Svarar antal nya, eller -1 vid fel. */
async function save(userId: string, items: InboxItem[], idSuffix = ''): Promise<number> {
  const now = Date.now()
  const rows = await Promise.all(
    items.map(async (item, i) => {
      const id = (await itemId(item)) + idSuffix
      return { user_id: userId, store: 'tasks', id, data: { id, ...item, created: now + i }, deleted: false, client_ts: now }
    }),
  )
  const { data, error } = await admin
    .from('personal_records')
    .upsert(rows, { onConflict: 'user_id,store,id', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('inbox save', error)
    return -1
  }
  return data?.length ?? 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Använd POST.' }, 405)
  try {
    const action = new URL(req.url).searchParams.get('action')
    return action === 'token' ? await createToken(req) : await receive(req)
  } catch (e) {
    console.error('inbox', e)
    return json({ error: 'Något gick fel. Försök igen.' }, 500)
  }
})

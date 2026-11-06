// Inkorg för Vanor: tar emot påminnelser från iPhone-genvägen och lägger in dem under Att göra.
//
// - POST ?action=token  (inloggad i appen): skapar en personlig nyckel för genvägen. En ny nyckel
//   ersätter den gamla. Bara en hash av nyckeln sparas (tabellen inbox_tokens).
// - POST  (från genvägen, "Authorization: Bearer <nyckel>"): JSON { rader: "Titel | datum\n..." }.
//   Varje rad blir en sak att göra. Samma påminnelse läggs bara in en gång (se parse.ts).
// - POST  (från Siri-genvägen "Ny uppgift"): JSON { sak: "Ringa mamma imorgon klockan 18" }.
//   Dag och tid plockas ut ur meningen (spoken.ts). Svaret är en kort text som Siri läser upp.
// - POST  (från genvägen "Hälsa till Groundwork"): JSON { steg: "8 432", traning: "34 min", … }, valfritt datum.
//   Sparas som dagens hälsodata och bockar vanor vars regel är uppfylld (health.ts).
//
// - POST ?action=morgon  (från genvägen "Morgonbesked", samma nyckel): kort text om dagens Att göra,
//   vanor som måste göras idag och vad som bör göras först (morning.ts, samma ordning som Vanor).
//   Läser bara, ändrar inget.
//
// Funktionen kontrollerar själv vem som anropar (verify_jwt är av).

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { itemId, parseLines, stockholmToday, type InboxItem } from './parse.ts'
import { confirmText, parseSpoken } from './spoken.ts'
import { prioritizeToday } from './priority.ts'
import { morningText } from './morning.ts'
import { weekStart } from './dates.ts'
import type { Habit, Log } from './habits.ts'
import type { Task } from './tasks.ts'
import { FIELD_METRICS, formatHealth, isHealthBody, metRules, parseHealthBody, parseSleepStages, type AutoRule, type HealthDay, type RampInfo } from './health.ts'

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

/** Vem nyckeln i genvägen tillhör, eller ett felsvar. */
async function tokenOwner(req: Request): Promise<{ user_id: string } | Response> {
  const token = bearer(req)
  if (!token.startsWith('gw_')) return json({ error: 'Fel nyckel. Skapa en ny i Groundwork → Vanor → Mina vanor.' }, 401)
  const { data: owner } = await admin.from('inbox_tokens').select('user_id').eq('token_hash', await sha256(token)).maybeSingle()
  if (!owner) return json({ error: 'Nyckeln gäller inte längre. Skapa en ny i Groundwork → Vanor → Mina vanor.' }, 401)
  return owner
}

/** Morgonbeskedet. Läser vanor, bockningar den här veckan, pausdagar och Att göra. Skriver ingenting. */
async function morning(req: Request) {
  const owner = await tokenOwner(req)
  if (owner instanceof Response) return owner
  const today = stockholmToday()
  const [{ data: rows, error }, { data: checkRows, error: checkError }] = await Promise.all([
    admin
      .from('personal_records')
      .select('store, data')
      .eq('user_id', owner.user_id)
      .in('store', ['habits', 'pauses', 'tasks'])
      .eq('deleted', false)
      .limit(5000),
    // Bara veckans bockar behövs för att räkna veckomålen och dagens måsten.
    admin
      .from('personal_records')
      .select('data')
      .eq('user_id', owner.user_id)
      .eq('store', 'checks')
      .eq('deleted', false)
      .gte('data->>date', weekStart(today))
      .limit(5000),
  ])
  if (error || checkError) {
    console.error('inbox morgon', error ?? checkError)
    return say('Det gick inte att hämta morgonbeskedet just nu. Försök igen.', 500)
  }
  const of = <T>(store: string) => (rows ?? []).filter((r) => r.store === store && r.data).map((r) => r.data as T)
  const habits = of<Habit>('habits').sort((a, b) => a.order - b.order)
  const paused = new Set(of<{ date: string }>('pauses').map((p) => p.date))
  const log: Log = {}
  for (const r of checkRows ?? []) {
    const c = r.data as { date: string; habitId: string } | null
    if (c) (log[c.date] ??= []).push(c.habitId)
  }
  return say(morningText(prioritizeToday(habits, log, paused, of<Task>('tasks'), today), today))
}

async function receive(req: Request) {
  const owner = await tokenOwner(req)
  if (owner instanceof Response) return owner

  const type = req.headers.get('content-type') ?? ''
  const body = type.includes('json') ? await req.json().catch(() => ({})) : { rader: await req.text() }
  const today = stockholmToday()

  // Från Apple Hälsa: dagens siffror, och vanor som bockas automatiskt
  if (body && typeof body === 'object' && isHealthBody(body)) return say(await saveHealth(owner.user_id, body, today))

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

/** Sparar dagens hälsodata (slås ihop med det som redan finns den dagen) och bockar vanor med uppfylld regel. */
async function saveHealth(userId: string, body: Record<string, unknown>, today: string): Promise<string> {
  const date = typeof body.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.datum.trim()) ? body.datum.trim() : today
  const values = parseHealthBody(body)
  if (!Object.keys(values).length) return 'Inga siffror kom fram från Hälsa. Kontrollera genvägen.'

  const { data: existing } = await admin
    .from('personal_records')
    .select('data, deleted')
    .eq('user_id', userId)
    .eq('store', 'health')
    .eq('id', date)
    .maybeSingle()
  const old = existing && !existing.deleted ? (existing.data as HealthDay | null) : null
  const before = old?.values ?? {}
  const stages = 'somn' in body ? parseSleepStages(body.somn) : []
  const day: HealthDay = { date, updated: Date.now(), values: { ...before, ...values } }
  // Faserna för sömndiagrammet: nya om de kom med, annars behålls de som redan finns
  const keep = stages.length ? stages : old?.stages
  if (keep?.length) day.stages = keep
  const { error } = await admin
    .from('personal_records')
    .upsert({ user_id: userId, store: 'health', id: date, data: day, deleted: false, client_ts: day.updated }, { onConflict: 'user_id,store,id' })
  if (error) {
    console.error('inbox health', error)
    return 'Det gick inte att spara hälsodatan. Försök igen.'
  }

  // Vanor med regel: lägg till dagens bock om den inte redan finns. En bock du tagit bort själv kommer inte tillbaka.
  const { data: habitRows } = await admin
    .from('personal_records')
    .select('data')
    .eq('user_id', userId)
    .eq('store', 'habits')
    .eq('deleted', false)
    .limit(500)
  const habits = (habitRows ?? []).map(
    (r) => r.data as { id: string; name: string; archived?: boolean; created?: string; minimum?: string; auto?: AutoRule; ramp?: RampInfo },
  )
  // Regler som följer ökningen behöver veta hur många dagar som gjorts i ökningen före idag
  const following = habits.filter((h) => h.auto?.follow && h.ramp)
  const doneCount = new Map<string, number>()
  if (following.length) {
    const earliest = following.reduce((min, h) => (h.ramp!.start < min ? h.ramp!.start : min), date)
    const { data: past } = await admin
      .from('personal_records')
      .select('data')
      .eq('user_id', userId)
      .eq('store', 'checks')
      .eq('deleted', false)
      .in('data->>habitId', following.map((h) => h.id))
      .gte('data->>date', earliest)
      .lt('data->>date', date)
      .limit(5000)
    for (const row of past ?? []) {
      const c = row.data as { habitId: string; date: string }
      const h = following.find((x) => x.id === c.habitId)
      if (h && c.date >= h.ramp!.start) doneCount.set(c.habitId, (doneCount.get(c.habitId) ?? 0) + 1)
    }
  }
  const met = metRules(habits, day.values, date, (id) => doneCount.get(id) ?? 0)
  let checked: string[] = []
  if (met.length) {
    const now = Date.now()
    const rows = met.map(({ id: habitId, min }) => {
      const key = `${date}|${habitId}`
      const data = min ? { key, date, habitId, min: true } : { key, date, habitId }
      return { user_id: userId, store: 'checks', id: key, data, deleted: false, client_ts: now }
    })
    const { data: inserted } = await admin
      .from('personal_records')
      .upsert(rows, { onConflict: 'user_id,store,id', ignoreDuplicates: true })
      .select('id')
    const newIds = new Set((inserted ?? []).map((r) => String(r.id).split('|')[1]))
    checked = habits.filter((h) => newIds.has(h.id)).map((h) => h.name)
  }

  const shown = FIELD_METRICS.filter((m) => values[m] !== undefined).map((m) => formatHealth(m, values[m]!))
  return `Hälsa sparad: ${shown.join(' · ')}.${checked.length ? ` Bockat: ${checked.join(', ')}.` : ''}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Använd POST.' }, 405)
  try {
    const action = new URL(req.url).searchParams.get('action')
    if (action === 'token') return await createToken(req)
    if (action === 'morgon') return await morning(req)
    return await receive(req)
  } catch (e) {
    console.error('inbox', e)
    return json({ error: 'Något gick fel. Försök igen.' }, 500)
  }
})

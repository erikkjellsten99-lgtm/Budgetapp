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
// - POST ?action=lasnyckel  (inloggad i appen): skapar en läsnyckel (gr_…) för Jarvis och "Fråga Groundwork".
//   Den kan bara läsa sammanfattningen, inte lägga in något. Bara en hash sparas (tabellen read_tokens).
// - POST ?action=sammanfattning  (med läsnyckeln): hela Groundwork som text med exakta siffror
//   (summary.ts, samma uträkningar som appen). Läser bara, ändrar inget.
// - POST ?action=fraga  (med läsnyckeln): JSON { fraga: "Hur sov jag i natt?" }. Kort svar med exakta siffror
//   för Siri, utan AI (ask.ts). Förstår den inte frågan säger den det och ger tre exempel. Läser bara.
// - GET ?action=nyheter (ingen nyckel): nyheter om ekonomi, krig, fotboll och Sverige från SVT:s RSS,
//   med ton positiv/negativ/neutral bedömd med ordlistor (news.ts). Sparas 10 minuter i minnet.
// - GET ?action=kurssok&q=…  (inloggad i appen): söker aktier, fonder och ETF:er hos Yahoo Finance (prices.ts).
// - POST ?action=kurser  (inloggad i appen): JSON { tickers: [{ ticker, from }] }. Hämtar dagskurser i kronor från
//   senast sparade dag (eller `from`) och sparar dem i tabellen prices. Svar: { updated: { ticker: antal }, failed: [ticker] }.
//
// Funktionen kontrollerar själv vem som anropar (verify_jwt är av).

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { itemId, parseLines, stockholmToday, type InboxItem } from './parse.ts'
import { confirmText, parseSpoken } from './spoken.ts'
import { prioritizeToday } from './priority.ts'
import { morningText } from './morning.ts'
import { addDays, weekStart } from './dates.ts'
import { summaryFacts, summaryText, type SummaryInput } from './summary.ts'
import { answer } from './ask.ts'
import { fetchChart, fetchStart, isRealDay, normalizeCurrency, rowsToUpsert, search, toSek } from './prices.ts'
import { FEEDS, loadNews, type NewsResult } from './news.ts'
import { monthPlans } from './months.ts'
import { MAX_MONTHS } from './goalPlan.ts'
import type { Loan } from './forecast.ts'
import type { Asset, Category, Holding, MonthBudget, MonthlyIncome, PricePoint, SavingsGoal, Trade, Wish } from './types.ts'
import type { Habit, Log } from './habits.ts'
import type { Task } from './tasks.ts'
import { FIELD_METRICS, formatHealth, isHealthBody, metRules, parseHealthBody, parseSleepStages, type AutoRule, type HealthDay, type RampInfo } from './health.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/** Skapar en ny nyckel för den inloggade (gw_ i inbox_tokens, eller gr_ = bara läsa i read_tokens). Ersätter den gamla. */
async function createToken(req: Request, kind: 'inbox' | 'read' = 'inbox') {
  const { data, error } = await admin.auth.getUser(bearer(req))
  if (error || !data.user) return json({ error: 'login' }, 401)
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const prefix = kind === 'read' ? 'gr_' : 'gw_'
  const token = prefix + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const { error: saveError } = await admin
    .from(kind === 'read' ? 'read_tokens' : 'inbox_tokens')
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

/** Vem läsnyckeln tillhör, eller ett felsvar. Den vanliga nyckeln (gw_) räcker inte för ekonomin. */
async function readOwner(req: Request): Promise<{ user_id: string } | Response> {
  const token = bearer(req)
  if (token.startsWith('gw_')) return say('Sammanfattningen kräver läsnyckeln. Skapa den i Groundwork → Vanor → Mina vanor → Läsnyckel.', 401)
  if (!token.startsWith('gr_')) return say('Fel nyckel. Skapa en läsnyckel i Groundwork → Vanor → Mina vanor.', 401)
  const { data: owner } = await admin.from('read_tokens').select('user_id').eq('token_hash', await sha256(token)).maybeSingle()
  if (!owner) return say('Läsnyckeln gäller inte längre. Skapa en ny i Groundwork → Vanor → Mina vanor.', 401)
  return owner
}

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

/** Kurser per ticker i datumordning. Går det inte att läsa dem räknas innehaven utan värde, sammanfattningen faller inte. */
async function loadPrices(tickers: string[]): Promise<Record<string, PricePoint[]>> {
  const out: Record<string, PricePoint[]> = {}
  if (tickers.length === 0) return out
  try {
    const rows = await allRows<{ ticker: string; date: string; close_sek: number | string }>((from, to) =>
      admin.from('prices').select('ticker,date,close_sek').in('ticker', tickers).order('date').order('ticker').range(from, to),
    )
    for (const r of rows) (out[r.ticker] ??= []).push({ date: r.date, close: Number(r.close_sek) })
    return out
  } catch {
    return {}
  }
}

/**
 * Sammanfattningen. Läser hushållets ekonomi (records) och dina egna vanor, Att göra och hälsa
 * (personal_records), och räknar med samma kod som appen. Skriver ingenting.
 */
async function summaryInput(userId: string): Promise<SummaryInput | Response> {
  const today = stockholmToday()
  const { data: member } = await admin.from('household_members').select('household_id').eq('user_id', userId).maybeSingle()
  if (!member) return say('Du är inte med i något hushåll i Groundwork än. Logga in i appen först.', 404)
  const owner = { user_id: userId }

  const [economy, mine, checkRows] = await Promise.all([
    allRows<{ store: string; data: unknown }>((from, to) =>
      admin.from('records').select('store, data').eq('household_id', member.household_id).eq('deleted', false).order('id').range(from, to),
    ),
    allRows<{ store: string; data: unknown }>((from, to) =>
      admin
        .from('personal_records')
        .select('store, data')
        .eq('user_id', owner.user_id)
        .in('store', ['habits', 'pauses', 'tasks', 'health'])
        .eq('deleted', false)
        .order('id')
        .range(from, to),
    ),
    allRows<{ data: unknown }>((from, to) =>
      admin
        .from('personal_records')
        .select('data')
        .eq('user_id', owner.user_id)
        .eq('store', 'checks')
        .eq('deleted', false)
        .gte('data->>date', weekStart(today))
        .order('id')
        .range(from, to),
    ),
  ])
  const pick = <T>(rows: { store: string; data: unknown }[], store: string) =>
    rows.filter((r) => r.store === store && r.data).map((r) => r.data as T)
  const byMonth = <T extends { month: string }>(list: T[]) => [...list].sort((a, b) => a.month.localeCompare(b.month))

  // Budget och inkomst från innevarande månad och 40 år framåt, som i appen (db.ts → months.ts).
  const month = today.slice(0, 7)
  const plans = monthPlans(
    byMonth(pick<MonthBudget>(economy, 'budgets')),
    byMonth(pick<MonthlyIncome>(economy, 'income')),
    pick<Category>(economy, 'categories'),
    month,
    MAX_MONTHS + 1,
  )
  const holdings = pick<Holding>(economy, 'holdings')
  const prices = await loadPrices([...new Set(holdings.flatMap((h) => (h.ticker ? [h.ticker] : [])))])
  const habits = pick<Habit>(mine, 'habits').sort((a, b) => a.order - b.order)
  const tasks = pick<Task>(mine, 'tasks')
  const paused = new Set(pick<{ date: string }>(mine, 'pauses').map((x) => x.date))
  const log: Log = {}
  for (const r of checkRows) {
    const c = r.data as { date: string; habitId: string } | null
    if (c) (log[c.date] ??= []).push(c.habitId)
  }
  const health = pick<HealthDay>(mine, 'health').filter((d) => d.date >= addDays(today, -1))

  return {
    today,
    plans,
    assets: pick<Asset>(economy, 'assets'),
    holdings,
    trades: pick<Trade>(economy, 'trades'),
    prices,
    goal: pick<SavingsGoal>(economy, 'goals')[0] ?? null,
    loan: pick<Loan>(economy, 'loans')[0] ?? null,
    wishes: pick<Wish>(economy, 'wishes'),
    priority: prioritizeToday(habits, log, paused, tasks, today),
    tasks,
    health,
  }
}

/** Sammanfattningen som text (med läsnyckeln). */
async function summary(req: Request) {
  const owner = await readOwner(req)
  if (owner instanceof Response) return owner
  const input = await summaryInput(owner.user_id)
  return input instanceof Response ? input : say(summaryText(input))
}

/** "Fråga Groundwork": ett kort svar på en fråga, utan AI (med läsnyckeln). */
async function ask(req: Request) {
  const owner = await readOwner(req)
  if (owner instanceof Response) return owner
  const type = req.headers.get('content-type') ?? ''
  const body = type.includes('json') ? await req.json().catch(() => ({})) : { fraga: await req.text() }
  const question = String(body?.fraga ?? body?.text ?? '').slice(0, 300)
  const input = await summaryInput(owner.user_id)
  return input instanceof Response ? input : say(answer(question, summaryFacts(input)))
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

// Nyheterna sparas en stund i minnet, så att flödena inte hämtas vid varje öppning av appen.
const NEWS_TTL = 10 * 60 * 1000
let newsCache: NewsResult | null = null

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'Groundwork/1.0 (RSS)' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${res.status}`)
  return await res.text()
}

/** Nyheter i fyra ämnen med ton (news.ts). Öppna RSS-flöden, inget konto behövs, läser bara. */
async function news() {
  if (!newsCache || Date.now() - newsCache.updated > NEWS_TTL || newsCache.missing.length === FEEDS.length) {
    const fresh = await loadNews(fetchFeed)
    console.log('nyheter', JSON.stringify({ antal: fresh.items.length, saknas: fresh.missing }))
    // Gick alla flöden fel: behåll de gamla nyheterna hellre än att visa inga.
    if (fresh.items.length || !newsCache) newsCache = fresh
  }
  return json(newsCache)
}

const TICKER = /^[A-Za-z0-9.\-=^]{1,20}$/
// Funktionen får köra högst ~150 s, så nya symboler startas inte efter 100 s.
const PRICE_POOL = 5
const PRICE_DEADLINE_MS = 100_000

/** Sök innehav hos Yahoo. Kräver inloggning i appen. */
async function priceSearch(req: Request) {
  const { data, error } = await admin.auth.getUser(bearer(req))
  if (error || !data.user) return json({ error: 'login' }, 401)
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (!q || q.length > 60) return json({ error: 'q' }, 400)
  return json({ results: await search(q) })
}

/** Hämtar och sparar dagskurser i kronor. En symbol som misslyckas hamnar i `failed` och stoppar inte de andra. */
async function updatePrices(req: Request) {
  const { data, error } = await admin.auth.getUser(bearer(req))
  if (error || !data.user) return json({ error: 'login' }, 401)
  const body = await req.json().catch(() => null)
  const list: unknown = body?.tickers
  if (!Array.isArray(list) || list.length > 50) return json({ error: 'tickers' }, 400)
  const wanted: { ticker: string; from: string }[] = []
  for (const w of list) {
    if (typeof w?.ticker !== 'string' || !TICKER.test(w.ticker) || !isRealDay(w?.from)) {
      return json({ error: 'tickers' }, 400)
    }
    wanted.push({ ticker: w.ticker, from: w.from })
  }
  const updated: Record<string, number> = {}
  const failed: string[] = []
  const deadline = Date.now() + PRICE_DEADLINE_MS
  const queue = [...wanted]
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { ticker, from } = next
      // Tiden är slut: resten får vänta till nästa uppdatering.
      if (Date.now() > deadline) { failed.push(ticker); continue }
      try {
        const [first, last] = await Promise.all([
          admin.from('prices').select('date').eq('ticker', ticker).order('date', { ascending: true }).limit(1),
          admin.from('prices').select('date').eq('ticker', ticker).order('date', { ascending: false }).limit(1),
        ])
        if (first.error) throw first.error
        if (last.error) throw last.error
        const start = fetchStart(first.data?.[0]?.date ?? null, last.data?.[0]?.date ?? null, from)
        const chart = await fetchChart(ticker, start)
        if (!chart) throw new Error('ingen kurs')
        // Pence och liknande räknas om till huvudvalutan; en okänd valutakod gör att symbolen misslyckas.
        const unit = normalizeCurrency(chart.currency)
        if (!unit) throw new Error(`okänd valuta ${chart.currency}`)
        const fx = unit.currency === 'SEK' ? null : await fetchChart(`${unit.currency}SEK=X`, start)
        if (unit.currency !== 'SEK' && !fx) throw new Error('ingen valutakurs')
        const rows = rowsToUpsert(ticker, toSek(chart.points, fx?.points ?? null, unit.currency, unit.divisor))
        if (rows.length) {
          const { error: saveError } = await admin.from('prices').upsert(rows, { onConflict: 'ticker,date' })
          if (saveError) throw saveError
        }
        updated[ticker] = rows.length
      } catch (e) {
        console.error('kurser', ticker, e)
        failed.push(ticker)
      }
    }
  }
  await Promise.all(Array.from({ length: PRICE_POOL }, worker))
  return json({ updated, failed })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const action = new URL(req.url).searchParams.get('action')
  if (action === 'nyheter' && req.method === 'GET') return await news().catch(() => json({ error: 'Nyheterna gick inte att hämta.' }, 502))
  if (action === 'kurssok' && req.method === 'GET') return await priceSearch(req).catch(() => json({ error: 'Sökningen gick inte att göra.' }, 502))
  if (req.method !== 'POST') return json({ error: 'Använd POST.' }, 405)
  try {
    if (action === 'token') return await createToken(req)
    if (action === 'morgon') return await morning(req)
    if (action === 'lasnyckel') return await createToken(req, 'read')
    if (action === 'sammanfattning') return await summary(req)
    if (action === 'fraga') return await ask(req)
    if (action === 'nyheter') return await news()
    if (action === 'kurser') return await updatePrices(req)
    return await receive(req)
  } catch (e) {
    console.error('inbox', e)
    return json({ error: 'Något gick fel. Försök igen.' }, 500)
  }
})

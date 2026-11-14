// Kunskap, generering: gör nya kort åt dem som slagit på det i appen (Kunskap → Inställningar). Frågar Claude
// (Anthropic API) med webbsökning, kontrollerar det som kommer tillbaka (generate.ts) och sparar korten och
// kostnaden i personal_records, så att de synkas till appen som allt annat i Kunskap.
//
// Två sätt att anropa (POST):
// - Schemat (pg_cron, en gång per dygn): rubriken "x-cron-secret" med hemligheten ur Vault (kunskap_cron_secret).
//   Kör alla som har Varje dag eller Varje vecka och står på tur (isDue).
// - Appen ("Generera nu"): "Authorization: Bearer <JWT>". Kör en batch åt den inloggade.
// Svar: { batches: [{ id, status, cards, costUsd }] }. Fel: { error, message }.
//
// Skydd mot kostnad: utan sparad inställning genereras ingenting, högst MAX_BATCHES_PER_DAY batchar per person
// och dygn, högst COUNT_MAX kort per batch och ett tak på antal webbsökningar. Varje batch loggas med token,
// sökningar och kostnad i USD (kunskap_batches), även när den misslyckas.
//
// verify_jwt ska vara AV (schemat har ingen JWT; funktionen kontrollerar själv). Hemlighet: ANTHROPIC_API_KEY
// (samma som Jarvis). Schemats hemlighet skapas av migrationen och läses med kunskap_cron_secret().
// Läggs bara ut efter att Erik skrivit "Lägg ut".

import { checkCards, collectSources, MODEL, SAVE_TOOL, systemPrompt, userPrompt, type Person } from './generate.ts'
import { admin, ask, CORS, errorText, fail, json, loadRows, pageText, save, type Row } from './server.ts'
import {
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
  type VoteRow,
  weights,
} from './shared.ts'

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
    const prompt = userPrompt(people, settings.count, discovery, taste, existing, new Date().toISOString().slice(0, 10))
    const { input, blocks } = await ask(systemPrompt(), prompt, SAVE_TOOL, Math.min(12, settings.count + 3), usage)
    const checked = await checkCards(input, people, collectSources(blocks), new Set(existing.map((c) => c.id)), settings.count, pageText, now, batch.id, discovery)
    await save(userId, 'kunskap_cards', checked.cards)
    Object.assign(batch, { status: 'klar', cards: checked.cards.length, quotesVerified: checked.quotesVerified, quotesRewritten: checked.quotesRewritten, dropped: checked.dropped, discovery: checked.discovery })
  } catch (error) {
    batch.status = 'fel'
    batch.error = errorText(error)
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

// Kunskap, presentation: skriver en kort text om en person som användaren själv lagt till i biblioteket.
// Frågar Claude (Anthropic API) med webbsökning och sparar texten på personens post i kunskap_people.
//
// POST { person: "<id i kunskap_people>" } med appens inloggning ("Authorization: Bearer <JWT>").
// Svar: { batches: [{ id, status, cards: 0, costUsd }] }. Fel: { error, message }.
//
// - Bara på användarens tryckning, aldrig på schema. Högst MAX_PROFILES_PER_DAY per person och dygn.
// - Texten kastas om den saknar en källa som finns bland webbsökningens resultat (toProfile i generate.ts).
// - Kostnaden loggas som en batch med trigger "profil" (kunskap_batches), även när det misslyckas.
//
// Egen funktion, skild från kunskap-generera, så att ett anrop aldrig kan starta en batch med kort av misstag.
// Importerar filer från ../kunskap-generera, så de måste följa med vid utläggning.
// verify_jwt ska vara på. Läggs bara ut efter att Erik skrivit "Lägg ut".

import { collectSources, MODEL, PROFILE_TOOL, profileSystemPrompt, profileUserPrompt, toProfile, type Person } from '../kunskap-generera/generate.ts'
import { admin, ask, CORS, errorText, fail, json, loadRows, save, type Row } from '../kunskap-generera/server.ts'
import { costUsd, MAX_PROFILES_PER_DAY, NO_USAGE, profilesLastDay, type Batch } from '../kunskap-generera/shared.ts'

/**
 * Skriver en presentation av en person användaren följer och sparar den på personens post. Loggas som en batch
 * utan kort, så att kostnaden syns. Posten ändras bara om personen fortfarande följs.
 */
async function runProfile(userId: string, row: Row): Promise<Batch> {
  const data = row.data as { name?: unknown; topics?: unknown }
  const person: Person = { name: String(data.name ?? ''), topics: Array.isArray(data.topics) ? data.topics.map(String) : [] }
  const now = Date.now()
  const batch: Batch = {
    id: `b-${now.toString(36)}`,
    created: now,
    status: 'pagar',
    trigger: 'profil',
    person: person.name.slice(0, 80),
    requested: 0,
    cards: 0,
    quotesVerified: 0,
    quotesRewritten: 0,
    dropped: 0,
    model: MODEL,
    usage: NO_USAGE,
    costUsd: 0,
  }
  await save(userId, 'kunskap_batches', [batch])
  const usage = { total: NO_USAGE }
  try {
    const { input, blocks } = await ask(profileSystemPrompt(), profileUserPrompt(person), PROFILE_TOOL, 4, usage)
    const profile = toProfile(input, collectSources(blocks), now)
    if (!profile) throw new Error('Ingen presentation med källa gick att skriva.')
    const { error } = await admin
      .from('personal_records')
      .update({ data: { ...(row.data as object), profile }, client_ts: Date.now() })
      .eq('user_id', userId)
      .eq('store', 'kunskap_people')
      .eq('id', row.id)
      .eq('deleted', false)
    if (error) throw error
    batch.status = 'klar'
  } catch (error) {
    batch.status = 'fel'
    batch.error = errorText(error)
    console.error('kunskap-presentation: misslyckades', batch.id, batch.error)
  }
  batch.usage = usage.total
  batch.costUsd = costUsd(usage.total)
  await save(userId, 'kunskap_batches', [batch])
  console.log('kunskap-presentation: klar', JSON.stringify({ id: batch.id, status: batch.status, usage: batch.usage, costUsd: batch.costUsd }))
  return batch
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'metod', 'Anropa med POST.')

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: null }
    if (!auth?.user) return fail(401, 'utloggad', 'Logga in i Groundwork först.')

    const body = (await req.json().catch(() => null)) as { person?: unknown } | null
    if (typeof body?.person !== 'string' || !body.person) return fail(400, 'person', 'Ange vilken person presentationen gäller.')

    const rows = await loadRows(auth.user.id)
    const row = rows.find((r) => r.store === 'kunskap_people' && r.id === body.person)
    if (!row) return fail(404, 'person', 'Personen finns inte på kontot än. Vänta några sekunder och försök igen.')
    const batches = rows.filter((r) => r.store === 'kunskap_batches').map((r) => r.data as Batch)
    if (profilesLastDay(batches, Date.now()) >= MAX_PROFILES_PER_DAY) {
      return fail(429, 'grans', `Högst ${MAX_PROFILES_PER_DAY} presentationer per dygn. Försök igen i morgon.`)
    }
    const done = await runProfile(auth.user.id, row)
    return done.status === 'klar'
      ? json({ batches: [{ id: done.id, status: done.status, cards: 0, costUsd: done.costUsd }] })
      : fail(502, 'fel', done.error ?? 'Presentationen misslyckades.')
  } catch (error) {
    console.error('kunskap-presentation: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Något gick fel. Försök igen.')
  }
})

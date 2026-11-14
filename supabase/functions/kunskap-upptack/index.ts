// Kunskap, Upptäck: söker efter personer att följa inom en genre som användaren skriver. Frågar Claude
// (Anthropic API) med webbsökning och svarar med personerna. Appen sparar dem; den här funktionen skriver bara
// kostnadsraden.
//
// POST { genre: "framgång", exclude?: ["Namn", …] } med appens inloggning ("Authorization: Bearer <JWT>").
// `exclude` är personer appen redan visar (biblioteket och katalogen), så att de inte föreslås igen.
// Svar: { people: [{ name, about, topics, genre, source: { title, url }, created }], costUsd }.
// Fel: { error, message }.
//
// - Bara på användarens tryckning. Högst MAX_SEARCHES_PER_DAY sökningar per person och dygn.
// - En person kastas om den saknar en källa som finns bland webbsökningens resultat (toFound i generate.ts).
// - Kostnaden loggas som en batch med trigger "profil" och search: true (kunskap_batches), även när det misslyckas.
//
// Egen funktion, skild från kunskap-generera, så att ett anrop aldrig kan starta en batch med kort av misstag.
// Importerar filer från ../kunskap-generera, så de måste följa med vid utläggning.
// verify_jwt ska vara på. Läggs bara ut efter att Erik skrivit "Lägg ut".

import { collectSources, FIND_TOOL, findSystemPrompt, findUserPrompt, MODEL, toFound } from '../kunskap-generera/generate.ts'
import { admin, ask, CORS, errorText, fail, json, loadRows, save } from '../kunskap-generera/server.ts'
import {
  cleanPrefs,
  costUsd,
  GENRE_MAX,
  MAX_SEARCHES_PER_DAY,
  NO_USAGE,
  searchesLastDay,
  type Batch,
  type FoundPerson,
  type VoteRow,
  weights,
} from '../kunskap-generera/shared.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'metod', 'Anropa med POST.')

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: null }
    if (!auth?.user) return fail(401, 'utloggad', 'Logga in i Groundwork först.')
    const userId = auth.user.id

    const body = (await req.json().catch(() => null)) as { genre?: unknown; exclude?: unknown } | null
    const genre = typeof body?.genre === 'string' ? body.genre.trim().replace(/\s+/g, ' ').slice(0, GENRE_MAX).trim() : ''
    if (genre.length < 2) return fail(400, 'genre', 'Skriv vad du vill hitta, till exempel en genre.')
    const exclude = (Array.isArray(body?.exclude) ? body.exclude : []).filter((n): n is string => typeof n === 'string').slice(0, 150)

    const rows = await loadRows(userId)
    const of = <T>(store: string) => rows.filter((r) => r.store === store && r.data).map((r) => r.data as T)
    const batches = of<Batch>('kunskap_batches')
    if (searchesLastDay(batches, Date.now()) >= MAX_SEARCHES_PER_DAY) {
      return fail(429, 'grans', `Högst ${MAX_SEARCHES_PER_DAY} sökningar per dygn. Försök igen i morgon.`)
    }

    const people = of<{ name?: unknown; topics?: unknown }>('kunskap_people')
      .map((p) => ({ name: String(p.name ?? ''), topics: Array.isArray(p.topics) ? p.topics.map(String) : [] }))
      .filter((p) => p.name)
    const prefs = rows.find((r) => r.store === 'kunskap_settings' && r.id === 'prefs')?.data
    const taste = weights(of<VoteRow>('kunskap_votes'), cleanPrefs(prefs), people.flatMap((p) => [{ kind: 'person' as const, label: p.name }, ...p.topics.map((t) => ({ kind: 'topic' as const, label: t }))]))
    const have = [...people.map((p) => p.name), ...exclude]

    const now = Date.now()
    const batch: Batch = {
      id: `b-${now.toString(36)}`,
      created: now,
      status: 'pagar',
      trigger: 'profil',
      search: true,
      person: genre,
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
    let found: FoundPerson[] = []
    try {
      const { input, blocks } = await ask(findSystemPrompt(), findUserPrompt(genre, taste, have), FIND_TOOL, 5, usage)
      found = toFound(input, collectSources(blocks), have, genre, now)
      if (found.length === 0) throw new Error('Hittade ingen med källa som passar.')
      batch.status = 'klar'
    } catch (error) {
      batch.status = 'fel'
      batch.error = errorText(error)
      console.error('kunskap-upptack: misslyckades', batch.id, batch.error)
    }
    batch.usage = usage.total
    batch.costUsd = costUsd(usage.total)
    await save(userId, 'kunskap_batches', [batch])
    console.log('kunskap-upptack: klar', JSON.stringify({ id: batch.id, status: batch.status, people: found.length, usage: batch.usage, costUsd: batch.costUsd }))
    return batch.status === 'klar' ? json({ people: found, costUsd: batch.costUsd }) : fail(502, 'fel', batch.error ?? 'Sökningen misslyckades.')
  } catch (error) {
    console.error('kunskap-upptack: oväntat fel', error instanceof Error ? error.message : error)
    return fail(500, 'fel', 'Något gick fel. Försök igen.')
  }
})

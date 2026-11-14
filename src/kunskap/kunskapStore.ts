// Kunskap: läser och sparar personer och röster. Lagringen delas med Vanor (samma lokala databas och samma
// privata synk till kontot, tabellen personal_records), så allt fungerar utan nät och synkas när det går.

import { useEffect, useState } from 'react';
import { deleteKunskapRecord, getMeta, loadKunskapRecords, newId, onHabitChange, saveKunskapRecord } from '../vanor/store';
import { supabase } from '../sync';
import { syncHabits } from '../vanor/sync';
import { cleanPrefs, cleanSettings, DEFAULT_SETTINGS, NO_PREFS, type Batch, type KunskapPrefs, type KunskapSettings } from '../../supabase/functions/kunskap-generera/shared.ts';
import { SUGGESTED, type KunskapCard } from './cards';
import { cleanName, isFollowed, nextVote, parseTopics, type FollowedPerson, type Vote } from './kunskapState';

export interface KunskapData {
  people: FollowedPerson[];
  votes: Vote[];
  /** Genererade kort, skrivna av servern. */
  cards: KunskapCard[];
  settings: KunskapSettings;
  /** Det du själv ändrat i "Vad Claude tror du gillar". */
  prefs: KunskapPrefs;
  /** Kostnadsloggen, skriven av servern. */
  batches: Batch[];
}

export async function loadKunskap(): Promise<KunskapData> {
  const [people, votes, cards, settings, batches] = await Promise.all([
    loadKunskapRecords<FollowedPerson>('kunskap_people'),
    loadKunskapRecords<Vote>('kunskap_votes'),
    loadKunskapRecords<KunskapCard>('kunskap_cards'),
    loadKunskapRecords<{ id?: string }>('kunskap_settings'),
    loadKunskapRecords<Batch>('kunskap_batches'),
  ]);
  people.sort((a, b) => a.created - b.created);
  // Inställningen och smaken ligger i samma store, med olika id.
  const saved = settings.find((r) => r.id === 'settings');
  const prefs = settings.find((r) => r.id === 'prefs');
  return { people, votes, cards, settings: saved ? cleanSettings(saved) : DEFAULT_SETTINGS, prefs: prefs ? cleanPrefs(prefs) : NO_PREFS, batches };
}

/** Sparar hur ofta kort ska genereras och hur många. Synkas till kontot, där servern läser det. */
export const saveSettings = (settings: Pick<KunskapSettings, 'frequency' | 'count'>) => saveKunskapRecord('kunskap_settings', cleanSettings(settings));

/** Sparar det du själv ställt in om vad du gillar. Synkas till kontot, där servern läser det vid nästa generering. */
export const savePrefs = (prefs: KunskapPrefs) => saveKunskapRecord('kunskap_settings', cleanPrefs(prefs));

export type GenerateReply = { ok: true; cards: number; costUsd: number } | { ok: false; message: string };

/** Svaret från kunskap-generera tolkat. Egen funktion så att den kan testas utan nätverk. */
export function readGenerateReply(status: number, body: unknown): GenerateReply {
  const b = (body ?? {}) as { batches?: { cards?: unknown; costUsd?: unknown }[]; message?: unknown };
  const batch = Array.isArray(b.batches) ? b.batches[0] : undefined;
  if (status >= 200 && status < 300 && batch) return { ok: true, cards: Number(batch.cards) || 0, costUsd: Number(batch.costUsd) || 0 };
  if (status === 401) return { ok: false, message: 'Logga in under Konto först. Genereringen körs på ditt konto.' };
  if (status === 404) return { ok: false, message: 'Det här är inte påslaget på servern än.' };
  return { ok: false, message: typeof b.message === 'string' && b.message.trim() ? b.message.trim() : 'Genereringen misslyckades. Försök igen.' };
}

/** Kör en batch nu, på servern. Tar upp till ett par minuter. Kastar aldrig. */
export const generateNow = () => callGenerate('kunskap-generera', {});

/** Ber servern skriva en presentation av en person du följer. Tar upp till en minut. Kastar aldrig. */
export const writeProfile = (personId: string) => callGenerate('kunskap-presentation', { person: personId });

async function callGenerate(name: 'kunskap-generera' | 'kunskap-presentation', body: { person?: string }): Promise<GenerateReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, message: 'Du är inte uppkopplad.' };
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return readGenerateReply(401, null);
    // Servern läser personerna och inställningen från kontot: skicka upp det som ändrats här först.
    await syncHabits();
    const { data, error, response } = await supabase.functions.invoke(name, { body });
    const reply = !error ? readGenerateReply(200, data) : response ? readGenerateReply(response.status, await response.json().catch(() => null)) : readGenerateReply(0, null);
    // Hämta det nya (kort, presentation, kostnadsrad) innan svaret visas.
    await syncHabits();
    return reply;
  } catch {
    return readGenerateReply(0, null);
  }
}

/** Börja följa en person. Ger false om namnet är tomt eller personen redan följs. */
export async function follow(name: string, topics: string | string[]): Promise<boolean> {
  const clean = cleanName(name);
  if (!clean) return false;
  const { people } = await loadKunskap();
  if (isFollowed(people, clean)) return false;
  const person: FollowedPerson = { id: newId(), name: clean, topics: parseTopics(Array.isArray(topics) ? topics.join(',') : topics), created: Date.now() };
  await saveKunskapRecord('kunskap_people', person);
  return true;
}

export const unfollow = (id: string) => deleteKunskapRecord('kunskap_people', id);

/**
 * Följer alla personer i biblioteket (Lär) som inte lagts till förut, så att de finns i flödet och får nya kort.
 * Vilka som lagts till sparas i posten "library" i kunskap_settings: den du själv tar bort kommer inte tillbaka,
 * men en ny person i biblioteket läggs till en gång. Id:t är fast per person, så att två telefoner inte får dubbletter.
 * Ger antalet nya.
 */
export async function followLibrary(): Promise<number> {
  const [people, records] = await Promise.all([
    loadKunskapRecords<FollowedPerson>('kunskap_people'),
    loadKunskapRecords<{ id?: string; seeded?: unknown }>('kunskap_settings'),
  ]);
  const saved = records.find((r) => r.id === 'library')?.seeded;
  const seeded = new Set(Array.isArray(saved) ? saved.map(String) : []);
  const missing = SUGGESTED.filter((p) => !seeded.has(p.id));
  if (missing.length === 0) return 0;
  const now = Date.now();
  let added = 0;
  for (const p of missing) {
    if (isFollowed(people, p.name)) continue;
    await saveKunskapRecord('kunskap_people', { id: `lib-${p.id}`, name: p.name, topics: p.topics, created: now + added } satisfies FollowedPerson);
    added++;
  }
  await saveKunskapRecord('kunskap_settings', { id: 'library', seeded: [...seeded, ...missing.map((p) => p.id)] });
  return added;
}

let seeding: Promise<void> | null = null;

/**
 * Lägger till bibliotekets personer när det är säkert: utloggad, eller när kontots poster har hämtats en gång.
 * Annars kunde en ny telefon lägga tillbaka någon som tagits bort på en annan, innan synken hunnit berätta det.
 */
function followLibraryWhenReady(): Promise<void> {
  // En körning i taget. Varje sparad person ger en ändring som anropar den här igen, och utan spärren kunde en
  // sen körning lägga tillbaka någon som just tagits bort.
  seeding ??= (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session && !(await getMeta<{ lastPull: string | null }>('sync'))?.lastPull) return;
      await followLibrary();
    } catch {
      // Går det inte nu görs ett nytt försök nästa gång Kunskap öppnas eller något ändras.
    } finally {
      seeding = null;
    }
  })();
  return seeding;
}

// Tryckningar görs en i taget, så att ett dubbelklick blir två riktiga tryckningar (på och av) och inte två "på".
let queue: Promise<unknown> = Promise.resolve();

/** Gilla eller ogilla ett kort. Samma knapp en gång till tar bort rösten. */
export function vote(card: KunskapCard, pressed: 1 | -1): Promise<void> {
  const run = async () => {
    const current = (await loadKunskapRecords<Vote>('kunskap_votes')).find((v) => v.cardId === card.id)?.value;
    const value = nextVote(current, pressed);
    if (value === null) return deleteKunskapRecord('kunskap_votes', card.id);
    const record: Vote = { cardId: card.id, value, ts: Date.now(), person: card.person, topic: card.topic, type: card.type };
    return saveKunskapRecord('kunskap_votes', record);
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/** Personer och röster, uppdaterade när något ändras här eller kommer in via synken. Null medan de laddas. */
export function useKunskap(): { data: KunskapData | null; failed: boolean } {
  const [data, setData] = useState<KunskapData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () =>
      loadKunskap().then(
        (next) => alive && (setData(next), setFailed(false)),
        () => alive && setFailed(true),
      );
    // Efter varje ändring: finns det någon i biblioteket som inte följts än? (Gör ingenting när alla redan lagts till.)
    const load = () => {
      void followLibraryWhenReady();
      return read();
    };
    load();
    const off = onHabitChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { data, failed };
}

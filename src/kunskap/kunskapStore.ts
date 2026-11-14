// Kunskap: läser och sparar personer och röster. Lagringen delas med Vanor (samma lokala databas och samma
// privata synk till kontot, tabellen personal_records), så allt fungerar utan nät och synkas när det går.

import { useEffect, useState } from 'react';
import { deleteKunskapRecord, loadKunskapRecords, newId, onHabitChange, saveKunskapRecord } from '../vanor/store';
import { supabase } from '../sync';
import { syncHabits } from '../vanor/sync';
import { cleanSettings, DEFAULT_SETTINGS, type Batch, type KunskapSettings } from '../../supabase/functions/kunskap-generera/shared.ts';
import type { KunskapCard } from './cards';
import { cleanName, isFollowed, nextVote, parseTopics, type FollowedPerson, type Vote } from './kunskapState';

export interface KunskapData {
  people: FollowedPerson[];
  votes: Vote[];
  /** Genererade kort, skrivna av servern. */
  cards: KunskapCard[];
  settings: KunskapSettings;
  /** Kostnadsloggen, skriven av servern. */
  batches: Batch[];
}

export async function loadKunskap(): Promise<KunskapData> {
  const [people, votes, cards, settings, batches] = await Promise.all([
    loadKunskapRecords<FollowedPerson>('kunskap_people'),
    loadKunskapRecords<Vote>('kunskap_votes'),
    loadKunskapRecords<KunskapCard>('kunskap_cards'),
    loadKunskapRecords<unknown>('kunskap_settings'),
    loadKunskapRecords<Batch>('kunskap_batches'),
  ]);
  people.sort((a, b) => a.created - b.created);
  return { people, votes, cards, settings: settings.length ? cleanSettings(settings[0]) : DEFAULT_SETTINGS, batches };
}

/** Sparar hur ofta kort ska genereras och hur många. Synkas till kontot, där servern läser det. */
export const saveSettings = (settings: Pick<KunskapSettings, 'frequency' | 'count'>) => saveKunskapRecord('kunskap_settings', cleanSettings(settings));

export type GenerateReply = { ok: true; cards: number; costUsd: number } | { ok: false; message: string };

/** Svaret från kunskap-generera tolkat. Egen funktion så att den kan testas utan nätverk. */
export function readGenerateReply(status: number, body: unknown): GenerateReply {
  const b = (body ?? {}) as { batches?: { cards?: unknown; costUsd?: unknown }[]; message?: unknown };
  const batch = Array.isArray(b.batches) ? b.batches[0] : undefined;
  if (status >= 200 && status < 300 && batch) return { ok: true, cards: Number(batch.cards) || 0, costUsd: Number(batch.costUsd) || 0 };
  if (status === 401) return { ok: false, message: 'Logga in under Konto för att generera kort.' };
  if (status === 404) return { ok: false, message: 'Genereringen är inte påslagen på servern än.' };
  return { ok: false, message: typeof b.message === 'string' && b.message.trim() ? b.message.trim() : 'Genereringen misslyckades. Försök igen.' };
}

/** Kör en batch nu, på servern. Tar upp till ett par minuter. Kastar aldrig. */
export async function generateNow(): Promise<GenerateReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, message: 'Du är inte uppkopplad.' };
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return readGenerateReply(401, null);
    // Servern läser personerna och inställningen från kontot: skicka upp det som ändrats här först.
    await syncHabits();
    const { data, error, response } = await supabase.functions.invoke('kunskap-generera', { body: {} });
    const reply = !error ? readGenerateReply(200, data) : response ? readGenerateReply(response.status, await response.json().catch(() => null)) : readGenerateReply(0, null);
    // Hämta de nya korten och kostnadsraden direkt.
    void syncHabits();
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
    const load = () =>
      loadKunskap().then(
        (next) => alive && (setData(next), setFailed(false)),
        () => alive && setFailed(true),
      );
    load();
    const off = onHabitChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { data, failed };
}

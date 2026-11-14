// Kunskap: läser och sparar personer och röster. Lagringen delas med Vanor (samma lokala databas och samma
// privata synk till kontot, tabellen personal_records), så allt fungerar utan nät och synkas när det går.

import { useEffect, useState } from 'react';
import { deleteKunskapRecord, loadKunskapRecords, newId, onHabitChange, saveKunskapRecord } from '../vanor/store';
import type { KunskapCard } from './cards';
import { cleanName, isFollowed, nextVote, parseTopics, type FollowedPerson, type Vote } from './kunskapState';

export interface KunskapData {
  people: FollowedPerson[];
  votes: Vote[];
}

export async function loadKunskap(): Promise<KunskapData> {
  const [people, votes] = await Promise.all([loadKunskapRecords<FollowedPerson>('kunskap_people'), loadKunskapRecords<Vote>('kunskap_votes')]);
  people.sort((a, b) => a.created - b.created);
  return { people, votes };
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

// Synk för Challenges: privata för varje konto (tabellerna challenges, challenge_tasks, challenge_checkins och
// challenge_attempts i Supabase, där radsäkerheten bara släpper fram ägarens rader). Samma mönster som Vanor:
// allt sparas först i telefonen, köas i en outbox och skickas upp när det finns nät och inloggning.
// Senast skickad ändring gäller. Progressbilder laddas upp till den privata bucketen challenge-photos.

import type { Session } from '@supabase/supabase-js';
import { supabase } from '../sync';
import {
  applyRemote,
  clearAll,
  clearOutbox,
  getMeta,
  getOutbox,
  getPhoto,
  getRow,
  onChallengeChange,
  pendingPhotos,
  queueEverything,
  savePhoto,
  setMeta,
  TABLES,
  type Table,
} from './store';
import { attemptId, checkinId, type Attempt, type Challenge, type ChallengeTask, type Checkin } from './types';

const BUCKET = 'challenge-photos';
const PULL_OVERLAP_MS = 5000;
const PULL_INTERVAL_MS = 60000;

interface Meta {
  userId: string;
  lastPull: Partial<Record<Table, string>>;
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;
let started = false;

export function startChallengeSync() {
  if (started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => handleSession(data.session));
  supabase.auth.onAuthStateChange((_event, next) => {
    setTimeout(() => handleSession(next), 0);
  });

  let pushTimer: number | undefined;
  onChallengeChange((kind) => {
    if (kind !== 'local' || !session) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(syncChallenges, 1200);
  });
  window.addEventListener('online', () => syncChallenges());
  document.addEventListener('visibilitychange', () => syncChallenges());
  window.setInterval(() => {
    if (document.visibilityState === 'visible') syncChallenges();
  }, PULL_INTERVAL_MS);
}

function handleSession(next: Session | null) {
  const changed = next?.user.id !== session?.user.id;
  session = next;
  if (next && changed) syncChallenges();
}

export async function syncChallenges(): Promise<void> {
  if (!session || !navigator.onLine) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      try {
        await runSync(session!.user.id);
      } catch (error) {
        console.error('Challenges: synken misslyckades', error);
      }
    } while (again && session);
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

/**
 * Synkar och väntar tills det är klart (högst några sekunder). Körs innan reglerna tillämpas, så att en telefon
 * med gamla data inte tror att en dag är missad när den är bockad på en annan telefon.
 */
export async function syncNow(): Promise<void> {
  const work = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session;
      await syncChallenges();
    } catch (error) {
      console.error('Challenges: kunde inte synka före reglerna', error);
    }
  })();
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, 6000))]);
}

async function runSync(userId: string) {
  let meta = await getMeta<Meta>('sync');
  if (!meta || meta.userId !== userId) {
    // Telefonens utmaningar hör till ett annat konto: byt ut dem. Annars: skicka upp det som finns här.
    if (meta) await clearAll();
    else await queueEverything();
    meta = { userId, lastPull: {} };
    await setMeta('sync', meta);
  }
  await push();
  await uploadPhotos(userId);
  await pull(meta);
}

/** Raden som den ska se ut på servern. Bockar och försök hittas där på sina unika kolumner, inte på id. */
function toServer(table: Table, row: unknown): { row: object; onConflict: string } {
  if (table === 'challenge_checkins') {
    const { id: _id, ...rest } = row as Checkin;
    return { row: rest, onConflict: 'task_id,date' };
  }
  if (table === 'challenge_attempts') {
    const { id: _id, ...rest } = row as Attempt;
    return { row: rest, onConflict: 'challenge_id,attempt_number' };
  }
  if (table === 'challenges') return { row: { ...(row as Challenge), deleted: (row as Challenge).deleted ?? false }, onConflict: 'id' };
  return { row: row as ChallengeTask, onConflict: 'id' };
}

async function push() {
  const outbox = await getOutbox();
  if (!outbox.length) return;
  // Utmaningen först, sedan uppgifterna, sist bockar och försök (de pekar på raderna före).
  for (const table of TABLES) {
    const ids = [...new Set(outbox.filter((e) => e.table === table).map((e) => e.id))];
    const rows: object[] = [];
    let onConflict = 'id';
    for (const id of ids) {
      const local = await getRow<unknown>(table, id);
      if (!local) continue; // Borttagen sedan den köades.
      const server = toServer(table, local);
      rows.push(server.row);
      onConflict = server.onConflict;
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict });
      if (error) throw error;
    }
  }
  await clearOutbox(outbox);
}

async function uploadPhotos(userId: string) {
  for (const photo of await pendingPhotos()) {
    const { error } = await supabase.storage.from(BUCKET).upload(`${userId}/${photo.path}`, photo.blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    await savePhoto({ ...photo, uploaded: true });
  }
}

async function pull(meta: Meta) {
  for (const table of TABLES) {
    const last = meta.lastPull[table];
    const since = last ? new Date(new Date(last).getTime() - PULL_OVERLAP_MS).toISOString() : null;
    const rows = await fetchSince(table, since);
    if (!rows.length) continue;
    meta.lastPull[table] = rows[rows.length - 1].updated_at;
    await applyRemote(
      table,
      rows.map(({ updated_at: _u, user_id: _owner, ...row }) => {
        if (table === 'challenge_checkins') return { ...row, id: checkinId(row.task_id as string, row.date as string) };
        if (table === 'challenge_attempts') return { ...row, id: attemptId(row.challenge_id as string, row.attempt_number as number) };
        return row as { id: string };
      }),
    );
    await setMeta('sync', meta);
  }
}

type ServerRow = { id: string; updated_at: string; user_id?: string } & Record<string, unknown>;

async function fetchSince(table: Table, since: string | null): Promise<ServerRow[]> {
  const all: ServerRow[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select('*').order('updated_at').range(from, from + 999);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data as ServerRow[]));
    if (data.length < 1000) return all;
  }
}

const urls = new Map<string, string>();

/** Adress till en progressbild: kopian i telefonen om den finns, annars en tillfällig länk från servern. */
export async function photoUrl(path: string): Promise<string | null> {
  const cached = urls.get(path);
  if (cached) return cached;
  const local = await getPhoto(path);
  if (local) {
    const url = URL.createObjectURL(local.blob);
    urls.set(path, url);
    return url;
  }
  if (!session || !navigator.onLine) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${session.user.id}/${path}`, 3600);
  if (error || !data) return null;
  urls.set(path, data.signedUrl);
  // Länken gäller en timme, hämta en ny efter det.
  setTimeout(() => urls.delete(path), 50 * 60 * 1000);
  return data.signedUrl;
}

/** En ny bild på samma dag ersätter den gamla, så den sparade adressen gäller inte längre. */
export function forgetPhotoUrl(path: string) {
  const url = urls.get(path);
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  urls.delete(path);
}

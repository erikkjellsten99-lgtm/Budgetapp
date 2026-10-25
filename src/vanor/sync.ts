// Synk för vanorna: privata för varje konto (tabellen personal_records i Supabase,
// där radsäkerheten bara släpper fram ägarens egna rader). Cassandra ser inte dina
// vanor och du inte hennes. Utan inloggning fungerar allt ändå i telefonen.

import type { Session } from '@supabase/supabase-js';
import { supabase } from '../sync';
import {
  applyRemote,
  clearOutbox,
  getAllHabitRecords,
  getMeta,
  getOutbox,
  onHabitChange,
  setMeta,
  type RemoteRow,
} from './store';

const PULL_OVERLAP_MS = 5000;
const PULL_INTERVAL_MS = 30000;

interface Meta {
  userId: string;
  lastPull: string | null;
}

let session: Session | null = null;
let running: Promise<void> | null = null;
let again = false;

export function startHabitSync() {
  supabase.auth.getSession().then(({ data }) => handleSession(data.session));
  supabase.auth.onAuthStateChange((_event, next) => {
    setTimeout(() => handleSession(next), 0);
  });

  let pushTimer: number | undefined;
  onHabitChange((kind) => {
    if (kind !== 'local' || !session) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(syncHabits, 1200);
  });
  window.addEventListener('online', () => syncHabits());
  document.addEventListener('visibilitychange', () => syncHabits());
  window.setInterval(() => {
    if (document.visibilityState === 'visible') syncHabits();
  }, PULL_INTERVAL_MS);
}

function handleSession(next: Session | null) {
  const changed = next?.user.id !== session?.user.id;
  session = next;
  if (next && changed) syncHabits();
}

export async function syncHabits(): Promise<void> {
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
        console.error('Vanor: synken misslyckades', error);
      }
    } while (again && session);
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

async function runSync(userId: string) {
  let meta = await getMeta<Meta>('sync');
  if (!meta || meta.userId !== userId) meta = await firstSync(userId, meta);
  await push();
  await pull(meta);
}

/**
 * Första synken för ett konto på den här telefonen.
 * - Telefonens vanor hör till ett annat konto: byt ut dem mot det här kontots.
 * - Annars: skicka upp det som finns här och hämta det som finns på kontot.
 */
async function firstSync(userId: string, old: Meta | undefined): Promise<Meta> {
  const meta: Meta = { userId, lastPull: null };
  if (old && old.userId !== userId) {
    const rows = await fetchSince(null);
    await applyRemote(rows, true);
    meta.lastPull = rows.length ? rows[rows.length - 1].updated_at : null;
  } else {
    const records = await getAllHabitRecords();
    const now = Date.now();
    await pushRows(records.map((r) => ({ ...r, deleted: false, client_ts: now })));
  }
  await setMeta('sync', meta);
  return meta;
}

async function push() {
  const outbox = await getOutbox();
  if (!outbox.length) return;
  await pushRows(outbox.map((e) => ({ store: e.store, id: e.id, data: e.data, deleted: e.deleted, client_ts: e.ts })));
  await clearOutbox(outbox);
}

async function pushRows(rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.rpc('push_personal_records', { rows: rows.slice(i, i + 500) });
    if (error) throw error;
  }
}

async function pull(meta: Meta) {
  const since = meta.lastPull ? new Date(new Date(meta.lastPull).getTime() - PULL_OVERLAP_MS).toISOString() : null;
  const rows = await fetchSince(since);
  if (!rows.length) return;
  await applyRemote(rows);
  meta.lastPull = rows[rows.length - 1].updated_at;
  await setMeta('sync', meta);
}

type ServerRow = RemoteRow & { updated_at: string };

async function fetchSince(since: string | null): Promise<ServerRow[]> {
  const all: ServerRow[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from('personal_records')
      .select('store, id, data, deleted, updated_at')
      .order('updated_at')
      .range(from, from + 999);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data as ServerRow[]));
    if (data.length < 1000) return all;
  }
}

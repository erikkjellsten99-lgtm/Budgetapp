// Lagring för Challenges: en egen databas ("challenges") i telefonen, skild från ekonomin och vanorna.
// Fungerar utan internet. Ändringar köas i en outbox och synkas till kontot när du är inloggad (./sync.ts).
//
// Ändra aldrig ett befintligt versionssteg nedan – data ligger redan i det.
// Lägg i stället till nästa version med ett nytt steg.

import type { Attempt, Challenge, ChallengeData, ChallengeTask, Checkin } from './types';

const DB_NAME = 'challenges';
const DB_VERSION = 1;

/** Tabellerna som synkas. Namnet är både lagrets namn här och tabellens namn i Supabase. */
export const TABLES = ['challenges', 'challenge_tasks', 'challenge_checkins', 'challenge_attempts'] as const;
export type Table = (typeof TABLES)[number];

export interface OutboxEntry {
  key?: number;
  table: Table;
  id: string;
  ts: number;
}

/** En progressbild som väntar på att laddas upp, eller som sparats för att visas utan nät. */
export interface LocalPhoto {
  path: string;
  blob: Blob;
  uploaded: boolean;
}

type Row = { id: string };

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        for (const table of TABLES) db.createObjectStore(table, { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'key', autoIncrement: true });
        db.createObjectStore('meta');
        db.createObjectStore('photos', { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const ask = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

type Listener = (kind: 'local' | 'remote') => void;
const listeners = new Set<Listener>();
export function onChallengeChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const notify = (kind: 'local' | 'remote') => listeners.forEach((l) => l(kind));

export const newId = () => crypto.randomUUID();

export async function loadAll(): Promise<ChallengeData> {
  const db = await open();
  const tx = db.transaction(TABLES, 'readonly');
  const [challenges, tasks, checkins, attempts] = await Promise.all([
    ask(tx.objectStore('challenges').getAll() as IDBRequest<Challenge[]>),
    ask(tx.objectStore('challenge_tasks').getAll() as IDBRequest<ChallengeTask[]>),
    ask(tx.objectStore('challenge_checkins').getAll() as IDBRequest<Checkin[]>),
    ask(tx.objectStore('challenge_attempts').getAll() as IDBRequest<Attempt[]>),
  ]);
  return {
    challenges: challenges.filter((c) => !c.deleted).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    tasks: tasks.sort((a, b) => a.sort_order - b.sort_order),
    checkins,
    attempts: attempts.sort((a, b) => a.attempt_number - b.attempt_number),
  };
}

/** Sparar rader och köar dem för synk, allt i en transaktion. */
export async function saveRows(writes: { table: Table; row: Row }[]): Promise<void> {
  if (!writes.length) return;
  const db = await open();
  const tx = db.transaction([...TABLES, 'outbox'], 'readwrite');
  const ts = Date.now();
  for (const { table, row } of writes) {
    tx.objectStore(table).put(row);
    tx.objectStore('outbox').add({ table, id: row.id, ts } satisfies OutboxEntry);
  }
  await done(tx);
  notify('local');
}

export const saveChallenge = (row: Challenge) => saveRows([{ table: 'challenges', row }]);
export const saveCheckin = (row: Checkin) => saveRows([{ table: 'challenge_checkins', row }]);

/** Tar bort en utmaning. Raden ligger kvar som borttagen tills servern fått veta, uppgifter och bockar tas bort här. */
export async function deleteChallenge(challenge: Challenge): Promise<void> {
  const db = await open();
  const tx = db.transaction([...TABLES, 'outbox'], 'readwrite');
  tx.objectStore('challenges').put({ ...challenge, deleted: true });
  tx.objectStore('outbox').add({ table: 'challenges', id: challenge.id, ts: Date.now() } satisfies OutboxEntry);
  removeChildren(tx, challenge.id);
  await done(tx);
  notify('local');
}

function removeChildren(tx: IDBTransaction, challengeId: string) {
  for (const table of ['challenge_tasks', 'challenge_checkins', 'challenge_attempts'] as const) {
    const store = tx.objectStore(table);
    store.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      if ((cursor.value as { challenge_id: string }).challenge_id === challengeId) cursor.delete();
      cursor.continue();
    };
  }
}

// ---- Synkens del ----

export async function getOutbox(): Promise<OutboxEntry[]> {
  const db = await open();
  return ask(db.transaction('outbox').objectStore('outbox').getAll() as IDBRequest<OutboxEntry[]>);
}

export async function clearOutbox(entries: OutboxEntry[]): Promise<void> {
  const db = await open();
  const tx = db.transaction('outbox', 'readwrite');
  for (const e of entries) if (e.key !== undefined) tx.objectStore('outbox').delete(e.key);
  await done(tx);
}

export async function getRow<T>(table: Table, id: string): Promise<T | undefined> {
  const db = await open();
  return ask(db.transaction(table).objectStore(table).get(id) as IDBRequest<T | undefined>);
}

/** Köar allt som finns i telefonen (första synken för ett konto). */
export async function queueEverything(): Promise<void> {
  const db = await open();
  const tx = db.transaction([...TABLES, 'outbox'], 'readwrite');
  const ts = Date.now();
  for (const table of TABLES) {
    const rows = await ask(tx.objectStore(table).getAll() as IDBRequest<Row[]>);
    for (const row of rows) tx.objectStore('outbox').add({ table, id: row.id, ts } satisfies OutboxEntry);
  }
  await done(tx);
}

/** Tömmer telefonen (ett annat konto har loggat in). */
export async function clearAll(): Promise<void> {
  const db = await open();
  const tx = db.transaction([...TABLES, 'outbox', 'photos'], 'readwrite');
  for (const name of [...TABLES, 'outbox', 'photos']) tx.objectStore(name).clear();
  await done(tx);
  notify('remote');
}

/**
 * Tar emot rader från servern. Rader med en ändring som väntar i outboxen hoppas över: telefonens version
 * skickas upp strax och vinner. En borttagen utmaning tar med sig sina uppgifter och bockar.
 */
export async function applyRemote(table: Table, rows: (Row & { deleted?: boolean })[]): Promise<void> {
  if (!rows.length) return;
  const db = await open();
  const tx = db.transaction([...TABLES, 'outbox'], 'readwrite');
  const pending = new Set(
    (await ask(tx.objectStore('outbox').getAll() as IDBRequest<OutboxEntry[]>)).filter((e) => e.table === table).map((e) => e.id),
  );
  for (const row of rows) {
    if (pending.has(row.id)) continue;
    if (table === 'challenges' && row.deleted) {
      tx.objectStore('challenges').delete(row.id);
      removeChildren(tx, row.id);
    } else tx.objectStore(table).put(row);
  }
  await done(tx);
  notify('remote');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return ask(db.transaction('meta').objectStore('meta').get(key) as IDBRequest<T | undefined>);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await open();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put(value, key);
  await done(tx);
}

// ---- Bilder ----

export async function savePhoto(photo: LocalPhoto): Promise<void> {
  const db = await open();
  const tx = db.transaction('photos', 'readwrite');
  tx.objectStore('photos').put(photo);
  await done(tx);
  notify('local');
}

export async function getPhoto(path: string): Promise<LocalPhoto | undefined> {
  const db = await open();
  return ask(db.transaction('photos').objectStore('photos').get(path) as IDBRequest<LocalPhoto | undefined>);
}

export async function pendingPhotos(): Promise<LocalPhoto[]> {
  const db = await open();
  const all = await ask(db.transaction('photos').objectStore('photos').getAll() as IDBRequest<LocalPhoto[]>);
  return all.filter((p) => !p.uploaded);
}

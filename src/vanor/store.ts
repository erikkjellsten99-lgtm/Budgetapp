// Lagring för vanorna: en egen databas ("vanor") i telefonen, skild från budgeten.
// Fungerar utan internet. Ändringar köas i en outbox och synkas till ditt konto
// (privat, bara du ser dina vanor) när du är inloggad, se ./sync.ts.
//
// Ändra aldrig ett befintligt versionssteg nedan – data ligger redan i det.
// Lägg i stället till nästa version med ett nytt steg.

import { todayKey, type DateKey } from './dates';
import { sameName, type Habit, type Log } from './habits';

const DB_NAME = 'vanor';
const DB_VERSION = 1;

export const HABIT_STORES = ['habits', 'checks', 'pauses'] as const;
export type HabitStore = (typeof HABIT_STORES)[number];

/** En bockning: vanan var klar den dagen. `min` = bara minimiversionen gjordes. */
export interface Check {
  key: string;
  date: DateKey;
  habitId: string;
  min?: boolean;
}

/** En pausad dag (sjuk/skadad): bryter inga streaks. */
export interface Pause {
  date: DateKey;
}

export interface HabitData {
  habits: Habit[];
  checks: Check[];
  pauses: Pause[];
}

export interface OutboxEntry {
  /** "store:id" */
  key: string;
  store: HabitStore;
  id: string;
  data: unknown;
  deleted: boolean;
  ts: number;
}

const checkKey = (date: DateKey, habitId: string) => `${date}|${habitId}`;
const idOf = (store: HabitStore, record: Record<string, unknown>) =>
  String(store === 'checks' ? record.key : store === 'pauses' ? record.date : record.id);

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('habits', { keyPath: 'id' });
        db.createObjectStore('checks', { keyPath: 'key' });
        db.createObjectStore('pauses', { keyPath: 'date' });
        db.createObjectStore('outbox', { keyPath: 'key' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return request(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

// Ändringar: 'local' när något ändrats här, 'remote' när synken hämtat nytt.
type ChangeKind = 'local' | 'remote';
const listeners = new Set<(kind: ChangeKind) => void>();

export function onHabitChange(listener: (kind: ChangeKind) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(kind: ChangeKind) {
  for (const listener of listeners) listener(kind);
}

/** Sparar och/eller tar bort poster i en transaktion, och köar ändringarna för synk. */
async function change(puts: { store: HabitStore; record: object }[], deletes: { store: HabitStore; id: string }[] = []) {
  const db = await openDb();
  const tx = db.transaction([...HABIT_STORES, 'outbox'], 'readwrite');
  const ts = Date.now();
  const outbox = tx.objectStore('outbox');
  for (const { store, record } of puts) {
    tx.objectStore(store).put(record);
    const id = idOf(store, record as Record<string, unknown>);
    outbox.put({ key: `${store}:${id}`, store, id, data: record, deleted: false, ts } satisfies OutboxEntry);
  }
  for (const { store, id } of deletes) {
    tx.objectStore(store).delete(id);
    outbox.put({ key: `${store}:${id}`, store, id, data: null, deleted: true, ts } satisfies OutboxEntry);
  }
  await done(tx);
  emit('local');
}

export async function loadHabitData(): Promise<HabitData> {
  const [habits, checks, pauses] = await Promise.all([
    getAll<Habit>('habits'),
    getAll<Check>('checks'),
    getAll<Pause>('pauses'),
  ]);
  habits.sort((a, b) => a.order - b.order);
  return { habits, checks, pauses };
}

export function toLog(checks: Check[]): Log {
  const log: Log = {};
  for (const c of checks) (log[c.date] ??= []).push(c.habitId);
  return log;
}

/** Nycklar "datum|vane-id" för bockningar där bara minimiversionen gjordes. */
export function minimumKeys(checks: Check[]): Set<string> {
  return new Set(checks.filter((c) => c.min).map((c) => c.key));
}

// Ändringar från appen

export const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const clean = (text: string, max = 40) => text.trim().replace(/\s+/g, ' ').slice(0, max);
const clampGoal = (goal: number) => Math.min(7, Math.max(1, Math.round(goal) || 1));

/** Bocka av vanan för dagen – eller ångra om den redan är bockad. */
export async function toggleCheck(habitId: string, date: DateKey, min = false) {
  const db = await openDb();
  const key = checkKey(date, habitId);
  const existing = await request(db.transaction('checks').objectStore('checks').get(key));
  if (existing) await change([], [{ store: 'checks', id: key }]);
  else await change([{ store: 'checks', record: min ? { key, date, habitId, min: true } : { key, date, habitId } }]);
}

/** Pausa dagen (sjuk/skadad) – eller ta bort pausen. */
export async function togglePause(date: DateKey) {
  const db = await openDb();
  const existing = await request(db.transaction('pauses').objectStore('pauses').get(date));
  if (existing) await change([], [{ store: 'pauses', id: date }]);
  else await change([{ store: 'pauses', record: { date } }]);
}

const nextOrder = (habits: Habit[]) => habits.reduce((max, h) => Math.max(max, h.order), -1) + 1;

/**
 * Lägg till en vana sist i listan. Finns en borttagen vana med samma namn
 * tas den tillbaka i stället, så att historiken följer med.
 */
export async function addHabit(name: string, goal: number, minimum = '', after: string[] = []): Promise<string> {
  const all = await getAll<Habit>('habits');
  const text = clean(name);
  const min = clean(minimum) || undefined;
  const old = all.find((h) => h.archived && sameName(h.name, text));
  const habit: Habit = old
    ? { ...old, archived: false, order: nextOrder(all), goal: clampGoal(goal), minimum: min, after }
    : { id: newId(), name: text, goal: clampGoal(goal), created: todayKey(), after, order: nextOrder(all), archived: false };
  if (!old && min) habit.minimum = min;
  await change([{ store: 'habits', record: habit }]);
  return habit.id;
}

async function updateRecord(id: string, update: (h: Habit) => Habit) {
  const db = await openDb();
  const habit = (await request(db.transaction('habits').objectStore('habits').get(id))) as Habit | undefined;
  if (habit) await change([{ store: 'habits', record: update(habit) }]);
}

/** Ändra namn, mål, minimiversion och vilka vanor den görs efter. */
export function updateHabit(id: string, changes: { name: string; goal: number; minimum: string; after: string[] }) {
  return updateRecord(id, (h) => ({
    ...h,
    name: clean(changes.name),
    goal: clampGoal(changes.goal),
    minimum: clean(changes.minimum) || undefined,
    after: changes.after.filter((a) => a !== id),
  }));
}

/** Ta bort en vana från listan. Bockningarna sparas, så den kan läggas tillbaka. */
export function removeHabit(id: string) {
  return updateRecord(id, (h) => ({ ...h, archived: true }));
}

/** Lägg tillbaka en borttagen vana, sist i listan. */
export async function restoreHabit(id: string) {
  const all = await getAll<Habit>('habits');
  return updateRecord(id, (h) => ({ ...h, archived: false, order: nextOrder(all) }));
}

/** Lägger in en hel uppsättning vanor (start-set eller flytt från gamla vanetrackern). */
export async function importHabits(data: { habits: Habit[]; checks: Omit<Check, 'key'>[]; pauses: Pause[] }) {
  const current = await loadHabitData();
  // Vanor som redan finns (samma id, eller samma namn och båda aktiva/borttagna) slås ihop:
  // bockningarna hamnar på den befintliga. Så kan samma kod klistras in två gånger utan dubbletter.
  const idMap = new Map<string, string>();
  const puts: { store: HabitStore; record: object }[] = [];
  let order = nextOrder(current.habits);
  for (const h of data.habits) {
    const same =
      current.habits.find((e) => e.id === h.id) ??
      current.habits.find((e) => sameName(e.name, h.name) && !e.archived === !h.archived);
    if (same) {
      idMap.set(h.id, same.id);
      continue;
    }
    idMap.set(h.id, h.id);
    puts.push({ store: 'habits', record: { ...h, order: order++, after: h.after ?? [] } });
  }
  // Kopplingar (t.ex. Stretching efter Gym) pekar på de nya id:na.
  for (const p of puts) {
    const h = p.record as Habit;
    h.after = h.after.map((id) => idMap.get(id) ?? id);
  }
  const known = new Set(current.checks.map((c) => c.key));
  for (const c of data.checks) {
    const habitId = idMap.get(c.habitId) ?? c.habitId;
    const key = checkKey(c.date, habitId);
    if (known.has(key)) continue;
    known.add(key);
    puts.push({ store: 'checks', record: c.min ? { key, date: c.date, habitId, min: true } : { key, date: c.date, habitId } });
  }
  const pausedDays = new Set(current.pauses.map((p) => p.date));
  for (const p of data.pauses) if (!pausedDays.has(p.date)) puts.push({ store: 'pauses', record: { date: p.date } });
  await change(puts);
  return { habits: puts.filter((p) => p.store === 'habits').length, checks: puts.filter((p) => p.store === 'checks').length };
}

// För synken

export async function getOutbox(): Promise<OutboxEntry[]> {
  return getAll<OutboxEntry>('outbox');
}

export async function clearOutbox(sent: OutboxEntry[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('outbox', 'readwrite');
  const outbox = tx.objectStore('outbox');
  for (const entry of sent) {
    const current = outbox.get(entry.key);
    current.onsuccess = () => {
      if ((current.result as OutboxEntry | undefined)?.ts === entry.ts) outbox.delete(entry.key);
    };
  }
  await done(tx);
}

/** Alla lokala poster, för första uppladdningen till kontot. */
export async function getAllHabitRecords(): Promise<{ store: HabitStore; id: string; data: unknown }[]> {
  const all = [];
  for (const store of HABIT_STORES) {
    for (const record of await getAll<Record<string, unknown>>(store)) all.push({ store, id: idOf(store, record), data: record });
  }
  return all;
}

export interface RemoteRow {
  store: string;
  id: string;
  data: unknown;
  deleted: boolean;
}

/**
 * Lägger in ändringar från servern. Poster med en lokal ändring som inte skickats än hoppas över.
 * Med replace töms allt först (när ett annat konto loggar in på samma telefon).
 */
export async function applyRemote(rows: RemoteRow[], replace = false): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([...HABIT_STORES, 'outbox'], 'readwrite');
  if (replace) {
    for (const store of HABIT_STORES) tx.objectStore(store).clear();
    tx.objectStore('outbox').clear();
  }
  const outbox = tx.objectStore('outbox');
  for (const row of rows) {
    if (!(HABIT_STORES as readonly string[]).includes(row.store)) continue;
    const store = tx.objectStore(row.store);
    const pending = outbox.get(`${row.store}:${row.id}`);
    pending.onsuccess = () => {
      if (pending.result && !replace) return;
      if (row.deleted) store.delete(row.id);
      else store.put(row.data);
    };
  }
  await done(tx);
  emit('remote');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const row = (await request(db.transaction('meta').objectStore('meta').get(key))) as { value: T } | undefined;
  return row?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('meta', 'readwrite');
  if (value === undefined) tx.objectStore('meta').delete(key);
  else tx.objectStore('meta').put({ key, value });
  await done(tx);
}

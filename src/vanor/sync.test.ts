// Två av Eriks telefoner mot en låtsasserver som fungerar som Supabase-tabellen personal_records och
// push_personal_records: servern sparar bara en ändring vars client_ts är minst lika ny. Varje telefon har en
// egen databas och egna moduler, som två riktiga telefoner (samma upplägg som ../sync.merge.test.ts).
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Progress } from '../akademin/types';

interface Row {
  store: string;
  id: string;
  data: unknown;
  deleted: boolean;
  client_ts: number;
  updated_at: string;
}

const server = new Map<string, Row>();
let clock = 0;
/** Anropas när en telefon skickar upp rader, innan servern sparar dem. */
let onPush: ((rows: Omit<Row, 'updated_at'>[]) => Promise<void>) | null = null;

function save(rows: Omit<Row, 'updated_at'>[]) {
  for (const row of rows) {
    const key = `${row.store}|${row.id}`;
    const old = server.get(key);
    if (old && old.client_ts > row.client_ts) continue;
    // Tio sekunder mellan varje sparning, så att hämtningens överlapp (5 s) bara tar med den senaste raden.
    server.set(key, { ...structuredClone(row), updated_at: new Date(Date.UTC(2030, 0, 1) + ++clock * 10_000).toISOString() });
  }
}

const sorted = () => [...server.values()].sort((a, b) => a.updated_at.localeCompare(b.updated_at));

/** Det lilla av Supabase-klienten som vanor/sync.ts använder. */
const fakeClient = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'erik' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  rpc: async (name: string, args: { rows: Omit<Row, 'updated_at'>[] }) => {
    if (name !== 'push_personal_records') return { data: null, error: new Error(`okänd rpc ${name}`) };
    const hook = onPush;
    onPush = null;
    if (hook) await hook(args.rows);
    save(args.rows);
    return { data: null, error: null };
  },
  from: (table: string) => {
    expect(table).toBe('personal_records');
    let since: string | null = null;
    let range: [number, number] = [0, Infinity];
    const builder = {
      select: () => builder,
      order: () => builder,
      range: (from: number, to: number) => ((range = [from, to]), builder),
      gt: (_col: 'updated_at', value: string) => ((since = value), builder),
      then: (resolve: (value: unknown) => void) => {
        const rows = sorted()
          .filter((r) => !since || r.updated_at > since)
          .slice(range[0], range[1] + 1)
          .map(({ store, id, data, deleted, updated_at }) => ({ store, id, data, deleted, updated_at }));
        resolve({ data: structuredClone(rows), error: null });
      },
    };
    return builder;
  },
};

type Store = typeof import('./store');
type Sync = typeof import('./sync');
interface Phone {
  store: Store;
  sync: Sync;
}

/** Startar en telefon med den nuvarande koden på `factory` (en egen databas), inloggad och synkad. */
async function phone(factory: IDBFactory): Promise<Phone> {
  vi.resetModules();
  vi.stubGlobal('indexedDB', factory);
  vi.doMock('../sync', () => ({ supabase: fakeClient }));
  const store = await import('./store');
  const sync = await import('./sync');
  sync.startHabitSync();
  await new Promise((r) => setTimeout(r, 0));
  await sync.syncHabits();
  return { store, sync };
}

// Telefonen med den gamla koden (version 6): bara lagren den känner till, och synken som den var då.
const OLD_STORES: Record<string, string> = {
  habits: 'id',
  checks: 'key',
  pauses: 'date',
  workouts: 'id',
  tasks: 'id',
  health: 'date',
  kunskap_people: 'id',
  kunskap_votes: 'cardId',
  kunskap_cards: 'id',
  kunskap_settings: 'id',
  kunskap_batches: 'id',
};

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

function openOld(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = factory.open('vanor', 6);
    r.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(OLD_STORES)) r.result.createObjectStore(name, { keyPath });
      r.result.createObjectStore('outbox', { keyPath: 'key' });
      r.result.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * En synk med den gamla koden, steg för steg som vanor/sync.ts gör: skicka outboxen, hämta allt sedan lastPull
 * (minus 5 s), lägg in rader i kända lager utan väntande lokal ändring, hoppa över okända lager och flytta ändå
 * fram lastPull till den sista raden.
 */
async function oldSync(db: IDBDatabase) {
  const outbox = await req(db.transaction('outbox').objectStore('outbox').getAll());
  save(outbox.map((e) => ({ store: e.store, id: e.id, data: e.data, deleted: e.deleted, client_ts: e.ts })));
  let tx = db.transaction('outbox', 'readwrite');
  tx.objectStore('outbox').clear();
  await txDone(tx);

  const meta = ((await req(db.transaction('meta').objectStore('meta').get('sync'))) as { value: { userId: string; lastPull: string | null } } | undefined)
    ?.value ?? { userId: 'erik', lastPull: null };
  const since = meta.lastPull ? new Date(new Date(meta.lastPull).getTime() - 5000).toISOString() : null;
  const rows = sorted().filter((r) => !since || r.updated_at > since);
  tx = db.transaction([...Object.keys(OLD_STORES), 'outbox', 'meta'], 'readwrite');
  for (const row of rows) {
    if (!(row.store in OLD_STORES)) continue;
    const store = tx.objectStore(row.store);
    const pending = tx.objectStore('outbox').get(`${row.store}:${row.id}`);
    pending.onsuccess = () => {
      if (pending.result) return;
      if (row.deleted) store.delete(row.id);
      else store.put(structuredClone(row.data));
    };
  }
  if (rows.length) meta.lastPull = rows[rows.length - 1].updated_at;
  tx.objectStore('meta').put({ key: 'sync', value: meta });
  await txDone(tx);
}

async function count(factory: IDBFactory, stores: string[]): Promise<Record<string, number>> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = factory.open('vanor');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const out: Record<string, number> = {};
  for (const s of stores) out[s] = await req(db.transaction(s).objectStore(s).count());
  db.close();
  return out;
}

beforeAll(() => {
  const listeners = { addEventListener() {} };
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  vi.stubGlobal('navigator', { onLine: true });
  // Synken körs bara när testet ber om det: inga timrar.
  vi.stubGlobal('window', { ...listeners, setTimeout: () => 0, setInterval: () => 0 });
  vi.stubGlobal('document', { ...listeners, visibilityState: 'visible' });
});

beforeEach(() => {
  server.clear();
  clock = 0;
  onPush = null;
});

describe('Akademin i vanor-synken', () => {
  it('en klar lektion på telefon A kommer fram till telefon B via servern', async () => {
    const a = await phone(new IDBFactory());
    await a.store.saveAkademinRecord('akademin_progress', { id: 'k1-01', doneAt: '2026-11-20' } satisfies Progress);
    await a.store.saveAkademinRecord('akademin_answers', { id: 'k1-01-q1', streak: 1, due: '2026-11-21', last: '2026-11-20' });
    await a.sync.syncHabits();
    expect(server.get('akademin_progress|k1-01')?.data).toEqual({ id: 'k1-01', doneAt: '2026-11-20' });

    const b = await phone(new IDBFactory());
    expect(await b.store.loadAkademinRecords('akademin_progress')).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    expect(await b.store.loadAkademinRecords('akademin_answers')).toEqual([{ id: 'k1-01-q1', streak: 1, due: '2026-11-21', last: '2026-11-20' }]);
  });

  it('en telefon på den gamla koden får Akademins poster efter uppgraderingen, utan att lokala ändringar eller poster går förlorade', async () => {
    // Telefon A (ny kod) har vanor och en klar lektion, och skriver sedan mer, så att servern har rader efter Akademins.
    const a = await phone(new IDBFactory());
    const habitId = await a.store.addHabit('Läsa', 5);
    await a.store.setCheck(habitId, '2026-11-19', 'done');
    await a.store.saveTaskRecord({ id: 't1', title: 'Ring tandläkaren', date: '2026-11-25', created: 1 });
    await a.sync.syncHabits();
    await a.store.saveAkademinRecord('akademin_progress', { id: 'k1-01', doneAt: '2026-11-20' } satisfies Progress);
    await a.sync.syncHabits();
    await a.store.setCheck(habitId, '2026-11-20', 'done');
    await a.store.saveTaskRecord({ id: 't2', title: 'Handla', date: '2026-11-26', created: 2 });
    await a.sync.syncHabits();
    const akademinRow = server.get('akademin_progress|k1-01')!;

    // Telefon B på den gamla koden hämtar allt: Akademins rad hoppas över, men lastPull flyttas förbi den.
    const bFactory = new IDBFactory();
    const old = await openOld(bFactory);
    await oldSync(old);
    const oldMeta = (await req(old.transaction('meta').objectStore('meta').get('sync'))) as { value: { lastPull: string } };
    expect(old.objectStoreNames.contains('akademin_progress')).toBe(false);
    expect(new Date(oldMeta.value.lastPull).getTime() - 5000).toBeGreaterThan(new Date(akademinRow.updated_at).getTime());

    // B byter namn på vanan med den gamla koden. Ändringen ligger i outboxen när B uppgraderas.
    const habit = (await req(old.transaction('habits').objectStore('habits').get(habitId))) as { name: string };
    expect(habit.name).toBe('Läsa');
    const renamed = { ...habit, name: 'Läsa B1' };
    const tx = old.transaction(['habits', 'outbox'], 'readwrite');
    tx.objectStore('habits').put(renamed);
    tx.objectStore('outbox').put({ key: `habits:${habitId}`, store: 'habits', id: habitId, data: renamed, deleted: false, ts: Date.now() });
    await txDone(tx);
    old.close();
    const before = await count(bFactory, Object.keys(OLD_STORES));
    const serverRows = server.size;

    // Medan B:s första uppladdning efter uppgraderingen är på väg byter B namn igen. Den ändringen ligger kvar i
    // outboxen under hela omhämtningen, där servern har det äldre namnet Läsa B1.
    let b: Phone | undefined;
    let duringRepull: string | undefined;
    onPush = async () => {
      await new Promise((r) => setTimeout(r, 2));
      await b!.store.updateHabit(habitId, { name: 'Läsa B2', goal: 5, minimum: '', after: [] });
      // Nästa uppladdning (som skickar Läsa B2) kommer efter omhämtningen: se vad B hade just då.
      onPush = async () => {
        duringRepull = (await b!.store.loadHabitData()).habits.find((h) => h.id === habitId)?.name;
      };
    };
    // Uppgraderingen till version 7 nollställer lastPull, så B hämtar om allt.
    vi.resetModules();
    vi.stubGlobal('indexedDB', bFactory);
    vi.doMock('../sync', () => ({ supabase: fakeClient }));
    const store = await import('./store');
    const sync = await import('./sync');
    b = { store, sync };
    sync.startHabitSync();
    await new Promise((r) => setTimeout(r, 0));
    await sync.syncHabits();
    await sync.syncHabits();

    // (b) Akademins post har kommit fram.
    expect(await store.loadAkademinRecords('akademin_progress')).toEqual([{ id: 'k1-01', doneAt: '2026-11-20' }]);
    // (c) Omhämtningen skrev inte över den väntande ändringen med serverns äldre namn, och ändringen nådde servern.
    expect(duringRepull).toBe('Läsa B2');
    expect((await store.loadHabitData()).habits.find((h) => h.id === habitId)?.name).toBe('Läsa B2');
    expect((server.get(`habits|${habitId}`)?.data as { name: string }).name).toBe('Läsa B2');
    expect(await store.getOutbox()).toEqual([]);
    // (d) Inget dubblerat: samma antal poster i de gamla lagren och på servern.
    expect(await count(bFactory, Object.keys(OLD_STORES))).toEqual(before);
    expect(before).toMatchObject({ habits: 1, checks: 2, tasks: 2 });
    expect(server.size).toBe(serverRows);

    // A får B:s namn vid nästa synk.
    await a.sync.syncHabits();
    expect((await a.store.loadHabitData()).habits.find((h) => h.id === habitId)?.name).toBe('Läsa B2');
  });
});

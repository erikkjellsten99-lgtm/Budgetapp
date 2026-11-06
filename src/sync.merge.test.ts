// Två telefoner (Erik och Cassandra) mot en låtsasserver som fungerar som Supabase-tabellen
// records och push_records: servern sparar bara en ändring vars client_ts är minst lika ny.
// Varje telefon har en egen databas och egna moduler, som två riktiga telefoner.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Category } from './types';

interface Row {
  household_id: string;
  store: string;
  id: string;
  data: unknown;
  deleted: boolean;
  client_ts: number;
  updated_at: string;
}

const server = new Map<string, Row>();
let clock = 0;
const HOUSEHOLD = 'hushall-1';

function push(rows: Omit<Row, 'updated_at'>[]) {
  for (const row of rows) {
    const key = `${row.household_id}|${row.store}|${row.id}`;
    const old = server.get(key);
    if (old && old.client_ts > row.client_ts) continue;
    server.set(key, { ...structuredClone(row), updated_at: new Date(Date.UTC(2030, 0, 1, 0, 0, ++clock)).toISOString() });
  }
}

/** Det lilla av Supabase-klienten som synken använder. */
function fakeClient(userId: string) {
  const session = { user: { id: userId, email: `${userId}@exempel.se` } };
  function query() {
    const filters: ((row: Row) => boolean)[] = [];
    let head = false;
    let range: [number, number] | null = null;
    const builder = {
      select: (_cols: string, options?: { head?: boolean }) => {
        head = !!options?.head;
        return builder;
      },
      eq: (col: keyof Row, value: unknown) => (filters.push((row) => row[col] === value), builder),
      in: (col: keyof Row, values: unknown[]) => (filters.push((row) => values.includes(row[col])), builder),
      gt: (col: keyof Row, value: string) => (filters.push((row) => String(row[col]) > value), builder),
      order: () => builder,
      range: (from: number, to: number) => ((range = [from, to]), builder),
      then: (resolve: (value: unknown) => void) => {
        let rows = [...server.values()].filter((row) => filters.every((f) => f(row)));
        rows.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
        if (range) rows = rows.slice(range[0], range[1] + 1);
        resolve(head ? { count: rows.length, error: null } : { data: structuredClone(rows), error: null });
      },
    };
    return builder;
  }
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({}),
    },
    rpc: async (name: string, args?: { rows: Omit<Row, 'updated_at'>[] }) => {
      if (name === 'join_household') return { data: [{ household_id: HOUSEHOLD, status: 'existing' }], error: null };
      if (name === 'push_records') push(args!.rows);
      return { data: null, error: null };
    },
    from: () => query(),
  };
}

type Db = typeof import('./db');
type Sync = typeof import('./sync');

/** Startar en telefon: egen databas, egna moduler, inloggad och synkad. */
async function phone(userId: string): Promise<{ db: Db; sync: Sync }> {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => fakeClient(userId) }));
  const db = await import('./db');
  const sync = await import('./sync');
  sync.startSync();
  await waitFor(() => sync.getSyncState().status === 'synkad');
  return { db, sync };
}

async function waitFor(done: () => boolean) {
  for (let i = 0; i < 200 && !done(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(done()).toBe(true);
}

const MONTH = '2030-11';
const byName = (list: Category[], name: string) => list.find((c) => c.name === name)!;

beforeAll(() => {
  const listeners = { addEventListener() {} };
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { ...listeners, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0 });
  vi.stubGlobal('document', { ...listeners, visibilityState: 'visible' });
  vi.stubGlobal('location', { hash: '', pathname: '/', search: '', origin: 'http://localhost' });
  vi.stubGlobal('history', { replaceState() {} });
  vi.stubGlobal('confirm', () => true);
});

describe('två telefoner ändrar samma månad', () => {
  it('båda ändringarna finns kvar på båda telefonerna, och inga andra belopp ändras', async () => {
    const erik = await phone('erik');
    const cassandra = await phone('cassandra');

    const start = (await erik.db.getBudget(MONTH)).categories;
    expect((await cassandra.db.getBudget(MONTH)).categories).toEqual(start);

    // Erik bockar Hem & hushåll som betald, Cassandra ändrar Telefoni. Ingen har synkat emellan.
    await erik.db.updateBudget(MONTH, (list) =>
      list.map((c) => (c.name === 'Hem & hushåll' ? { ...c, paidMonth: MONTH } : c)),
    );
    await cassandra.db.updateBudget(MONTH, (list) =>
      list.map((c) => (c.name === 'Telefoni' ? { ...c, monthlyBudget: 2299 } : c)),
    );

    await erik.sync.syncNow();
    await cassandra.sync.syncNow();
    await erik.sync.syncNow();

    for (const p of [erik, cassandra]) {
      const now = (await p.db.getBudget(MONTH)).categories;
      expect(byName(now, 'Hem & hushåll').paidMonth).toBe(MONTH);
      expect(byName(now, 'Telefoni').monthlyBudget).toBe(2299);
      // Allt annat är exakt som förut.
      const untouched = (list: Category[]) => list.filter((c) => c.name !== 'Telefoni').map((c) => ({ ...c, paidMonth: undefined }));
      expect(untouched(now)).toEqual(untouched(start));
      expect((await p.sync.getSyncState()).pending).toBe(0);
    }
    expect((await erik.db.getBudget(MONTH)).categories).toEqual((await cassandra.db.getBudget(MONTH)).categories);
    // Månaden efter fick samma kopia på båda och påverkades inte.
    expect((await erik.db.getBudget('2030-12')).categories).toEqual(start);
    expect((await cassandra.db.getBudget('2030-12')).categories).toEqual(start);
  });

  it('en ändring med äldre klocka försvinner inte (servern kräver nyare tidsstämpel)', async () => {
    const erik = await phone('erik');
    const cassandra = await phone('cassandra');
    const month = '2031-03';

    await cassandra.db.updateBudget(month, (list) =>
      list.map((c) => (c.name === 'Försäkringar' ? { ...c, monthlyBudget: 2100 } : c)),
    );
    // Eriks ändring görs efter, men Cassandras skickas först med en tidsstämpel långt fram.
    const realNow = Date.now;
    Date.now = () => realNow() + 60 * 60 * 1000;
    await cassandra.sync.syncNow();
    Date.now = realNow;
    await erik.db.updateBudget(month, (list) =>
      list.map((c) => (c.name === 'Abonnemang' ? { ...c, monthlyBudget: 1750.5 } : c)),
    );
    await erik.sync.syncNow();
    await cassandra.sync.syncNow();

    for (const p of [erik, cassandra]) {
      const now = (await p.db.getBudget(month)).categories;
      expect(byName(now, 'Försäkringar').monthlyBudget).toBe(2100);
      expect(byName(now, 'Abonnemang').monthlyBudget).toBe(1750.5);
    }
  });

  it('en ändring som inte krockar skickas som den är', async () => {
    const erik = await phone('erik');
    const cassandra = await phone('cassandra');
    const month = '2032-06';
    await erik.db.updateBudget(month, (list) => list.map((c) => (c.name === 'Billån' ? { ...c, paidMonth: month } : c)));
    await erik.sync.syncNow();
    const sent = server.get(`${HOUSEHOLD}|budgets|${month}`)!.data as { categories: Category[] };
    expect(sent.categories).toEqual((await erik.db.getBudget(month)).categories);
    await cassandra.sync.syncNow();
    expect((await cassandra.db.getBudget(month)).categories).toEqual(sent.categories);
  });
});

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Ett exempel per lager i vanor-databasen som den såg ut i version 6, med samma form som riktiga poster. */
const before: Record<string, object> = {
  habits: { id: 'h1', name: 'Läsa', goal: 5, order: 0 },
  checks: { key: '2026-11-03|h1', date: '2026-11-03', habitId: 'h1' },
  pauses: { date: '2026-11-04' },
  workouts: { id: 'w1', date: '2026-10-01', kind: 'löpning' },
  tasks: { id: 't1', title: 'Ring tandläkaren', date: '2026-11-10' },
  health: { date: '2026-11-02', steps: 8432 },
  kunskap_people: { id: 'p1', name: 'Warren Buffett' },
  kunskap_votes: { cardId: 'k1', vote: 'up' },
  kunskap_cards: { id: 'k1', title: 'Ränta på ränta' },
  kunskap_settings: { id: 'generation', enabled: true },
  kunskap_batches: { id: 'b1', cost: 0.12 },
  outbox: { key: 'habits:h1', store: 'habits', id: 'h1', data: { id: 'h1' }, deleted: false, ts: 1700000000000 },
  meta: { key: 'sync', value: { userId: 'u1', lastPull: '2026-11-01T00:00:00Z' } },
};

const KEY_PATHS: Record<string, string> = { checks: 'key', pauses: 'date', health: 'date', kunskap_votes: 'cardId', outbox: 'key', meta: 'key' };

async function makeV6() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('vanor', 6);
    req.onupgradeneeded = () => {
      for (const name of Object.keys(before)) req.result.createObjectStore(name, { keyPath: KEY_PATHS[name] ?? 'id' });
      for (const [name, record] of Object.entries(before)) req.transaction!.objectStore(name).put(record);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
}

/** Nytt modulläge med färsk databas: store.ts håller sin anslutning på modulnivå. */
async function freshStore() {
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
}

describe('vanor-databasen, version 7 (Akademin)', () => {
  beforeEach(freshStore);
  afterEach(() => vi.unstubAllGlobals());

  it('lämnar gamla poster orörda, lägger till tomma lager och nollställer lastPull', async () => {
    await makeV6();
    const store = await import('./store');
    expect(await store.loadAkademinRecords('akademin_companies')).toEqual([]);
    for (const name of ['akademin_progress', 'akademin_answers', 'akademin_reports', 'akademin_journal', 'akademin_settings'] as const) {
      expect(await store.loadAkademinRecords(name), name).toEqual([]);
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('vanor');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(db.version).toBe(7);
    for (const [name, record] of Object.entries(before)) {
      if (name === 'meta') continue;
      const rows = await new Promise<unknown[]>((resolve, reject) => {
        const req = db.transaction(name).objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      expect(rows, name).toEqual([record]);
    }
    db.close();

    expect(await store.getMeta('sync')).toEqual({ userId: 'u1', lastPull: null });
  });

  it('en ny tom databas får ingen sync-post', async () => {
    const store = await import('./store');
    expect(await store.getMeta('sync')).toBeUndefined();
  });
});

describe('Akademins lager och synken', () => {
  beforeEach(freshStore);
  afterEach(() => vi.unstubAllGlobals());

  it('saveAkademinRecord köar en ändring i outbox', async () => {
    const store = await import('./store');
    await store.saveAkademinRecord('akademin_companies', { id: 'c1', name: 'Investor' });
    expect(await store.loadAkademinRecords('akademin_companies')).toEqual([{ id: 'c1', name: 'Investor' }]);
    const outbox = await store.getOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ store: 'akademin_companies', id: 'c1', deleted: false });
  });

  it('applyRemote lägger in poster från servern i Akademins lager', async () => {
    const store = await import('./store');
    await store.applyRemote([{ store: 'akademin_reports', id: 'r1', data: { id: 'r1', companyId: 'c1' }, deleted: false }]);
    expect(await store.loadAkademinRecords('akademin_reports')).toEqual([{ id: 'r1', companyId: 'c1' }]);
  });

  it('deleteAkademinRecords tar bort poster i flera lager och köar borttagningarna', async () => {
    const store = await import('./store');
    await store.saveAkademinRecord('akademin_companies', { id: 'c1' });
    await store.saveAkademinRecord('akademin_reports', { id: 'r1' });
    await store.deleteAkademinRecords([
      { store: 'akademin_companies', id: 'c1' },
      { store: 'akademin_reports', id: 'r1' },
    ]);
    expect(await store.loadAkademinRecords('akademin_companies')).toEqual([]);
    expect(await store.loadAkademinRecords('akademin_reports')).toEqual([]);
    const outbox = await store.getOutbox();
    expect(outbox.map((o) => [o.key, o.deleted])).toEqual([
      ['akademin_companies:c1', true],
      ['akademin_reports:r1', true],
    ]);
  });
});

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Skapar databasen som den såg ut i version 11, med det gamla billånet. */
async function makeV11(loan: object) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('budget', 11);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const name of ['categories', 'assets', 'goals', 'wishes', 'debts', 'loans']) d.createObjectStore(name, { keyPath: 'id' });
      const t = d.createObjectStore('transactions', { keyPath: 'id' });
      t.createIndex('date', 'date');
      t.createIndex('categoryId', 'categoryId');
      d.createObjectStore('income', { keyPath: 'month' });
      d.createObjectStore('budgets', { keyPath: 'month' });
      d.createObjectStore('outbox', { keyPath: 'key' });
      d.createObjectStore('meta', { keyPath: 'key' });
      req.transaction!.objectStore('loans').put(loan);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
}

describe('uppgradering till version 12', () => {
  it('byter det gamla billånet mot siffrorna från LF Finans, och behåller valet om extra betalning', async () => {
    await makeV11({ id: 'billan', name: 'Billån', balance: 100000, annualRate: 10, monthlyPayment: 1586, amortization: 750, categoryName: 'Billån', startMonth: '2026-11', payExtra: false });
    const { getLoans } = await import('./db');
    const [loan] = await getLoans();
    expect([loan.balance, loan.annualRate, loan.fees, loan.payExtra]).toEqual([95927, 8.45, 143, false]);
  });
});

describe('uppgradering till version 13', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lämnar alla befintliga poster orörda, lägger till tomma lager för innehav och affärer och köar inget', async () => {
    const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);

    // Ett exempel per lager, med samma form som riktiga poster.
    const before: Record<string, object> = {
      categories: { id: 'c1', name: 'Hem & hushåll', type: 'fixed', monthlyBudget: 8000 },
      budgets: { month: '2026-11', categories: [{ id: 'c1', name: 'Hem & hushåll', type: 'fixed', monthlyBudget: 8000 }] },
      transactions: { id: 't1', date: '2026-11-03', categoryId: 'c1', amount: 1234.5, description: 'Hyra' },
      income: { month: '2026-11', amount: 52000.25 },
      debts: { id: 'd1', name: 'Studielån', balance: 150000 },
      assets: { id: 'a1', name: 'Sparkonto', type: 'savings', value: 80000.5 },
      goals: { id: 'g1', name: 'Buffert', targetAmount: 100000 },
      wishes: { id: 'w1', name: 'Cykel', price: 7999 },
      loans: { id: 'l1', name: 'Annat lån', balance: 12345.67, annualRate: 4.2, monthlyPayment: 900 },
      outbox: { key: 'assets:a1', store: 'assets', id: 'a1', data: { id: 'a1' }, deleted: false, ts: 1700000000000 },
      meta: { key: 'lastSync', value: '2026-11-06T10:00:00.000Z' },
    };

    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('budget', 12);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const name of ['categories', 'assets', 'goals', 'wishes', 'debts', 'loans']) d.createObjectStore(name, { keyPath: 'id' });
        const t = d.createObjectStore('transactions', { keyPath: 'id' });
        t.createIndex('date', 'date');
        t.createIndex('categoryId', 'categoryId');
        d.createObjectStore('income', { keyPath: 'month' });
        d.createObjectStore('budgets', { keyPath: 'month' });
        d.createObjectStore('outbox', { keyPath: 'key' });
        d.createObjectStore('meta', { keyPath: 'key' });
        for (const [name, record] of Object.entries(before)) req.transaction!.objectStore(name).put(record);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    old.close();

    const db = await import('./db');
    expect(await db.getHoldings()).toEqual([]);
    expect(await db.getTrades()).toEqual([]);

    const now = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('budget');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(now.version).toBe(13);
    for (const [name, record] of Object.entries(before)) {
      const rows = await new Promise<unknown[]>((resolve, reject) => {
        const req = now.transaction(name).objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      expect(rows, name).toEqual([record]);
    }
    now.close();
  });
});

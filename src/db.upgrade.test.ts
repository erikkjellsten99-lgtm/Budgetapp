import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

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

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Färsk lokal ekonomidatabas: db.ts håller sin anslutning på modulnivå. */
async function freshEconomy() {
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  const db = await import('../db');
  const links = await import('./economyLinks');
  return { db, links };
}

describe('economyLinks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ger innehavens id och namn och affärernas id, innehav, datum och sida', async () => {
    const { db, links } = await freshEconomy();
    await db.saveHoldingWithTrade(
      { id: 'h1', name: 'Volvo B', type: 'stock', ticker: 'VOLV-B.ST' },
      { id: 't1', holdingId: 'h1', date: '2026-10-18', side: 'buy', quantity: 10, price: 250, fee: 39 },
    );
    expect(await links.loadEconomyLinks()).toEqual({
      holdings: [{ id: 'h1', name: 'Volvo B' }],
      trades: [{ id: 't1', holdingId: 'h1', date: '2026-10-18', side: 'buy' }],
    });
  });

  it('läser bara: ekonomidatabasens outbox är tom efter anropet', async () => {
    const { db, links } = await freshEconomy();
    await db.saveHoldingWithTrade(
      { id: 'h1', name: 'Volvo B', type: 'stock' },
      { id: 't1', holdingId: 'h1', date: '2026-10-18', side: 'sell', quantity: 1, price: 1, fee: 0 },
    );
    await db.clearOutbox(await db.getOutbox());
    expect(await db.getOutbox()).toEqual([]);
    await links.loadEconomyLinks();
    expect(await db.getOutbox()).toEqual([]);
  });

  it('en tom ekonomidatabas ger tomma listor', async () => {
    const { links } = await freshEconomy();
    expect(await links.loadEconomyLinks()).toEqual({ holdings: [], trades: [] });
  });
});

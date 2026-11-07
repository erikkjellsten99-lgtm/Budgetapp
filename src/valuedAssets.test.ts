import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asset, Holding } from './types';

const assets: Asset[] = [{ id: 'a1', name: 'Spar', amount: 10, updated: '2026-10-01' }];
let holdings: Holding[] = [];
vi.mock('./db', () => ({
  getAssets: vi.fn(async () => assets),
  getHoldings: vi.fn(async () => holdings),
  getTrades: vi.fn(async () => []),
  today: () => '2026-11-07',
}));
vi.mock('./prices', () => ({ loadPrices: vi.fn(async () => ({})) }));

import { getAssets } from './db';
import { loadPrices } from './prices';
import { getValuedAssets } from './valuedAssets';

beforeEach(() => {
  vi.mocked(loadPrices).mockClear();
  holdings = [];
});

describe('getValuedAssets', () => {
  it('ger samma objekt som getAssets utan fromHoldings och rör inte kurserna', async () => {
    holdings = [{ id: 'h1', name: 'X', type: 'stock', ticker: 'X.ST', assetId: 'a1' }];
    const res = await getValuedAssets();
    expect(res).toBe(await getAssets());
    expect(res[0]).toBe(assets[0]);
    expect(loadPrices).not.toHaveBeenCalled();
  });

  it('räknar kontanter för konto med fromHoldings', async () => {
    const acct: Asset = { id: 'a2', name: 'Avanza', amount: 0, updated: '', fromHoldings: true, cash: 500 };
    vi.mocked(getAssets).mockResolvedValueOnce([acct]);
    const [res] = await getValuedAssets();
    expect(res.amount).toBe(500);
    expect(loadPrices).not.toHaveBeenCalled();
  });
});

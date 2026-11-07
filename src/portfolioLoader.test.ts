import { describe, expect, it, vi } from 'vitest';
import { createPortfolioLoader, type PortfolioState } from './portfolioLoader';
import type { Holding, PricePoint } from './types';

const h: Holding = { id: 'h1', name: 'X', type: 'stock', ticker: 'X.ST' };
const old: Record<string, PricePoint[]> = { 'X.ST': [{ date: '2026-11-05', close: 1 }] };
const fresh: Record<string, PricePoint[]> = { 'X.ST': [{ date: '2026-11-06', close: 2 }] };

function setup(refresh: () => Promise<boolean>, loadPrices: () => Promise<Record<string, PricePoint[]>>) {
  const state: Partial<PortfolioState> = {};
  const deps = {
    getHoldings: async () => [h],
    getTrades: async () => [],
    loadPrices: vi.fn(loadPrices),
    refreshPrices: vi.fn(refresh),
  };
  const loader = createPortfolioLoader(deps, (p) => Object.assign(state, p));
  return { state, deps, loader };
}

describe('createPortfolioLoader', () => {
  it('läser om kurserna när refreshPrices ger true', async () => {
    let fetched = false;
    const { state, deps, loader } = setup(async () => (fetched = true), async () => (fetched ? fresh : old));
    await loader.load();
    expect(deps.refreshPrices).toHaveBeenCalledTimes(1);
    expect(state.prices).toBe(fresh);
  });

  it('en nyare läsning hindrar inte de nyhämtade kurserna', async () => {
    let fetched = false;
    let release!: (v: boolean) => void;
    let calls = 0;
    const { state, loader } = setup(
      () => {
        if (calls++ > 0) return Promise.resolve(false);
        return new Promise<boolean>((r) => (release = r));
      },
      async () => (fetched ? fresh : old),
    );
    const first = loader.load();
    await new Promise((r) => setTimeout(r, 0));
    await loader.load(); // nyare läsning, gamla kurser
    expect(state.prices).toBe(old);
    fetched = true;
    release(true);
    await first;
    expect(state.prices).toBe(fresh);
  });

  it('varje load ber om kurser, och true ger ingen loop', async () => {
    const { deps, loader } = setup(async () => true, async () => old);
    await loader.load();
    await loader.load();
    expect(deps.refreshPrices).toHaveBeenCalledTimes(2);
  });
});

import type { Holding, PricePoint, Trade } from './types';

export interface PortfolioState {
  holdings: Holding[];
  trades: Trade[];
  prices: Record<string, PricePoint[]>;
}

export interface PortfolioDeps {
  getHoldings: () => Promise<Holding[]>;
  getTrades: () => Promise<Trade[]>;
  loadPrices: (tickers: string[]) => Promise<Record<string, PricePoint[]>>;
  refreshPrices: (holdings: Holding[], trades: Trade[]) => Promise<boolean>;
}

/**
 * Läser innehav, affärer och kurser, ber sedan om nya kurser och läser om kurserna om det kom några.
 * Ett äldre svar får inte skriva över ett nyare. refreshPrices ändrar inget som ger onDataChange, så det blir ingen loop.
 */
export function createPortfolioLoader(deps: PortfolioDeps, set: (patch: Partial<PortfolioState>) => void) {
  let counter = 0;

  /** Ett läsvarv. Returnerar null om ett nyare varv har börjat, annars det som lästes. */
  async function pass(): Promise<{ holdings: Holding[]; trades: Trade[] } | null> {
    const id = ++counter;
    const [holdings, trades] = await Promise.all([deps.getHoldings(), deps.getTrades()]);
    if (id !== counter) return null;
    // Innehav och affärer först, så att kontanter och manuella kurser räknas även om kurserna inte går att hämta.
    set({ holdings, trades });
    try {
      const tickers = [...new Set(holdings.flatMap((h) => (h.ticker ? [h.ticker] : [])))].sort();
      const prices = await deps.loadPrices(tickers);
      if (id !== counter) return null;
      set({ prices });
    } catch {
      // Kurserna går inte att läsa nu: behåll de vi har.
    }
    return { holdings, trades };
  }

  async function load(): Promise<void> {
    const read = await pass();
    if (!read) return; // Det nyare varvet ber själv om kurser.
    let refreshed = false;
    try {
      refreshed = await deps.refreshPrices(read.holdings, read.trades);
    } catch {
      // Ingen kurshämtning nu.
    }
    if (refreshed) await pass();
  }

  return { load };
}

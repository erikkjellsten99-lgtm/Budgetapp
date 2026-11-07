import { getAssets, getHoldings, getTrades, today } from './db';
import { loadPrices } from './prices';
import { summarize, withHoldingValues } from '../supabase/functions/inbox/portfolio.ts';
import type { Asset, PricePoint } from './types';

/**
 * Tillgångarna med värdet för konton som räknas från innehaven. Appen, Prognos, Jarvis och Siri ska räkna samma.
 * Utan sådana konton är det exakt getAssets() och ingen kurs läses.
 */
export async function getValuedAssets(): Promise<Asset[]> {
  const assets = await getAssets();
  if (!assets.some((a) => a.fromHoldings)) return assets;
  const [holdings, trades] = await Promise.all([getHoldings(), getTrades()]);
  const tickers = [...new Set(holdings.flatMap((h) => (h.ticker ? [h.ticker] : [])))];
  let prices: Record<string, PricePoint[]> = {};
  if (tickers.length > 0) {
    try {
      prices = await loadPrices(tickers);
    } catch {
      // Utan kurser räknas innehaven utan värde (se missingValues).
    }
  }
  return withHoldingValues(assets, summarize(holdings, trades, prices, today()));
}

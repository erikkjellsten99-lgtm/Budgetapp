import { useEffect, useMemo, useRef, useState } from 'react';
import { getHoldings, getTrades, onDataChange, today } from './db';
import { loadPrices, refreshPrices } from './prices';
import { createPortfolioLoader, type PortfolioState } from './portfolioLoader';
import { summarize, type HoldingSummary } from '../supabase/functions/inbox/portfolio.ts';
import type { Holding, PricePoint, Trade } from './types';

export interface Portfolio {
  holdings: Holding[];
  trades: Trade[];
  prices: Record<string, PricePoint[]>;
  rows: HoldingSummary[];
  reload: () => Promise<void>;
}

/**
 * Innehav, affärer och kurser, och raderna som räknas av dem. Anropas en gång, i App.
 * Läser om och ber om nya kurser (högst en hämtning per dygn och ändring) vid start och när datan ändras,
 * här eller på andra telefonen.
 */
export function usePortfolio(): Portfolio {
  const [state, setState] = useState<PortfolioState>({ holdings: [], trades: [], prices: {} });
  const loader = useRef<ReturnType<typeof createPortfolioLoader> | null>(null);
  loader.current ??= createPortfolioLoader({ getHoldings, getTrades, loadPrices, refreshPrices }, (patch) =>
    setState((prev) => ({ ...prev, ...patch })),
  );

  useEffect(() => {
    const load = () => {
      loader.current!.load().catch(() => {});
    };
    load();
    return onDataChange(load);
  }, []);

  const rows = useMemo(
    () => summarize(state.holdings, state.trades, state.prices, today()),
    [state.holdings, state.trades, state.prices],
  );
  return { ...state, rows, reload: () => loader.current!.load() };
}

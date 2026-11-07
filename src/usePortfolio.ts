import { useCallback, useEffect, useMemo, useState } from 'react';
import { getHoldings, getTrades, onDataChange, today } from './db';
import { loadPrices, refreshPrices } from './prices';
import { summarize, type HoldingSummary } from '../supabase/functions/inbox/portfolio.ts';
import type { Holding, PricePoint, Trade } from './types';

export interface Portfolio {
  holdings: Holding[];
  trades: Trade[];
  prices: Record<string, PricePoint[]>;
  rows: HoldingSummary[];
  reload: () => Promise<unknown>;
}

/**
 * Innehav, affärer och kurser, och raderna som räknas av dem. Anropas en gång, i App.
 * Hämtar nya kurser vid start (högst en gång per dygn) och läser om när datan ändras, här eller på andra telefonen.
 */
export function usePortfolio(): Portfolio {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Record<string, PricePoint[]>>({});

  // Innehav och affärer sätts först, så att kontanter och manuella kurser räknas även om kurserna inte går att hämta.
  const reload = useCallback(async () => {
    const [h, t] = await Promise.all([getHoldings(), getTrades()]);
    setHoldings(h);
    setTrades(t);
    try {
      setPrices(await loadPrices([...new Set(h.flatMap((x) => (x.ticker ? [x.ticker] : [])))]));
    } catch {
      // Kurserna går inte att läsa nu: behåll de vi har.
    }
    return { holdings: h, trades: t };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const first = await reload();
      if (alive && (await refreshPrices(first.holdings, first.trades))) await reload();
    })().catch(() => {});
    const stop = onDataChange(() => {
      reload().catch(() => {});
    });
    return () => {
      alive = false;
      stop();
    };
  }, [reload]);

  const rows = useMemo(() => summarize(holdings, trades, prices, today()), [holdings, trades, prices]);
  return { holdings, trades, prices, rows, reload };
}

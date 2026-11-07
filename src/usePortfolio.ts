import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHoldings, getTrades, onDataChange, today } from './db';
import { loadPrices, refreshPrices } from './prices';
import { summarize, type HoldingSummary } from '../supabase/functions/inbox/portfolio.ts';
import type { Holding, PricePoint, Trade } from './types';

export interface Portfolio {
  holdings: Holding[];
  trades: Trade[];
  prices: Record<string, PricePoint[]>;
  rows: HoldingSummary[];
  reload: () => Promise<void>;
}

const tickersOf = (holdings: Holding[]) => [...new Set(holdings.flatMap((x) => (x.ticker ? [x.ticker] : [])))].sort();

/**
 * Innehav, affärer och kurser, och raderna som räknas av dem. Anropas en gång, i App.
 * Hämtar nya kurser vid start (högst en gång per dygn) och läser om när datan ändras, här eller på andra telefonen.
 */
export function usePortfolio(): Portfolio {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [prices, setPrices] = useState<Record<string, PricePoint[]>>({});
  // Ett äldre svar får inte skriva över ett nyare.
  const counter = useRef(0);
  const loadedTickers = useRef<string | null>(null);

  // Innehav och affärer sätts först, så att kontanter och manuella kurser räknas även om kurserna inte går att hämta.
  // Kurserna läses om bara när tickers ändrats, eller när force är satt.
  const load = useCallback(async (force: boolean) => {
    const id = ++counter.current;
    const [h, t] = await Promise.all([getHoldings(), getTrades()]);
    if (id !== counter.current) return { holdings: h, trades: t };
    setHoldings(h);
    setTrades(t);
    const tickers = tickersOf(h);
    const key = tickers.join(',');
    if (force || key !== loadedTickers.current) {
      try {
        const p = await loadPrices(tickers);
        if (id === counter.current) {
          setPrices(p);
          loadedTickers.current = key;
        }
      } catch {
        // Kurserna går inte att läsa nu: behåll de vi har.
      }
    }
    return { holdings: h, trades: t };
  }, []);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const first = await load(true);
      if (alive && (await refreshPrices(first.holdings, first.trades))) await load(true);
    })().catch(() => {});
    const stop = onDataChange(() => {
      load(false).catch(() => {});
    });
    return () => {
      alive = false;
      stop();
    };
  }, [load]);

  const rows = useMemo(() => summarize(holdings, trades, prices, today()), [holdings, trades, prices]);
  return { holdings, trades, prices, rows, reload };
}

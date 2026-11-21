// Akademin: läser namn och id på innehav och affärer i Investeringar, för att kunna länka. Bara läsfunktionerna
// importeras, så inget här kan skriva i ekonomidatan, och ingen kurshämtning startas.
import { getHoldings, getTrades } from '../db';
import type { DateKey } from './types';

export interface EconomyLinks {
  holdings: { id: string; name: string }[];
  trades: { id: string; holdingId: string; date: DateKey; side: 'buy' | 'sell' }[];
}

export async function loadEconomyLinks(): Promise<EconomyLinks> {
  const [holdings, trades] = await Promise.all([getHoldings(), getTrades()]);
  return {
    holdings: holdings.map((h) => ({ id: h.id, name: h.name })),
    trades: trades.map((t) => ({ id: t.id, holdingId: t.holdingId, date: t.date, side: t.side })),
  };
}

// Innehavens nyckeltal. Rena funktioner som appen och servern kan dela, så att alla räknar GAV på samma sätt.

import type { Trade } from './types.ts';

/** Så här mycket andelar får avvika innan det räknas som noll (flyttal). */
const EPSILON = 1e-9;

export interface Position {
  /** Antal andelar som ägs. */
  quantity: number;
  /** Genomsnittligt anskaffningsvärde per andel i kronor, courtage inräknat. */
  gav: number;
  /** Kvarvarande andelar gånger GAV, i kronor. */
  invested: number;
  /** Vinst eller förlust på sålda andelar i kronor, efter courtage. */
  realized: number;
}

/** Affärerna i tidsordning. Samma datum: köp före sälj. Ändrar inte listan. */
function sorted(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.side === b.side) return 0;
    return a.side === 'buy' ? -1 : 1;
  });
}

/** Läget för ett innehav efter affärerna till och med `until` (alla om den utelämnas). */
export function position(trades: Trade[], until?: string): Position {
  let quantity = 0;
  let gav = 0;
  let realized = 0;
  for (const t of sorted(trades)) {
    if (until !== undefined && t.date > until) continue;
    if (t.side === 'buy') {
      gav = (quantity * gav + t.quantity * t.price + t.fee) / (quantity + t.quantity);
      quantity += t.quantity;
    } else {
      realized += t.quantity * (t.price - gav) - t.fee;
      quantity -= t.quantity;
    }
    if (Math.abs(quantity) < EPSILON) {
      quantity = 0;
      gav = 0;
    }
  }
  return { quantity, gav, invested: quantity * gav, realized };
}

/** Felmeddelande om någon försäljning gäller fler andelar än som ägs den dagen, annars null. */
export function validateTrades(trades: Trade[]): string | null {
  let quantity = 0;
  for (const t of sorted(trades)) {
    quantity += t.side === 'buy' ? t.quantity : -t.quantity;
    if (quantity < -EPSILON) return `Ni säljer fler andelar än ni äger den ${t.date}.`;
  }
  return null;
}

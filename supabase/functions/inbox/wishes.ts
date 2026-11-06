// Önskelistans summor. Rena funktioner som både appen (Önskelista, Översikt) och servern
// (sammanfattningen) använder, så att beloppen alltid är samma på båda ställena.

import type { Wish } from './types.ts';

/** Summan av det som bockades i en viss månad. Den månaden räknas det in i rörliga utgifter. */
export function sumPaidIn(wishes: Wish[], month: string): number {
  return wishes.filter((wish) => wish.paidMonth === month).reduce((sum, wish) => sum + wish.amount, 0);
}

/**
 * Delar en lista i önskningar som går att bocka den här månaden (inte köpta, eller köpta den här
 * månaden) och sådant som köptes en annan månad. Det som köptes en annan månad ligger kvar på
 * den månaden: det går inte att bocka i igen, så att den månadens utgifter inte ändras.
 */
export function splitWishes(items: Wish[], month: string): { open: Wish[]; bought: Wish[] } {
  const open = items.filter((wish) => !wish.paidMonth || wish.paidMonth === month);
  const bought = items
    .filter((wish) => wish.paidMonth && wish.paidMonth !== month)
    .sort((a, b) => b.paidMonth!.localeCompare(a.paidMonth!) || byOrder(a, b));
  return { open, bought };
}

/** Summan av det som inte är köpt (ingen månad alls). Det som är köpt, den här eller en annan månad, räknas inte. */
export function sumLeftToBuy(wishes: Wish[]): number {
  return wishes.filter((wish) => !wish.paidMonth).reduce((sum, wish) => sum + wish.amount, 0);
}

/** Något är köpt. Annars är "Kvar att köpa" samma som summan och visas inte. */
export function hasBought(wishes: Wish[]): boolean {
  return wishes.some((wish) => !!wish.paidMonth);
}

export function byOrder(a: Wish, b: Wish): number {
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'sv');
}

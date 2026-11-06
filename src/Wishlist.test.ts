import { describe, expect, it } from 'vitest';
import { hasBought, splitWishes, sumLeftToBuy } from './Wishlist';
import type { Wish } from './types';

const wish = (id: string, paidMonth?: string, order = 0): Wish => ({ id, list: 'erik', name: id, amount: 100, paidMonth, order });

describe('splitWishes', () => {
  const items = [wish('cykel'), wish('jacka', '2026-11', 1), wish('hörlurar', '2026-10', 2), wish('bok', '2026-12', 3)];

  it('går att bocka: inte köpt, eller köpt den visade månaden', () => {
    expect(splitWishes(items, '2026-11').open.map((w) => w.id)).toEqual(['cykel', 'jacka']);
  });

  it('köpt en annan månad ligger för sig, senaste först, och går inte att bocka om', () => {
    expect(splitWishes(items, '2026-11').bought.map((w) => w.id)).toEqual(['bok', 'hörlurar']);
  });

  it('månaden den köptes räknar den som bockad, andra månader inte', () => {
    expect(splitWishes(items, '2026-10').open.map((w) => w.id)).toEqual(['cykel', 'hörlurar']);
    expect(splitWishes(items, '2027-01').open.map((w) => w.id)).toEqual(['cykel']);
  });
});

describe('Kvar att köpa', () => {
  const w = (id: string, amount: number, paidMonth?: string): Wish => ({ id, list: 'erik', name: id, amount, paidMonth });

  it('inget köpt: raden visas inte (samma som summan)', () => {
    const list = [w('cykel', 2499), w('hörlurar', 1200)];
    expect(hasBought(list)).toBe(false);
    expect(sumLeftToBuy(list)).toBe(3699);
  });

  it('något köpt den här månaden: bara det som inte är köpt', () => {
    const list = [w('cykel', 2499, '2026-11'), w('hörlurar', 1200)];
    expect(hasBought(list)).toBe(true);
    expect(sumLeftToBuy(list)).toBe(1200);
  });

  it('allt köpt: 0 kr kvar', () => {
    const list = [w('cykel', 2499, '2026-11'), w('hörlurar', 1200, '2026-12')];
    expect(hasBought(list)).toBe(true);
    expect(sumLeftToBuy(list)).toBe(0);
  });

  it('köpt en annan månad räknas också som köpt', () => {
    const list = [w('cykel', 2499, '2026-10'), w('hörlurar', 1200.5)];
    expect(hasBought(list)).toBe(true);
    expect(sumLeftToBuy(list)).toBe(1200.5);
  });

  it('summan på listan ändras inte', () => {
    const list = [w('cykel', 2499, '2026-10'), w('hörlurar', 1200)];
    expect(list.reduce((s, x) => s + x.amount, 0)).toBe(3699);
  });
});

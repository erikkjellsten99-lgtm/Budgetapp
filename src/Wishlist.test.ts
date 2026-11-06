import { describe, expect, it } from 'vitest';
import { splitWishes } from './Wishlist';
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

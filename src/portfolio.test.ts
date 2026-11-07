import { describe, expect, it } from 'vitest';
import { position, validateTrades } from '../supabase/functions/inbox/portfolio';
import type { Trade } from '../supabase/functions/inbox/types';

let n = 0;
const trade = (
  side: 'buy' | 'sell',
  date: string,
  quantity: number,
  price: number,
  fee = 0,
): Trade => ({ id: `t${n++}`, holdingId: 'h1', date, side, quantity, price, fee });

describe('position', () => {
  it('räknar ett köp med courtage in i GAV', () => {
    expect(position([trade('buy', '2026-01-10', 10, 100, 5)])).toEqual({
      quantity: 10,
      gav: 100.5,
      invested: 1005,
      realized: 0,
    });
  });

  it('räknar genomsnittligt GAV över flera köp', () => {
    const p = position([trade('buy', '2026-01-10', 10, 100), trade('buy', '2026-02-10', 10, 200)]);
    expect(p.gav).toBe(150);
    expect(p.invested).toBe(3000);
  });

  it('behåller GAV vid försäljning och räknar realiserad vinst', () => {
    const p = position([
      trade('buy', '2026-01-10', 10, 100),
      trade('buy', '2026-02-10', 10, 200),
      trade('sell', '2026-03-10', 5, 300, 10),
    ]);
    expect(p.quantity).toBe(15);
    expect(p.gav).toBe(150);
    expect(p.realized).toBe(5 * (300 - 150) - 10);
  });

  it('nollställer GAV efter helförsäljning', () => {
    const p = position([
      trade('buy', '2026-01-10', 10, 100),
      trade('sell', '2026-02-10', 10, 120),
      trade('buy', '2026-03-10', 2, 50),
    ]);
    expect(p.gav).toBe(50);
    expect(p.quantity).toBe(2);
  });

  it('hanterar fondandelar med decimaler', () => {
    const p = position([trade('buy', '2026-01-10', 12.3456, 187.45)]);
    expect(p.quantity).toBe(12.3456);
    expect(p.invested).toBeCloseTo(12.3456 * 187.45, 6);
  });

  it('sorterar affärer på datum, köp före sälj samma dag', () => {
    const p = position([
      trade('sell', '2026-02-10', 5, 120),
      trade('buy', '2026-02-10', 10, 100),
    ]);
    expect(p.quantity).toBe(5);
    expect(p.gav).toBe(100);
    const q = position([
      trade('sell', '2026-02-10', 5, 120),
      trade('buy', '2026-01-10', 10, 100),
    ]);
    expect(q.quantity).toBe(5);
  });

  it('räknar bara affärer till och med until', () => {
    const p = position(
      [trade('buy', '2026-01-10', 10, 100), trade('buy', '2026-04-02', 10, 200)],
      '2026-03-31',
    );
    expect(p.quantity).toBe(10);
    expect(p.gav).toBe(100);
  });
});

describe('validateTrades', () => {
  it('ger felmeddelande när man säljer fler än man äger', () => {
    expect(
      validateTrades([trade('buy', '2026-01-10', 10, 100), trade('sell', '2026-05-01', 11, 100)]),
    ).toBe('Ni säljer fler andelar än ni äger den 2026-05-01.');
  });

  it('ger null för en giltig lista', () => {
    expect(
      validateTrades([trade('buy', '2026-01-10', 10, 100), trade('sell', '2026-05-01', 10, 100)]),
    ).toBeNull();
  });
});

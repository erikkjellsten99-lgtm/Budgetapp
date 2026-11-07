import { describe, expect, it } from 'vitest';
import { parseQuantity, rangeStart, tradeError } from './tradeForm';
import type { Trade } from './types';

const t = (id: string, side: 'buy' | 'sell', date: string, quantity: number, price = 100, fee = 0): Trade => ({
  id,
  holdingId: 'h1',
  date,
  side,
  quantity,
  price,
  fee,
});

describe('parseQuantity', () => {
  it('tar komma och punkt som decimaltecken', () => {
    expect(parseQuantity('12,3456')).toBe(12.3456);
    expect(parseQuantity('12.3456')).toBe(12.3456);
  });
  it('ignorerar mellanslag, även hårda och smala', () => {
    expect(parseQuantity('1 000')).toBe(1000);
    expect(parseQuantity('1 000')).toBe(1000);
    expect(parseQuantity('1 000,5')).toBe(1000.5);
  });
  it('avrundar inte', () => {
    expect(parseQuantity('0,123456789')).toBe(0.123456789);
  });
  it('ger NaN för tomt och skräp', () => {
    expect(parseQuantity('')).toBeNaN();
    expect(parseQuantity('   ')).toBeNaN();
    expect(parseQuantity('abc')).toBeNaN();
    expect(parseQuantity('1,2,3')).toBeNaN();
  });
});

describe('tradeError', () => {
  const buy = t('a', 'buy', '2026-01-10', 10);
  const sell = t('b', 'sell', '2026-02-10', 8);

  it('ger null för ett giltigt utkast', () => {
    expect(tradeError([buy], sell)).toBeNull();
  });

  it('ger felet från validateTrades när ett ändrat köp gör en senare försäljning för stor', () => {
    expect(tradeError([buy, sell], { ...buy, quantity: 5 })).toBe('Ni säljer fler andelar än ni äger den 2026-02-10.');
  });

  it('ersätter affären med samma id i listan', () => {
    expect(tradeError([buy, sell], { ...sell, quantity: 10 })).toBeNull();
  });

  it('en ny affär läggs till i listan', () => {
    expect(tradeError([buy], t('c', 'sell', '2026-02-10', 11))).toBe('Ni säljer fler andelar än ni äger den 2026-02-10.');
  });

  it('avvisar antal som inte är större än 0, för köp och sälj', () => {
    for (const side of ['buy', 'sell'] as const) {
      for (const q of [0, -1, NaN]) {
        expect(tradeError([buy], t('x', side, '2026-02-10', q))).toBe('Skriv ett antal större än 0.');
      }
    }
  });

  it('avvisar kurs som inte är större än 0', () => {
    for (const p of [0, -5, NaN]) {
      expect(tradeError([buy], t('x', 'buy', '2026-02-10', 1, p))).toBe('Skriv en kurs större än 0.');
    }
  });

  it('avvisar negativt eller ogiltigt courtage men tillåter 0', () => {
    expect(tradeError([buy], t('x', 'buy', '2026-02-10', 1, 100, -1))).toBe('Courtage kan inte vara negativt.');
    expect(tradeError([buy], t('x', 'buy', '2026-02-10', 1, 100, NaN))).toBe('Courtage kan inte vara negativt.');
    expect(tradeError([buy], t('x', 'buy', '2026-02-10', 1, 100, 0))).toBeNull();
  });

  it('avvisar datum som inte finns', () => {
    for (const d of ['', '2026-13-01', '2026-02-30', '10/02/2026', '2026-2-3']) {
      expect(tradeError([buy], t('x', 'buy', d, 1))).toBe('Välj ett datum.');
    }
  });
});

describe('rangeStart', () => {
  it('räknar 31 och 365 dagar bakåt', () => {
    expect(rangeStart('1m', '2026-11-07', '2025-01-01')).toBe('2026-10-07');
    expect(rangeStart('1y', '2026-11-07', '2025-01-01')).toBe('2025-11-07');
  });
  it('börjar vid första affären för "Sedan köp"', () => {
    expect(rangeStart('all', '2026-11-07', '2026-02-03')).toBe('2026-02-03');
    expect(rangeStart('all', '2026-11-07', null)).toBe('2026-11-07');
  });
});

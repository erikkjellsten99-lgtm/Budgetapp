import { describe, expect, it } from 'vitest';
import {
  allocation,
  position,
  priceOn,
  quote,
  summarize,
  totals,
  validateTrades,
  valueOverTime,
  withHoldingValues,
  missingValues,
} from '../supabase/functions/inbox/portfolio';
import type { Asset, Holding, PricePoint, Trade } from '../supabase/functions/inbox/types';

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

const holding = (id: string, extra: Partial<Holding> = {}): Holding => ({
  id,
  name: id,
  type: 'stock',
  ...extra,
});
const buyFor = (holdingId: string, date: string, quantity: number, price: number): Trade => ({
  ...trade('buy', date, quantity, price),
  holdingId,
});

describe('priceOn', () => {
  const points: PricePoint[] = [
    { date: '2026-11-03', close: 100 },
    { date: '2026-11-06', close: 110 },
  ];

  it('ger senaste kurs på eller före datumet', () => {
    expect(priceOn(points, '2026-11-04')).toEqual(points[0]);
    expect(priceOn(points, '2026-11-06')).toEqual(points[1]);
  });

  it('ger null före första kursen', () => {
    expect(priceOn(points, '2026-11-02')).toBeNull();
  });
});

describe('quote', () => {
  const points: PricePoint[] = [{ date: '2026-10-30', close: 120 }];

  it('använder marknadskurs när ticker och kurs finns', () => {
    const q = quote(holding('a', { ticker: 'A.ST' }), points, '2026-11-04');
    expect(q).toEqual({ price: 120, date: '2026-10-30', source: 'market', stale: false });
  });

  it('använder manuell kurs utan ticker', () => {
    const q = quote(holding('a', { manualPrice: 50, manualPriceDate: '2026-11-03' }), [], '2026-11-04');
    expect(q).toEqual({ price: 50, date: '2026-11-03', source: 'manual', stale: false });
  });

  it('ger ingen kurs när varken marknad eller manuell finns', () => {
    expect(quote(holding('a'), [], '2026-11-04')).toEqual({
      price: null,
      date: null,
      source: 'none',
      stale: false,
    });
  });

  it('markerar kurs äldre än 4 vardagar som gammal', () => {
    const h = holding('a', { ticker: 'A.ST' });
    expect(quote(h, points, '2026-11-05').stale).toBe(true);
    expect(quote(h, points, '2026-11-04').stale).toBe(false);
  });

  it('räknar gammal även för manuell kurs', () => {
    const h = holding('a', { manualPrice: 50, manualPriceDate: '2026-10-30' });
    expect(quote(h, [], '2026-11-05').stale).toBe(true);
  });
});

describe('summarize och totals', () => {
  const h1 = holding('h1', { ticker: 'A.ST', type: 'fund' });
  const h2 = holding('h2', { type: 'stock' });
  const trades = [buyFor('h1', '2026-01-10', 10, 100), buyFor('h2', '2026-01-10', 5, 100)];
  const prices = { 'A.ST': [{ date: '2026-11-04', close: 120 }] };

  it('räknar värde, förändring och procent', () => {
    const [row] = summarize([h1], trades, prices, '2026-11-04');
    expect(row.value).toBe(1200);
    expect(row.change).toBe(200);
    expect(row.changePct).toBe(0.2);
  });

  it('ger null utan kurs', () => {
    const [row] = summarize([h2], trades, prices, '2026-11-04');
    expect(row.value).toBeNull();
    expect(row.change).toBeNull();
    expect(row.changePct).toBeNull();
  });

  it('totals räknar saknade och summerar bara rader med kurs', () => {
    const rows = summarize([h1, h2], trades, prices, '2026-11-04');
    const t = totals(rows);
    expect(t.missing).toBe(1);
    expect(t.invested).toBe(1500);
    expect(t.value).toBe(1200);
    expect(t.change).toBe(200);
    expect(t.changePct).toBe(0.2);
    expect(t.latestDate).toBe('2026-11-04');
  });

  it('latestDate är äldsta marknadskursen', () => {
    const h3 = holding('h3', { ticker: 'B.ST' });
    const rows = summarize(
      [h1, h3],
      [...trades, buyFor('h3', '2026-01-10', 1, 10)],
      { ...prices, 'B.ST': [{ date: '2026-11-02', close: 10 }] },
      '2026-11-04',
    );
    expect(totals(rows).latestDate).toBe('2026-11-02');
  });

  it('value är null när ingen rad har kurs', () => {
    const t = totals(summarize([h2], trades, prices, '2026-11-04'));
    expect(t.value).toBeNull();
    expect(t.change).toBeNull();
    expect(t.changePct).toBeNull();
  });
});

describe('allocation', () => {
  const fund = holding('f', { type: 'fund', ticker: 'F' });
  const stock = holding('s', { type: 'stock', ticker: 'S' });
  const trades = [buyFor('f', '2026-01-10', 30, 100), buyFor('s', '2026-01-10', 10, 100)];
  const prices = {
    F: [{ date: '2026-11-04', close: 100 }],
    S: [{ date: '2026-11-04', close: 100 }],
  };
  const rows = summarize([stock, fund], trades, prices, '2026-11-04');

  it('fördelar på typ, störst först', () => {
    expect(allocation(rows, 'type')).toEqual([
      { key: 'fund', label: 'Fonder', value: 3000, share: 0.75 },
      { key: 'stock', label: 'Aktier', value: 1000, share: 0.25 },
    ]);
  });

  it('ger tom lista när värdena summerar till 0', () => {
    const zero = summarize([holding('z', { ticker: 'Z' })], [buyFor('z', '2026-01-10', 1, 1)], { Z: [{ date: '2026-11-04', close: 0 }] }, '2026-11-04');
    expect(allocation(zero, 'holding')).toEqual([]);
  });

  it('fördelar på innehav och hoppar över rader utan värde', () => {
    const none = summarize([holding('x')], [buyFor('x', '2026-01-10', 1, 1)], {}, '2026-11-04');
    const slices = allocation([...rows, ...none], 'holding');
    expect(slices.map((s) => s.key)).toEqual(['f', 's']);
  });
});

describe('valueOverTime', () => {
  const h = holding('h1', { ticker: 'A.ST' });
  const trades = [buyFor('h1', '2026-01-15', 10, 100)];

  it('ger en punkt per månad med invested och värde', () => {
    const prices = {
      'A.ST': [
        { date: '2026-01-20', close: 110 },
        { date: '2026-02-27', close: 120 },
        { date: '2026-03-09', close: 130 },
      ],
    };
    expect(valueOverTime([h], trades, prices, '2026-03-10')).toEqual([
      { date: '2026-01-31', invested: 1000, value: 1100 },
      { date: '2026-02-28', invested: 1000, value: 1200 },
      { date: '2026-03-10', invested: 1000, value: 1300 },
    ]);
  });

  it('ger value null när inget innehav har kurs på eller före datumet', () => {
    const prices = { 'A.ST': [{ date: '2026-02-20', close: 120 }] };
    const s = valueOverTime([h], trades, prices, '2026-03-10');
    expect(s.map((p) => p.value)).toEqual([null, 1200, 1200]);
  });

  it('lämnar innehav utan kurs utanför både värde och investerat', () => {
    const g = holding('h2', { ticker: 'B.ST' });
    const both = [...trades, buyFor('h2', '2026-01-15', 5, 100)];
    const prices = { 'A.ST': [{ date: '2026-01-20', close: 110 }] };
    expect(valueOverTime([h, g], both, prices, '2026-02-10')).toEqual([
      { date: '2026-01-31', invested: 1000, value: 1100 },
      { date: '2026-02-10', invested: 1000, value: 1100 },
    ]);
  });

  it('ger tom serie utan affärer', () => {
    expect(valueOverTime([h], [], {}, '2026-03-10')).toEqual([]);
  });
});

describe('withHoldingValues', () => {
  const plain: Asset = { id: 'a1', name: 'Sparkonto', amount: 777, updated: '2026-10-01' };
  const acct: Asset = {
    id: 'a2',
    name: 'Avanza',
    amount: 0,
    updated: '2026-10-01',
    fromHoldings: true,
    cash: 500,
  };
  const row = (assetId: string, value: number | null) =>
    ({
      holding: holding(`h${value}`, { assetId }),
      value,
    }) as unknown as Parameters<typeof withHoldingValues>[1][number];

  it('lämnar konto utan fromHoldings som samma objekt', () => {
    expect(withHoldingValues([plain], [row('a1', 5)])[0]).toBe(plain);
  });

  it('utan konto med fromHoldings är varje element samma objekt, även utan innehav', () => {
    const other: Asset = { id: 'a3', name: 'Hushåll', amount: 12.5, updated: '', spending: true };
    const input = [plain, other];
    for (const rows of [[], [row('a1', 5)]]) {
      const res = withHoldingValues(input, rows);
      expect(res).toHaveLength(2);
      res.forEach((a, i) => expect(a).toBe(input[i]));
    }
  });

  it('summerar kontanter och innehavsvärden, null räknas som 0', () => {
    const [res] = withHoldingValues([acct], [row('a2', 1000), row('a2', null), row('a1', 99)]);
    expect(res.amount).toBe(1500);
    expect(res.fromHoldings).toBe(true);
    expect(res.cash).toBe(500);
    expect(res.name).toBe('Avanza');
    expect(res.updated).toBe('2026-10-01');
  });
});

describe('missingValues', () => {
  const acct: Asset = { id: 'a2', name: 'Avanza', amount: 0, updated: '', fromHoldings: true, cash: 1 };
  const row = (assetId: string, value: number | null) =>
    ({ holding: holding(`h${assetId}${value}`, { assetId }), value }) as unknown as Parameters<typeof missingValues>[1][number];
  it('räknar innehav på kontot utan värde', () => {
    expect(missingValues(acct, [row('a2', null), row('a2', 5), row('a2', null), row('a1', null)])).toBe(2);
    expect(missingValues(acct, [])).toBe(0);
  });
});

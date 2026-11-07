import { beforeEach, describe, expect, it, vi } from 'vitest';

const meta = new Map<string, unknown>();
const getSession = vi.fn();
const rangeMock = vi.fn();
const inMock = vi.fn();

vi.mock('./db', () => ({
  getMeta: async (k: string) => meta.get(k),
  setMeta: async (k: string, v: unknown) => void meta.set(k, v),
  today: () => '2026-11-07',
}));
vi.mock('./vanor/InboxSettings', () => ({ INBOX_URL: 'https://x.test/inbox' }));
vi.mock('./sync', () => {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.in = (...a: unknown[]) => (inMock(...a), q);
  q.order = () => q;
  q.range = (...a: unknown[]) => rangeMock(...a);
  return { supabase: { auth: { getSession: () => getSession() }, from: () => q } };
});

import { loadPrices, refreshPrices, searchTicker } from './prices';
import type { Holding, Trade } from './types';

const h = (id: string, ticker?: string): Holding => ({ id, name: id, type: 'stock', ticker }) as Holding;
const t = (holdingId: string, date: string): Trade =>
  ({ id: `${holdingId}${date}`, holdingId, date, side: 'buy', quantity: 1, price: 1, fee: 0 }) as Trade;

const day1 = new Date(2026, 10, 7, 12);
const day2 = new Date(2026, 10, 8, 12);

const fetchMock = vi.fn();

beforeEach(() => {
  meta.clear();
  fetchMock.mockReset();
  getSession.mockReset();
  rangeMock.mockReset();
  inMock.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ updated: {}, failed: [] }) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('refreshPrices', () => {
  const holdings = [h('a', 'VOLV-B.ST')];
  const trades = [t('a', '2025-05-02'), t('a', '2024-01-10'), t('a', '2025-09-01')];

  it('två anrop samma dag ger ett nätverksanrop, nästa dag ett nytt', async () => {
    expect(await refreshPrices(holdings, trades, day1)).toBe(true);
    await refreshPrices(holdings, trades, day1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await refreshPrices(holdings, trades, day2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('nytt innehav samma dag ger nytt anrop', async () => {
    await refreshPrices(holdings, trades, day1);
    const hs = [...holdings, h('b', 'AAA')];
    await refreshPrices(hs, [...trades, t('b', '2025-03-01')], day1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tickers.map((x: { ticker: string }) => x.ticker)).toEqual([
      'AAA',
      'VOLV-B.ST',
    ]);
  });

  it('tidigare affär i befintligt innehav samma dag ger nytt anrop', async () => {
    await refreshPrices(holdings, trades, day1);
    await refreshPrices(holdings, [...trades, t('a', '2023-06-01')], day1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tickers[0].from).toBe('2023-06-01');
  });

  it('fetch som kastar ger false och sparar inte pricesRefreshedOn', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await refreshPrices(holdings, trades, day1)).toBe(false);
    expect(meta.has('pricesRefreshedOn')).toBe(false);
  });

  it('from är tidigaste datumet bland affärerna, med token', async () => {
    await refreshPrices(holdings, trades, day1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x.test/inbox?action=kurser');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ tickers: [{ ticker: 'VOLV-B.ST', from: '2024-01-10' }] });
  });

  it('hoppar över innehav utan ticker eller affärer, och dubbletter', async () => {
    const hs = [h('a', 'AAA'), h('b'), h('c', 'CCC'), h('d', 'AAA')];
    await refreshPrices(hs, [t('a', '2025-02-01'), t('b', '2025-01-01'), t('d', '2025-01-01')], day1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tickers).toEqual([{ ticker: 'AAA', from: '2025-01-01' }]);
  });

  it('inget att hämta eller utloggad ger false utan anrop', async () => {
    expect(await refreshPrices([h('b')], [], day1)).toBe(false);
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await refreshPrices(holdings, trades, day1)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('svar som inte är 2xx ger false och sparar inte', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'login' }) });
    expect(await refreshPrices(holdings, trades, day1)).toBe(false);
    expect(meta.has('pricesRefreshedOn')).toBe(false);
  });

  it('skickar högst 50 tickers', async () => {
    const hs = Array.from({ length: 60 }, (_, i) => h(`h${i}`, `T${i}`));
    const ts = hs.map((x) => t(x.id, '2025-01-01'));
    await refreshPrices(hs, ts, day1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tickers).toHaveLength(50);
  });
});

describe('loadPrices', () => {
  it('inga tickers ger {} utan fråga', async () => {
    expect(await loadPrices([])).toEqual({});
    expect(rangeMock).not.toHaveBeenCalled();
  });

  it('gör close_sek till tal och grupperar per ticker i datumordning', async () => {
    rangeMock.mockResolvedValue({
      data: [
        { ticker: 'A', date: '2026-11-05', close_sek: '10.5' },
        { ticker: 'B', date: '2026-11-05', close_sek: 7 },
        { ticker: 'A', date: '2026-11-06', close_sek: '11' },
      ],
      error: null,
    });
    expect(await loadPrices(['A', 'B'])).toEqual({
      A: [{ date: '2026-11-05', close: 10.5 }, { date: '2026-11-06', close: 11 }],
      B: [{ date: '2026-11-05', close: 7 }],
    });
  });

  it('hämtar flera sidor om 1000 rader', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ ticker: 'A', date: `d${i}`, close_sek: 1 }));
    rangeMock
      .mockResolvedValueOnce({ data: page, error: null })
      .mockResolvedValueOnce({ data: [{ ticker: 'A', date: 'z', close_sek: 2 }], error: null });
    const r = await loadPrices(['A']);
    expect(r.A).toHaveLength(1001);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe('searchTicker', () => {
  it('tom fråga ger [] utan anrop', async () => {
    expect(await searchTicker('  ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returnerar results och kodar frågan', async () => {
    const results = [{ ticker: 'VOLV-B.ST', name: 'Volvo B', type: 'stock' }];
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results }) });
    expect(await searchTicker('volvo b')).toEqual(results);
    expect(fetchMock.mock.calls[0][0]).toBe('https://x.test/inbox?action=kurssok&q=volvo%20b');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('fel ger null, tom träfflista ger []', async () => {
    fetchMock.mockRejectedValue(new Error('x'));
    expect(await searchTicker('volvo')).toBeNull();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'login' }) });
    expect(await searchTicker('volvo')).toBeNull();
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await searchTicker('volvo')).toBeNull();
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    expect(await searchTicker('volvo')).toEqual([]);
  });
});

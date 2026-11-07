// Innehavens nyckeltal. Rena funktioner som appen och servern kan dela, så att alla räknar GAV på samma sätt.

import type { Asset, Holding, HoldingType, PricePoint, Trade } from './types.ts';

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

/**
 * Kursen räknas som gammal när minst så här många vardagar har gått efter kursdagen.
 * Kursdagen själv räknas som första vardagen, så fre 30/10 är gammal tor 5/11 (5 vardagar) men inte ons 4/11 (4).
 */
const STALE_WEEKDAYS_AFTER = 4;

export type PriceSource = 'market' | 'manual' | 'none';

export interface Quote {
  price: number | null;
  date: string | null;
  source: PriceSource;
  /** Sant om kursen är äldre än 4 vardagar (kursdagen inräknad). */
  stale: boolean;
}

/** Senaste kurspunkten med datum på eller före `date`, annars null. */
export function priceOn(points: PricePoint[], date: string): PricePoint | null {
  let best: PricePoint | null = null;
  for (const p of points) {
    if (p.date <= date && (best === null || p.date > best.date)) best = p;
  }
  return best;
}

/** Antal vardagar (mån–fre, utan helgdagar) efter `from` till och med `to`. */
function weekdaysBetween(from: string, to: string): number {
  const end = Date.parse(`${to}T00:00:00Z`);
  let day = Date.parse(`${from}T00:00:00Z`) + 86_400_000;
  let count = 0;
  for (; day <= end; day += 86_400_000) {
    const dow = new Date(day).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/** Kursen för ett innehav: marknadskurs om den finns, annars den inskrivna, annars ingen. */
export function quote(holding: Holding, points: PricePoint[], today: string): Quote {
  const market = holding.ticker ? priceOn(points, today) : null;
  if (market) {
    return {
      price: market.close,
      date: market.date,
      source: 'market',
      stale: weekdaysBetween(market.date, today) >= STALE_WEEKDAYS_AFTER,
    };
  }
  if (holding.manualPrice !== undefined) {
    const date = holding.manualPriceDate ?? null;
    return {
      price: holding.manualPrice,
      date,
      source: 'manual',
      stale: date !== null && weekdaysBetween(date, today) >= STALE_WEEKDAYS_AFTER,
    };
  }
  return { price: null, date: null, source: 'none', stale: false };
}

export interface HoldingSummary {
  holding: Holding;
  position: Position;
  quote: Quote;
  /** Antal gånger kurs i kronor. Null om kurs saknas. */
  value: number | null;
  /** Värde minus investerat belopp. */
  change: number | null;
  /** Förändring delat med investerat belopp. Null om inget är investerat. */
  changePct: number | null;
}

/** Ett nyckeltalsblock per innehav, räknat på läget `today`. */
export function summarize(
  holdings: Holding[],
  trades: Trade[],
  prices: Record<string, PricePoint[]>,
  today: string,
): HoldingSummary[] {
  return holdings.map((holding) => {
    const pos = position(
      trades.filter((t) => t.holdingId === holding.id),
      today,
    );
    const q = quote(holding, (holding.ticker && prices[holding.ticker]) || [], today);
    const value = q.price === null ? null : pos.quantity * q.price;
    const change = value === null ? null : value - pos.invested;
    const changePct = change === null || pos.invested === 0 ? null : change / pos.invested;
    return { holding, position: pos, quote: q, value, change, changePct };
  });
}

export interface PortfolioTotals {
  invested: number;
  /** Null om ingen rad har kurs. */
  value: number | null;
  change: number | null;
  changePct: number | null;
  realized: number;
  /** Antal innehav utan kurs. */
  missing: number;
  /** Äldsta kursdatum bland innehav med marknadskurs. */
  latestDate: string | null;
}

/** Summerar raderna. Värde, förändring och procent räknas bara på rader med kurs. */
export function totals(rows: HoldingSummary[]): PortfolioTotals {
  let invested = 0;
  let realized = 0;
  let missing = 0;
  let value = 0;
  let valuedInvested = 0;
  let valued = 0;
  let latestDate: string | null = null;
  for (const r of rows) {
    invested += r.position.invested;
    realized += r.position.realized;
    if (r.value === null) {
      missing++;
    } else {
      value += r.value;
      valuedInvested += r.position.invested;
      valued++;
    }
    const d = r.quote.source === 'market' ? r.quote.date : null;
    if (d !== null && (latestDate === null || d < latestDate)) latestDate = d;
  }
  if (valued === 0) {
    return { invested, value: null, change: null, changePct: null, realized, missing, latestDate };
  }
  const change = value - valuedInvested;
  return {
    invested,
    value,
    change,
    changePct: valuedInvested === 0 ? null : change / valuedInvested,
    realized,
    missing,
    latestDate,
  };
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  share: number;
}

const TYPE_LABEL: Record<HoldingType, string> = { stock: 'Aktier', fund: 'Fonder', etf: 'ETF' };

/** Fördelning av värdet per innehav eller typ, störst först. Rader utan värde hoppas över. */
export function allocation(rows: HoldingSummary[], by: 'holding' | 'type'): Slice[] {
  const sums = new Map<string, { label: string; value: number }>();
  for (const r of rows) {
    if (r.value === null) continue;
    const key = by === 'holding' ? r.holding.id : r.holding.type;
    const label = by === 'holding' ? r.holding.name : TYPE_LABEL[r.holding.type];
    const cur = sums.get(key);
    if (cur) cur.value += r.value;
    else sums.set(key, { label, value: r.value });
  }
  let sum = 0;
  for (const s of sums.values()) if (s.value > 0) sum += s.value;
  if (sum <= 0) return [];
  return [...sums.entries()]
    .filter(([, s]) => s.value > 0)
    .map(([key, s]) => ({ key, label: s.label, value: s.value, share: s.value / sum }))
    .sort((a, b) => b.value - a.value);
}

export interface SeriesPoint {
  date: string;
  invested: number;
  /** Null om inget innehav har kurs på eller före datumet. */
  value: number | null;
}

/** Sista dagen i månaden för "YYYY-MM". */
function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Nästa månad efter "YYYY-MM". */
function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Investerat belopp och värde vid månadsskiften, från första affären till `today`.
 * Investerat räknar här bara innehav som har kurs det datumet. Värdet är null först när inget innehav har kurs.
 */
export function valueOverTime(
  holdings: Holding[],
  trades: Trade[],
  prices: Record<string, PricePoint[]>,
  today: string,
): SeriesPoint[] {
  if (trades.length === 0) return [];
  const first = trades.reduce((min, t) => (t.date < min ? t.date : min), trades[0].date);
  const currentMonth = today.slice(0, 7);
  const dates: string[] = [];
  for (let m = first.slice(0, 7); m < currentMonth; m = nextMonth(m)) dates.push(lastDayOfMonth(m));
  dates.push(today);

  return dates.map((date) => {
    let invested = 0;
    let value = 0;
    let held = 0;
    let priced = 0;
    for (const h of holdings) {
      const pos = position(
        trades.filter((t) => t.holdingId === h.id),
        date,
      );
      if (pos.quantity <= 0) {
        invested += pos.invested;
        continue;
      }
      held++;
      const market = h.ticker ? priceOn(prices[h.ticker] ?? [], date) : null;
      let close: number | null = market ? market.close : null;
      if (close === null && h.manualPrice !== undefined && h.manualPriceDate !== undefined && h.manualPriceDate <= date) {
        close = h.manualPrice;
      }
      // Innehav utan kurs det datumet lämnas utanför både värde och investerat, så att linjerna jämförs lika.
      if (close === null) continue;
      priced++;
      invested += pos.invested;
      value += pos.quantity * close;
    }
    return { date, invested, value: held > 0 && priced === 0 ? null : value };
  });
}

/** Antal innehav på kontot vars värde saknas (ingen kurs). withHoldingValues räknar dem som 0. */
export function missingValues(asset: Asset, rows: HoldingSummary[]): number {
  return rows.filter((r) => r.holding.assetId === asset.id && r.value === null).length;
}

/** Konton med `fromHoldings` får saldot kontanter plus innehavens värden. Övriga returneras oförändrade. */
export function withHoldingValues(assets: Asset[], rows: HoldingSummary[]): Asset[] {
  return assets.map((a) => {
    if (!a.fromHoldings) return a;
    let amount = a.cash ?? 0;
    for (const r of rows) {
      if (r.holding.assetId === a.id) amount += r.value ?? 0;
    }
    return { ...a, amount };
  });
}

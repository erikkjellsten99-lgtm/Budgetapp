import { useEffect, useMemo, useState } from 'react';
import { deleteHolding, deleteTrade, getAssets, newId, saveHoldingWithTrade, saveHolding, saveTrade, today } from './db';
import { formatKr, formatKrOre, formatPct, parseKr, toInputKr } from './money';
import { searchTicker } from './prices';
import { niceStep, shortDate, signedKr } from './chartUtil';
import { longDate, parseQuantity, rangeStart, tradeError, type PriceRange } from './tradeForm';
import { priceOn, type HoldingSummary } from '../supabase/functions/inbox/portfolio.ts';
import type { Asset, Holding, HoldingType, PricePoint, Trade } from './types';

const TYPE_LABEL: Record<HoldingType, string> = { stock: 'Aktie', fund: 'Fond', etf: 'ETF' };
const TYPES: HoldingType[] = ['stock', 'fund', 'etf'];

/** Antal andelar som text, t.ex. "12,3456". */
function qty(n: number): string {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 6 });
}

interface HoldingViewProps {
  row: HoldingSummary;
  trades: Trade[];
  prices: Record<string, PricePoint[]>;
  onBack: () => void;
}

/** Ett innehav: kursgraf, nyckeltal, affärer och knappar. Räknar inte själv, allt kommer från portfolio.ts. */
export default function HoldingView({ row, trades, prices, onBack }: HoldingViewProps) {
  const { holding, position, quote } = row;
  const mine = useMemo(
    () => trades.filter((t) => t.holdingId === holding.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [trades, holding.id],
  );
  // En affär som skrivs eller ändras: side styr köp eller sälj, trade finns bara vid ändring.
  const [form, setForm] = useState<{ side: 'buy' | 'sell'; trade?: Trade } | 'holding' | null>(null);

  if (form === 'holding') {
    return <HoldingForm holding={holding} onDone={() => setForm(null)} />;
  }
  if (form) {
    return (
      <TradeForm
        holding={holding}
        trades={mine}
        side={form.side}
        trade={form.trade}
        onDone={() => setForm(null)}
      />
    );
  }

  const subtitle = [TYPE_LABEL[holding.type], holding.ticker].filter(Boolean).join(', ');
  const points = (holding.ticker && prices[holding.ticker]) || [];
  const firstDate = mine.length > 0 ? mine[mine.length - 1].date : null;

  return (
    <>
      <h2>{holding.name}</h2>
      <p className="hint">{subtitle}</p>

      {points.length === 0 ? (
        holding.ticker ? (
          <p className="hint">Kurserna hämtas.</p>
        ) : (
          <p className="hint">Ingen kurshistorik. Kursen skrivs in för hand.</p>
        )
      ) : (
        <PriceChart points={points} trades={mine} firstDate={firstDate} />
      )}

      <section className="group-block" aria-label="Nyckeltal">
        <div className="group">
          <Row name="Antal" value={qty(position.quantity)} />
          <Row name="GAV" value={position.quantity > 0 ? formatKrOre(position.gav) : '–'} />
          <Row name="Investerat" value={formatKrOre(position.invested)} />
          <p className="group-row">
            <span className="row-main">
              <span className="row-name">Värde</span>
              {quote.date && (
                <span className="row-sub">
                  {quote.price === null ? 'Kurs saknas' : `Kurs ${formatKrOre(quote.price)}`} {shortDate(quote.date)}
                  {quote.source === 'manual' ? ', egen kurs' : ''}
                  {quote.stale ? ', gammal kurs' : ''}
                </span>
              )}
            </span>
            <span className="row-value">{row.value === null ? 'Värde saknas' : formatKrOre(row.value)}</span>
          </p>
          <p className="group-row">
            <span className="row-main">
              <span className="row-name">Utveckling</span>
              {row.changePct !== null && <span className="row-sub">{formatPct(row.changePct)}</span>}
            </span>
            <span className={row.change !== null && row.change < 0 ? 'row-value negative' : 'row-value'}>
              {row.change === null ? 'Värde saknas' : signedKr(row.change)}
            </span>
          </p>
          <p className="group-row">
            <span className="row-name">Realiserat</span>
            <span className={position.realized < 0 ? 'row-value negative' : 'row-value'}>
              {formatKrOre(position.realized)}
            </span>
          </p>
        </div>
      </section>

      <div className="actions holding-actions">
        <button type="button" className="primary" onClick={() => setForm({ side: 'buy' })}>
          + Köp
        </button>
        <button type="button" onClick={() => setForm({ side: 'sell' })}>
          + Sälj
        </button>
      </div>

      <section className="group-block" aria-label="Affärer">
        <div className="group">
          {mine.map((t) => (
            <button
              type="button"
              key={t.id}
              className="group-row"
              onClick={() => setForm({ side: t.side, trade: t })}
            >
              <span className="row-main">
                <span className="row-name">
                  {t.side === 'buy' ? 'Köp' : 'Sälj'} {longDate(t.date)}
                </span>
                <span className="row-sub">
                  {qty(t.quantity)} × {formatKr(t.price)}
                  {t.fee > 0 ? `, courtage ${formatKr(t.fee)}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="actions holding-actions">
        <button type="button" onClick={() => setForm('holding')}>
          Ändra innehav
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (confirm(`Ta bort ${holding.name} och alla affärer?`)) void deleteHolding(holding.id).then(onBack);
          }}
        >
          Ta bort
        </button>
      </div>
    </>
  );
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <p className="group-row">
      <span className="row-name">{name}</span>
      <span className="row-value">{value}</span>
    </p>
  );
}

/** Pris som kort tal på y-axeln, t.ex. "1 250" eller "98,5". */
function priceLabel(v: number): string {
  return v.toLocaleString('sv-SE', { maximumFractionDigits: v >= 100 ? 0 : 2 });
}

/** Kursgraf med växel för period. Köp (cirkel) och sälj (ruta) ligger som prickar på linjen vid sitt datum. */
function PriceChart({ points, trades, firstDate }: { points: PricePoint[]; trades: Trade[]; firstDate: string | null }) {
  const [range, setRange] = useState<PriceRange>('1y');
  const from = rangeStart(range, today(), firstDate);
  const shown = useMemo(() => points.filter((p) => p.date >= from), [points, from]);

  return (
    <figure className="card forecast-chart investments-chart">
      <div className="segmented-row" role="group" aria-label="Period">
        {(
          [
            ['1m', '1 mån'],
            ['1y', '1 år'],
            ['all', 'Sedan köp'],
          ] as [PriceRange, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={range === key ? 'seg active' : 'seg'}
            aria-pressed={range === key}
            onClick={() => setRange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length < 2 ? (
        <p className="hint">Grafen visas när det finns kurser för fler dagar.</p>
      ) : (
        <PriceLine shown={shown} all={points} trades={trades} />
      )}
    </figure>
  );
}

function PriceLine({ shown, all, trades }: { shown: PricePoint[]; all: PricePoint[]; trades: Trade[] }) {
  const W = 340;
  const H = 190;
  const pad = { l: 46, r: 14, t: 14, b: 26 };
  const t0 = Date.parse(`${shown[0].date}T00:00:00Z`);
  const t1 = Date.parse(`${shown[shown.length - 1].date}T00:00:00Z`);
  const lo = Math.min(...shown.map((p) => p.close));
  const hi = Math.max(...shown.map((p) => p.close));
  const step = niceStep(Math.max(hi - lo, hi * 0.02, 0.01));
  const min = Math.floor(lo / step) * step;
  const max = Math.max(Math.ceil(hi / step) * step, min + step);
  const x = (date: string) => pad.l + ((Date.parse(`${date}T00:00:00Z`) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);

  // Affärer inom grafens period, på kursen den dagen
  const marks = trades
    .filter((t) => t.date >= shown[0].date && t.date <= shown[shown.length - 1].date)
    .flatMap((t) => {
      const p = priceOn(all, t.date);
      return p ? [{ trade: t, cx: x(t.date), cy: y(p.close) }] : [];
    });
  const last = shown[shown.length - 1];

  return (
    <>
      <figcaption className="chart-legend">
        <span className="key buy">Köp</span>
        <span className="key sell">Sälj</span>
      </figcaption>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Kurs ${formatKrOre(last.close)} den ${shortDate(last.date)}.`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="lbl">
                {priceLabel(v)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 8} className="lbl">
            {shortDate(shown[0].date)}
          </text>
          <text x={W - pad.r} y={H - 8} textAnchor="end" className="lbl">
            {shortDate(last.date)}
          </text>
          <polyline points={shown.map((p) => `${x(p.date).toFixed(1)},${y(p.close).toFixed(1)}`).join(' ')} className="save-line" />
          {marks.map(({ trade, cx, cy }) =>
            trade.side === 'buy' ? (
              <circle key={trade.id} cx={cx} cy={cy} r={4} className="trade-dot buy" />
            ) : (
              <rect key={trade.id} x={cx - 3.5} y={cy - 3.5} width={7} height={7} className="trade-dot sell" />
            ),
          )}
        </svg>
      </div>
    </>
  );
}

interface TradeFormProps {
  holding: Holding;
  /** Innehavets alla affärer. */
  trades: Trade[];
  side: 'buy' | 'sell';
  /** Finns när en affär ändras. */
  trade?: Trade;
  onDone: () => void;
}

/** Köp eller sälj: datum, antal, kurs och courtage. Spara är avstängt så länge tradeError ger ett fel. */
function TradeForm({ holding, trades, side, trade, onDone }: TradeFormProps) {
  const [id] = useState(() => trade?.id ?? newId());
  const [date, setDate] = useState(trade?.date ?? today());
  const [quantityText, setQuantityText] = useState(trade ? String(trade.quantity).replace('.', ',') : '');
  const [priceText, setPriceText] = useState(toInputKr(trade?.price));
  const [feeText, setFeeText] = useState(toInputKr(trade?.fee));
  const [touched, setTouched] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const draft: Trade = {
    id,
    holdingId: holding.id,
    date,
    side,
    quantity: parseQuantity(quantityText),
    price: parseKr(priceText),
    fee: parseKr(feeText),
  };
  const error = tradeError(trades, draft);
  const edit = (set: (v: string) => void) => (event: { target: { value: string } }) => {
    set(event.target.value);
    setTouched(true);
  };

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (error) return;
        saveTrade(draft).then(onDone, () => setSaveError(true));
      }}
    >
      <h2>
        {trade ? 'Ändra' : 'Ny'} {side === 'buy' ? 'köp' : 'försäljning'} av {holding.name}
      </h2>
      <label>
        Datum
        <input type="date" value={date} onChange={edit(setDate)} />
      </label>
      <label>
        Antal
        <input value={quantityText} onChange={edit(setQuantityText)} inputMode="decimal" placeholder="0" autoFocus />
      </label>
      <label>
        Kurs (kr)
        <input value={priceText} onChange={edit(setPriceText)} inputMode="decimal" placeholder="0" />
      </label>
      <label>
        Courtage (kr)
        <input value={feeText} onChange={edit(setFeeText)} inputMode="decimal" placeholder="0" />
      </label>
      {error && (touched || trade) && <p className="error">{error}</p>}
      {saveError && <p className="error">Det gick inte att spara. Försök igen.</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={error !== null}>
          Spara
        </button>
        <button type="button" onClick={onDone}>
          Avbryt
        </button>
        {trade && (
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirm('Ta bort affären?')) void deleteTrade(trade.id).then(onDone);
            }}
          >
            Ta bort
          </button>
        )}
      </div>
    </form>
  );
}

interface HoldingFormProps {
  /** Finns när ett innehav ändras. Annars skapas ett nytt tillsammans med sitt första köp. */
  holding?: Holding;
  onDone: () => void;
}

/** Nytt eller ändrat innehav: namn, typ, kortnamn (sökning), konto och egen kurs. */
export function HoldingForm({ holding, onDone }: HoldingFormProps) {
  const [id] = useState(() => holding?.id ?? newId());
  const [name, setName] = useState(holding?.name ?? '');
  const [type, setType] = useState<HoldingType>(holding?.type ?? 'stock');
  const [ticker, setTicker] = useState(holding?.ticker ?? '');
  // Sökrutan är bara en sökruta. Kortnamnet ändras när en träff väljs eller när det tas bort.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ ticker: string; name: string; type: HoldingType }[]>([]);
  // 'empty' = sökningen gick men gav inga träffar, 'failed' = den gick inte (utloggad, inget nät)
  const [searched, setSearched] = useState<'empty' | 'failed' | null>(null);
  const [touched, setTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState(holding?.assetId ?? '');
  const [manualText, setManualText] = useState(toInputKr(holding?.manualPrice));
  // Första köpet, bara för ett nytt innehav
  const [tradeId] = useState(newId);
  const [date, setDate] = useState(today());
  const [quantityText, setQuantityText] = useState('');
  const [priceText, setPriceText] = useState('');
  const [feeText, setFeeText] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getAssets().then((all) => {
      if (cancelled) return;
      const own = all.filter((a) => !a.spending);
      setAssets(own);
      if (!holding) {
        const avanza = own.filter((a) => a.name.toLowerCase().includes('avanza'));
        if (avanza.length === 1) setAssetId(avanza[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [holding]);

  // Sök 300 ms efter sista tecknet, från två tecken. Gamla träffar och meddelanden rensas direkt.
  useEffect(() => {
    setResults([]);
    setSearched(null);
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchTicker(q).then((found) => {
        if (cancelled) return;
        if (found === null) {
          setSearched('failed');
        } else {
          setResults(found.slice(0, 8));
          setSearched(found.length === 0 ? 'empty' : null);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const draft: Trade = {
    id: tradeId,
    holdingId: id,
    date,
    side: 'buy',
    quantity: parseQuantity(quantityText),
    price: parseKr(priceText),
    fee: parseKr(feeText),
  };
  const tradeProblem = holding ? null : tradeError([], draft);
  const showManual = ticker === '' && results.length === 0;
  const manual = parseKr(manualText);
  const manualProblem = showManual && manualText.trim() !== '' && !(manual > 0) ? 'Skriv en kurs större än 0.' : null;
  const error = manualProblem ?? tradeProblem;
  const nameOk = name.trim() !== '';
  const valid = nameOk && error === null;

  const save = async () => {
    const saved: Holding = { id, name: name.trim(), type };
    if (ticker) saved.ticker = ticker;
    if (assetId) saved.assetId = assetId;
    if (showManual) {
      if (manualText.trim() !== '') {
        saved.manualPrice = manual;
        saved.manualPriceDate = manual === holding?.manualPrice ? (holding.manualPriceDate ?? today()) : today();
      }
    } else if (holding) {
      // Kursen rörs inte när kortnamnet gäller
      if (holding.manualPrice !== undefined) saved.manualPrice = holding.manualPrice;
      if (holding.manualPriceDate !== undefined) saved.manualPriceDate = holding.manualPriceDate;
    }
    try {
      if (holding) await saveHolding(saved);
      else await saveHoldingWithTrade(saved, draft);
    } catch {
      setSaveError(true);
      return;
    }
    onDone();
  };

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void save();
      }}
    >
      <h2>{holding ? 'Ändra innehav' : 'Nytt innehav'}</h2>
      {ticker !== '' && (
        <div className="ticker-chosen">
          <span>Kortnamn: {ticker}</span>
          <button type="button" onClick={() => setTicker('')}>
            Ta bort kortnamn
          </button>
        </div>
      )}
      <label>
        {ticker === '' ? 'Sök kortnamn' : 'Sök ett annat kortnamn'}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök på namn eller kortnamn"
          autoFocus={!holding}
        />
      </label>
      {results.length > 0 && (
        <div className="group">
          {results.map((r) => (
            <button
              type="button"
              key={r.ticker}
              className="group-row"
              onClick={() => {
                setName(r.name);
                setType(r.type);
                setTicker(r.ticker);
                setQuery('');
              }}
            >
              <span className="row-main">
                <span className="row-name">{r.name}</span>
                <span className="row-sub">
                  {r.ticker}, {TYPE_LABEL[r.type]}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {searched === 'empty' && <p className="hint">Hittade inget hos Yahoo. Skriv in kursen själva.</p>}
      {searched === 'failed' && (
        <p className="hint">Sökningen fungerar bara när du är inloggad och har nät. Skriv in kursen själva.</p>
      )}
      <label>
        Namn
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setNameTouched(true);
          }}
        />
      </label>
      {nameTouched && !nameOk && <p className="error">Skriv ett namn.</p>}
      <label>
        Typ
        <select value={type} onChange={(event) => setType(event.target.value as HoldingType)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Konto
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
          <option value="">Inget konto</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {showManual && (
        <label>
          Egen kurs (kr)
          <input
            value={manualText}
            onChange={(event) => {
              setManualText(event.target.value);
              setTouched(true);
            }}
            inputMode="decimal"
            placeholder="0"
          />
        </label>
      )}
      {!holding && (
        <>
          <h3>Första köpet</h3>
          <label>
            Datum
            <input type="date" value={date} onChange={(event) => {
                setDate(event.target.value);
                setTouched(true);
              }}
            />
          </label>
          <label>
            Antal
            <input
              value={quantityText}
              onChange={(event) => {
                setQuantityText(event.target.value);
                setTouched(true);
              }}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
          <label>
            Kurs (kr)
            <input
              value={priceText}
              onChange={(event) => {
                setPriceText(event.target.value);
                setTouched(true);
              }}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
          <label>
            Courtage (kr)
            <input
              value={feeText}
              onChange={(event) => {
                setFeeText(event.target.value);
                setTouched(true);
              }}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
        </>
      )}
      {error && touched && <p className="error">{error}</p>}
      {saveError && <p className="error">Det gick inte att spara. Försök igen.</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={!valid}>
          Spara
        </button>
        <button type="button" onClick={onDone}>
          Avbryt
        </button>
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { deleteAsset, getAssets, newId, saveAsset, today, onDataChange } from './db';
import { formatKrOre, parseKr, toInputKr } from './money';
import { missingValues, withHoldingValues, type HoldingSummary } from '../supabase/functions/inbox/portfolio.ts';
import type { Asset } from './types';

interface AssetsProps {
  /** Får alla tillgångar varje gång de har lästs in. */
  onChange: (assets: Asset[]) => void;
  /** Innehaven, för konton vars värde räknas från dem. */
  rows: HoldingSummary[];
}

/** Tillgångar, t.ex. Avanza-kontot. Saldot skriver du in själv när du vill. */
export default function Assets({ onChange, rows }: AssetsProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  // Id på tillgången som redigeras, 'new' när en ny läggs till, annars null.
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    const loaded = await getAssets();
    setAssets(loaded);
    onChange(loaded);
  }

  useEffect(() => {
    reload();
    // Hämta igen när synken har tagit emot ändringar från den andra telefonen.
    return onDataChange((kind) => kind === 'remote' && reload());
  }, []);

  async function handleSave(asset: Asset) {
    await saveAsset(asset);
    setEditing(null);
    await reload();
  }

  async function handleDelete(asset: Asset) {
    if (!confirm(`Ta bort ${asset.name}?`)) return;
    await deleteAsset(asset.id);
    setEditing(null);
    await reload();
  }

  const sorted = [...assets].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  // Konton som räknas från innehaven visas med det uträknade värdet (App använder samma uträkning).
  const valued = withHoldingValues(assets, rows);
  const shown = new Map(valued.map((asset) => [asset.id, asset.amount]));
  const missing = new Map(assets.map((asset) => [asset.id, missingValues(asset, rows)]));
  const total = valued
    .filter((asset) => !asset.spending)
    .reduce((sum, asset) => sum + asset.amount, 0);

  return (
    <>
      <h2>Tillgångar</h2>
      <p className="hint">Skriv av saldona från banken och Avanza när du vill, t.ex. en gång i månaden.</p>
      <section className="card">
        <h3>
          Totalt <span>{formatKrOre(total)}</span>
        </h3>
        <ul>
          {sorted.map((asset) => (
            <li key={asset.id}>
              {editing === asset.id ? (
                <AssetForm
                  asset={asset}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                  onDelete={() => handleDelete(asset)}
                />
              ) : (
                <button className="row" onClick={() => setEditing(asset.id)}>
                  <span>
                    {asset.name}
                    <small className="updated">
                      {asset.fromHoldings
                        ? missing.get(asset.id)
                          ? `Från innehaven, värde saknas för ${missing.get(asset.id)} innehav`
                          : 'Från innehaven'
                        : asset.updated
                          ? `Uppdaterat ${formatDate(asset.updated)}`
                          : 'Inte ifyllt än'}
                      {asset.spending && ' · räknas inte i nettovärdet'}
                    </small>
                  </span>
                  <span>{formatKrOre(shown.get(asset.id) ?? asset.amount)}</span>
                </button>
              )}
            </li>
          ))}
          {editing === 'new' && (
            <li>
              <AssetForm onSave={handleSave} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
      </section>
      {editing !== 'new' && (
        <button className="add" onClick={() => setEditing('new')}>
          + Ny tillgång
        </button>
      )}
    </>
  );
}

/** "2026-10-18" → "18 okt. 2026". */
function formatDate(date: string): string {
  return new Date(`${date}T12:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface AssetFormProps {
  /** Tillgången som ändras. Saknas när en ny läggs till. */
  asset?: Asset;
  onSave: (asset: Asset) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function AssetForm({ asset, onSave, onCancel, onDelete }: AssetFormProps) {
  const [name, setName] = useState(asset?.name ?? '');
  const [amountText, setAmountText] = useState(toInputKr(asset?.amount));
  const [spending, setSpending] = useState(asset?.spending ?? false);

  const [fromHoldings, setFromHoldings] = useState(asset?.fromHoldings ?? false);
  const [cashText, setCashText] = useState(toInputKr(asset?.cash));

  const amount = parseKr(amountText);
  const cash = parseKr(cashText);
  const amountOk = fromHoldings ? Number.isFinite(cash) && cash >= 0 : Number.isFinite(amount) && amount >= 0;
  const valid = name.trim() !== '' && amountOk;

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        if (fromHoldings) {
          // Saldot och datumet rörs inte: värdet räknas från innehaven, kontanterna sparas för sig.
          onSave({
            ...asset,
            id: asset?.id ?? newId(),
            name: name.trim(),
            amount: asset?.amount ?? 0,
            updated: asset?.updated ?? '',
            spending,
            fromHoldings: true,
            cash,
          });
        } else {
          const saved: Asset = { id: asset?.id ?? newId(), name: name.trim(), amount, updated: today(), spending };
          // Kontanterna behålls om kryssrutan har varit ikryssad tidigare.
          if (asset?.cash !== undefined) saved.cash = asset.cash;
          if (asset?.fromHoldings !== undefined) saved.fromHoldings = false;
          onSave(saved);
        }
      }}
    >
      <label>
        Namn
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus={!asset} />
      </label>
      <label>
        {fromHoldings ? 'Kontanter (kr)' : 'Saldo idag (kr)'}
        <input
          value={fromHoldings ? cashText : amountText}
          onChange={(event) => (fromHoldings ? setCashText : setAmountText)(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoFocus={!!asset}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={spending} onChange={(event) => {
            setSpending(event.target.checked);
            if (event.target.checked) setFromHoldings(false);
          }} />
        Pengar att använda, t.ex. matpengar (räknas inte i nettovärdet)
      </label>
      {!spending && (
        <label className="checkbox">
          <input type="checkbox" checked={fromHoldings} onChange={(event) => setFromHoldings(event.target.checked)} />
          Värdet räknas från innehaven
        </label>
      )}
      {!amountOk && <p className="error">Skriv ett belopp, till exempel 25000 eller 49,90.</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={!valid}>
          Spara
        </button>
        <button type="button" onClick={onCancel}>
          Avbryt
        </button>
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            Ta bort
          </button>
        )}
      </div>
    </form>
  );
}

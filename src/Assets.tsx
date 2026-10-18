import { useEffect, useState } from 'react';
import { deleteAsset, getAssets, newId, saveAsset, today } from './db';
import { formatKr, parseKr, toInputKr } from './money';
import type { Asset } from './types';

interface AssetsProps {
  /** Får alla tillgångar varje gång de har lästs in. */
  onChange: (assets: Asset[]) => void;
}

/** Tillgångar, t.ex. Avanza-kontot. Saldot skriver du in själv när du vill. */
export default function Assets({ onChange }: AssetsProps) {
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
  const total = assets.reduce((sum, asset) => sum + asset.amount, 0);

  return (
    <>
      <h2>Tillgångar</h2>
      <p className="hint">Skriv av saldona från banken och Avanza när du vill, t.ex. en gång i månaden.</p>
      <section className="card">
        <h3>
          Totalt <span>{formatKr(total)}</span>
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
                      {asset.updated ? `Uppdaterat ${formatDate(asset.updated)}` : 'Inte ifyllt än'}
                      {asset.spending && ' · räknas inte i nettovärdet'}
                    </small>
                  </span>
                  <span>{formatKr(asset.amount)}</span>
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

  const amount = parseKr(amountText);
  const amountOk = Number.isFinite(amount) && amount >= 0;
  const valid = name.trim() !== '' && amountOk;

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave({ id: asset?.id ?? newId(), name: name.trim(), amount, updated: today(), spending });
      }}
    >
      <label>
        Namn
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus={!asset} />
      </label>
      <label>
        Saldo idag (kr)
        <input
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoFocus={!!asset}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={spending} onChange={(event) => setSpending(event.target.checked)} />
        Pengar att använda, t.ex. matpengar (räknas inte i nettovärdet)
      </label>
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

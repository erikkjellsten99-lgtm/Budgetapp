import { useEffect, useState } from 'react';
import { deleteDebt, getDebts, newId, saveDebt } from './db';
import { formatKr, parseKr, toInputKr } from './money';
import type { Debt } from './types';

/** Skulder: vem du är skyldig och hur mycket som är kvar. */
export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  // Id på skulden som redigeras, 'new' när en ny läggs till, annars null.
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    setDebts(await getDebts());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSave(debt: Debt) {
    await saveDebt(debt);
    setEditing(null);
    await reload();
  }

  async function handleDelete(debt: Debt) {
    if (!confirm(`Ta bort skulden till ${debt.name}?`)) return;
    await deleteDebt(debt.id);
    setEditing(null);
    await reload();
  }

  const sorted = [...debts].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const total = debts.reduce((sum, debt) => sum + debt.amount, 0);

  return (
    <>
      <h2>Skulder</h2>
      <section className="card">
        <h3>
          Kvar att betala <span>{formatKr(total)}</span>
        </h3>
        <ul>
          {sorted.map((debt) => (
            <li key={debt.id}>
              {editing === debt.id ? (
                <DebtForm
                  debt={debt}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                  onDelete={() => handleDelete(debt)}
                />
              ) : (
                <button className="row" onClick={() => setEditing(debt.id)}>
                  <span>{debt.name}</span>
                  <span>{formatKr(debt.amount)}</span>
                </button>
              )}
            </li>
          ))}
          {editing === 'new' && (
            <li>
              <DebtForm onSave={handleSave} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
      </section>
      {editing !== 'new' && (
        <button className="add" onClick={() => setEditing('new')}>
          + Ny skuld
        </button>
      )}
    </>
  );
}

interface DebtFormProps {
  /** Skulden som ändras. Saknas när en ny läggs till. */
  debt?: Debt;
  onSave: (debt: Debt) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function DebtForm({ debt, onSave, onCancel, onDelete }: DebtFormProps) {
  const [name, setName] = useState(debt?.name ?? '');
  const [amountText, setAmountText] = useState(toInputKr(debt?.amount));

  const amount = parseKr(amountText);
  const amountOk = Number.isFinite(amount) && amount >= 0;
  const valid = name.trim() !== '' && amountOk;

  return (
    <form
      className="category-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave({ id: debt?.id ?? newId(), name: name.trim(), amount });
      }}
    >
      <label>
        Vem är du skyldig?
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus={!debt} />
      </label>
      <label>
        Kvar att betala (kr)
        <input
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
      </label>
      {!amountOk && <p className="error">Skriv ett belopp, till exempel 1000 eller 49,90.</p>}
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

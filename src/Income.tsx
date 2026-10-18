import { useState } from 'react';
import { saveIncome } from './db';
import { formatKr, parseKr, toInputKr } from './money';
import type { MonthlyIncome } from './types';

interface IncomeProps {
  income: MonthlyIncome;
  onChanged: () => Promise<void>;
}

/** Månadens inkomst: CSN och övrigt (t.ex. lön). */
export default function Income({ income, onChanged }: IncomeProps) {
  const [editing, setEditing] = useState(false);
  const [csn, setCsn] = useState('');
  const [other, setOther] = useState('');

  const csnAmount = parseKr(csn);
  const otherAmount = parseKr(other);
  const valid = [csnAmount, otherAmount].every((amount) => Number.isFinite(amount) && amount >= 0);

  function startEditing() {
    setCsn(toInputKr(income.csn));
    setOther(toInputKr(income.other));
    setEditing(true);
  }

  return (
    <section className="card">
      <h3>
        Inkomst {income.month} <span>{formatKr(income.csn + income.other)}</span>
      </h3>
      {editing ? (
        <form
          className="category-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!valid) return;
            await saveIncome({ month: income.month, csn: csnAmount, other: otherAmount });
            setEditing(false);
            await onChanged();
          }}
        >
          <label>
            CSN (kr)
            <input value={csn} onChange={(event) => setCsn(event.target.value)} inputMode="decimal" placeholder="0" />
          </label>
          <label>
            Övrigt, t.ex. lön (kr)
            <input value={other} onChange={(event) => setOther(event.target.value)} inputMode="decimal" placeholder="0" />
          </label>
          {!valid && <p className="error">Skriv belopp, till exempel 18156 eller 49,90.</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={!valid}>
              Spara
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Avbryt
            </button>
          </div>
        </form>
      ) : (
        <ul>
          <li>
            <button className="row" onClick={startEditing}>
              <span>CSN</span>
              <span>{formatKr(income.csn)}</span>
            </button>
          </li>
          <li>
            <button className="row" onClick={startEditing}>
              <span>Övrigt</span>
              <span>{formatKr(income.other)}</span>
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}

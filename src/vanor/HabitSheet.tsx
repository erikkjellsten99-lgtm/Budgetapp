import { useEffect, useRef, useState } from 'react';
import ManageHabits from './ManageHabits';
import PushSettings from './PushSettings';
import ThemePicker from '../ThemePicker';
import { START_HABITS } from './defaults';
import { todayKey } from './dates';
import type { Habit } from './habits';
import { importHabits, newId } from './store';
import { parseTransfer } from './transfer';

interface Props {
  /** Alla vanor, även borttagna. */
  habits: Habit[];
  onClose: () => void;
}

/** Hantera vanor: lägg till, ändra, ta bort, startpaket och flytt från gamla appen. Glider upp nerifrån. */
export default function HabitSheet({ habits, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const empty = !habits.some((h) => !h.archived);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="habit-sheet-title">
        <div className="sheet-head">
          <h2 id="habit-sheet-title">Mina vanor</h2>
          <button ref={closeRef} type="button" className="primary" onClick={onClose}>
            Klar
          </button>
        </div>

        {!empty && <PushSettings habits={habits} />}
        <ImportFromOldApp />
        {empty && <StartPack />}
        <ManageHabits all={habits} />
        <div className="theme-in-sheet">
          <ThemePicker />
        </div>
      </div>
    </div>
  );
}

function StartPack() {
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    const today = todayKey();
    const ids = new Map(START_HABITS.map((t) => [t.name, newId()]));
    await importHabits({
      habits: START_HABITS.map((t, order) => ({
        id: ids.get(t.name)!,
        name: t.name,
        goal: t.goal,
        created: today,
        after: (t.after ?? []).map((name) => ids.get(name)!),
        order,
        archived: false,
        ...(t.minimum ? { minimum: t.minimum } : {}),
      })),
      checks: [],
      pauses: [],
    });
    setBusy(false);
  }
  return (
    <section className="start-pack">
      <h3>Startpaket</h3>
      <p className="hint">{START_HABITS.map((t) => t.name).join(', ')}.</p>
      <button type="button" className="primary" disabled={busy} onClick={add}>
        Lägg in startpaketet
      </button>
    </section>
  );
}

/** Klistra in flyttkoden från den gamla vanetrackern. */
function ImportFromOldApp() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    try {
      const data = parseTransfer(code);
      setBusy(true);
      const added = await importHabits(data);
      setResult(
        added.habits || added.checks
          ? `Klart! ${added.habits} ${added.habits === 1 ? 'vana' : 'vanor'} och ${added.checks} ${added.checks === 1 ? 'bockning' : 'bockningar'} flyttades.`
          : 'Allt i koden fanns redan här. Inget behövde flyttas.',
      );
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="import-open" onClick={() => setOpen(true)}>
        <b>Flytta från gamla vanetrackern</b>
        <span>Ta med dina vanor och bockningar hit</span>
      </button>
    );
  }

  return (
    <section className="import-box">
      <h3>Flytta från gamla vanetrackern</h3>
      <ol className="steps">
        <li>Öppna den gamla vanetrackern och tryck på knappen uppe till höger.</li>
        <li>Tryck <b>Kopiera flyttkod</b> längst ned.</li>
        <li>Kom tillbaka hit och klistra in koden nedan.</li>
      </ol>
      <form className="habit-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Flyttkod</span>
          <textarea
            id="import-code"
            rows={3}
            value={code}
            placeholder="VANOR1:…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
              setResult('');
            }}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="field-ok" role="status">
            {result}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy || !code.trim()}>
            Flytta hit
          </button>
          <button type="button" className="text-btn" onClick={() => setOpen(false)}>
            Stäng
          </button>
        </div>
      </form>
    </section>
  );
}

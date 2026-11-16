import { useEffect, useRef, useState } from 'react';
import ManageHabits from './ManageHabits';
import PushSettings from './PushSettings';
import InboxSettings from './InboxSettings';
import ThemePicker from '../ThemePicker';
import { START_HABITS } from './defaults';
import { todayKey } from './dates';
import type { Habit } from './habits';
import { parseHealthFile } from './healthImport';
import type { ImportDay } from './appleExport';
import { importHabits, importHealthDays, newId } from './store';
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
        {!empty && <InboxSettings />}
        <ImportFromOldApp />
        <ImportHealthFile />
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

const count = (n: number) => n.toLocaleString('sv-SE');
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

/** Läs in historiken från Apple Hälsa ur en fil (groundwork-halsa.json, se scripts/halsa-export.ts). */
function ImportHealthFile() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<ImportDay[] | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function choose(file: File | undefined) {
    setError('');
    setResult('');
    setDays(null);
    if (!file) return;
    try {
      setDays(parseHealthFile(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !days) return;
    setError('');
    setBusy(true);
    try {
      const added = await importHealthDays(days);
      setResult(
        added.values
          ? `Klart! ${plural(added.newDays, 'ny dag', 'nya dagar')} och ${plural(added.filledDays, 'kompletterad dag', 'kompletterade dagar')} (${plural(added.values, 'värde', 'värden')}). Det som redan fanns är orört.`
          : 'Allt i filen fanns redan här. Inget behövde läggas in.',
      );
      setDays(null);
    } catch {
      setError('Det gick inte att spara. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="import-open" onClick={() => setOpen(true)}>
        <b>Importera från Apple Hälsa</b>
        <span>Läs in din historik från en fil</span>
      </button>
    );
  }

  return (
    <section className="import-box">
      <h3>Importera från Apple Hälsa</h3>
      <ol className="steps">
        <li>
          Öppna <b>Hälsa</b>, tryck på din bild uppe till höger och välj <b>Exportera all hälsodata</b>.
        </li>
        <li>
          Gör om exporten till filen <b>groundwork-halsa.json</b> på datorn (skriptet <code>scripts/halsa-export.ts</code>).
        </li>
        <li>Välj filen nedan. Dagar och mått som saknas fylls i. Det som redan finns ändras inte.</li>
      </ol>
      <form className="habit-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Hälsofil</span>
          <input
            id="health-file"
            type="file"
            accept=".json,application/json"
            aria-invalid={!!error}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
        {days && (
          <p className="field-help" role="status">
            Filen har {plural(days.length, 'dag', 'dagar')}, {days[0].date} – {days[days.length - 1].date}.
          </p>
        )}
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
          <button type="submit" className="primary" disabled={busy || !days}>
            {busy ? 'Läser in …' : 'Läs in'}
          </button>
          <button type="button" className="text-btn" onClick={() => setOpen(false)}>
            Stäng
          </button>
        </div>
      </form>
    </section>
  );
}
